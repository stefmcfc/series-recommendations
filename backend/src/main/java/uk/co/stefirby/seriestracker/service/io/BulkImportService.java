package uk.co.stefirby.seriestracker.service.io;

import uk.co.stefirby.seriestracker.dto.ImportJobStatus;
import uk.co.stefirby.seriestracker.dto.ImportRowError;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.exception.ConflictException;
import uk.co.stefirby.seriestracker.service.AbstractPollingJobService;
import uk.co.stefirby.seriestracker.service.SeriesService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Backs {@code POST}/{@code GET /api/v1/series/import} (series_spec_038_import.md) -- a single
 * in-process, in-memory job, no database table, mirroring {@code BulkRefreshService} exactly
 * (same {@link AbstractPollingJobService} plumbing: single-threaded daemon executor,
 * {@link AtomicReference}-backed status, {@code synchronized} guarded {@link #start},
 * delay-between-items shape). Each row is created via the existing
 * {@link SeriesService#create(SeriesDto)} rather than a bespoke bulk-insert path, so
 * every existing guarantee (validation, duplicate-{@code imdbId} rejection, best-effort TMDB/
 * OMDb enrichment) applies to each imported row for free.
 *
 * <p>A duplicate-{@code imdbId} rejection ({@link ConflictException}, series_spec_028) is
 * counted toward {@code skippedCount}, not a job failure; any other per-row failure is counted
 * toward {@code errorCount} with a capped {@link ImportRowError} appended to {@code errors}
 * (SERIES-038-AC-03).
 */
@Service
public class BulkImportService extends AbstractPollingJobService<ImportJobStatus> {

    private static final Logger log = LoggerFactory.getLogger(BulkImportService.class);

    // SERIES-038-AC-03: a badly-malformed large file could otherwise blow up the response body
    // with one error message per row -- capped, same rationale as any other "first N" summary.
    private static final int MAX_ERRORS = 20;

    private final SeriesService seriesService;
    private final Clock clock;
    private final long importDelayMs;

    // Test-only: lets BulkImportServiceSpec block deterministically until an async run finishes
    // instead of polling, since (unlike BulkRefreshServiceSpec's repository-backed batch) every
    // row here is driven by an in-memory list handed to start() rather than a mockable
    // repository call the test can stall on indefinitely.
    private final AtomicReference<Future<?>> currentRun = new AtomicReference<>();

    private enum RowOutcome { IMPORTED, SKIPPED, ERROR }

    public BulkImportService(SeriesService seriesService,
                              Clock clock,
                              @Value("${app.tmdb.refresh-delay-ms:250}") long importDelayMs) {
        super(new ImportJobStatus(IDLE, 0, 0, 0, 0, List.of(), null, null), "bulk-import-worker");
        this.seriesService = seriesService;
        this.clock = clock;
        this.importDelayMs = importDelayMs;
    }

    /**
     * Starts a new import job if none is currently {@code IN_PROGRESS}, returning its initial
     * state immediately -- the batch itself runs asynchronously on a dedicated background
     * thread, so this method never blocks waiting for it.
     *
     * @throws ConflictException if a job is already {@code IN_PROGRESS}
     */
    public synchronized ImportJobStatus start(List<SeriesDto> entries) {
        guardNotInProgress("An import job is already in progress");

        int totalCount = entries.size();
        ImportJobStatus started =
            new ImportJobStatus(IN_PROGRESS, totalCount, 0, 0, 0, List.of(), LocalDateTime.now(clock), null);
        currentJob.set(started);

        currentRun.set(executor.submit(() -> runJob(started, entries)));
        return started;
    }

    /**
     * Test-only: blocks until the most recently started job's background task has finished,
     * so specs can assert on the final status deterministically instead of polling.
     */
    public void awaitCompletionForTest() {
        Future<?> run = currentRun.get();
        if (run == null) {
            return;
        }
        try {
            run.get();
        } catch (InterruptedException _) {
            Thread.currentThread().interrupt();
        } catch (ExecutionException e) {
            log.warn("Bulk import job's background task completed exceptionally", e);
        }
    }

    /**
     * Creates every entry sequentially via {@link SeriesService#create(SeriesDto)}, with a
     * fixed delay between items to stay within TMDB's free-tier rate limit (each row may
     * trigger TMDB/OMDb enrichment). One row's failure does not stop the batch -- it's caught,
     * logged, and counted toward {@code skippedCount}/{@code errorCount} as appropriate. An
     * unexpected exception in the loop's own mechanics (not a per-row failure, which is already
     * caught inside {@link #importOneRow}) is caught here too, setting the job's status to
     * {@code FAILED} rather than letting it propagate -- there is no caller waiting on this
     * async task.
     */
    private void runJob(ImportJobStatus started, List<SeriesDto> entries) {
        try {
            int imported = 0;
            int skipped = 0;
            int errorCount = 0;
            List<ImportRowError> errors = new ArrayList<>();
            for (int i = 0; i < entries.size(); i++) {
                RowOutcome outcome = importOneRow(i, entries.get(i), errors);
                switch (outcome) {
                    case IMPORTED -> imported++;
                    case SKIPPED -> skipped++;
                    case ERROR -> errorCount++;
                }
                currentJob.set(new ImportJobStatus(IN_PROGRESS, started.totalCount(), imported, skipped,
                    errorCount, List.copyOf(errors), started.startedAt(), null));

                if (importDelayMs > 0) {
                    applyDelay(importDelayMs, "Bulk import job interrupted");
                }
            }
            currentJob.set(new ImportJobStatus(COMPLETED, started.totalCount(), imported, skipped, errorCount,
                List.copyOf(errors), started.startedAt(), LocalDateTime.now(clock)));
        } catch (RuntimeException e) {
            log.error("Bulk import job failed unexpectedly", e);
            ImportJobStatus current = currentJob.get();
            currentJob.set(new ImportJobStatus(FAILED, started.totalCount(), current.importedCount(),
                current.skippedCount(), current.errorCount(), current.errors(), started.startedAt(),
                LocalDateTime.now(clock)));
        }
    }

    /** Extracted so the loop in {@link #runJob} doesn't nest a try/catch inside its own try/catch (java:S1141). */
    private RowOutcome importOneRow(int rowIndex, SeriesDto entry, List<ImportRowError> errors) {
        try {
            seriesService.create(entry);
            return RowOutcome.IMPORTED;
        } catch (ConflictException e) {
            log.info("Bulk import: row {} skipped, already tracked ({})", rowIndex, e.getMessage());
            return RowOutcome.SKIPPED;
        } catch (RuntimeException e) {
            log.warn("Bulk import: row {} failed, continuing with the batch", rowIndex, e);
            if (errors.size() < MAX_ERRORS) {
                errors.add(new ImportRowError(rowIndex, e.getMessage()));
            }
            return RowOutcome.ERROR;
        }
    }
}
