package uk.co.stefirby.seriestracker.model;

/**
 * The unrelated frontend contexts a {@link FilterProfileEntity} can be saved for -- see
 * series_spec_055_filter_profiles.md ({@code MY_SERIES}/{@code USE_MY_SERIES}/
 * {@code RECOMMENDATION_FILTERS}) and series_spec_057_filter_profile_new_areas.md
 * ({@code CUSTOM_SEARCH}/{@code ANALYSIS_FILTERS}). Uniqueness of a profile's {@code name} is
 * scoped to one area, not global.
 */
public enum FilterProfileArea {
    MY_SERIES,
    USE_MY_SERIES,
    RECOMMENDATION_FILTERS,
    CUSTOM_SEARCH,
    ANALYSIS_FILTERS
}
