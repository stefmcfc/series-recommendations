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
public interface SeriesKeywordControllerApi {

    @Operation(summary = "Aggregate per-keyword stats across tracked series",
        description = "Aggregates seriesCount/averagePersonalRating/averageBlendedRating per "
            + "keyword from normalized TMDB keyword data. Empty list, not an error, when "
            + "nothing tracked has keywords.")
    @GetMapping("/keywords")
    ResponseEntity<ApiResponse<List<NameStatDto>>> keywords(
            @Parameter(description = "seriesCount (default), averagePersonalRating, "
                + "averageBlendedRating, or name (case-insensitive alphabetical); an "
                + "unrecognized value falls back to the default rather than 400.")
            @RequestParam(required = false) String sortBy,
            @Parameter(description = "asc|desc; an unrecognized value falls back to the active "
                + "field's own established default direction rather than 400. Null averages "
                + "always sort last, under both directions.")
            @RequestParam(required = false) String sortDirection,
            @Parameter(description = "Excludes any keyword whose seriesCount is below this "
                + "threshold. AND-combined with the other two minimum-value filters; a null "
                + "average never satisfies a minAverage* filter, even at threshold 0.")
            @RequestParam(required = false) Integer minSeriesCount,
            @Parameter(description = "Excludes any keyword whose averagePersonalRating is null "
                + "or below this threshold. AND-combined with the other two minimum-value "
                + "filters; a null average never satisfies this filter, even at threshold 0.")
            @RequestParam(required = false) BigDecimal minAveragePersonalRating,
            @Parameter(description = "Excludes any keyword whose averageBlendedRating is null "
                + "or below this threshold. AND-combined with the other two minimum-value "
                + "filters; a null average never satisfies this filter, even at threshold 0.")
            @RequestParam(required = false) BigDecimal minAverageBlendedRating,
            @Parameter(description = "Restricts aggregation to series whose status is COMPLETED "
                + "when true. null/false/omitted apply no restriction.")
            @RequestParam(required = false) Boolean onlyCompleted);
}
