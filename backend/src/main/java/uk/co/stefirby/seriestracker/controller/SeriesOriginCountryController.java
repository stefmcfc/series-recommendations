package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.NameStatDto;
import uk.co.stefirby.seriestracker.service.stats.CountryStatsService;
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
 * series_spec_049_country_of_origin_stats.md (SERIES-049-AC-05/AC-06): country-of-origin stats
 * endpoint, mirroring {@link SeriesGenreController}'s {@code /genres/stats} shape exactly.
 *
 * <p>series_spec_051_stats_status_scope_filter.md: {@code onlyCompleted} is likewise optional and
 * passed through unchanged -- omitting it produces a response byte-identical to before this param
 * existed. Not among series_spec_049's own acceptance criteria (which predate series_spec_051),
 * but required to match the current shared {@code NameStatAggregator} signature.
 */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesOriginCountryController {

    private final CountryStatsService countryStatsService;

    public SeriesOriginCountryController(CountryStatsService countryStatsService) {
        this.countryStatsService = countryStatsService;
    }

    @Operation(summary = "Aggregate per-origin-country stats across tracked series",
        description = "Aggregates seriesCount/averagePersonalRating/averageBlendedRating per "
            + "origin country from the comma-joined originCountry column. A series listing more "
            + "than one code contributes once to each listed code's aggregate, not split or "
            + "fractionally. Each result's name is the raw ISO 3166-1 alpha-2 code (e.g. \"GB\"), "
            + "not a resolved display name -- display-name resolution is frontend-only.")
    @GetMapping("/origin-country/stats")
    public ResponseEntity<ApiResponse<List<NameStatDto>>> originCountryStats(
            @Parameter(description = "seriesCount (default), averagePersonalRating, "
                + "averageBlendedRating, or name (raw ISO code, not display name); an "
                + "unrecognized value falls back to the default rather than 400.")
            @RequestParam(required = false) String sortBy,
            @Parameter(description = "asc|desc; an unrecognized value falls back to the active "
                + "field's own established default direction rather than 400.")
            @RequestParam(required = false) String sortDirection,
            @Parameter(description = "Excludes any country whose seriesCount is below this "
                + "threshold. AND-combined with the other minimum-value filters.")
            @RequestParam(required = false) Integer minSeriesCount,
            @Parameter(description = "Excludes any country whose averagePersonalRating is null "
                + "or below this threshold. AND-combined with the other minimum-value filters.")
            @RequestParam(required = false) BigDecimal minAveragePersonalRating,
            @Parameter(description = "Excludes any country whose averageBlendedRating is null "
                + "or below this threshold. AND-combined with the other minimum-value filters.")
            @RequestParam(required = false) BigDecimal minAverageBlendedRating,
            @Parameter(description = "Restricts aggregation to series whose status is COMPLETED "
                + "when true. null/false/omitted apply no restriction.")
            @RequestParam(required = false) Boolean onlyCompleted) {
        List<NameStatDto> stats = countryStatsService.getStats(
            sortBy, sortDirection, minSeriesCount, minAveragePersonalRating, minAverageBlendedRating, onlyCompleted);
        return ResponseEntity.ok(new ApiResponse<>(stats, stats.size()));
    }
}
