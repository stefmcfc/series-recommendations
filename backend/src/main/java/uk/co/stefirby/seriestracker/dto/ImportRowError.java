package uk.co.stefirby.seriestracker.dto;

/**
 * series_spec_038_import.md (SERIES-038-AC-03): one entry in {@link ImportJobStatus#errors()},
 * naming the zero-based position of the offending row in the uploaded {@code series} array
 * (not a series id -- the row failed before/while being created, so it may never have one) and
 * a human-readable reason it wasn't imported. Distinct from a duplicate-{@code imdbId} skip
 * (counted via {@code skippedCount} instead, not appended here) -- this is only for a genuine
 * per-row failure, e.g. a validation error.
 */
public record ImportRowError(int rowIndex, String message) {
}
