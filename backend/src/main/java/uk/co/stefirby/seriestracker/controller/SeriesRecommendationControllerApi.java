package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.CandidateDetailDto;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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
            + "combined), except the deliberate useMySeries + seriesIds combination.")
    @GetMapping("/recommendations")
    ResponseEntity<ApiResponse<List<RecommendationDto>>> recommendations(
            @RequestParam(required = false, defaultValue = "20") int limit,
            @RequestParam(required = false) List<String> seriesIds,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false) List<String> keywords,
            @RequestParam(required = false) BigDecimal minTmdbRating,
            @RequestParam(required = false) Integer minVoteCount,
            @RequestParam(required = false) Integer yearMin,
            @RequestParam(required = false) Integer yearMax,
            @Parameter(description = "Comma-separated genre names; excludes a candidate whose "
                + "genres match any entry, resolved via the genre alias vocabulary (not a raw "
                + "string comparison). Applied as a post-fetch filter across every sourcing "
                + "mode; for genre/keyword-directed sourcing, additionally sent to TMDB as "
                + "without_genres pre-fetch.")
            @RequestParam(required = false) List<String> excludeGenres,
            @Parameter(description = "Comma-separated keyword names; excludes a candidate whose "
                + "TMDB keywords case-insensitively match any entry, applied last (after every "
                + "other output filter) across every sourcing mode. A per-candidate keyword "
                + "lookup failure fails that one candidate open rather than the whole request.")
            @RequestParam(required = false) List<String> excludeKeywords,
            @RequestParam(required = false) String language,
            @Parameter(description = "Comma-separated ISO 3166-1 alpha-2 codes (e.g. "
                + "countries=US,GB); excludes a candidate whose originCountry doesn't "
                + "case-insensitively match any entry, OR-matched across multiple entries, "
                + "applied unconditionally across every sourcing mode. For Custom Search "
                + "sourcing, additionally sent to TMDB as with_origin_country (pipe-joined).")
            @RequestParam(required = false) List<String> countries,
            @RequestParam(required = false) Integer maxPerSource,
            @RequestParam(required = false) Integer maxSourcesShown,
            @RequestParam(required = false) String sortBy,
            @Parameter(description = "trending|topRated|useMySeries selects the sourcing mode; "
                + "omitted with no seriesIds/genres/keywords set falls through to Custom Search. "
                + "useMySeries sources from TMDB based on your COMPLETED series, mutually "
                + "exclusive with genres/keywords but compatible with seriesIds. 400 if combined "
                + "with genres/keywords/other modes where disallowed, or if unrecognized.")
            @RequestParam(required = false) String sourceMode,
            @Parameter(description = "day|week (default week); only read under "
                + "sourceMode=trending, selecting TMDB's trending window.")
            @RequestParam(required = false) String trendingWindow,
            @Parameter(description = "For topRated and Custom Search, selects the TMDB-native "
                + "discover/tv sort_by value (one of TMDB's 12 documented values, e.g. "
                + "vote_average.desc, popularity.desc; 400 if unrecognized), defaulting to "
                + "vote_average.desc for topRated and popularity.desc for Custom Search when "
                + "omitted; ignored under any other mode.")
            @RequestParam(required = false) String discoverSortBy,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String sourceRankingStrategy,
            @RequestParam(required = false) List<String> sourceRatingBlendSources);

    @Operation(summary = "On-demand TMDB keyword lookup for a single recommendation candidate",
        description = "On-demand lookup, deliberately not folded into GET "
            + "/api/v1/series/recommendations itself -- fetching keywords for every card in a "
            + "10-20-result list would cost a TMDB call per card the user never asked to expand. "
            + "A TMDB failure or an unresolvable tmdbId both yield an empty list (200), never an "
            + "error -- there's no persisted entity here for a \"leave unchanged\" posture.")
    @GetMapping("/recommendations/{tmdbId}/keywords")
    ResponseEntity<ApiResponse<List<String>>> recommendationKeywords(@PathVariable int tmdbId);

    @Operation(summary = "On-demand lookup for a candidate's season/episode counts and IMDb rating",
        description = "On-demand, per-candidate lookup mirroring .../keywords' shape -- not "
            + "folded into the bulk recommendations response, since fetching this for every card "
            + "would cost a TMDB + OMDb call per card never asked to expand. All three fields "
            + "degrade independently to null on their respective source's failure, never a "
            + "4xx/5xx for this endpoint: numberOfSeasons/numberOfEpisodes come from TMDB (both "
            + "null together if that call fails); imdbRating comes from OMDb (null if imdbId is "
            + "omitted/blank or that call fails).")
    @GetMapping("/recommendations/{tmdbId}/details")
    ResponseEntity<ApiResponse<CandidateDetailDto>> recommendationDetails(
            @PathVariable int tmdbId, @RequestParam(required = false) String imdbId);
}
