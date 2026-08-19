package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.IgnoredSeriesDto;

/**
 * Result of {@link IgnoredSeriesService#ignore(IgnoredSeriesDto)} -- pairs the persisted (or
 * pre-existing) entry with whether it was newly created, so
 * {@code SeriesController.ignore(...)} can pick {@code 201} vs {@code 200}
 * (SERIES-006-AC-32/34) without the controller itself having to duplicate the
 * already-ignored check the service just performed.
 */
public record IgnoreOutcome(IgnoredSeriesDto dto, boolean created) {
}
