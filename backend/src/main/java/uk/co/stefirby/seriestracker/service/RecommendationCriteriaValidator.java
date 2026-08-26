package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import org.springframework.stereotype.Service;

/**
 * Validates a {@link RecommendationCriteria} before it reaches sourcing. Extracted from {@code
 * RecommendationService} (TOOLING-003-AC-04) -- pure/stateless, no collaborators
 * (TOOLING-003-AC-06).
 */
@Service
public class RecommendationCriteriaValidator {

    /**
     * Each independent check is its own method (java:S3776) -- this method's own job is just to
     * run them all in order; none of them depend on another's outcome.
     */
    public void validate(RecommendationCriteria c) {
        boolean hasSeriesIds = c.getSeriesIds() != null && !c.getSeriesIds().isEmpty();
        boolean hasGenreOrKeyword = c.isDirectedByGenreOrKeyword();
        boolean hasSourceMode = c.getSourceMode() != null && !c.getSourceMode().isBlank();

        validateSourceMode(c, hasSourceMode);
        validateMutuallyExclusiveModes(hasSeriesIds, hasGenreOrKeyword, hasSourceMode);
        validateMinSourceRating(c);
        validateTrendingWindow(c);
        validateDiscoverSortBy(c);
    }

    private void validateSourceMode(RecommendationCriteria c, boolean hasSourceMode) {
        if (hasSourceMode && !"trending".equals(c.getSourceMode()) && !RecommendationDefaults.SOURCE_MODE_TOP_RATED.equals(c.getSourceMode())) {
            throw new IllegalArgumentException("sourceMode must be one of: trending, topRated");
        }
    }

    private void validateMutuallyExclusiveModes(boolean hasSeriesIds, boolean hasGenreOrKeyword, boolean hasSourceMode) {
        if (hasSeriesIds && hasGenreOrKeyword) {
            throw new IllegalArgumentException(
                "seriesIds cannot be combined with genres/keywords -- these are mutually exclusive request modes");
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
