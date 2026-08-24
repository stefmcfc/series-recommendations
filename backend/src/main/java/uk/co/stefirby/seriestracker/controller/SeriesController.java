package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.IgnoredSeriesDto;
import uk.co.stefirby.seriestracker.dto.KeywordStatDto;
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.dto.SeriesLookupDto;
import uk.co.stefirby.seriestracker.dto.SeriesSearchCriteria;
import uk.co.stefirby.seriestracker.dto.TmdbLookupCandidateDto;
import uk.co.stefirby.seriestracker.service.BulkRefreshService;
import uk.co.stefirby.seriestracker.service.IgnoreOutcome;
import uk.co.stefirby.seriestracker.service.IgnoredSeriesService;
import uk.co.stefirby.seriestracker.service.KeywordStatsService;
import uk.co.stefirby.seriestracker.service.RecommendationService;
import uk.co.stefirby.seriestracker.service.RefreshJobStatus;
import uk.co.stefirby.seriestracker.service.RefreshResult;
import uk.co.stefirby.seriestracker.service.SeriesExportService;
import uk.co.stefirby.seriestracker.service.SeriesLookupService;
import uk.co.stefirby.seriestracker.service.SeriesRefreshService;
import uk.co.stefirby.seriestracker.service.SeriesSearchService;
import uk.co.stefirby.seriestracker.service.SeriesService;
import uk.co.stefirby.seriestracker.service.TmdbGenreTable;
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

    // SERIES-017-AC-01/05: constrains {id} to an actual UUID shape so a non-UUID literal
    // path segment (e.g. the now-removed "lookup") doesn't ambiguously match this pattern
    // ahead of falling through to "no mapping found" -- without this, GET /lookup would be
    // routed here and fail UUID conversion with a 400, instead of correctly 404ing as an
    // unmapped path.
    private static final String UUID_PATH_PATTERN =
        "{id:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}";

    private final SeriesService seriesService;
    private final SeriesSearchService searchService;
    private final SeriesExportService exportService;
    private final SeriesLookupService lookupService;
    private final RecommendationService recommendationService;
    private final IgnoredSeriesService ignoredSeriesService;
    private final TmdbGenreTable genreTable;
    private final SeriesRefreshService refreshService;
    private final BulkRefreshService bulkRefreshService;
    private final KeywordStatsService keywordStatsService;

    public SeriesController(SeriesService seriesService,
                            SeriesSearchService searchService,
                            SeriesExportService exportService,
                            SeriesLookupService lookupService,
                            RecommendationService recommendationService,
                            IgnoredSeriesService ignoredSeriesService,
                            TmdbGenreTable genreTable,
                            SeriesRefreshService refreshService,
                            BulkRefreshService bulkRefreshService,
                            KeywordStatsService keywordStatsService) {
        this.seriesService = seriesService;
        this.searchService = searchService;
        this.exportService = exportService;
        this.lookupService = lookupService;
        this.recommendationService = recommendationService;
        this.ignoredSeriesService = ignoredSeriesService;
        this.genreTable = genreTable;
        this.refreshService = refreshService;
        this.bulkRefreshService = bulkRefreshService;
        this.keywordStatsService = keywordStatsService;
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

    @GetMapping("/" + UUID_PATH_PATTERN)
    public ResponseEntity<ApiResponse<SeriesDto>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(new ApiResponse<>(seriesService.getById(id)));
    }

    @PatchMapping("/" + UUID_PATH_PATTERN)
    public ResponseEntity<ApiResponse<SeriesDto>> update(@PathVariable UUID id, @RequestBody SeriesDto dto) {
        return ResponseEntity.ok(new ApiResponse<>(seriesService.update(id, dto)));
    }

    @DeleteMapping("/" + UUID_PATH_PATTERN)
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        seriesService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/" + UUID_PATH_PATTERN + "/refresh")
    public ResponseEntity<ApiResponse<RefreshResult>> refresh(@PathVariable UUID id) {
        RefreshResult result = refreshService.refresh(id);
        return ResponseEntity.ok(new ApiResponse<>(result));
    }

    @PostMapping("/" + UUID_PATH_PATTERN + "/acknowledge-new-content")
    public ResponseEntity<ApiResponse<SeriesDto>> acknowledgeNewContent(@PathVariable UUID id) {
        SeriesDto dto = refreshService.acknowledgeNewContent(id);
        return ResponseEntity.ok(new ApiResponse<>(dto));
    }

    @PostMapping("/refresh-all")
    public ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAll() {
        RefreshJobStatus status = bulkRefreshService.start();
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new ApiResponse<>(status));
    }

    @GetMapping("/refresh-all/status")
    public ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAllStatus() {
        return ResponseEntity.ok(new ApiResponse<>(bulkRefreshService.status()));
    }

    @GetMapping("/lookup/search-tmdb")
    public ResponseEntity<ApiResponse<List<TmdbLookupCandidateDto>>> lookupSearchTmdb(@RequestParam String title) {
        if (title.isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        List<TmdbLookupCandidateDto> results = lookupService.searchTmdb(title);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size()));
    }

    @GetMapping("/lookup/resolve-tmdb")
    public ResponseEntity<ApiResponse<SeriesLookupDto>> lookupResolveTmdb(@RequestParam int tmdbId) {
        SeriesLookupDto dto = lookupService.resolveTmdbCandidate(tmdbId);
        return ResponseEntity.ok(new ApiResponse<>(dto));
    }

    @GetMapping("/genres")
    public ResponseEntity<ApiResponse<List<String>>> genres() {
        List<String> aliases = genreTable.allAliasNames();
        return ResponseEntity.ok(new ApiResponse<>(aliases, aliases.size()));
    }

    @GetMapping("/keywords")
    public ResponseEntity<ApiResponse<List<KeywordStatDto>>> keywords(
            @RequestParam(required = false) String sortBy) {
        List<KeywordStatDto> stats = keywordStatsService.getStats(sortBy);
        return ResponseEntity.ok(new ApiResponse<>(stats, stats.size()));
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
            @RequestParam(required = false) Integer maxPerSource,
            @RequestParam(required = false) Integer maxSourcesShown,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sourceMode,
            @RequestParam(required = false) String trendingWindow) {
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
        criteria.setMaxSourcesShown(maxSourcesShown);
        criteria.setSortBy(sortBy);
        criteria.setSourceMode(sourceMode);
        criteria.setTrendingWindow(trendingWindow);

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
            @RequestParam(required = false) List<String> keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer minPersonalRating,
            @RequestParam(required = false) Integer maxPersonalRating,
            @RequestParam(required = false) BigDecimal minImdbRating,
            @RequestParam(required = false) BigDecimal maxImdbRating,
            @RequestParam(required = false) Boolean startedNotFinished,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection) {

        SeriesSearchCriteria c = new SeriesSearchCriteria();
        c.setTitle(title);
        c.setGenres(genre);
        c.setKeywords(keyword);
        c.setStatus(status);
        c.setMinPersonalRating(minPersonalRating);
        c.setMaxPersonalRating(maxPersonalRating);
        c.setMinImdbRating(minImdbRating);
        c.setMaxImdbRating(maxImdbRating);
        c.setStartedNotFinished(startedNotFinished);
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
