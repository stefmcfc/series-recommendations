package uk.co.stefirby.seriestracker.service.recommendation;

import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.model.SeriesEntity;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * series_spec_068_recommendation_source_ranking_strategy.md (SERIES-068-AC-06): a
 * user-configurable "Custom Rating Blend" of whichever of {@code
 * imdb}/{@code tmdb}/{@code tomatometer}/{@code popcornmeter} the caller selects --
 * deliberately a new, separate concept from {@code service.stats.RatingBlendUtil}, which is
 * fixed (always {@code imdbRating}/{@code tmdbRating} only) and feeds an unrelated
 * Analysis-page stat (see this spec's Design Decisions). {@code rottenTomatoesRating} (the
 * Tomatometer) and {@code rottenTomatoesPopcornmeter} are both 0-100, so either is divided by
 * 10 before being averaged with {@code imdbRating}/{@code tmdbRating} (already 0-10) --
 * mirroring the same normalize-before-blend principle {@code
 * RecommendationRankingService#score} already applies to {@code personalRating}.
 */
final class SourceRatingBlend {

    /** SERIES-068-AC-04: default selection when {@code sourceRatingBlendSources} is unset -- matches {@code RatingBlendUtil}'s own historical imdb/tmdb pair. */
    private static final Set<String> DEFAULT_SOURCES = Set.of(
        RecommendationDefaults.BLEND_SOURCE_IMDB, RecommendationDefaults.BLEND_SOURCE_TMDB);

    private SourceRatingBlend() {
    }

    /**
     * SERIES-068-AC-06: the average of whichever of {@code sources} are non-null on {@code
     * entity}, normalizing the two Rotten Tomatoes fields to a 0-10 scale first, or {@code null}
     * if none of the selected sources have a value.
     */
    static BigDecimal compute(SeriesEntity entity, Set<String> sources) {
        List<BigDecimal> ratings = new ArrayList<>();
        if (sources.contains(RecommendationDefaults.BLEND_SOURCE_IMDB) && entity.getImdbRating() != null) {
            ratings.add(entity.getImdbRating());
        }
        if (sources.contains(RecommendationDefaults.BLEND_SOURCE_TMDB) && entity.getTmdbRating() != null) {
            ratings.add(entity.getTmdbRating());
        }
        if (sources.contains(RecommendationDefaults.BLEND_SOURCE_TOMATOMETER) && entity.getRottenTomatoesRating() != null) {
            ratings.add(normalize(entity.getRottenTomatoesRating()));
        }
        if (sources.contains(RecommendationDefaults.BLEND_SOURCE_POPCORNMETER) && entity.getRottenTomatoesPopcornmeter() != null) {
            ratings.add(normalize(entity.getRottenTomatoesPopcornmeter()));
        }
        if (ratings.isEmpty()) {
            return null;
        }
        BigDecimal sum = ratings.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(ratings.size()), 1, RoundingMode.HALF_UP);
    }

    /** Rotten Tomatoes' 0-100 scale -> the 0-10 scale {@code imdbRating}/{@code tmdbRating} already share. */
    private static BigDecimal normalize(Integer rottenTomatoesValue) {
        return BigDecimal.valueOf(rottenTomatoesValue).divide(BigDecimal.TEN);
    }

    /** SERIES-068-AC-04: an explicit, non-empty {@code sourceRatingBlendSources} wins; otherwise {@link #DEFAULT_SOURCES}. */
    static Set<String> resolveSources(RecommendationCriteria criteria) {
        List<String> configured = criteria.getSourceRatingBlendSources();
        return configured == null || configured.isEmpty() ? DEFAULT_SOURCES : Set.copyOf(configured);
    }
}
