package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.IgnoredSeriesDto;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.dto.SeriesSearchCriteria;
import uk.co.stefirby.seriestracker.service.IgnoreOutcome;
import uk.co.stefirby.seriestracker.service.IgnoredSeriesService;
import uk.co.stefirby.seriestracker.service.SeriesExportService;
import uk.co.stefirby.seriestracker.service.SeriesSearchService;
import uk.co.stefirby.seriestracker.service.SeriesService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/series")
public class SeriesController {

    private static final DateTimeFormatter FILENAME_FMT = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private final SeriesService seriesService;
    private final SeriesSearchService searchService;
    private final SeriesExportService exportService;
    private final IgnoredSeriesService ignoredSeriesService;
    private final Clock clock;

    public SeriesController(SeriesService seriesService,
                            SeriesSearchService searchService,
                            SeriesExportService exportService,
                            IgnoredSeriesService ignoredSeriesService,
                            Clock clock) {
        this.seriesService = seriesService;
        this.searchService = searchService;
        this.exportService = exportService;
        this.ignoredSeriesService = ignoredSeriesService;
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
}
