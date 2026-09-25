package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.NameStatDto;
import uk.co.stefirby.seriestracker.service.stats.GenreStatsService;
import uk.co.stefirby.seriestracker.service.tmdb.TmdbGenreTable;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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

    @Operation(summary = "List the genre alias vocabulary",
        description = "The full set of genre alias names this app/OMDb's vocabulary accepts -- "
            + "every name a genre/excludeGenre search filter or a genres recommendation param "
            + "can resolve, one entry per TMDB alias. Always 200; no query params.")
    @GetMapping("/genres")
    public ResponseEntity<ApiResponse<List<String>>> genres() {
        List<String> aliases = genreTable.allAliasNames();
        return ResponseEntity.ok(new ApiResponse<>(aliases, aliases.size()));
    }

    @Operation(summary = "Aggregate per-genre stats across tracked series",
        description = "Aggregates seriesCount/averagePersonalRating/averageBlendedRating per "
            + "genre from the comma-delimited genres column, de-duplicated per series. Empty "
            + "list, not an error, when nothing tracked has genres.")
    @GetMapping("/genres/stats")
    public ResponseEntity<ApiResponse<List<NameStatDto>>> genreStats(
            @Parameter(description = "seriesCount (default), averagePersonalRating, "
                + "averageBlendedRating, or name; an unrecognized value falls back to the "
                + "default rather than 400.")
            @RequestParam(required = false) String sortBy,
            @Parameter(description = "asc|desc; an unrecognized value falls back to the active "
                + "field's own established default direction rather than 400.")
            @RequestParam(required = false) String sortDirection,
            @Parameter(description = "Excludes any genre whose seriesCount is below this "
                + "threshold. AND-combined with the other minimum-value filters.")
            @RequestParam(required = false) Integer minSeriesCount,
            @Parameter(description = "Excludes any genre whose averagePersonalRating is null or "
                + "below this threshold. AND-combined with the other minimum-value filters.")
            @RequestParam(required = false) BigDecimal minAveragePersonalRating,
            @Parameter(description = "The unweighted average of a genre's carrying series' "
                + "IMDb/TMDB ratings, excluding series with neither set. Excludes any genre "
                + "whose averageBlendedRating is null or below this threshold; AND-combined "
                + "with the other minimum-value filters.")
            @RequestParam(required = false) BigDecimal minAverageBlendedRating,
            @Parameter(description = "Restricts aggregation to series whose status is COMPLETED "
                + "when true. null/false/omitted apply no restriction.")
            @RequestParam(required = false) Boolean onlyCompleted) {
        List<NameStatDto> stats = genreStatsService.getStats(
            sortBy, sortDirection, minSeriesCount, minAveragePersonalRating, minAverageBlendedRating, onlyCompleted);
        return ResponseEntity.ok(new ApiResponse<>(stats, stats.size()));
    }
}
