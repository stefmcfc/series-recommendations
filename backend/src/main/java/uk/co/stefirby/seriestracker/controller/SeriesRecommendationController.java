package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.CandidateDetailDto;
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.service.recommendation.RecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/** TOOLING-002-AC-07/08: recommendation endpoints, extracted from {@code SeriesController}. */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesRecommendationController {

    private final RecommendationService recommendationService;

    public SeriesRecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<List<RecommendationDto>>> recommendations(
            @RequestParam(required = false, defaultValue = "20") int limit,
            @RequestParam(required = false) List<String> seriesIds,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false) List<String> keywords,
            @RequestParam(required = false) BigDecimal minTmdbRating,
            @RequestParam(required = false) Integer minVoteCount,
            @RequestParam(required = false) Integer yearMin,
            @RequestParam(required = false) Integer yearMax,
            @RequestParam(required = false) List<String> excludeGenres,
            @RequestParam(required = false) List<String> excludeKeywords,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) List<String> countries,
            @RequestParam(required = false) Integer maxPerSource,
            @RequestParam(required = false) Integer maxSourcesShown,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sourceMode,
            @RequestParam(required = false) String trendingWindow,
            @RequestParam(required = false) String discoverSortBy) {
        int clampedLimit = Math.clamp(limit, 1, 50);

        RecommendationCriteria criteria = new RecommendationCriteria();
        criteria.setSeriesIds(seriesIds);
        criteria.setGenres(genres);
        criteria.setKeywords(keywords);
        criteria.setMinTmdbRating(minTmdbRating);
        criteria.setMinVoteCount(minVoteCount);
        criteria.setYearMin(yearMin);
        criteria.setYearMax(yearMax);
        criteria.setExcludeGenres(excludeGenres);
        criteria.setExcludeKeywords(excludeKeywords);
        criteria.setLanguage(language);
        criteria.setCountries(countries);
        criteria.setMaxPerSource(maxPerSource);
        criteria.setMaxSourcesShown(maxSourcesShown);
        criteria.setSortBy(sortBy);
        criteria.setSourceMode(sourceMode);
        criteria.setTrendingWindow(trendingWindow);
        criteria.setDiscoverSortBy(discoverSortBy);

        List<RecommendationDto> results = recommendationService.recommend(clampedLimit, criteria);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size()));
    }

    @GetMapping("/recommendations/{tmdbId}/keywords")
    public ResponseEntity<ApiResponse<List<String>>> recommendationKeywords(@PathVariable int tmdbId) {
        List<String> keywords = recommendationService.getKeywordsForCandidate(tmdbId);
        return ResponseEntity.ok(new ApiResponse<>(keywords, keywords.size()));
    }

    /**
     * SERIES-036-AC-04: single-object envelope (matching {@code SeriesController.getById}'s
     * {@code ApiResponse<SeriesDto>} shape), not the list-plus-{@code count} shape {@link
     * #recommendationKeywords(int)}/{@link #recommendations} use -- this returns one object,
     * not a collection.
     */
    @GetMapping("/recommendations/{tmdbId}/details")
    public ResponseEntity<ApiResponse<CandidateDetailDto>> recommendationDetails(
            @PathVariable int tmdbId, @RequestParam(required = false) String imdbId) {
        CandidateDetailDto details = recommendationService.getDetailsForCandidate(tmdbId, imdbId);
        return ResponseEntity.ok(new ApiResponse<>(details));
    }
}
