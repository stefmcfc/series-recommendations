package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.KeywordStatDto;
import uk.co.stefirby.seriestracker.service.stats.KeywordStatsService;
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
 */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesKeywordController {

    private final KeywordStatsService keywordStatsService;

    public SeriesKeywordController(KeywordStatsService keywordStatsService) {
        this.keywordStatsService = keywordStatsService;
    }

    @GetMapping("/keywords")
    public ResponseEntity<ApiResponse<List<KeywordStatDto>>> keywords(
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection,
            @RequestParam(required = false) Integer minSeriesCount,
            @RequestParam(required = false) BigDecimal minAveragePersonalRating,
            @RequestParam(required = false) BigDecimal minAverageBlendedRating) {
        List<KeywordStatDto> stats = keywordStatsService.getStats(
            sortBy, sortDirection, minSeriesCount, minAveragePersonalRating, minAverageBlendedRating);
        return ResponseEntity.ok(new ApiResponse<>(stats, stats.size()));
    }
}
