package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Year;

/**
 * Validates a {@link RecommendationCriteria} before it reaches sourcing. Extracted from {@code
 * RecommendationService} (TOOLING-003-AC-04) -- pure/stateless, no collaborators
 * (TOOLING-003-AC-06).
 */
@Service
public class RecommendationCriteriaValidator {

    /** Floor for {@code yearMin}/{@code yearMax} (SERIES-031-AC-12) -- safely before any TV series existed. */
    private static final int MIN_VALID_YEAR = 1900;

    /**
     * Each independent check is its own method (java:S3776) -- this method's own job is just to
     * run them all in order; none of them depend on another's outcome.
     */
    public void validate(RecommendationCriteria c) {
        boolean hasSeriesIds = c.getSeriesIds() != null && !c.getSeriesIds().isEmpty();
        boolean hasGenreOrKeyword = c.isDirectedByGenreOrKeyword();
        boolean hasSourceMode = c.getSourceMode() != null && !c.getSourceMode().isBlank();
        boolean isUseMySeriesMode = RecommendationDefaults.SOURCE_MODE_USE_MY_SERIES.equals(c.getSourceMode());

        validateSourceMode(c, hasSourceMode);
        validateMutuallyExclusiveModes(hasSeriesIds, hasGenreOrKeyword, hasSourceMode, isUseMySeriesMode);
        validateMinSourceRating(c);
        validateMinTmdbRating(c);
        validateYearRange(c);
        validateTrendingWindow(c);
        validateDiscoverSortBy(c);
    }

    private void validateSourceMode(RecommendationCriteria c, boolean hasSourceMode) {
        if (hasSourceMode
            && !"trending".equals(c.getSourceMode())
            && !RecommendationDefaults.SOURCE_MODE_TOP_RATED.equals(c.getSourceMode())
            && !RecommendationDefaults.SOURCE_MODE_USE_MY_SERIES.equals(c.getSourceMode())) {
            throw new IllegalArgumentException("sourceMode must be one of: trending, topRated, useMySeries");
        }
    }

    /**
     * SERIES-033-AC-02/03: {@code sourceMode=useMySeries} gets its own, narrower rule -- rejected
     * combined with {@code genres}/{@code keywords} (like {@code trending}/{@code topRated}), but
     * deliberately *not* rejected combined with {@code seriesIds} (unlike {@code trending}/{@code
     * topRated}), so this check intentionally doesn't fall through to the generic {@code
     * hasSourceMode} rule below it once {@code isUseMySeriesMode} is true.
     */
    private void validateMutuallyExclusiveModes(boolean hasSeriesIds, boolean hasGenreOrKeyword,
                                                 boolean hasSourceMode, boolean isUseMySeriesMode) {
        if (hasSeriesIds && hasGenreOrKeyword) {
            throw new IllegalArgumentException(
                "seriesIds cannot be combined with genres/keywords -- these are mutually exclusive request modes");
        }
        if (isUseMySeriesMode) {
            if (hasGenreOrKeyword) {
                throw new IllegalArgumentException(
                    "sourceMode=useMySeries cannot be combined with genres/keywords -- these are mutually exclusive request modes");
            }
            return;
        }
        if (hasSourceMode && (hasSeriesIds || hasGenreOrKeyword)) {
            throw new IllegalArgumentException(
                "sourceMode cannot be combined with seriesIds/genres/keywords -- these are mutually exclusive request modes");
        }
    }

    private void validateMinSourceRating(RecommendationCriteria c) {
        if (c.getMinSourceRating() != null && (c.getMinSourceRating() < 1 || c.getMinSourceRating() > 5)) {
            throw new IllegalArgumentException("minSourceRating must be between 1 and 5");
        }
    }

    /**
     * SERIES-031-AC-11: rejects a {@code minTmdbRating} outside TMDB's own 0-10 rating scale --
     * previously unvalidated, so a negative or above-10 value passed straight through to the
     * post-fetch comparison (silently matching nothing) or, since {@code series_spec_031}, to
     * TMDB's own {@code vote_average.gte} param directly.
     */
    private void validateMinTmdbRating(RecommendationCriteria c) {
        BigDecimal minTmdbRating = c.getMinTmdbRating();
        if (minTmdbRating != null
            && (minTmdbRating.compareTo(BigDecimal.ZERO) < 0 || minTmdbRating.compareTo(BigDecimal.TEN) > 0)) {
            throw new IllegalArgumentException("minTmdbRating must be between 0 and 10");
        }
    }

    /**
     * SERIES-031-AC-12: rejects a {@code yearMin}/{@code yearMax} outside a sane range, and
     * rejects {@code yearMin} exceeding {@code yearMax} when both are set -- previously
     * unvalidated, so a negative or far-future year passed straight through to the post-fetch
     * comparison or, since {@code series_spec_031}, produced a malformed {@code air_date.gte}/
     * {@code .lte} date string sent directly to TMDB (e.g. {@code air_date.gte=-5-01-01}). The
     * upper bound is resolved at request time ({@code Year.now()}, not hardcoded) so it stays
     * correct as years pass, rather than needing a periodic manual bump.
     */
    private void validateYearRange(RecommendationCriteria c) {
        int maxValidYear = Year.now().getValue() + 1;
        Integer yearMin = c.getYearMin();
        Integer yearMax = c.getYearMax();

        if (yearMin != null && (yearMin < MIN_VALID_YEAR || yearMin > maxValidYear)) {
            throw new IllegalArgumentException("yearMin must be between " + MIN_VALID_YEAR + " and " + maxValidYear);
        }
        if (yearMax != null && (yearMax < MIN_VALID_YEAR || yearMax > maxValidYear)) {
            throw new IllegalArgumentException("yearMax must be between " + MIN_VALID_YEAR + " and " + maxValidYear);
        }
        if (yearMin != null && yearMax != null && yearMin > yearMax) {
            throw new IllegalArgumentException("yearMin cannot exceed yearMax");
        }
    }

    private void validateTrendingWindow(RecommendationCriteria c) {
        String trendingWindow = c.getTrendingWindow();
        if (trendingWindow != null && !trendingWindow.isBlank()
            && !"day".equals(trendingWindow) && !"week".equals(trendingWindow)) {
            throw new IllegalArgumentException("trendingWindow must be one of: day, week");
        }
    }

    private void validateDiscoverSortBy(RecommendationCriteria c) {
        String discoverSortBy = c.getDiscoverSortBy();
        if (discoverSortBy != null && !discoverSortBy.isBlank() && !RecommendationDefaults.VALID_DISCOVER_SORT_BY.contains(discoverSortBy)) {
            throw new IllegalArgumentException("discoverSortBy must be one of: " + RecommendationDefaults.VALID_DISCOVER_SORT_BY);
        }
    }
}
