package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.RefreshAllOptions;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.service.refresh.RefreshJobStatus;
import uk.co.stefirby.seriestracker.service.refresh.RefreshResult;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.UUID;

@RequestMapping("/api/v1/series")
public interface SeriesRefreshControllerApi {

    @Operation(summary = "Re-fetch one series' external data",
        description = "Re-fetches TMDB detail, its normalized keywords set, and a narrowed OMDb "
            + "ratings call; either source failing is independently non-fatal. Always forces a "
            + "real refresh, ignoring app.tmdb.refresh-skip-threshold-minutes (that skip "
            + "threshold applies only to bulk refresh). If totalSeasons/totalEpisodes increased "
            + "since before this refresh, new content is flagged via newContentDetectedAt; if the series was "
            + "COMPLETED, it's also flipped to BACKLOG with dateCompleted cleared. 404 for an "
            + "unknown id; otherwise always 200 with { series, omdbRefreshed, tmdbRefreshed }.")
    @PostMapping("/" + UuidPathPattern.PATTERN + "/refresh")
    ResponseEntity<ApiResponse<RefreshResult>> refresh(@PathVariable UUID id);

    @Operation(summary = "Clear a series' newContentDetectedAt flag",
        description = "Never reverses a status change refresh already made. 404 for an unknown "
            + "id; otherwise 200 with the updated series.")
    @PostMapping("/" + UuidPathPattern.PATTERN + "/acknowledge-new-content")
    ResponseEntity<ApiResponse<SeriesDto>> acknowledgeNewContent(@PathVariable UUID id);

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
    ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAll(@RequestBody(required = false) RefreshAllOptions options);

    @Operation(summary = "Poll the current (or most recently finished) bulk refresh job",
        description = "status is IDLE before any job has ever run, then progresses through "
            + "IN_PROGRESS to COMPLETED or FAILED. skipThresholdMinutesUsed reports the "
            + "effective threshold that governed the run this status describes.")
    @GetMapping("/refresh-all/status")
    ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAllStatus();
}
