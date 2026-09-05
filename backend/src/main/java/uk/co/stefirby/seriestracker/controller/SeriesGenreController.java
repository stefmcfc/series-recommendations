package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.GenreStatDto;
import uk.co.stefirby.seriestracker.service.stats.GenreStatsService;
import uk.co.stefirby.seriestracker.service.tmdb.TmdbGenreTable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * TOOLING-002-AC-11/12: genre-taxonomy endpoint, extracted from {@code SeriesController}.
 *
 * <p>series_spec_048_genre_stats.md (SERIES-048-AC-05): {@code /genres/stats} is added
 * alongside the existing static-taxonomy {@code /genres} endpoint rather than a new controller
 * class -- genre-related endpoints are still small enough to share one, per the spec's Design
 * Decisions.
 *
 * <p>series_spec_051_stats_status_scope_filter.md (SERIES-051-AC-07/AC-08): {@code
 * onlyCompleted} is likewise optional and passed through unchanged -- omitting it produces a
 * response byte-identical to before this param existed.
 */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesGenreController {

    private final TmdbGenreTable genreTable;
    private final GenreStatsService genreStatsService;

    public SeriesGenreController(TmdbGenreTable genreTable, GenreStatsService genreStatsService) {
        this.genreTable = genreTable;
        this.genreStatsService = genreStatsService;
    }

    @GetMapping("/genres")
    public ResponseEntity<ApiResponse<List<String>>> genres() {
        List<String> aliases = genreTable.allAliasNames();
        return ResponseEntity.ok(new ApiResponse<>(aliases, aliases.size()));
    }

    @GetMapping("/genres/stats")
    public ResponseEntity<ApiResponse<List<GenreStatDto>>> genreStats(
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection,
            @RequestParam(required = false) Integer minSeriesCount,
            @RequestParam(required = false) BigDecimal minAveragePersonalRating,
            @RequestParam(required = false) BigDecimal minAverageBlendedRating,
            @RequestParam(required = false) Boolean onlyCompleted) {
        List<GenreStatDto> stats = genreStatsService.getStats(
            sortBy, sortDirection, minSeriesCount, minAveragePersonalRating, minAverageBlendedRating, onlyCompleted);
        return ResponseEntity.ok(new ApiResponse<>(stats, stats.size()));
    }
}
