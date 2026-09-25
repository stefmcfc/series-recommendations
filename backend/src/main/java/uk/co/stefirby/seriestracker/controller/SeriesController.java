package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.IgnoredSeriesDto;
import uk.co.stefirby.seriestracker.dto.ImportJobStatus;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.dto.SeriesSearchCriteria;
import uk.co.stefirby.seriestracker.service.IgnoreOutcome;
import uk.co.stefirby.seriestracker.service.IgnoredSeriesService;
import uk.co.stefirby.seriestracker.service.SeriesSearchService;
import uk.co.stefirby.seriestracker.service.SeriesService;
import uk.co.stefirby.seriestracker.service.io.BulkImportService;
import uk.co.stefirby.seriestracker.service.io.ImportFileParser;
import uk.co.stefirby.seriestracker.service.io.SeriesExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * Backs {@code POST}/{@code GET /api/v1/series/import} (series_spec_038_import.md) in addition
 * to this controller's existing CRUD/search/export/ignore endpoints -- a new controller wasn't
 * warranted purely for two routes sharing this class' resource base path and dependencies, the
 * same "one thing backing many endpoints" posture as {@code SeriesRefreshController}'s own wide
 * constructor.
 */
@SuppressWarnings("java:S107")
@RestController
@RequestMapping("/api/v1/series")
public class SeriesController {

    private static final DateTimeFormatter FILENAME_FMT = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private final SeriesService seriesService;
    private final SeriesSearchService searchService;
    private final SeriesExportService exportService;
    private final IgnoredSeriesService ignoredSeriesService;
    private final BulkImportService importService;
    private final ImportFileParser importFileParser;
    private final Clock clock;

    public SeriesController(SeriesService seriesService,
                            SeriesSearchService searchService,
                            SeriesExportService exportService,
                            IgnoredSeriesService ignoredSeriesService,
                            BulkImportService importService,
                            ImportFileParser importFileParser,
                            Clock clock) {
        this.seriesService = seriesService;
        this.searchService = searchService;
        this.exportService = exportService;
        this.ignoredSeriesService = ignoredSeriesService;
        this.importService = importService;
        this.importFileParser = importFileParser;
        this.clock = clock;
    }

    @Operation(summary = "Create a new series")
    @PostMapping
    public ResponseEntity<ApiResponse<SeriesDto>> create(@RequestBody SeriesDto dto) {
        SeriesDto created = seriesService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(new ApiResponse<>(created));
    }

    @Operation(summary = "List all series")
    @GetMapping
    public ResponseEntity<ApiResponse<List<SeriesDto>>> getAll(
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection) {
        List<SeriesDto> list = seriesService.getAll(sortBy, sortDirection);
        long excludedCount = seriesService.countMissingForSort(sortBy);
        return ResponseEntity.ok(new ApiResponse<>(list, list.size(), excludedCount));
    }

    @Operation(summary = "Get a series by ID")
    @GetMapping("/" + UuidPathPattern.PATTERN)
    public ResponseEntity<ApiResponse<SeriesDto>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(new ApiResponse<>(seriesService.getById(id)));
    }

    @Operation(summary = "Update a series (partial)",
        description = "title, year, genres, totalSeasons, totalEpisodes, and imdbRating are "
            + "TMDB (or OMDb, for imdbRating)-managed: once a series' value for one of these is "
            + "non-null, an attempted change to it here is silently ignored, not rejected; every "
            + "other field in the same request still applies. The optional clearedFields body "
            + "field names fields to explicitly reset to null; for the five fields it shares with "
            + "the TMDB-managed lock above, clearing reopens that field for one more manual edit "
            + "until it's next set by TMDB/refresh.")
    @PatchMapping("/" + UuidPathPattern.PATTERN)
    public ResponseEntity<ApiResponse<SeriesDto>> update(@PathVariable UUID id, @RequestBody SeriesDto dto) {
        return ResponseEntity.ok(new ApiResponse<>(seriesService.update(id, dto)));
    }

    @Operation(summary = "Delete a series")
    @DeleteMapping("/" + UuidPathPattern.PATTERN)
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        seriesService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Dismiss a recommendation so it never resurfaces",
        description = "Idempotent -- re-ignoring the same imdbId returns 200 instead of 201.")
    @PostMapping("/ignored")
    public ResponseEntity<ApiResponse<IgnoredSeriesDto>> ignore(@RequestBody IgnoredSeriesDto dto) {
        IgnoreOutcome outcome = ignoredSeriesService.ignore(dto);
        HttpStatus status = outcome.created() ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(new ApiResponse<>(outcome.dto()));
    }

    @Operation(summary = "Search and filter series",
        description = "yearMin/yearMax use true interval-overlap matching against a series' "
            + "known airing span, not just its stored year. Supports sortBy/sortDirection.")
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<SeriesDto>>> search(
            @RequestParam(required = false) String title,
            @Parameter(description = "Repeatable, case-insensitive substring match against the "
                + "stored genres field, OR'd across multiple values. If a series matches both "
                + "genre and excludeGenre, the exclusion wins.")
            @RequestParam(required = false) List<String> genre,
            @Parameter(description = "Repeatable, case-insensitive substring match against the "
                + "stored genres field; drops any matching series. A series with no genres at "
                + "all is never excluded. Exclusion wins over genre on conflict.")
            @RequestParam(required = false) List<String> excludeGenre,
            @RequestParam(required = false) List<String> keyword,
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
            @RequestParam(required = false) String sortDirection) {

        SeriesSearchCriteria c = buildCriteria(title, genre, status, originCountry, originalLanguage,
            minPersonalRating, minImdbRating, minTmdbRating, minRottenTomatoesRating,
            minRottenTomatoesPopcornmeter, yearMin, yearMax);
        c.setExcludeGenres(excludeGenre);
        c.setKeywords(keyword);
        c.setFlaggedForRewatch(flaggedForRewatch);
        c.setMissingImdbRating(missingImdbRating);
        c.setMissingTmdbRating(missingTmdbRating);
        c.setMissingRottenTomatoesRating(missingRottenTomatoesRating);
        c.setMissingRottenTomatoesPopcornmeter(missingRottenTomatoesPopcornmeter);
        c.setSortBy(sortBy);
        c.setSortDirection(sortDirection);

        List<SeriesDto> results = searchService.search(c);
        long excludedCount = searchService.countMissingForSort(c);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size(), excludedCount));
    }

    @Operation(summary = "Export series as JSON or CSV",
        description = "Accepts the same title/genre/status/originCountry/originalLanguage/"
            + "min*Rating/yearMin/yearMax filter params as GET /api/v1/series/search (a smaller "
            + "shared subset -- no excludeGenre/keyword/flaggedForRewatch/missing-rating "
            + "booleans/sort params on this endpoint).")
    @GetMapping("/export")
    public ResponseEntity<String> export(
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
            @RequestParam(required = false) Integer yearMax) {

        if (!format.equalsIgnoreCase("json") && !format.equalsIgnoreCase("csv")) {
            return ResponseEntity.badRequest().body("Invalid format. Use 'json' or 'csv'.");
        }

        SeriesSearchCriteria c = buildCriteria(title, genre, status, originCountry, originalLanguage,
            minPersonalRating, minImdbRating, minTmdbRating, minRottenTomatoesRating,
            minRottenTomatoesPopcornmeter, yearMin, yearMax);

        List<SeriesDto> series = searchService.search(c);
        String ts = LocalDateTime.now(clock).format(FILENAME_FMT);
        String content;
        String filename;
        String contentType;

        if (format.equalsIgnoreCase("json")) {
            content = exportService.exportAsJson(series, LocalDateTime.now(clock));
            filename = "series-export-" + ts + ".json";
            contentType = "application/json";
        } else {
            content = exportService.exportAsCsv(series);
            filename = "series-export-" + ts + ".csv";
            contentType = "text/csv";
        }

        return ResponseEntity.ok()
            .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType(contentType))
            .body(content);
    }

    /**
     * The 12 {@link SeriesSearchCriteria} fields shared verbatim by {@link #search} and
     * {@link #export} -- {@code search}'s 9 extra fields ({@code excludeGenres}, {@code
     * keywords}, {@code flaggedForRewatch}, {@code missingImdbRating}, {@code
     * missingTmdbRating}, {@code missingRottenTomatoesRating}, {@code
     * missingRottenTomatoesPopcornmeter}, {@code sortBy}, {@code sortDirection}) are set by
     * its own caller on the returned instance.
     */
    private SeriesSearchCriteria buildCriteria(String title, List<String> genre, String status,
            List<String> originCountry, String originalLanguage,
            Integer minPersonalRating, BigDecimal minImdbRating, BigDecimal minTmdbRating,
            Integer minRottenTomatoesRating, Integer minRottenTomatoesPopcornmeter,
            Integer yearMin, Integer yearMax) {
        SeriesSearchCriteria c = new SeriesSearchCriteria();
        c.setTitle(title);
        c.setGenres(genre);
        c.setStatus(status);
        c.setOriginCountry(originCountry);
        c.setOriginalLanguage(originalLanguage);
        c.setMinPersonalRating(minPersonalRating);
        c.setMinImdbRating(minImdbRating);
        c.setMinTmdbRating(minTmdbRating);
        c.setMinRottenTomatoesRating(minRottenTomatoesRating);
        c.setMinRottenTomatoesPopcornmeter(minRottenTomatoesPopcornmeter);
        c.setYearMin(yearMin);
        c.setYearMax(yearMax);
        return c;
    }

    // series_spec_038_import.md (SERIES-038-AC-01/02): JSON only -- reads the same
    // { series: SeriesDto[] } shape SeriesExportService.exportAsJson produces, ignoring
    // exportDate/count if present so a re-uploaded, unmodified export file works unchanged.
    // Parsed/validated here, before importService.start is ever called, so a structurally
    // invalid upload is rejected with 400 without starting a job.
    @Operation(summary = "Start an async job re-importing a previously exported file",
        description = "Multipart file upload (file field), dispatched by extension: a JSON file "
            + "(containing a series array of SeriesDto objects) or a CSV file (header row must "
            + "match GET /api/v1/series/export?format=csv's column order exactly). 400 before any "
            + "job starts if the extension is neither, or the file content doesn't match. A "
            + "duplicate imdbId is caught and counted toward skippedCount, not a job failure; any "
            + "other per-row failure is counted toward errorCount instead. 409 if an import job "
            + "is already running (tracked independently from bulk refresh).")
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<ImportJobStatus>> importSeries(@RequestParam("file") MultipartFile file) {
        List<SeriesDto> entries = importFileParser.parse(file);
        ImportJobStatus status = importService.start(entries);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new ApiResponse<>(status));
    }

    @Operation(summary = "Poll the current (or most recently finished) bulk import job",
        description = "status is IDLE before any job has ever run, then progresses through "
            + "IN_PROGRESS to COMPLETED or FAILED -- a completed run's result stays visible here "
            + "until a new job starts.")
    @GetMapping("/import/status")
    public ResponseEntity<ApiResponse<ImportJobStatus>> importStatus() {
        return ResponseEntity.ok(new ApiResponse<>(importService.status()));
    }
}
