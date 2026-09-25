package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.CandidateDetailDto;
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.service.recommendation.RecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/** TOOLING-002-AC-07/08: recommendation endpoints, extracted from {@code SeriesController}. */
@RestController
public class SeriesRecommendationController implements SeriesRecommendationControllerApi {

    private final RecommendationService recommendationService;

    public SeriesRecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @Override
    public ResponseEntity<ApiResponse<List<RecommendationDto>>> recommendations(
            int limit,
            List<String> seriesIds,
            List<String> genres,
            List<String> keywords,
            BigDecimal minTmdbRating,
            Integer minVoteCount,
            Integer yearMin,
            Integer yearMax,
            List<String> excludeGenres,
            List<String> excludeKeywords,
            String language,
            List<String> countries,
            Integer maxPerSource,
            Integer maxSourcesShown,
            String sortBy,
            String sourceMode,
            String trendingWindow,
            String discoverSortBy,
            String region,
            String sourceRankingStrategy,
            List<String> sourceRatingBlendSources) {
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
        criteria.setRegion(region);
        criteria.setSourceRankingStrategy(sourceRankingStrategy);
        criteria.setSourceRatingBlendSources(sourceRatingBlendSources);

        List<RecommendationDto> results = recommendationService.recommend(clampedLimit, criteria);
        return ResponseEntity.ok(new ApiResponse<>(results, results.size()));
    }

    @Override
    public ResponseEntity<ApiResponse<List<String>>> recommendationKeywords(int tmdbId) {
        List<String> keywords = recommendationService.getKeywordsForCandidate(tmdbId);
        return ResponseEntity.ok(new ApiResponse<>(keywords, keywords.size()));
    }

    /**
     * SERIES-036-AC-04: single-object envelope (matching {@code SeriesController.getById}'s
     * {@code ApiResponse<SeriesDto>} shape), not the list-plus-{@code count} shape {@link
     * #recommendationKeywords(int)}/{@link #recommendations} use -- this returns one object,
     * not a collection.
     */
    @Override
    public ResponseEntity<ApiResponse<CandidateDetailDto>> recommendationDetails(int tmdbId, String imdbId) {
        CandidateDetailDto details = recommendationService.getDetailsForCandidate(tmdbId, imdbId);
        return ResponseEntity.ok(new ApiResponse<>(details));
    }
}
