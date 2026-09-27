package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.RefreshAllOptions;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.service.refresh.RefreshJobStatus;
import uk.co.stefirby.seriestracker.service.refresh.RefreshResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
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
            + "unknown id; otherwise always 200 with { series, omdbRefreshed, tmdbRefreshed }.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "refreshed", value = """
                        {"data":{"series":{"id":"3fa85f64-5717-4562-b3fc-2c963f66afa6",\
                        "title":"The Office","year":2005,"genres":"Comedy","totalSeasons":9,\
                        "status":"WATCHING","lastRefreshedAt":"2026-01-15T10:30:00"},\
                        "omdbRefreshed":true,"tmdbRefreshed":true},"error":null,"count":1,\
                        "excludedCount":0}"""))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404",
                ref = "#/components/responses/NotFound")
        })
    @PostMapping("/" + UuidPathPattern.PATTERN + "/refresh")
    ResponseEntity<ApiResponse<RefreshResult>> refresh(
            @Parameter(example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
            @PathVariable UUID id);

    @Operation(summary = "Clear a series' newContentDetectedAt flag",
        description = "Never reverses a status change refresh already made. 404 for an unknown "
            + "id; otherwise 200 with the updated series.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404",
                ref = "#/components/responses/NotFound")
        })
    @PostMapping("/" + UuidPathPattern.PATTERN + "/acknowledge-new-content")
    ResponseEntity<ApiResponse<SeriesDto>> acknowledgeNewContent(
            @Parameter(example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
            @PathVariable UUID id);

    @Operation(summary = "Start an async job refreshing every tracked series sequentially",
        description = "Same logic as the single-series refresh, including new-content "
            + "detection/reactivation, with a fixed delay between items. A series refreshed "
            + "within the effective skip threshold is skipped rather than re-fetched, but still "
            + "counted toward completedCount. 202 with the job's initial state; 409 if a job is "
            + "already running.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "202",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "refresh-all-started", value = """
                        {"data":{"status":"IN_PROGRESS","totalCount":50,"completedCount":0,\
                        "skippedCount":0,"startedAt":"2026-01-15T10:30:00","finishedAt":null,\
                        "skipThresholdMinutesUsed":30},"error":null,"count":1,\
                        "excludedCount":0}"""))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409",
                ref = "#/components/responses/Conflict")
        })
    @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Optional: { "
        + "\"skipThresholdMinutesOverride\": <int> } overrides "
        + "app.tmdb.refresh-skip-threshold-minutes for this one run only, without changing the "
        + "configured default for any future run. Omitting the body, or the field within it, "
        + "leaves the configured default governing.",
        content = @Content(mediaType = "application/json", examples = @ExampleObject(
            name = "override-threshold", value = "{\"skipThresholdMinutesOverride\":30}")))
    @PostMapping("/refresh-all")
    ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAll(@RequestBody(required = false) RefreshAllOptions options);

    @Operation(summary = "Poll the current (or most recently finished) bulk refresh job",
        description = "status is IDLE before any job has ever run, then progresses through "
            + "IN_PROGRESS to COMPLETED or FAILED. skipThresholdMinutesUsed reports the "
            + "effective threshold that governed the run this status describes.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "refresh-all-status", value = """
                        {"data":{"status":"COMPLETED","totalCount":50,"completedCount":50,\
                        "skippedCount":12,"startedAt":"2026-01-15T10:30:00","finishedAt":\
                        "2026-01-15T10:45:22","skipThresholdMinutesUsed":30},"error":null,\
                        "count":1,"excludedCount":0}""")))
        })
    @GetMapping("/refresh-all/status")
    ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAllStatus();
}
