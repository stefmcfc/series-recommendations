package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.SeriesLookupDto;
import uk.co.stefirby.seriestracker.dto.TmdbLookupCandidateDto;
import uk.co.stefirby.seriestracker.service.tmdb.SeriesLookupService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** TOOLING-002-AC-05/06: TMDB lookup endpoints, extracted from {@code SeriesController}. */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesLookupController {

    private final SeriesLookupService lookupService;

    public SeriesLookupController(SeriesLookupService lookupService) {
        this.lookupService = lookupService;
    }

    @Operation(summary = "Search TMDB for a title",
        description = "TMDB is this app's sole search source (matches original/translated/AKA "
            + "names). Requires app.tmdb.api-key. An empty result is a normal 200 with an empty "
            + "list, not an error.")
    @GetMapping("/lookup/search-tmdb")
    public ResponseEntity<ApiResponse<List<TmdbLookupCandidateDto>>> lookupSearchTmdb(@RequestParam String title) {
        if (title.isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        List<TmdbLookupCandidateDto> results = lookupService.searchTmdb(title);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size()));
    }

    @Operation(summary = "Resolve a TMDB search candidate to full lookup detail",
        description = "Built exclusively from TMDB's own data. If TMDB resolves an imdbId, "
            + "imdbRating/rottenTomatoesRating are additionally merged in from OMDb (requires "
            + "app.omdb.api-key) -- any OMDb failure or absence just leaves those two fields "
            + "null, never fails the request. Always 200 on success; 502 only for a genuine "
            + "TMDB upstream failure.")
    @GetMapping("/lookup/resolve-tmdb")
    public ResponseEntity<ApiResponse<SeriesLookupDto>> lookupResolveTmdb(@RequestParam int tmdbId) {
        SeriesLookupDto dto = lookupService.resolveTmdbCandidate(tmdbId);
        return ResponseEntity.ok(new ApiResponse<>(dto));
    }
}
