package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.NameStatDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.math.BigDecimal;
import java.util.List;

@RequestMapping("/api/v1/series")
public interface SeriesGenreControllerApi {

    @Operation(summary = "List the genre alias vocabulary",
        description = "The full set of genre alias names this app/OMDb's vocabulary accepts -- "
            + "every name a genre/excludeGenre search filter or a genres recommendation param "
            + "can resolve, one entry per TMDB alias. Always 200; no query params.")
    @GetMapping("/genres")
    ResponseEntity<ApiResponse<List<String>>> genres();

    @Operation(summary = "Aggregate per-genre stats across tracked series",
        description = "Aggregates seriesCount/averagePersonalRating/averageBlendedRating per "
            + "genre from the comma-delimited genres column, de-duplicated per series. Empty "
            + "list, not an error, when nothing tracked has genres.")
    @GetMapping("/genres/stats")
    ResponseEntity<ApiResponse<List<NameStatDto>>> genreStats(
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
            @RequestParam(required = false) Boolean onlyCompleted);
}
