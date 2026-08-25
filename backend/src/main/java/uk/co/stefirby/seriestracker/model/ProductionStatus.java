package uk.co.stefirby.seriestracker.model;

import java.util.Locale;
import java.util.Optional;

/**
 * TMDB-sourced, informational answer to "is this show still going?" -- mirrors TMDB's
 * documented TV {@code status} field values. Deliberately not a new value on {@link
 * SeriesStatus}: that enum means "where am I with watching this" (a personal-progress
 * concept), while this is "has the show itself finished being made" (a production-fact
 * concept). See {@code series_spec_008_series_lifecycle_data.md} Requirement 2.
 *
 * <p>Introduced as a minimal prerequisite of {@code series_spec_018_series_refresh.md}
 * (SERIES-018-AC-02): at the time spec 018 was implemented, spec 008 itself had not shipped,
 * so only the pieces spec 018's refresh logic actually needs -- this enum, the mapping below,
 * and the {@code productionStatus} column/field -- are introduced here rather than the fuller
 * spec 008 surface (e.g. {@code excludeFromRecommendations}, {@code flaggedForRewatch}), which
 * remains unimplemented. See series_spec_018's Acceptance Criteria Summary note.
 */
public enum ProductionStatus {
    RETURNING_SERIES,
    PLANNED,
    IN_PRODUCTION,
    ENDED,
    CANCELED,
    PILOT;

    /**
     * Maps a raw TMDB {@code status} string (e.g. {@code "Returning Series"}, {@code
     * "In Production"}) onto a {@link ProductionStatus} constant. An absent value or one with
     * no matching constant maps to {@link Optional#empty()}, not an error -- same posture as
     * this app's other unmapped-external-value handling (e.g. genre id lookups).
     */
    public static Optional<ProductionStatus> fromTmdbStatus(String tmdbStatus) {
        if (tmdbStatus == null || tmdbStatus.isBlank()) {
            return Optional.empty();
        }
        String normalized = tmdbStatus.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        try {
            return Optional.of(ProductionStatus.valueOf(normalized));
        } catch (IllegalArgumentException _) {
            return Optional.empty();
        }
    }
}
