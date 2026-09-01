package uk.co.stefirby.seriestracker.service.recommendation;

import java.util.List;
import java.util.UUID;

/**
 * Cache key for {@link RecommendationPoolCache}, built from exactly what feeds into {@link
 * RecommendationSourcingService#sourceFromPool}'s TMDB calls -- {@code seriesIds} (empty
 * represents the automatic pool), {@code minSourceRating}, and {@code limit} (SERIES-035-AC-04).
 * Deliberately excludes {@code sortBy}/{@code excludeGenres}/{@code excludeKeywords}/{@code
 * minTmdbRating}/{@code maxSourcesShown}/{@code maxPerSource} -- all applied strictly after
 * sourcing in {@code RecommendationService.doRecommend}'s pipeline, so none of them should affect
 * what's cached.
 *
 * <p>The compact canonical constructor normalizes {@code seriesIds} (sorted, deduplicated) so two
 * keys built from the same id set in a different input order are equal -- records derive {@code
 * equals}/{@code hashCode} from this canonical field state automatically, so no manual override
 * is needed.
 */
public record PoolCacheKey(List<UUID> seriesIds, Integer minSourceRating, int limit) {

    public PoolCacheKey {
        seriesIds = seriesIds == null
            ? List.of()
            : seriesIds.stream().sorted().distinct().toList();
    }
}
