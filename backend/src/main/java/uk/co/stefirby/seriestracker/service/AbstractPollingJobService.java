package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.exception.ConflictException;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Shared plumbing extracted out of {@code BulkImportService}/{@code BulkRefreshService}
 * (chore/sonar-cleanup) -- both were built to deliberately mirror each other's shape but had
 * drifted into real copy-paste: identical single-thread daemon-executor construction, identical
 * {@link AtomicReference}-backed IDLE/IN_PROGRESS/COMPLETED/FAILED status-string constants, and
 * an identical {@code synchronized start()}-guard-throws-{@link ConflictException} pattern. The
 * two status DTOs have genuinely different shapes -- only this shared plumbing around them is
 * unified, not the per-item accumulation logic each subclass still owns.
 *
 * @param <T> the job-status type this instance tracks
 */
public abstract class AbstractPollingJobService<T extends JobStatus> {

    protected static final String IDLE = "IDLE";
    protected static final String IN_PROGRESS = "IN_PROGRESS";
    protected static final String COMPLETED = "COMPLETED";
    protected static final String FAILED = "FAILED";

    protected final AtomicReference<T> currentJob;
    protected final ExecutorService executor;

    protected AbstractPollingJobService(T idleStatus, String workerThreadName) {
        this.currentJob = new AtomicReference<>(idleStatus);
        this.executor = Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, workerThreadName);
            thread.setDaemon(true);
            return thread;
        });
    }

    /** The current (or, once one has run, the most recently finished) job's status. */
    public T status() {
        return currentJob.get();
    }

    /**
     * Deliberately NOT {@code synchronized} itself -- it's always called from within each
     * subclass's own {@code synchronized start()}, which is the sole atomicity boundary.
     *
     * @throws ConflictException if a job is already {@code IN_PROGRESS}
     */
    protected void guardNotInProgress(String conflictMessage) {
        if (IN_PROGRESS.equals(currentJob.get().status())) {
            throw new ConflictException(conflictMessage);
        }
    }

    protected void applyDelay(long delayMs, String interruptedMessage) {
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(interruptedMessage, ie);
        }
    }
}
