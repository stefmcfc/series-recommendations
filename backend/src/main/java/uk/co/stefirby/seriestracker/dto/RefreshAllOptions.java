package uk.co.stefirby.seriestracker.dto;

/**
 * Optional per-run override for {@code POST /api/v1/series/refresh-all}'s skip-threshold
 * (series_spec_052_refresh_skip_threshold_override.md). Deliberately not persisted -- there is
 * no settings/preference entity anywhere in this backend, and this spec doesn't add one (see the
 * spec's Design Decisions): omitting the field, or the whole request body, leaves the injected
 * {@code app.tmdb.refresh-skip-threshold-minutes} default governing the run, exactly as before
 * this spec (SERIES-052-AC-03).
 *
 * @param skipThresholdMinutesOverride minutes to override the skip threshold for this run only,
 *                                      or {@code null} to use the injected default. Zero or a
 *                                      negative value disables skipping entirely for this run
 *                                      (SERIES-052-AC-07), the same "0 disables the filter"
 *                                      convention {@code shouldSkip} already applies to the
 *                                      injected default.
 */
public record RefreshAllOptions(Integer skipThresholdMinutesOverride) {
}
