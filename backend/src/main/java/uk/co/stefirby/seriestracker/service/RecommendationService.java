package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.client.TmdbKeyword;
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Backs {@code GET /api/v1/series/recommendations}. Sources candidates from TMDB using
 * either an automatic "watched" pool of the user's own {@code COMPLETED} series or an
 * explicitly directed selection (specific series, and/or genre/keyword independent of watch
 * history), ranks them by a blend of TMDB's own rating and the source series' {@code
 * personalRating}, applies a set of output-quality filters and a per-source diversity cap,
 * then filters out anything already added or already ignored and deduplicates. See
 * {@code series_spec_006_recommendations.md} and {@code
 * series_spec_007_recommendation_sourcing.md} for the full design rationale.
 */
@Service
public class RecommendationService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationService.class);

    /**
     * Default for {@code maxSourcesShown} when {@link RecommendationCriteria#getMaxSourcesShown()}
     * is unset (SERIES-015-AC-13).
     */
    private static final int DEFAULT_MAX_SOURCES_SHOWN = 3;

    private final TmdbClient tmdbClient;
    private final RecommendationCriteriaValidator criteriaValidator;
    private final RecommendationSourcingService sourcingService;
    private final RecommendationDeduplicationService deduplicationService;
    private final RecommendationOutputFilterService outputFilterService;
    private final RecommendationRankingService rankingService;

    /**
     * Upper bound on the combined raw candidate pool before {@code external_ids} is resolved
     * for each one (SERIES-007-AC-02, superseding the previously hardcoded {@code
     * TMDB_MAX_CANDIDATES = 50}).
     */
    private final int maxCandidates;

    /**
     * Default upper bound on how many recommendations can come from any single source series
     * in "Specific Series" mode's diversity cap ({@link RecommendationRankingService#applyDiversityCap}),
     * used when {@link RecommendationCriteria#getMaxPerSource()} is unset (SERIES-007-AC-22,
     * superseding the previously hardcoded {@code DEFAULT_MAX_PER_SOURCE = 3}).
     */
    private final int maxPerSource;

    private final RecommendationDtoAssembler dtoAssembler;

    public RecommendationService(TmdbClient tmdbClient,
                                  RecommendationCriteriaValidator criteriaValidator,
                                  RecommendationSourcingService sourcingService,
                                  RecommendationDeduplicationService deduplicationService,
                                  RecommendationOutputFilterService outputFilterService,
                                  RecommendationRankingService rankingService,
                                  RecommendationDtoAssembler dtoAssembler,
                                  @Value("${app.tmdb.max-candidates:50}") int maxCandidates,
                                  @Value("${app.tmdb.max-per-source:8}") int maxPerSource) {
        this.tmdbClient = tmdbClient;
        this.criteriaValidator = criteriaValidator;
        this.sourcingService = sourcingService;
        this.deduplicationService = deduplicationService;
        this.outputFilterService = outputFilterService;
        this.rankingService = rankingService;
        this.dtoAssembler = dtoAssembler;
        this.maxCandidates = maxCandidates;
        this.maxPerSource = maxPerSource;
    }

    /** Convenience overload -- equivalent to {@code recommend(limit, new RecommendationCriteria())}. */
    @Transactional(readOnly = true)
    public List<RecommendationDto> recommend(int limit) {
        return doRecommend(limit, new RecommendationCriteria());
    }

    @Transactional(readOnly = true)
    public List<RecommendationDto> recommend(int limit, RecommendationCriteria criteria) {
        return doRecommend(limit, criteria);
    }

    /**
     * Shared implementation for both {@link #recommend(int)} and {@link #recommend(int,
     * RecommendationCriteria)} -- kept private (not itself {@code @Transactional}) so neither
     * public overload calls the other via {@code this}, which would bypass Spring's
     * transactional proxy (java:S6809).
     */
    private List<RecommendationDto> doRecommend(int limit, RecommendationCriteria criteria) {
        criteriaValidator.validate(criteria);

        boolean trendingMode = "trending".equals(criteria.getSourceMode());
        boolean topRatedMode = RecommendationDefaults.SOURCE_MODE_TOP_RATED.equals(criteria.getSourceMode());
        boolean genreOrKeywordDirected = criteria.isDirectedByGenreOrKeyword();

        List<RawCandidate> raw;
        if (trendingMode) {
            raw = sourcingService.sourceTrending(criteria);
        } else if (topRatedMode) {
            raw = sourcingService.sourceTopRated(criteria);
        } else if (genreOrKeywordDirected) {
            raw = sourcingService.sourceByGenreOrKeyword(criteria);
        } else {
            raw = sourcingService.sourceFromPool(criteria, limit);
        }

        List<RawCandidate> capped = raw.size() > maxCandidates
            ? raw.subList(0, maxCandidates)
            : raw;

        List<DedupedCandidate> deduped = deduplicationService.dedupeAndExclude(capped);
        List<DedupedCandidate> filtered = outputFilterService.applyOutputFilters(deduped, criteria);

        if (trendingMode || topRatedMode || genreOrKeywordDirected) {
            // SERIES-022-AC-08 (trending), generalized by SERIES-025-AC-07 to topRated and
            // genre/keyword-directed sourcing: none of the three ever link a candidate to a
            // source series, so Requirement 7's ranking/diversity-cap step is a full no-op for
            // them (rankScore always equals tmdbRating, and the diversity cap never caps a
            // candidate with no contributing sources -- SERIES-015-AC-15). Rather than run that
            // no-op and silently discard TMDB's own (now sort_by-driven) order, these three
            // modes keep TMDB's own returned order. Output filters still run above, unaffected.
            int effectiveMaxSourcesShown = criteria.getMaxSourcesShown() != null
                ? criteria.getMaxSourcesShown() : DEFAULT_MAX_SOURCES_SHOWN;
            return filtered.stream()
                .map(dc -> dtoAssembler.toDto(dc, effectiveMaxSourcesShown))
                .limit(limit)
                .toList();
        }

        int effectiveMaxSourcesShown = criteria.getMaxSourcesShown() != null
            ? criteria.getMaxSourcesShown() : DEFAULT_MAX_SOURCES_SHOWN;

        List<ScoredCandidate> ranked = filtered.stream()
            .map(dc -> rankingService.score(dc, effectiveMaxSourcesShown))
            .sorted(rankingService.resolveSortComparator(criteria))
            .toList();

        int effectiveMaxPerSource = criteria.getMaxPerSource() != null ? criteria.getMaxPerSource() : maxPerSource;
        List<ScoredCandidate> diversified = rankingService.applyDiversityCap(ranked, effectiveMaxPerSource);

        return diversified.stream()
            .map(ScoredCandidate::dto)
            .limit(limit)
            .toList();
    }

    /**
     * Backs {@code GET /api/v1/series/recommendations/{tmdbId}/keywords} (SERIES-023-AC-04/05):
     * an on-demand, single-candidate keyword lookup, deliberately not folded into {@link
     * #recommend(int, RecommendationCriteria)} itself -- fetching keywords for every card in a
     * 10-20-result list would cost a TMDB call per card the user never asked to expand (see
     * {@code series_spec_023_recommendation_metadata_and_overview.md}'s Overview). A TMDB
     * failure or an unresolvable {@code tmdbId} both yield an empty list, never an exception
     * (SERIES-023-AC-06) -- there's no persisted entity here for a "leave unchanged" posture to
     * apply to, so this is simply "no keywords available right now".
     */
    @Transactional(readOnly = true)
    public List<String> getKeywordsForCandidate(int tmdbId) {
        try {
            return tmdbClient.showKeywords(tmdbId).stream()
                .map(TmdbKeyword::name)
                .toList();
        } catch (ExternalServiceException e) {
            log.info("TMDB keywords unavailable for tmdbId={}: {}", tmdbId, e.getMessage());
            return List.of();
        }
    }
}
