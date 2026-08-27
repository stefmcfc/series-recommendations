package uk.co.stefirby.seriestracker.service;

import java.util.Set;

/**
 * Constants shared across recommendation-pipeline collaborators (sourcing, output filtering,
 * criteria validation) -- centralized so the sourcing-time and post-hoc output-filter call
 * sites, and the validator's enum check, can't drift apart (SERIES-024-AC-09..12,
 * SERIES-025-AC-04..07). TOOLING-003-AC-02.
 */
final class RecommendationDefaults {

    /** {@code RecommendationCriteria#getSourceMode()} value selecting directed top-rated sourcing (SERIES-022-AC-11..15). */
    static final String SOURCE_MODE_TOP_RATED = "topRated";

    /**
     * Mode-aware override applied only when {@code sourceMode == "topRated"}
     * (SERIES-024-AC-09), at both the sourcing-time call site and the post-hoc output-filter
     * call site (SERIES-024-AC-10/11). Every other mode now defaults to the same value via a
     * constructor-injected {@code @Value("${app.tmdb.default-min-vote-count:200}")} on
     * {@code RecommendationOutputFilterService}/{@code RecommendationSourcingService}
     * (SERIES-029-AC-01/02/05, superseding this class's former {@code DEFAULT_MIN_VOTE_COUNT
     * = 20} constant, removed by that same spec) rather than a second hardcoded constant here
     * -- the two knobs happen to share a value today but remain independently configurable.
     */
    static final int DEFAULT_MIN_VOTE_COUNT_TOP_RATED = 200;

    /** {@code sourceTopRated}'s default {@code discoverSortBy} when unset (SERIES-025-AC-05) -- preserves pre-spec-025 behavior exactly. */
    static final String DEFAULT_TOP_RATED_SORT_BY = "vote_average.desc";

    /**
     * {@code sourceByGenreOrKeyword}'s default {@code discoverSortBy} when unset
     * (SERIES-025-AC-06) -- TMDB's own {@code discover/tv} default, so an unset {@code
     * discoverSortBy} is functionally identical to the pre-spec-025 behavior of sending no
     * {@code sort_by} at all.
     */
    static final String DEFAULT_GENRE_SORT_BY = "popularity.desc";

    /**
     * TMDB's full confirmed {@code discover/tv} {@code sort_by} enum (SERIES-025-AC-04),
     * validated whenever {@code RecommendationCriteria#getDiscoverSortBy()} is non-blank.
     * Deliberately the complete 12-value enum, not just the subset a given frontend release
     * exposes -- see {@code series_spec_025_discover_native_sort.md}'s Design Decisions.
     */
    static final Set<String> VALID_DISCOVER_SORT_BY = Set.of(
        "first_air_date.asc", "first_air_date.desc",
        "name.asc", "name.desc",
        "original_name.asc", "original_name.desc",
        "popularity.asc", DEFAULT_GENRE_SORT_BY,
        "vote_average.asc", DEFAULT_TOP_RATED_SORT_BY,
        "vote_count.asc", "vote_count.desc"
    );

    private RecommendationDefaults() {
    }
}
