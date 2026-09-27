package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.IgnoredSeriesDto;
import uk.co.stefirby.seriestracker.dto.ImportJobStatus;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RequestMapping("/api/v1/series")
public interface SeriesControllerApi {

    @Operation(summary = "Create a new series",
        description = "Returns 201 with the created series. title is required and IMDb/Rotten "
            + "Tomatoes ratings must fall within their valid ranges (400 if violated); a "
            + "duplicate imdbId returns 409.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "office-created", value = """
                        {"data":{"id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","title":"The Office",\
                        "year":2005,"genres":"Comedy","totalSeasons":9,"totalEpisodes":186,\
                        "status":"BACKLOG","dateAdded":"2026-01-15T10:30:00"},"error":null,\
                        "count":1,"excludedCount":0}"""))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400",
                ref = "#/components/responses/BadRequest"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409",
                ref = "#/components/responses/Conflict")
        })
    @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
        mediaType = "application/json", examples = @ExampleObject(name = "office-create", value = """
            {"title":"The Office","year":2005,"genres":"Comedy","totalSeasons":9}""")))
    @PostMapping
    ResponseEntity<ApiResponse<SeriesDto>> create(@RequestBody SeriesDto dto);

    @Operation(summary = "List all series",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "series-list", value = """
                        {"data":[{"id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","title":"The Office",\
                        "year":2005,"genres":"Comedy","totalSeasons":9,"status":"WATCHING",\
                        "personalRating":9}],"error":null,"count":1,"excludedCount":0}""")))
        })
    @GetMapping
    ResponseEntity<ApiResponse<List<SeriesDto>>> getAll(
            @Parameter(description = "Field to sort by, e.g. personalRating, title, year.",
                example = "personalRating")
            @RequestParam(required = false) String sortBy,
            @Parameter(description = "asc|desc.", example = "desc")
            @RequestParam(required = false) String sortDirection);

    @Operation(summary = "Get a series by ID",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "office", value = """
                        {"data":{"id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","title":"The Office",\
                        "year":2005,"genres":"Comedy","totalSeasons":9,"status":"WATCHING",\
                        "personalRating":9},"error":null,"count":1,"excludedCount":0}"""))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404",
                ref = "#/components/responses/NotFound")
        })
    @GetMapping("/" + UuidPathPattern.PATTERN)
    ResponseEntity<ApiResponse<SeriesDto>> getById(
            @Parameter(example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
            @PathVariable UUID id);

    @Operation(summary = "Update a series (partial)",
        description = "title, year, genres, totalSeasons, totalEpisodes, and imdbRating are "
            + "TMDB (or OMDb, for imdbRating)-managed: once a series' value for one of these is "
            + "non-null, an attempted change to it here is silently ignored, not rejected; every "
            + "other field in the same request still applies. The optional clearedFields body "
            + "field names fields to explicitly reset to null; for the five fields it shares with "
            + "the TMDB-managed lock above, clearing reopens that field for one more manual edit "
            + "until it's next set by TMDB/refresh.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404",
                ref = "#/components/responses/NotFound")
        })
    @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
        mediaType = "application/json", examples = @ExampleObject(name = "partial-update", value = """
            {"personalRating":9,"currentSeason":5}""")))
    @PatchMapping("/" + UuidPathPattern.PATTERN)
    ResponseEntity<ApiResponse<SeriesDto>> update(
            @Parameter(example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
            @PathVariable UUID id,
            @RequestBody SeriesDto dto);

    @Operation(summary = "Delete a series",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404",
                ref = "#/components/responses/NotFound")
        })
    @DeleteMapping("/" + UuidPathPattern.PATTERN)
    ResponseEntity<Void> delete(
            @Parameter(example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
            @PathVariable UUID id);

    @Operation(summary = "Dismiss a recommendation so it never resurfaces",
        description = "Idempotent -- re-ignoring the same imdbId returns 200 instead of 201.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "ignored", value = """
                        {"data":{"id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","imdbId":\
                        "tt0386676","title":"The Office","reason":"Already watched","ignoredAt":\
                        "2026-01-15T10:30:00"},"error":null,"count":1,"excludedCount":0}""")))
        })
    @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
        mediaType = "application/json", examples = @ExampleObject(name = "ignore-request", value = """
            {"imdbId":"tt0386676","title":"The Office","reason":"Already watched"}""")))
    @PostMapping("/ignored")
    ResponseEntity<ApiResponse<IgnoredSeriesDto>> ignore(@RequestBody IgnoredSeriesDto dto);

    @Operation(summary = "Search and filter series",
        description = "yearMin/yearMax use true interval-overlap matching against a series' "
            + "known airing span, not just its stored year. Supports sortBy/sortDirection.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "search-results", value = """
                        {"data":[{"id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","title":"The Office",\
                        "year":2005,"genres":"Comedy","status":"WATCHING","personalRating":9}],\
                        "error":null,"count":1,"excludedCount":2}""")))
        })
    @GetMapping("/search")
    ResponseEntity<ApiResponse<List<SeriesDto>>> search(
            @Parameter(example = "office")
            @RequestParam(required = false) String title,
            @Parameter(description = "Repeatable, case-insensitive substring match against the "
                + "stored genres field, OR'd across multiple values. If a series matches both "
                + "genre and excludeGenre, the exclusion wins.", example = "Comedy")
            @RequestParam(required = false) List<String> genre,
            @Parameter(description = "Repeatable, case-insensitive substring match against the "
                + "stored genres field; drops any matching series. A series with no genres at "
                + "all is never excluded. Exclusion wins over genre on conflict.")
            @RequestParam(required = false) List<String> excludeGenre,
            @RequestParam(required = false) List<String> keyword,
            @Parameter(example = "WATCHING")
            @RequestParam(required = false) String status,
            @RequestParam(required = false) List<String> originCountry,
            @RequestParam(required = false) String originalLanguage,
            @RequestParam(required = false) Integer minPersonalRating,
            @RequestParam(required = false) BigDecimal minImdbRating,
            @RequestParam(required = false) BigDecimal minTmdbRating,
            @RequestParam(required = false) Integer minRottenTomatoesRating,
            @RequestParam(required = false) Integer minRottenTomatoesPopcornmeter,
            @RequestParam(required = false) Integer yearMin,
            @RequestParam(required = false) Integer yearMax,
            @RequestParam(required = false) Boolean flaggedForRewatch,
            @Parameter(description = "null/absent is a no-op; true restricts results to series "
                + "missing an IMDb rating. OR'd together with the other three missing*Rating "
                + "filters (not AND'd) -- a series matches if it's missing any checked rating. "
                + "This combined missing-ratings condition still ANDs with every other filter.")
            @RequestParam(required = false) Boolean missingImdbRating,
            @Parameter(description = "null/absent is a no-op; true restricts results to series "
                + "missing a TMDB rating. OR'd together with the other three missing*Rating "
                + "filters (not AND'd) -- a series matches if it's missing any checked rating. "
                + "This combined missing-ratings condition still ANDs with every other filter.")
            @RequestParam(required = false) Boolean missingTmdbRating,
            @Parameter(description = "null/absent is a no-op; true restricts results to series "
                + "missing a Rotten Tomatoes rating. OR'd together with the other three "
                + "missing*Rating filters (not AND'd) -- a series matches if it's missing any "
                + "checked rating. This combined condition still ANDs with every other filter.")
            @RequestParam(required = false) Boolean missingRottenTomatoesRating,
            @Parameter(description = "null/absent is a no-op; true restricts results to series "
                + "missing a Rotten Tomatoes Popcornmeter rating. OR'd together with the other "
                + "three missing*Rating filters (not AND'd) -- a series matches if it's missing "
                + "any checked rating. This combined condition still ANDs with every other filter.")
            @RequestParam(required = false) Boolean missingRottenTomatoesPopcornmeter,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection);

    @Operation(summary = "Export series as JSON or CSV",
        description = "Accepts the same title/genre/status/originCountry/originalLanguage/"
            + "min*Rating/yearMin/yearMax filter params as GET /api/v1/series/search (a smaller "
            + "shared subset -- no excludeGenre/keyword/flaggedForRewatch/missing-rating "
            + "booleans/sort params on this endpoint).",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "json-export", value = """
                        {"exportDate":"2026-01-15T10:30:00Z","series":[{"title":"The Office",\
                        "year":2005,"genres":"Comedy","totalSeasons":9,"status":"WATCHING"}],\
                        "count":1}""")))
        })
    @GetMapping("/export")
    ResponseEntity<String> export(
            @Parameter(example = "json")
            @RequestParam String format,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) List<String> genre,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) List<String> originCountry,
            @RequestParam(required = false) String originalLanguage,
            @RequestParam(required = false) Integer minPersonalRating,
            @RequestParam(required = false) BigDecimal minImdbRating,
            @RequestParam(required = false) BigDecimal minTmdbRating,
            @RequestParam(required = false) Integer minRottenTomatoesRating,
            @RequestParam(required = false) Integer minRottenTomatoesPopcornmeter,
            @RequestParam(required = false) Integer yearMin,
            @RequestParam(required = false) Integer yearMax);

    @Operation(summary = "Start an async job re-importing a previously exported file",
        description = "Multipart file upload (file field), dispatched by extension: a JSON file "
            + "(containing a series array of SeriesDto objects) or a CSV file (header row must "
            + "match GET /api/v1/series/export?format=csv's column order exactly). 400 before any "
            + "job starts if the extension is neither, or the file content doesn't match. A "
            + "duplicate imdbId is caught and counted toward skippedCount, not a job failure; any "
            + "other per-row failure is counted toward errorCount instead. 409 if an import job "
            + "is already running (tracked independently from bulk refresh).",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "import-started", value = """
                        {"data":{"status":"IN_PROGRESS","totalCount":50,"importedCount":0,\
                        "skippedCount":0,"errorCount":0,"errors":[],"startedAt":\
                        "2026-01-15T10:30:00","completedAt":null},"error":null,"count":1,\
                        "excludedCount":0}"""))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400",
                ref = "#/components/responses/BadRequest"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409",
                ref = "#/components/responses/Conflict")
        })
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<ApiResponse<ImportJobStatus>> importSeries(@RequestParam("file") MultipartFile file);

    @Operation(summary = "Poll the current (or most recently finished) bulk import job",
        description = "status is IDLE before any job has ever run, then progresses through "
            + "IN_PROGRESS to COMPLETED or FAILED -- a completed run's result stays visible here "
            + "until a new job starts.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "import-status", value = """
                        {"data":{"status":"COMPLETED","totalCount":50,"importedCount":48,\
                        "skippedCount":1,"errorCount":1,"errors":[{"rowIndex":12,"message":\
                        "Missing title"}],"startedAt":"2026-01-15T10:30:00","completedAt":\
                        "2026-01-15T10:31:05"},"error":null,"count":1,"excludedCount":0}""")))
        })
    @GetMapping("/import/status")
    ResponseEntity<ApiResponse<ImportJobStatus>> importStatus();
}
