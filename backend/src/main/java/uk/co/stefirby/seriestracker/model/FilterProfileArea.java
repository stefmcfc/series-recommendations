package uk.co.stefirby.seriestracker.model;

/**
 * The three unrelated frontend contexts a {@link FilterProfileEntity} can be saved for -- see
 * series_spec_055_filter_profiles.md. Uniqueness of a profile's {@code name} is scoped to one
 * area, not global.
 */
public enum FilterProfileArea {
    MY_SERIES,
    USE_MY_SERIES,
    RECOMMENDATION_FILTERS
}
