package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.service.tmdb.TmdbGenreTable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** TOOLING-002-AC-11/12: genre-taxonomy endpoint, extracted from {@code SeriesController}. */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesGenreController {

    private final TmdbGenreTable genreTable;

    public SeriesGenreController(TmdbGenreTable genreTable) {
        this.genreTable = genreTable;
    }

    @GetMapping("/genres")
    public ResponseEntity<ApiResponse<List<String>>> genres() {
        List<String> aliases = genreTable.allAliasNames();
        return ResponseEntity.ok(new ApiResponse<>(aliases, aliases.size()));
    }
}
