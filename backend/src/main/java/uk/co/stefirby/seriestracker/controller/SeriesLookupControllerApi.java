package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.SeriesLookupDto;
import uk.co.stefirby.seriestracker.dto.TmdbLookupCandidateDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@RequestMapping("/api/v1/series")
public interface SeriesLookupControllerApi {

    @Operation(summary = "Search TMDB for a title",
        description = "TMDB is this app's sole search source (matches original/translated/AKA "
            + "names). Requires app.tmdb.api-key. An empty result is a normal 200 with an empty "
            + "list, not an error.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "tmdb-candidates", value = """
                        {
                          "data": [
                            {
                              "tmdbId": 2316,
                              "title": "The Office",
                              "year": 2005,
                              "originalTitle": null,
                              "posterUrl": "https://image.tmdb.org/t/p/w500/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg",
                              "originCountry": "US"
                            },
                            {
                              "tmdbId": 2996,
                              "title": "The Office",
                              "year": 2001,
                              "originalTitle": null,
                              "posterUrl": "https://image.tmdb.org/t/p/w500/oX2JKE1RzAONMbYlujHx0hRAJo1.jpg",
                              "originCountry": "GB"
                            }
                          ],
                          "error": null,
                          "count": 2,
                          "excludedCount": 0
                        }""")))
        })
    @GetMapping("/lookup/search-tmdb")
    ResponseEntity<ApiResponse<List<TmdbLookupCandidateDto>>> lookupSearchTmdb(
            @Parameter(example = "The Office")
            @RequestParam String title);

    @Operation(summary = "Resolve a TMDB search candidate to full lookup detail",
        description = "Built exclusively from TMDB's own data. If TMDB resolves an imdbId, "
            + "imdbRating/rottenTomatoesRating are additionally merged in from OMDb (requires "
            + "app.omdb.api-key) -- any OMDb failure or absence just leaves those two fields "
            + "null, never fails the request. Always 200 on success; 502 only for a genuine "
            + "TMDB upstream failure.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "office-resolved", value = """
                        {
                          "data": {
                            "tmdbId": 2316,
                            "title": "The Office",
                            "year": 2005,
                            "genres": "Comedy",
                            "totalSeasons": 9,
                            "totalEpisodes": 186,
                            "imdbRating": 9.0,
                            "rottenTomatoesRating": null,
                            "tmdbRating": 8.584,
                            "tmdbVoteCount": 5508,
                            "posterUrl": "https://image.tmdb.org/t/p/w500/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg",
                            "imdbId": "tt0386676",
                            "originCountry": "US",
                            "productionStatus": "ENDED",
                            "overview": "The everyday lives of office employees in the Scranton, Pennsylvania branch of the fictional Dunder Mifflin Paper Company.",
                            "lastAirYear": 2013,
                            "originalLanguage": "en"
                          },
                          "error": null,
                          "count": 1,
                          "excludedCount": 0
                        }"""))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "502",
                ref = "#/components/responses/BadGateway")
        })
    @GetMapping("/lookup/resolve-tmdb")
    ResponseEntity<ApiResponse<SeriesLookupDto>> lookupResolveTmdb(
            @Parameter(description = "The Office's real, live-verified TMDB id.", example = "2316")
            @RequestParam int tmdbId);
}
