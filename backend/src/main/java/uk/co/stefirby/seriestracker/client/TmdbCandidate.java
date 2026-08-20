package uk.co.stefirby.seriestracker.client;

import java.math.BigDecimal;
import java.util.List;

/**
 * A single TV series result from a {@link TmdbClient} call ({@code recommendations},
 * {@code similar}, or {@code discover}) -- TMDB's raw response fields mapped onto this app's
 * own naming, per {@code series_spec_006_recommendations.md} Requirement 3 and {@code
 * series_spec_007_recommendation_sourcing.md} Requirement 3/8.
 *
 * <p>{@code genreIds} is TMDB's {@code genre_ids} array on each result. It isn't explicitly
 * listed in SERIES-006-AC-09's field list, but is needed to populate {@code RecommendationDto
 * .genres} (SERIES-006-AC-28) -- TMDB's documented {@code /tv/{id}/recommendations},
 * {@code /tv/{id}/similar}, and {@code /discover/tv} responses all include it on every
 * result object.
 *
 * <p>{@code voteCount} ({@code vote_count}) and {@code originalLanguage}
 * ({@code original_language}) were added by SERIES-007-AC-23 to back the new
 * {@code minVoteCount}/{@code language} output filters -- both are documented as present on
 * every result object of the same three endpoints.
 */
public record TmdbCandidate(
    int tmdbId,
    String title,
    Integer year,
    String overview,
    String posterPath,
    BigDecimal voteAverage,
    List<Integer> genreIds,
    Integer voteCount,
    String originalLanguage
) {
}
