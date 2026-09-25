package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.SeriesLookupDto;
import uk.co.stefirby.seriestracker.dto.TmdbLookupCandidateDto;
import uk.co.stefirby.seriestracker.service.tmdb.SeriesLookupService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** TOOLING-002-AC-05/06: TMDB lookup endpoints, extracted from {@code SeriesController}. */
@RestController
public class SeriesLookupController implements SeriesLookupControllerApi {

    private final SeriesLookupService lookupService;

    public SeriesLookupController(SeriesLookupService lookupService) {
        this.lookupService = lookupService;
    }

    @Override
    public ResponseEntity<ApiResponse<List<TmdbLookupCandidateDto>>> lookupSearchTmdb(String title) {
        if (title.isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        List<TmdbLookupCandidateDto> results = lookupService.searchTmdb(title);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size()));
    }

    @Override
    public ResponseEntity<ApiResponse<SeriesLookupDto>> lookupResolveTmdb(int tmdbId) {
        SeriesLookupDto dto = lookupService.resolveTmdbCandidate(tmdbId);
        return ResponseEntity.ok(new ApiResponse<>(dto));
    }
}
