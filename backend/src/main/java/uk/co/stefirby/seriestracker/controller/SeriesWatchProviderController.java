package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.service.tmdb.WatchProviderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * TOOLING-002-AC-09/10: per-series watch-provider endpoint, extracted from {@code
 * SeriesController}. Depends on {@code WatchProviderService} directly (TOOLING-003-AC-09), not
 * {@code RecommendationService} -- this endpoint isn't a recommendation.
 */
@RestController
public class SeriesWatchProviderController implements SeriesWatchProviderControllerApi {

    private final WatchProviderService watchProviderService;

    public SeriesWatchProviderController(WatchProviderService watchProviderService) {
        this.watchProviderService = watchProviderService;
    }

    /**
     * SERIES-053-AC-03/04: {@code region} is optional -- omitting it behaves identically to
     * before this spec, with {@code WatchProviderService}'s injected {@code
     * app.tmdb.watch-region} default governing.
     */
    @Override
    public ResponseEntity<ApiResponse<List<RecommendationDto.StreamingProvider>>> watchProviders(
            UUID id, String region) {
        List<RecommendationDto.StreamingProvider> results = watchProviderService.getStreamingProvidersForSeries(id, region);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size()));
    }
}
