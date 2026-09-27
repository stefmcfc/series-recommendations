package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.UUID;

@RequestMapping("/api/v1/series")
public interface SeriesWatchProviderControllerApi {

    @Operation(summary = "On-demand streaming availability for one tracked series",
        description = "The same streamingProviders shape each recommendations result already "
            + "carries inline, fetched live per request (never persisted), in "
            + "app.tmdb.watch-region (default GB). Requires app.tmdb.api-key, but never fails "
            + "with 502 even when it's unset or the TMDB call fails: always 200 with an empty "
            + "list in that case. 404 for an unknown series id.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = {
                    @ExampleObject(name = "providers-available", value = """
                        {"data":[{"name":"Peacock","logoUrl":\
                        "https://image.tmdb.org/t/p/w500/example-peacock.jpg"}],"error":null,\
                        "count":1,"excludedCount":0}"""),
                    @ExampleObject(name = "no-providers-found", value = """
                        {"data":[],"error":null,"count":0,"excludedCount":0}""")
                })),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404",
                ref = "#/components/responses/NotFound")
        })
    @GetMapping("/" + UuidPathPattern.PATTERN + "/watch-providers")
    ResponseEntity<ApiResponse<List<RecommendationDto.StreamingProvider>>> watchProviders(
            @Parameter(example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
            @PathVariable UUID id,
            @Parameter(description = "Optional ISO 3166-1 alpha-2 code overriding "
                + "app.tmdb.watch-region for this lookup; omitting it behaves identically to "
                + "before -- the injected default governs.", example = "US")
            @RequestParam(required = false) String region);
}
