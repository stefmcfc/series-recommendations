package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.service.tmdb.WatchProviderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * TOOLING-002-AC-09/10: per-series watch-provider endpoint, extracted from {@code
 * SeriesController}. Depends on {@code WatchProviderService} directly (TOOLING-003-AC-09), not
 * {@code RecommendationService} -- this endpoint isn't a recommendation.
 */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesWatchProviderController {

    private final WatchProviderService watchProviderService;

    public SeriesWatchProviderController(WatchProviderService watchProviderService) {
        this.watchProviderService = watchProviderService;
    }

    /**
     * SERIES-053-AC-03/04: {@code region} is optional -- omitting it behaves identically to
     * before this spec, with {@code WatchProviderService}'s injected {@code
     * app.tmdb.watch-region} default governing.
     */
    @Operation(summary = "On-demand streaming availability for one tracked series",
        description = "The same streamingProviders shape each recommendations result already "
            + "carries inline, fetched live per request (never persisted), in "
            + "app.tmdb.watch-region (default GB). Requires app.tmdb.api-key, but never fails "
            + "with 502 even when it's unset or the TMDB call fails: always 200 with an empty "
            + "list in that case. 404 for an unknown series id.")
    @GetMapping("/" + UuidPathPattern.PATTERN + "/watch-providers")
    public ResponseEntity<ApiResponse<List<RecommendationDto.StreamingProvider>>> watchProviders(
            @PathVariable UUID id,
            @Parameter(description = "Optional ISO 3166-1 alpha-2 code overriding "
                + "app.tmdb.watch-region for this lookup; omitting it behaves identically to "
                + "before -- the injected default governs.")
            @RequestParam(required = false) String region) {
        List<RecommendationDto.StreamingProvider> results = watchProviderService.getStreamingProvidersForSeries(id, region);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size()));
    }
}
