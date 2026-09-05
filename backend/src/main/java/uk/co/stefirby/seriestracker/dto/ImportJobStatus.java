package uk.co.stefirby.seriestracker.dto;

import uk.co.stefirby.seriestracker.service.JobStatus;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Snapshot of {@code BulkImportService}'s single in-memory job (series_spec_038_import.md,
 * SERIES-038-AC-04) -- {@code status} is one of {@code IDLE}/{@code IN_PROGRESS}/
 * {@code COMPLETED}/{@code FAILED}, the same plain-{@code String} convention as
 * {@code RefreshJobStatus} (series_spec_018_series_refresh.md).
 *
 * <p>{@code importedCount} + {@code skippedCount} + {@code errorCount} sums to the number of
 * rows processed so far (out of {@code totalCount}, the size of the uploaded {@code series}
 * array) -- a duplicate {@code imdbId} (SERIES-028-AC-01) counts toward {@code skippedCount},
 * any other per-row failure counts toward {@code errorCount} with a capped
 * {@link ImportRowError} appended to {@code errors} (SERIES-038-AC-03).
 */
public record ImportJobStatus(String status, int totalCount, int importedCount, int skippedCount,
                               int errorCount, List<ImportRowError> errors,
                               LocalDateTime startedAt, LocalDateTime completedAt) implements JobStatus {
}
