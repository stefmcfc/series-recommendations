package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.IgnoredSeriesDto;
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.dto.SeriesLookupDto;
import uk.co.stefirby.seriestracker.dto.SeriesSearchCriteria;
import uk.co.stefirby.seriestracker.service.IgnoreOutcome;
import uk.co.stefirby.seriestracker.service.IgnoredSeriesService;
import uk.co.stefirby.seriestracker.service.RecommendationService;
import uk.co.stefirby.seriestracker.service.SeriesExportService;
import uk.co.stefirby.seriestracker.service.SeriesLookupService;
import uk.co.stefirby.seriestracker.service.SeriesSearchService;
import uk.co.stefirby.seriestracker.service.SeriesService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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
    private final SeriesLookupService lookupService;
    private final RecommendationService recommendationService;
    private final IgnoredSeriesService ignoredSeriesService;

    public SeriesController(SeriesService seriesService,
                            SeriesSearchService searchService,
                            SeriesExportService exportService,
                            SeriesLookupService lookupService,
                            RecommendationService recommendationService,
                            IgnoredSeriesService ignoredSeriesService) {
        this.seriesService = seriesService;
        this.searchService = searchService;
        this.exportService = exportService;
        this.lookupService = lookupService;
        this.recommendationService = recommendationService;
        this.ignoredSeriesService = ignoredSeriesService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SeriesDto>> create(@RequestBody SeriesDto dto) {
        SeriesDto created = seriesService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(new ApiResponse<>(created));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<SeriesDto>>> getAll() {
        List<SeriesDto> list = seriesService.getAll();
        return ResponseEntity.ok(new ApiResponse<>(list, list.size()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SeriesDto>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(new ApiResponse<>(seriesService.getById(id)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<SeriesDto>> update(@PathVariable UUID id, @RequestBody SeriesDto dto) {
        return ResponseEntity.ok(new ApiResponse<>(seriesService.update(id, dto)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        seriesService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/lookup")
    public ResponseEntity<ApiResponse<SeriesLookupDto>> lookup(@RequestParam String title) {
        if (title.isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        return ResponseEntity.ok(new ApiResponse<>(lookupService.lookup(title)));
    }

    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<List<RecommendationDto>>> recommendations(
            @RequestParam(required = false, defaultValue = "20") int limit,
            @RequestParam(required = false) List<String> seriesIds,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false) List<String> keywords,
            @RequestParam(required = false) Integer minSourceRating,
            @RequestParam(required = false) BigDecimal minTmdbRating,
            @RequestParam(required = false) Integer minVoteCount,
            @RequestParam(required = false) Integer yearMin,
            @RequestParam(required = false) Integer yearMax,
            @RequestParam(required = false) List<String> excludeGenres,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) Integer maxPerSource) {
        int clampedLimit = Math.clamp(limit, 1, 50);

        RecommendationCriteria criteria = new RecommendationCriteria();
        criteria.setSeriesIds(seriesIds);
        criteria.setGenres(genres);
        criteria.setKeywords(keywords);
        criteria.setMinSourceRating(minSourceRating);
        criteria.setMinTmdbRating(minTmdbRating);
        criteria.setMinVoteCount(minVoteCount);
        criteria.setYearMin(yearMin);
        criteria.setYearMax(yearMax);
        criteria.setExcludeGenres(excludeGenres);
        criteria.setLanguage(language);
        criteria.setMaxPerSource(maxPerSource);

        List<RecommendationDto> results = recommendationService.recommend(clampedLimit, criteria);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size()));
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
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer minPersonalRating,
            @RequestParam(required = false) Integer maxPersonalRating,
            @RequestParam(required = false) BigDecimal minImdbRating,
            @RequestParam(required = false) BigDecimal maxImdbRating,
            @RequestParam(required = false) Boolean startedNotFinished) {

        SeriesSearchCriteria c = new SeriesSearchCriteria();
        c.setTitle(title);
        c.setGenres(genre);
        c.setStatus(status);
        c.setMinPersonalRating(minPersonalRating);
        c.setMaxPersonalRating(maxPersonalRating);
        c.setMinImdbRating(minImdbRating);
        c.setMaxImdbRating(maxImdbRating);
        c.setStartedNotFinished(startedNotFinished);

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
            @RequestParam(required = false) Integer maxPersonalRating,
            @RequestParam(required = false) BigDecimal minImdbRating,
            @RequestParam(required = false) BigDecimal maxImdbRating,
            @RequestParam(required = false) Boolean startedNotFinished) {

        if (!format.equalsIgnoreCase("json") && !format.equalsIgnoreCase("csv")) {
            return ResponseEntity.badRequest().body("Invalid format. Use 'json' or 'csv'.");
        }

        SeriesSearchCriteria c = new SeriesSearchCriteria();
        c.setTitle(title);
        c.setGenres(genre);
        c.setStatus(status);
        c.setMinPersonalRating(minPersonalRating);
        c.setMaxPersonalRating(maxPersonalRating);
        c.setMinImdbRating(minImdbRating);
        c.setMaxImdbRating(maxImdbRating);
        c.setStartedNotFinished(startedNotFinished);

        List<SeriesDto> series = searchService.search(c);
        String ts = LocalDateTime.now().format(FILENAME_FMT);
        String content;
        String filename;
        String contentType;

        if (format.equalsIgnoreCase("json")) {
            content = exportService.exportAsJson(series, LocalDateTime.now());
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
