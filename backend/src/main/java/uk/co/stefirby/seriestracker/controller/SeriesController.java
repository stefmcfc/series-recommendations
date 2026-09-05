package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.IgnoredSeriesDto;
import uk.co.stefirby.seriestracker.dto.ImportJobStatus;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.dto.SeriesSearchCriteria;
import uk.co.stefirby.seriestracker.service.BulkImportService;
import uk.co.stefirby.seriestracker.service.IgnoreOutcome;
import uk.co.stefirby.seriestracker.service.IgnoredSeriesService;
import uk.co.stefirby.seriestracker.service.SeriesExportService;
import uk.co.stefirby.seriestracker.service.SeriesSearchService;
import uk.co.stefirby.seriestracker.service.SeriesService;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
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
    private static final String SERIES_FIELD = "series";

    private final SeriesService seriesService;
    private final SeriesSearchService searchService;
    private final SeriesExportService exportService;
    private final IgnoredSeriesService ignoredSeriesService;
    private final BulkImportService importService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public SeriesController(SeriesService seriesService,
                            SeriesSearchService searchService,
                            SeriesExportService exportService,
                            IgnoredSeriesService ignoredSeriesService,
                            BulkImportService importService,
                            ObjectMapper objectMapper,
                            Clock clock) {
        this.seriesService = seriesService;
        this.searchService = searchService;
        this.exportService = exportService;
        this.ignoredSeriesService = ignoredSeriesService;
        this.importService = importService;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SeriesDto>> create(@RequestBody SeriesDto dto) {
        SeriesDto created = seriesService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(new ApiResponse<>(created));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<SeriesDto>>> getAll(
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection) {
        List<SeriesDto> list = seriesService.getAll(sortBy, sortDirection);
        return ResponseEntity.ok(new ApiResponse<>(list, list.size()));
    }

    @GetMapping("/" + UuidPathPattern.PATTERN)
    public ResponseEntity<ApiResponse<SeriesDto>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(new ApiResponse<>(seriesService.getById(id)));
    }

    @PatchMapping("/" + UuidPathPattern.PATTERN)
    public ResponseEntity<ApiResponse<SeriesDto>> update(@PathVariable UUID id, @RequestBody SeriesDto dto) {
        return ResponseEntity.ok(new ApiResponse<>(seriesService.update(id, dto)));
    }

    @DeleteMapping("/" + UuidPathPattern.PATTERN)
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        seriesService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/ignored")
    public ResponseEntity<ApiResponse<IgnoredSeriesDto>> ignore(@RequestBody IgnoredSeriesDto dto) {
        IgnoreOutcome outcome = ignoredSeriesService.ignore(dto);
        HttpStatus status = outcome.created() ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(new ApiResponse<>(outcome.dto()));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<SeriesDto>>> search(
            @RequestParam(required = false) String title,
            @RequestParam(required = false) List<String> genre,
            @RequestParam(required = false) List<String> excludeGenre,
            @RequestParam(required = false) List<String> keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer minPersonalRating,
            @RequestParam(required = false) BigDecimal minImdbRating,
            @RequestParam(required = false) BigDecimal minTmdbRating,
            @RequestParam(required = false) Integer yearMin,
            @RequestParam(required = false) Integer yearMax,
            @RequestParam(required = false) Boolean flaggedForRewatch,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection) {

        SeriesSearchCriteria c = new SeriesSearchCriteria();
        c.setTitle(title);
        c.setGenres(genre);
        c.setExcludeGenres(excludeGenre);
        c.setKeywords(keyword);
        c.setStatus(status);
        c.setMinPersonalRating(minPersonalRating);
        c.setMinImdbRating(minImdbRating);
        c.setMinTmdbRating(minTmdbRating);
        c.setYearMin(yearMin);
        c.setYearMax(yearMax);
        c.setFlaggedForRewatch(flaggedForRewatch);
        c.setSortBy(sortBy);
        c.setSortDirection(sortDirection);

        List<SeriesDto> results = searchService.search(c);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size()));
    }

    @GetMapping("/export")
    public ResponseEntity<String> export(
            @RequestParam String format,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) List<String> genre,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer minPersonalRating,
            @RequestParam(required = false) BigDecimal minImdbRating,
            @RequestParam(required = false) BigDecimal minTmdbRating,
            @RequestParam(required = false) Integer yearMin,
            @RequestParam(required = false) Integer yearMax) {

        if (!format.equalsIgnoreCase("json") && !format.equalsIgnoreCase("csv")) {
            return ResponseEntity.badRequest().body("Invalid format. Use 'json' or 'csv'.");
        }

        SeriesSearchCriteria c = new SeriesSearchCriteria();
        c.setTitle(title);
        c.setGenres(genre);
        c.setStatus(status);
        c.setMinPersonalRating(minPersonalRating);
        c.setMinImdbRating(minImdbRating);
        c.setMinTmdbRating(minTmdbRating);
        c.setYearMin(yearMin);
        c.setYearMax(yearMax);

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

    // series_spec_038_import.md (SERIES-038-AC-01/02): JSON only -- reads the same
    // { series: SeriesDto[] } shape SeriesExportService.exportAsJson produces, ignoring
    // exportDate/count if present so a re-uploaded, unmodified export file works unchanged.
    // Parsed/validated here, before importService.start is ever called, so a structurally
    // invalid upload is rejected with 400 without starting a job.
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<ImportJobStatus>> importSeries(@RequestParam("file") MultipartFile file) {
        List<SeriesDto> entries = parseImportFile(file);
        ImportJobStatus status = importService.start(entries);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new ApiResponse<>(status));
    }

    @GetMapping("/import/status")
    public ResponseEntity<ApiResponse<ImportJobStatus>> importStatus() {
        return ResponseEntity.ok(new ApiResponse<>(importService.status()));
    }

    private List<SeriesDto> parseImportFile(MultipartFile file) {
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException _) {
            throw new IllegalArgumentException("Unable to read the uploaded file");
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(bytes);
        } catch (JacksonException _) {
            throw new IllegalArgumentException("Uploaded file is not valid JSON");
        }

        if (root == null || !root.has(SERIES_FIELD) || !root.get(SERIES_FIELD).isArray()) {
            throw new IllegalArgumentException("Uploaded file must contain a 'series' array");
        }

        return objectMapper.convertValue(root.get(SERIES_FIELD), new TypeReference<List<SeriesDto>>() { });
    }
}
