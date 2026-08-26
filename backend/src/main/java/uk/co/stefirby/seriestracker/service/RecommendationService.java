package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.client.TmdbKeyword;
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    /**
     * Upper bound on the combined raw candidate pool before {@code external_ids} is resolved
     * for each one (SERIES-007-AC-02, superseding the previously hardcoded {@code
     * TMDB_MAX_CANDIDATES = 50}).
     */
    private final int maxCandidates;

    /**
     * Selects the {@link #applyDiversityCap} strategy (SERIES-015-AC-14): {@code "best-source"}
     * (default) caps on each candidate's single best contributing source only; {@code
     * "all-sources"} caps on every contributing source. Any value other than exactly {@code
     * "all-sources"} is treated as {@code "best-source"} -- no startup validation/rejection of
     * an unrecognized value (SERIES-015-AC-18).
     */
    private final String diversityCapMode;

    /**
     * Default upper bound on how many recommendations can come from any single source series
     * in "Specific Series" mode's diversity cap ({@link #applyDiversityCap}), used when {@link
     * RecommendationCriteria#getMaxPerSource()} is unset (SERIES-007-AC-22, superseding the
     * previously hardcoded {@code DEFAULT_MAX_PER_SOURCE = 3}).
     */
    private final int maxPerSource;

    private final RecommendationDtoAssembler dtoAssembler;

    public RecommendationService(TmdbClient tmdbClient,
                                  RecommendationCriteriaValidator criteriaValidator,
                                  RecommendationSourcingService sourcingService,
                                  RecommendationDeduplicationService deduplicationService,
                                  RecommendationOutputFilterService outputFilterService,
                                  RecommendationDtoAssembler dtoAssembler,
                                  @Value("${app.tmdb.max-candidates:50}") int maxCandidates,
                                  @Value("${app.recommendations.diversity-cap-mode:best-source}") String diversityCapMode,
                                  @Value("${app.tmdb.max-per-source:8}") int maxPerSource) {
        this.tmdbClient = tmdbClient;
        this.criteriaValidator = criteriaValidator;
        this.sourcingService = sourcingService;
        this.deduplicationService = deduplicationService;
        this.outputFilterService = outputFilterService;
        this.dtoAssembler = dtoAssembler;
        this.maxCandidates = maxCandidates;
        this.diversityCapMode = diversityCapMode;
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
            .map(dc -> score(dc, effectiveMaxSourcesShown))
            .sorted(resolveSortComparator(criteria))
            .toList();

        int effectiveMaxPerSource = criteria.getMaxPerSource() != null ? criteria.getMaxPerSource() : maxPerSource;
        List<ScoredCandidate> diversified = applyDiversityCap(ranked, effectiveMaxPerSource);

        return diversified.stream()
            .map(ScoredCandidate::dto)
            .limit(limit)
            .toList();
    }

    // -- Requirement 7: output ranking & diversity cap (SERIES-007-AC-21/22) --

    private ScoredCandidate score(DedupedCandidate dc, int effectiveMaxSourcesShown) {
        double tmdbRating = dc.candidate().voteAverage() != null ? dc.candidate().voteAverage().doubleValue() : 0.0;
        RecommendationDto dto = dtoAssembler.toDto(dc, effectiveMaxSourcesShown);

        double rankScore;
        if (!dc.sourceSeries().isEmpty()) {
            // SERIES-015-AC-07: the max personalRating across all contributing sources --
            // equivalently the first entry's personalRating under the canonical ordering
            // (SERIES-015-AC-05), since that ordering is personalRating-descending.
            Integer maxPersonalRating = dc.sourceSeries().getFirst().getPersonalRating();
            double personalRatingTerm = maxPersonalRating != null ? maxPersonalRating * 2 : 0;
            rankScore = (tmdbRating * 0.5) + (personalRatingTerm * 0.5);
        } else {
            rankScore = tmdbRating;
        }

        List<String> allSourceTitles = dc.sourceSeries().stream()
            .map(SeriesEntity::getTitle)
            .toList();
        return new ScoredCandidate(dto, rankScore, allSourceTitles);
    }

    /**
     * Branches the ranking sort on {@link RecommendationCriteria#getSortBy()}
     * (SERIES-015-AC-19/20/21): {@code "score"} (default) sorts by {@code rankScore}
     * descending; {@code "recommendationCount"} sorts by {@code totalSourceCount} descending,
     * with {@code rankScore} descending as a tiebreaker. Any other value falls back to {@code
     * "score"}.
     */
    private Comparator<ScoredCandidate> resolveSortComparator(RecommendationCriteria c) {
        if ("recommendationCount".equals(c.getSortBy())) {
            return Comparator
                .comparingInt((ScoredCandidate sc) -> sc.dto().totalSourceCount())
                .thenComparingDouble(ScoredCandidate::rankScore)
                .reversed();
        }
        return Comparator.comparingDouble(ScoredCandidate::rankScore).reversed();
    }

    /**
     * SERIES-015-AC-15/16/17/18: either mode never caps a candidate with no contributing
     * sources. {@code "best-source"} (default, and the fallback for any unrecognized {@link
     * #diversityCapMode} value) checks/increments only the candidate's best contributing
     * source (the first entry under the canonical ordering); {@code "all-sources"}
     * checks/increments every contributing source.
     */
    private List<ScoredCandidate> applyDiversityCap(List<ScoredCandidate> ranked, int maxPerSource) {
        boolean allSourcesMode = "all-sources".equals(diversityCapMode);
        Map<String, Integer> perSourceCount = new HashMap<>();
        List<ScoredCandidate> result = new ArrayList<>();
        for (ScoredCandidate sc : ranked) {
            if (admitsCandidate(sc, allSourcesMode, perSourceCount, maxPerSource)) {
                result.add(sc);
            }
        }
        return result;
    }

    /**
     * Decides whether {@code sc} stays under the diversity cap, incrementing {@code
     * perSourceCount} as a side effect when it does -- extracted from {@link
     * #applyDiversityCap}'s loop to keep the two mode branches (java:S3776) out of the loop
     * body itself.
     */
    private boolean admitsCandidate(ScoredCandidate sc, boolean allSourcesMode,
                                     Map<String, Integer> perSourceCount, int maxPerSource) {
        List<String> sourceTitles = sc.allSourceTitles();
        if (sourceTitles.isEmpty()) {
            return true;
        }
        return allSourcesMode
            ? admitAllSources(sourceTitles, perSourceCount, maxPerSource)
            : admitBestSource(sourceTitles, perSourceCount, maxPerSource);
    }

    private boolean admitAllSources(List<String> sourceTitles, Map<String, Integer> perSourceCount, int maxPerSource) {
        boolean anySourceAtCap = sourceTitles.stream()
            .anyMatch(title -> perSourceCount.getOrDefault(title, 0) >= maxPerSource);
        if (anySourceAtCap) {
            return false;
        }
        for (String title : sourceTitles) {
            perSourceCount.merge(title, 1, Integer::sum);
        }
        return true;
    }

    private boolean admitBestSource(List<String> sourceTitles, Map<String, Integer> perSourceCount, int maxPerSource) {
        String bestSourceTitle = sourceTitles.getFirst();
        int count = perSourceCount.getOrDefault(bestSourceTitle, 0);
        if (count >= maxPerSource) {
            return false;
        }
        perSourceCount.put(bestSourceTitle, count + 1);
        return true;
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
