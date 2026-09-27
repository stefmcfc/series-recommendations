package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.CandidateDetailDto;
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

import java.math.BigDecimal;
import java.util.List;

@RequestMapping("/api/v1/series")
public interface SeriesRecommendationControllerApi {

    @Operation(summary = "Suggest series to watch next",
        description = "limit defaults to 20, clamped to 1-50. Excludes anything already added "
            + "or ignored. Requires app.tmdb.api-key once there's data to source from, otherwise "
            + "502. Sourcing mode is selected via sourceMode/seriesIds/genres/keywords: "
            + "sourceMode=useMySeries (or an explicit seriesIds selection) sources from TMDB "
            + "based on your COMPLETED series, mutually exclusive with genres/keywords but "
            + "compatible with seriesIds; sourceMode=trending sources TMDB's globally trending "
            + "shows; sourceMode=topRated sources TMDB's highest-rated shows; everything else "
            + "(sourceMode omitted with no seriesIds/genres/keywords set) is Custom Search, an "
            + "unfiltered or genre/keyword-filtered TMDB discover/tv call. trending/topRated/"
            + "useMySeries are mutually exclusive with seriesIds/genres/keywords (400 if "
            + "combined), except the deliberate useMySeries + seriesIds combination.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "recommendations",
                    summary = "Two recommendation candidates, one shared by two source series",
                    value = """
                        {
                          "data": [
                            {
                              "title": "Parks and Recreation",
                              "year": 2009,
                              "genres": "Comedy",
                              "overview": "A mockumentary about a Parks Department in a small Indiana town.",
                              "posterUrl": "https://image.tmdb.org/t/p/w500/example-parks.jpg",
                              "tmdbRating": 8.2,
                              "voteCount": 3200,
                              "streamingProviders": [
                                {
                                  "name": "Peacock",
                                  "logoUrl": "https://image.tmdb.org/t/p/w500/example-peacock.jpg"
                                }
                              ],
                              "imdbId": "tt1266020",
                              "sourceTitles": ["The Office", "Brooklyn Nine-Nine"],
                              "totalSourceCount": 2,
                              "originCountry": "US",
                              "tmdbId": 8592
                            },
                            {
                              "title": "Community",
                              "year": 2009,
                              "genres": "Comedy",
                              "overview": "A suspended lawyer is forced to attend a community college.",
                              "posterUrl": null,
                              "tmdbRating": 8.5,
                              "voteCount": 1800,
                              "streamingProviders": [],
                              "imdbId": "tt1439629",
                              "sourceTitles": ["The Office"],
                              "totalSourceCount": 1,
                              "originCountry": "US",
                              "tmdbId": 25546
                            }
                          ],
                          "error": null,
                          "count": 2,
                          "excludedCount": 0
                        }"""))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400",
                ref = "#/components/responses/BadRequest"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "502",
                ref = "#/components/responses/BadGateway")
        })
    @GetMapping("/recommendations")
    ResponseEntity<ApiResponse<List<RecommendationDto>>> recommendations(
            @Parameter(description = "Max candidates to return, clamped to 1-50.",
                example = "10")
            @RequestParam(required = false, defaultValue = "20") int limit,
            @Parameter(description = "Comma-separated series ids (UUIDs) to source "
                + "recommendations from directly.",
                example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
            @RequestParam(required = false) List<String> seriesIds,
            @Parameter(description = "Comma-separated genre names sourcing a Custom Search "
                + "TMDB discover/tv call.", example = "Comedy")
            @RequestParam(required = false) List<String> genres,
            @Parameter(description = "Comma-separated TMDB keyword names sourcing a "
                + "keyword-directed TMDB discover/tv call.", example = "workplace")
            @RequestParam(required = false) List<String> keywords,
            @Parameter(description = "Excludes a candidate whose tmdbRating is null or below "
                + "this threshold. Applied as a post-fetch filter across every sourcing mode.",
                example = "7.5")
            @RequestParam(required = false) BigDecimal minTmdbRating,
            @Parameter(description = "Excludes a candidate whose TMDB vote count is below this "
                + "threshold. Applied as a post-fetch filter across every sourcing mode.",
                example = "100")
            @RequestParam(required = false) Integer minVoteCount,
            @Parameter(description = "Excludes a candidate whose known airing span ends before "
                + "this year.", example = "2015")
            @RequestParam(required = false) Integer yearMin,
            @Parameter(description = "Excludes a candidate whose known airing span starts "
                + "after this year.", example = "2024")
            @RequestParam(required = false) Integer yearMax,
            @Parameter(description = "Comma-separated genre names; excludes a candidate whose "
                + "genres match any entry, resolved via the genre alias vocabulary (not a raw "
                + "string comparison). Applied as a post-fetch filter across every sourcing "
                + "mode; for genre/keyword-directed sourcing, additionally sent to TMDB as "
                + "without_genres pre-fetch.", example = "Horror")
            @RequestParam(required = false) List<String> excludeGenres,
            @Parameter(description = "Comma-separated keyword names; excludes a candidate whose "
                + "TMDB keywords case-insensitively match any entry, applied last (after every "
                + "other output filter) across every sourcing mode. A per-candidate keyword "
                + "lookup failure fails that one candidate open rather than the whole request.",
                example = "anime")
            @RequestParam(required = false) List<String> excludeKeywords,
            @Parameter(description = "ISO 639-1 language code, sent to TMDB as "
                + "with_original_language under Custom Search sourcing only.", example = "en")
            @RequestParam(required = false) String language,
            @Parameter(description = "Comma-separated ISO 3166-1 alpha-2 codes (e.g. "
                + "countries=US,GB); excludes a candidate whose originCountry doesn't "
                + "case-insensitively match any entry, OR-matched across multiple entries, "
                + "applied unconditionally across every sourcing mode. For Custom Search "
                + "sourcing, additionally sent to TMDB as with_origin_country (pipe-joined).",
                example = "US")
            @RequestParam(required = false) List<String> countries,
            @Parameter(description = "Diversity cap: the max candidates any single source "
                + "series may contribute, before maxSourcesShown truncates each candidate's own "
                + "sourceTitles display list. Defaults to app.tmdb.max-per-source (8).",
                example = "8")
            @RequestParam(required = false) Integer maxPerSource,
            @Parameter(description = "Caps how many source titles are shown in a candidate's "
                + "own sourceTitles list; totalSourceCount still reports the true total "
                + "regardless of this cap.", example = "3")
            @RequestParam(required = false) Integer maxSourcesShown,
            @Parameter(description = "score (default) sorts by internal rank score descending; "
                + "recommendationCount sorts by totalSourceCount descending (rank score as "
                + "tiebreaker). Any other value falls back to score.", example = "score")
            @RequestParam(required = false) String sortBy,
            @Parameter(description = "trending|topRated|useMySeries selects the sourcing mode; "
                + "omitted with no seriesIds/genres/keywords set falls through to Custom Search. "
                + "useMySeries sources from TMDB based on your COMPLETED series, mutually "
                + "exclusive with genres/keywords but compatible with seriesIds. 400 if combined "
                + "with genres/keywords/other modes where disallowed, or if unrecognized.",
                example = "trending")
            @RequestParam(required = false) String sourceMode,
            @Parameter(description = "day|week (default week); only read under "
                + "sourceMode=trending, selecting TMDB's trending window.", example = "week")
            @RequestParam(required = false) String trendingWindow,
            @Parameter(description = "For topRated and Custom Search, selects the TMDB-native "
                + "discover/tv sort_by value (one of TMDB's 12 documented values, e.g. "
                + "vote_average.desc, popularity.desc; 400 if unrecognized), defaulting to "
                + "vote_average.desc for topRated and popularity.desc for Custom Search when "
                + "omitted; ignored under any other mode.", example = "popularity.desc")
            @RequestParam(required = false) String discoverSortBy,
            @Parameter(description = "Optional ISO 3166-1 alpha-2 code overriding "
                + "app.tmdb.watch-region for each candidate's own streamingProviders.",
                example = "US")
            @RequestParam(required = false) String region,
            @Parameter(description = "One of personalRatingThenDate (default), "
                + "personalRatingThenCustomBlend, customBlendThenPersonalRating -- selects how "
                + "useMySeries-sourced candidates are ranked.",
                example = "personalRatingThenDate")
            @RequestParam(required = false) String sourceRankingStrategy,
            @Parameter(description = "Comma-separated, one or more of imdb, tmdb, tomatometer, "
                + "popcornmeter -- the rating sources blended into the Custom Rating Blend used "
                + "by the two customBlend* sourceRankingStrategy values.",
                example = "imdb,tmdb")
            @RequestParam(required = false) List<String> sourceRatingBlendSources);

    @Operation(summary = "On-demand TMDB keyword lookup for a single recommendation candidate",
        description = "On-demand lookup, deliberately not folded into GET "
            + "/api/v1/series/recommendations itself -- fetching keywords for every card in a "
            + "10-20-result list would cost a TMDB call per card the user never asked to expand. "
            + "A TMDB failure or an unresolvable tmdbId both yield an empty list (200), never an "
            + "error -- there's no persisted entity here for a \"leave unchanged\" posture.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "candidate-keywords",
                    summary = "Three TMDB keywords for a candidate",
                    value = "{\"data\":[\"workplace\",\"mockumentary\",\"paper company\"],"
                        + "\"error\":null,\"count\":3,\"excludedCount\":0}")))
        })
    @GetMapping("/recommendations/{tmdbId}/keywords")
    ResponseEntity<ApiResponse<List<String>>> recommendationKeywords(
            @Parameter(description = "The Office's real, live-verified TMDB id.", example = "2316")
            @PathVariable int tmdbId);

    @Operation(summary = "On-demand lookup for a candidate's season/episode counts and IMDb rating",
        description = "On-demand, per-candidate lookup mirroring .../keywords' shape -- not "
            + "folded into the bulk recommendations response, since fetching this for every card "
            + "would cost a TMDB + OMDb call per card never asked to expand. All three fields "
            + "degrade independently to null on their respective source's failure, never a "
            + "4xx/5xx for this endpoint: numberOfSeasons/numberOfEpisodes come from TMDB (both "
            + "null together if that call fails); imdbRating comes from OMDb (null if imdbId is "
            + "omitted/blank or that call fails).",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "candidate-details-degraded",
                    summary = "TMDB counts present, IMDb rating unavailable",
                    value = "{\"data\":{\"numberOfSeasons\":9,\"numberOfEpisodes\":186,"
                        + "\"imdbRating\":null},\"error\":null,\"count\":1,\"excludedCount\":0}")))
        })
    @GetMapping("/recommendations/{tmdbId}/details")
    ResponseEntity<ApiResponse<CandidateDetailDto>> recommendationDetails(
            @Parameter(description = "The Office's real, live-verified TMDB id.", example = "2316")
            @PathVariable int tmdbId,
            @Parameter(description = "The Office's real, live-verified IMDb id.", example = "tt0386676")
            @RequestParam(required = false) String imdbId);
}
