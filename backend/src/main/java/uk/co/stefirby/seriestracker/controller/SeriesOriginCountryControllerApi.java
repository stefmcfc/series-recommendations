package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.NameStatDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.math.BigDecimal;
import java.util.List;

@RequestMapping("/api/v1/series")
public interface SeriesOriginCountryControllerApi {

    @Operation(summary = "Aggregate per-origin-country stats across tracked series",
        description = "Aggregates seriesCount/averagePersonalRating/averageBlendedRating per "
            + "origin country from the comma-joined originCountry column. A series listing more "
            + "than one code contributes once to each listed code's aggregate, not split or "
            + "fractionally. Each result's name is the raw ISO 3166-1 alpha-2 code (e.g. \"GB\"), "
            + "not a resolved display name -- display-name resolution is frontend-only.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "origin-country-stats",
                    summary = "Two origin countries' aggregated rating/count stats",
                    value = """
                        {
                          "data": [
                            {
                              "name": "US",
                              "seriesCount": 18,
                              "averagePersonalRating": 8.2,
                              "averageBlendedRating": 7.9
                            },
                            {
                              "name": "GB",
                              "seriesCount": 6,
                              "averagePersonalRating": null,
                              "averageBlendedRating": 8.0
                            }
                          ],
                          "error": null,
                          "count": 2,
                          "excludedCount": 0
                        }""")))
        })
    @GetMapping("/origin-country/stats")
    ResponseEntity<ApiResponse<List<NameStatDto>>> originCountryStats(
            @Parameter(description = "seriesCount (default), averagePersonalRating, "
                + "averageBlendedRating, or name (raw ISO code, not display name); an "
                + "unrecognized value falls back to the default rather than 400.",
                example = "seriesCount")
            @RequestParam(required = false) String sortBy,
            @Parameter(description = "asc|desc; an unrecognized value falls back to the active "
                + "field's own established default direction rather than 400.", example = "desc")
            @RequestParam(required = false) String sortDirection,
            @Parameter(description = "Excludes any country whose seriesCount is below this "
                + "threshold. AND-combined with the other minimum-value filters.", example = "3")
            @RequestParam(required = false) Integer minSeriesCount,
            @Parameter(description = "Excludes any country whose averagePersonalRating is null "
                + "or below this threshold. AND-combined with the other minimum-value filters.",
                example = "7.5")
            @RequestParam(required = false) BigDecimal minAveragePersonalRating,
            @Parameter(description = "Excludes any country whose averageBlendedRating is null "
                + "or below this threshold. AND-combined with the other minimum-value filters.",
                example = "7.5")
            @RequestParam(required = false) BigDecimal minAverageBlendedRating,
            @Parameter(description = "Restricts aggregation to series whose status is COMPLETED "
                + "when true. null/false/omitted apply no restriction.", example = "true")
            @RequestParam(required = false) Boolean onlyCompleted);
}
