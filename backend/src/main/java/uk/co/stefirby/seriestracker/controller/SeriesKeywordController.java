package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.KeywordStatDto;
import uk.co.stefirby.seriestracker.service.KeywordStatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** TOOLING-002-AC-13/14: keyword-stats endpoint, extracted from {@code SeriesController}. */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesKeywordController {

    private final KeywordStatsService keywordStatsService;

    public SeriesKeywordController(KeywordStatsService keywordStatsService) {
        this.keywordStatsService = keywordStatsService;
    }

    @GetMapping("/keywords")
    public ResponseEntity<ApiResponse<List<KeywordStatDto>>> keywords(
            @RequestParam(required = false) String sortBy) {
        List<KeywordStatDto> stats = keywordStatsService.getStats(sortBy);
        return ResponseEntity.ok(new ApiResponse<>(stats, stats.size()));
    }
}
