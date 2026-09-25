package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.RefreshAllOptions;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.service.refresh.BulkRefreshService;
import uk.co.stefirby.seriestracker.service.refresh.RefreshJobStatus;
import uk.co.stefirby.seriestracker.service.refresh.RefreshResult;
import uk.co.stefirby.seriestracker.service.refresh.SeriesRefreshService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** TOOLING-002-AC-03/04: per-series and bulk refresh endpoints, extracted from {@code SeriesController}. */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesRefreshController {

    private final SeriesRefreshService refreshService;
    private final BulkRefreshService bulkRefreshService;

    public SeriesRefreshController(SeriesRefreshService refreshService, BulkRefreshService bulkRefreshService) {
        this.refreshService = refreshService;
        this.bulkRefreshService = bulkRefreshService;
    }

    @Operation(summary = "Re-fetch one series' external data",
        description = "Re-fetches TMDB detail, its normalized keywords set, and a narrowed OMDb "
            + "ratings call; either source failing is independently non-fatal. Always forces a "
            + "real refresh, ignoring app.tmdb.refresh-skip-threshold-minutes (that skip "
            + "threshold applies only to bulk refresh). If totalSeasons/totalEpisodes increased "
            + "since before this refresh, new content is flagged via newContentDetectedAt; if the series was "
            + "COMPLETED, it's also flipped to BACKLOG with dateCompleted cleared. 404 for an "
            + "unknown id; otherwise always 200 with { series, omdbRefreshed, tmdbRefreshed }.")
    @PostMapping("/" + UuidPathPattern.PATTERN + "/refresh")
    public ResponseEntity<ApiResponse<RefreshResult>> refresh(@PathVariable UUID id) {
        RefreshResult result = refreshService.refresh(id);
        return ResponseEntity.ok(new ApiResponse<>(result));
    }

    @Operation(summary = "Clear a series' newContentDetectedAt flag",
        description = "Never reverses a status change refresh already made. 404 for an unknown "
            + "id; otherwise 200 with the updated series.")
    @PostMapping("/" + UuidPathPattern.PATTERN + "/acknowledge-new-content")
    public ResponseEntity<ApiResponse<SeriesDto>> acknowledgeNewContent(@PathVariable UUID id) {
        SeriesDto dto = refreshService.acknowledgeNewContent(id);
        return ResponseEntity.ok(new ApiResponse<>(dto));
    }

    @Operation(summary = "Start an async job refreshing every tracked series sequentially",
        description = "Same logic as the single-series refresh, including new-content "
            + "detection/reactivation, with a fixed delay between items. A series refreshed "
            + "within the effective skip threshold is skipped rather than re-fetched, but still "
            + "counted toward completedCount. 202 with the job's initial state; 409 if a job is "
            + "already running.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Optional: { "
        + "\"skipThresholdMinutesOverride\": <int> } overrides "
        + "app.tmdb.refresh-skip-threshold-minutes for this one run only, without changing the "
        + "configured default for any future run. Omitting the body, or the field within it, "
        + "leaves the configured default governing.")
    @PostMapping("/refresh-all")
    public ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAll(@RequestBody(required = false) RefreshAllOptions options) {
        Integer skipThresholdOverride = options != null ? options.skipThresholdMinutesOverride() : null;
        RefreshJobStatus status = bulkRefreshService.start(skipThresholdOverride);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new ApiResponse<>(status));
    }

    @Operation(summary = "Poll the current (or most recently finished) bulk refresh job",
        description = "status is IDLE before any job has ever run, then progresses through "
            + "IN_PROGRESS to COMPLETED or FAILED. skipThresholdMinutesUsed reports the "
            + "effective threshold that governed the run this status describes.")
    @GetMapping("/refresh-all/status")
    public ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAllStatus() {
        return ResponseEntity.ok(new ApiResponse<>(bulkRefreshService.status()));
    }
}
