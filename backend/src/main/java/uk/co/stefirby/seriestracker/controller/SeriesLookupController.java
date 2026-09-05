package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.SeriesLookupDto;
import uk.co.stefirby.seriestracker.dto.TmdbLookupCandidateDto;
import uk.co.stefirby.seriestracker.service.tmdb.SeriesLookupService;
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

    @GetMapping("/lookup/search-tmdb")
    public ResponseEntity<ApiResponse<List<TmdbLookupCandidateDto>>> lookupSearchTmdb(@RequestParam String title) {
        if (title.isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        List<TmdbLookupCandidateDto> results = lookupService.searchTmdb(title);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size()));
    }

    @GetMapping("/lookup/resolve-tmdb")
    public ResponseEntity<ApiResponse<SeriesLookupDto>> lookupResolveTmdb(@RequestParam int tmdbId) {
        SeriesLookupDto dto = lookupService.resolveTmdbCandidate(tmdbId);
        return ResponseEntity.ok(new ApiResponse<>(dto));
    }
}
