package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.exception.ConflictException;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Backs {@code POST}/{@code GET /api/v1/series/refresh-all} (Requirement 3) --
 * {@code series_spec_018_series_refresh.md}. A single in-process, in-memory job, no database
 * table: a personal, single-instance app has no need for job state to survive a restart or be
 * visible across instances (see the spec's Design Decisions). Guarded so only one job runs at
 * a time; a second {@link #start()} while one is already {@code IN_PROGRESS} throws {@link
 * ConflictException} (SERIES-018-AC-14) rather than queuing or running two batches
 * concurrently against the same rate-limited upstream APIs.
 *
 * <p>The most recently finished run's result is deliberately left visible via {@link
 * #status()} until a new job starts (SERIES-018-AC-21) -- it does not reset to {@code IDLE} on
 * completion.
 */
@Service
public class BulkRefreshService {

    private static final Logger log = LoggerFactory.getLogger(BulkRefreshService.class);

    private static final String IDLE = "IDLE";
    private static final String IN_PROGRESS = "IN_PROGRESS";
    private static final String COMPLETED = "COMPLETED";
    private static final String FAILED = "FAILED";

    private final SeriesRepository repository;
    private final SeriesRefreshService refreshService;
    private final long refreshDelayMs;
    private final ExecutorService executor;

    private final AtomicReference<RefreshJobStatus> currentJob =
        new AtomicReference<>(new RefreshJobStatus(IDLE, 0, 0, null, null));

    public BulkRefreshService(SeriesRepository repository,
                               SeriesRefreshService refreshService,
                               @Value("${app.tmdb.refresh-delay-ms:250}") long refreshDelayMs) {
        this.repository = repository;
        this.refreshService = refreshService;
        this.refreshDelayMs = refreshDelayMs;
        this.executor = Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, "bulk-refresh-worker");
            thread.setDaemon(true);
            return thread;
        });
    }

    /**
     * Starts a new bulk refresh job if none is currently {@code IN_PROGRESS}
     * (SERIES-018-AC-13), returning its initial state immediately -- the batch itself runs
     * asynchronously (SERIES-018-AC-16) on a dedicated background thread, so this method never
     * blocks waiting for it.
     *
     * @throws ConflictException if a job is already {@code IN_PROGRESS} (SERIES-018-AC-14)
     */
    public synchronized RefreshJobStatus start() {
        RefreshJobStatus existing = currentJob.get();
        if (IN_PROGRESS.equals(existing.status())) {
            throw new ConflictException("A bulk refresh job is already in progress");
        }

        int totalCount = (int) repository.count();
        RefreshJobStatus started = new RefreshJobStatus(IN_PROGRESS, totalCount, 0, LocalDateTime.now(), null);
        currentJob.set(started);

        executor.submit(() -> runJob(started));
        return started;
    }

    /** The current (or, once one has run, the most recently finished) job's status (SERIES-018-AC-18). */
    public RefreshJobStatus status() {
        return currentJob.get();
    }

    /**
     * Refreshes every series sequentially via {@link SeriesRefreshService#refresh(UUID)}, with
     * a fixed delay between items (SERIES-018-AC-15) to stay within TMDB's free-tier rate
     * limit. One series' refresh failing does not stop the batch (SERIES-018-AC-17) -- it's
     * caught, logged, and still counted toward {@code completedCount}. An unexpected exception
     * in the loop's own mechanics (not a per-item failure) is caught here too, setting the
     * job's status to {@code FAILED} rather than letting it propagate -- there is no caller
     * waiting on this async task (SERIES-018-AC-22).
     */
    private void runJob(RefreshJobStatus started) {
        try {
            List<UUID> ids = repository.findAll().stream().map(SeriesEntity::getId).toList();
            int completed = 0;
            for (UUID id : ids) {
                try {
                    refreshService.refresh(id);
                } catch (RuntimeException e) {
                    log.warn("Bulk refresh: refreshing series {} failed, continuing with the batch", id, e);
                }
                completed++;
                currentJob.set(new RefreshJobStatus(IN_PROGRESS, started.totalCount(), completed, started.startedAt(), null));

                if (refreshDelayMs > 0) {
                    try {
                        Thread.sleep(refreshDelayMs);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException("Bulk refresh job interrupted", ie);
                    }
                }
            }
            currentJob.set(new RefreshJobStatus(COMPLETED, started.totalCount(), completed, started.startedAt(), LocalDateTime.now()));
        } catch (RuntimeException e) {
            log.error("Bulk refresh job failed unexpectedly", e);
            RefreshJobStatus current = currentJob.get();
            currentJob.set(new RefreshJobStatus(FAILED, started.totalCount(), current.completedCount(), started.startedAt(), LocalDateTime.now()));
        }
    }
}
