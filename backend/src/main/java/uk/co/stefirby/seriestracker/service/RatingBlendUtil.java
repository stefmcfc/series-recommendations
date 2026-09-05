package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.model.SeriesEntity;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md (SERIES-047-AC-01): a
 * shared, non-instantiable helper computing a series' "blended rating" -- the unweighted
 * average of whichever of {@code imdbRating}/{@code tmdbRating} are non-null, rounded
 * {@code HALF_UP} to one decimal place. {@code rottenTomatoesRating}/
 * {@code rottenTomatoesPopcornmeter} are deliberately excluded (see the spec's Design
 * Decisions -- they're on a 0-100 scale, not 0-10, and normalizing them is out of scope here).
 * Reused unchanged by {@code series_spec_048}/{@code series_spec_049} so this average isn't
 * re-derived across multiple stats services.
 */
public final class RatingBlendUtil {

    private RatingBlendUtil() {
    }

    public static BigDecimal blendedRating(SeriesEntity entity) {
        List<BigDecimal> ratings = new ArrayList<>();
        if (entity.getImdbRating() != null) {
            ratings.add(entity.getImdbRating());
        }
        if (entity.getTmdbRating() != null) {
            ratings.add(entity.getTmdbRating());
        }
        if (ratings.isEmpty()) {
            return null;
        }
        BigDecimal sum = ratings.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(ratings.size()), 1, RoundingMode.HALF_UP);
    }
}
