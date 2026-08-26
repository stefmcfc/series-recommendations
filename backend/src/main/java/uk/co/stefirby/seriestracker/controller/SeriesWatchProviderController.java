package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.service.RecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** TOOLING-002-AC-09/10: per-series watch-provider endpoint, extracted from {@code SeriesController}. */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesWatchProviderController {

    private final RecommendationService recommendationService;

    public SeriesWatchProviderController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @GetMapping("/" + UuidPathPattern.PATTERN + "/watch-providers")
    public ResponseEntity<ApiResponse<List<RecommendationDto.StreamingProvider>>> watchProviders(@PathVariable UUID id) {
        List<RecommendationDto.StreamingProvider> results = recommendationService.getStreamingProvidersForSeries(id);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size()));
    }
}
