package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.CountryStatDto;
import uk.co.stefirby.seriestracker.service.stats.CountryStatsService;
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

    @GetMapping("/origin-country/stats")
    public ResponseEntity<ApiResponse<List<CountryStatDto>>> originCountryStats(
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection,
            @RequestParam(required = false) Integer minSeriesCount,
            @RequestParam(required = false) BigDecimal minAveragePersonalRating,
            @RequestParam(required = false) BigDecimal minAverageBlendedRating,
            @RequestParam(required = false) Boolean onlyCompleted) {
        List<CountryStatDto> stats = countryStatsService.getStats(
            sortBy, sortDirection, minSeriesCount, minAveragePersonalRating, minAverageBlendedRating, onlyCompleted);
        return ResponseEntity.ok(new ApiResponse<>(stats, stats.size()));
    }
}
