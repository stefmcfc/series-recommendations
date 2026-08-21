package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.SeriesDto;

/**
 * Result of {@link SeriesRefreshService#refresh(java.util.UUID)} -- pairs the refreshed (or
 * unchanged) {@link SeriesDto} with which of the two upstream sources actually succeeded,
 * mirroring {@link IgnoreOutcome}'s established pattern (SERIES-018-AC-07) of pairing a DTO
 * with outcome metadata the controller can't otherwise derive without duplicating the
 * service's own checks.
 */
public record RefreshResult(SeriesDto series, boolean omdbRefreshed, boolean tmdbRefreshed) {
}
