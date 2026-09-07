package uk.co.stefirby.seriestracker.service.refresh;

import uk.co.stefirby.seriestracker.service.JobStatus;

import java.time.LocalDateTime;

/**
 * Snapshot of {@link BulkRefreshService}'s single in-memory job (SERIES-018-AC-18) --
 * {@code status} is one of {@code IDLE}/{@code IN_PROGRESS}/{@code COMPLETED}/{@code FAILED}.
 * A plain {@code String} rather than an enum: it's serialized straight to JSON with no other
 * consumer needing type-safe handling, the same shape {@code SeriesStatus} already uses on
 * {@code SeriesDto}.
 *
 * <p>{@code skippedCount} (SERIES-018-AC-32) counts series skipped under the
 * {@code app.tmdb.refresh-skip-threshold-minutes} threshold (SERIES-018-AC-30) -- each skip is
 * also counted toward {@code completedCount}, so {@code skippedCount} is a subset of it, not an
 * addition to {@code totalCount}.
 *
 * <p>{@code skipThresholdMinutesUsed} (series_spec_052_refresh_skip_threshold_override.md,
 * SERIES-052-AC-08) reports the effective threshold that actually governed the run this status
 * describes -- an override if one was passed to {@link BulkRefreshService#start}, otherwise the
 * injected {@code app.tmdb.refresh-skip-threshold-minutes} default -- so a user can see *why* a
 * run's {@code skippedCount} came out the way it did, even when no override was used.
 */
public record RefreshJobStatus(String status, int totalCount, int completedCount, int skippedCount,
                                LocalDateTime startedAt, LocalDateTime finishedAt,
                                int skipThresholdMinutesUsed) implements JobStatus {
}
