package uk.co.stefirby.seriestracker.service;

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
 */
public record RefreshJobStatus(String status, int totalCount, int completedCount, int skippedCount,
                                LocalDateTime startedAt, LocalDateTime finishedAt) {
}
