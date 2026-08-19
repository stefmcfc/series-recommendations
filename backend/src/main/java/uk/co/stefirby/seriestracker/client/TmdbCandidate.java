package uk.co.stefirby.seriestracker.client;

import java.math.BigDecimal;
import java.util.List;

/**
 * A single TV series result from a {@link TmdbClient} call ({@code recommendations},
 * {@code similar}, or {@code discoverByGenre}) -- TMDB's raw response fields mapped onto
 * this app's own naming, per {@code series_spec_006_recommendations.md} Requirement 3.
 *
 * <p>{@code genreIds} is TMDB's {@code genre_ids} array on each result. It isn't explicitly
 * listed in SERIES-006-AC-09's field list, but is needed to populate {@code RecommendationDto
 * .genres} (SERIES-006-AC-28) -- TMDB's documented {@code /tv/{id}/recommendations},
 * {@code /tv/{id}/similar}, and {@code /discover/tv} responses all include it on every
 * result object.
 */
public record TmdbCandidate(
    int tmdbId,
    String title,
    Integer year,
    String overview,
    String posterPath,
    BigDecimal voteAverage,
    List<Integer> genreIds
) {
}
