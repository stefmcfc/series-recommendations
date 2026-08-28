package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.TmdbCandidate;
import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.client.TmdbKeyword;
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Post-sourcing output-quality filters (Requirement 8, SERIES-007-AC-23..29), extracted from
 * {@code RecommendationService} (TOOLING-003-AC-15/16).
 */
@Service
public class RecommendationOutputFilterService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationOutputFilterService.class);

    private final TmdbClient tmdbClient;
    private final TmdbGenreTable genreTable;

    /**
     * Default {@code minVoteCount} output-filter floor for every {@code sourceMode} other than
     * {@code "topRated"} (SERIES-029-AC-01/05), replacing the former hardcoded {@code
     * RecommendationDefaults.DEFAULT_MIN_VOTE_COUNT = 20}. Overridable via
     * {@code APP_TMDB_DEFAULT_MIN_VOTE_COUNT} without a code change.
     */
    private final int defaultMinVoteCount;

    public RecommendationOutputFilterService(TmdbClient tmdbClient, TmdbGenreTable genreTable,
                                              @Value("${app.tmdb.default-min-vote-count:200}") int defaultMinVoteCount) {
        this.tmdbClient = tmdbClient;
        this.genreTable = genreTable;
        this.defaultMinVoteCount = defaultMinVoteCount;
    }

    public List<DedupedCandidate> applyOutputFilters(List<DedupedCandidate> candidates, RecommendationCriteria c) {
        // SERIES-024-AC-11/SERIES-029-AC-05: the post-hoc default is 200 for topRated
        // (RecommendationDefaults.DEFAULT_MIN_VOTE_COUNT_TOP_RATED), and the injected
        // defaultMinVoteCount (also 200 by default, but independently configurable) otherwise.
        int modeDefaultMinVoteCount = RecommendationDefaults.SOURCE_MODE_TOP_RATED.equals(c.getSourceMode())
            ? RecommendationDefaults.DEFAULT_MIN_VOTE_COUNT_TOP_RATED : defaultMinVoteCount;
        int effectiveMinVoteCount = c.getMinVoteCount() != null ? c.getMinVoteCount() : modeDefaultMinVoteCount;
        return candidates.stream()
            .filter(dc -> matchesMinTmdbRating(dc.candidate(), c.getMinTmdbRating()))
            .filter(dc -> matchesMinVoteCount(dc.candidate(), effectiveMinVoteCount))
            .filter(dc -> matchesYearRange(dc.candidate(), c))
            .filter(dc -> matchesExcludeGenres(dc.candidate(), c.getExcludeGenres()))
            .filter(dc -> matchesLanguage(dc.candidate(), c.getLanguage()))
            // SERIES-024-AC-05: run last -- the only filter with a per-candidate extra call,
            // so it only ever runs against the smallest possible remaining pool.
            .filter(dc -> matchesExcludeKeywords(dc.candidate(), c.getExcludeKeywords()))
            .toList();
    }

    private boolean matchesMinTmdbRating(TmdbCandidate c, BigDecimal minTmdbRating) {
        if (minTmdbRating == null) {
            return true;
        }
        return c.voteAverage() != null && c.voteAverage().compareTo(minTmdbRating) >= 0;
    }

    private boolean matchesMinVoteCount(TmdbCandidate c, int effectiveMinVoteCount) {
        int voteCount = c.voteCount() != null ? c.voteCount() : 0;
        return voteCount >= effectiveMinVoteCount;
    }

    /**
     * A null {@code year} can't be verified to satisfy an active range, so it's excluded
     * rather than assumed to pass.
     *
     * <p>SERIES-031-AC-09: skipped entirely for Custom Search ({@code
     * criteria.isDirectedByGenreOrKeyword()}) -- TMDB's {@code discover/tv} response only ever
     * carries a candidate's {@code first_air_date} (surfaced here as {@code
     * TmdbCandidate.year()}), never episode-level air dates, so there's no data available
     * post-fetch to correctly re-verify the {@code air_date.gte}/{@code .lte} pre-filter
     * {@code TmdbClient.discover()} already applied. Re-checking with only the first-air year
     * would wrongly re-exclude a still-running older show that legitimately matched TMDB's own
     * episode-air-date filter. Every other mode -- where that flag is {@code false} -- keeps
     * this check exactly as it ran before this spec (SERIES-031-AC-10).
     */
    private boolean matchesYearRange(TmdbCandidate c, RecommendationCriteria criteria) {
        if (criteria.isDirectedByGenreOrKeyword()) {
            return true;
        }
        Integer yearMin = criteria.getYearMin();
        Integer yearMax = criteria.getYearMax();
        if (yearMin == null && yearMax == null) {
            return true;
        }
        if (c.year() == null) {
            return false;
        }
        if (yearMin != null && c.year() < yearMin) {
            return false;
        }
        return yearMax == null || c.year() <= yearMax;
    }

    private boolean matchesExcludeGenres(TmdbCandidate c, List<String> excludeGenres) {
        if (excludeGenres == null || excludeGenres.isEmpty()) {
            return true;
        }
        String genresDisplay = genreTable.joinDisplayNames(c.genreIds());
        if (genresDisplay == null) {
            return true;
        }
        Set<String> candidateGenres = Arrays.stream(genresDisplay.split(","))
            .map(String::trim)
            .collect(Collectors.toSet());
        return excludeGenres.stream().noneMatch(excluded ->
            candidateGenres.stream().anyMatch(g -> g.equalsIgnoreCase(excluded.trim())));
    }

    private boolean matchesLanguage(TmdbCandidate c, String language) {
        if (language == null || language.isBlank()) {
            return true;
        }
        return c.originalLanguage() != null && language.equalsIgnoreCase(c.originalLanguage());
    }

    /**
     * SERIES-024-AC-03/04/06/07: a true no-op (zero {@code TmdbClient} calls) when {@code
     * excludeKeywords} is null/empty. Otherwise fetches the candidate's TMDB keywords via
     * {@link TmdbClient#showKeywords(int)} and excludes it if any keyword name
     * case-insensitively matches an entry in {@code excludeKeywords}. A {@code
     * showKeywords} failure fails this one candidate open (not excluded) rather than
     * propagating, mirroring {@code KeywordSyncService.syncKeywords}'s degrade-gracefully
     * pattern around the same {@code TmdbClient} method.
     */
    private boolean matchesExcludeKeywords(TmdbCandidate c, List<String> excludeKeywords) {
        if (excludeKeywords == null || excludeKeywords.isEmpty()) {
            return true;
        }
        List<TmdbKeyword> candidateKeywords;
        try {
            candidateKeywords = tmdbClient.showKeywords(c.tmdbId());
        } catch (ExternalServiceException e) {
            log.info("TMDB keyword lookup unavailable for candidate tmdbId={}, excludeKeywords filter fails open: {}",
                c.tmdbId(), e.getMessage());
            return true;
        }
        return excludeKeywords.stream().noneMatch(excluded ->
            candidateKeywords.stream().anyMatch(k -> k.name() != null && k.name().equalsIgnoreCase(excluded.trim())));
    }
}
