package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.NameStatDto;
import uk.co.stefirby.seriestracker.service.stats.KeywordStatsService;
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
 * TOOLING-002-AC-13/14: keyword-stats endpoint, extracted from {@code SeriesController}.
 *
 * <p>series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md (SERIES-047-AC-06/
 * AC-09): {@code sortDirection}, {@code minSeriesCount}, {@code minAveragePersonalRating}, and
 * {@code minAverageBlendedRating} are all optional and simply passed through to {@link
 * KeywordStatsService#getStats} -- the soft-fallback/filtering logic itself lives there, not
 * here, per this codebase's "controllers stay thin" convention.
 *
 * <p>series_spec_051_stats_status_scope_filter.md (SERIES-051-AC-06/AC-08): {@code
 * onlyCompleted} is likewise optional and passed through unchanged -- omitting it produces a
 * response byte-identical to before this param existed.
 */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesKeywordController {

    private final KeywordStatsService keywordStatsService;

    public SeriesKeywordController(KeywordStatsService keywordStatsService) {
        this.keywordStatsService = keywordStatsService;
    }

    @Operation(summary = "Aggregate per-keyword stats across tracked series",
        description = "Aggregates seriesCount/averagePersonalRating/averageBlendedRating per "
            + "keyword from normalized TMDB keyword data. Empty list, not an error, when "
            + "nothing tracked has keywords.")
    @GetMapping("/keywords")
    public ResponseEntity<ApiResponse<List<NameStatDto>>> keywords(
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
            @RequestParam(required = false) Boolean onlyCompleted) {
        List<NameStatDto> stats = keywordStatsService.getStats(
            sortBy, sortDirection, minSeriesCount, minAveragePersonalRating, minAverageBlendedRating, onlyCompleted);
        return ResponseEntity.ok(new ApiResponse<>(stats, stats.size()));
    }
}
