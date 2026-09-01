package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;

/**
 * Backs {@code GET /api/v1/series/recommendations/{tmdbId}/details} -- an on-demand,
 * single-candidate lookup that fills in a recommendation card's season/episode counts and
 * IMDb rating, none of which {@link RecommendationDto} carries up front (folding them into
 * the bulk {@code recommend()} response would cost a TMDB + OMDb call per card in a 10-20
 * result list the user never asked to expand). Mirrors {@code getKeywordsForCandidate}'s
 * on-demand, tmdbId-scoped, best-effort-degrading precedent exactly -- see
 * {@code series_spec_036_recommendation_candidate_details.md}.
 *
 * <p>All three fields are independently nullable: {@code numberOfSeasons}/{@code
 * numberOfEpisodes} come from {@link
 * uk.co.stefirby.seriestracker.client.tmdb.TmdbClient#details(int)} and are both {@code null}
 * together if that call fails; {@code imdbRating} comes from {@link
 * uk.co.stefirby.seriestracker.client.omdb.OmdbClient#ratingsForImdbId(String)} and is {@code
 * null} if no {@code imdbId} was supplied or that call fails. Neither source's failure affects
 * the other.
 *
 * <p>A record: always built fully, in one place ({@code
 * RecommendationService.getDetailsForCandidate}), and never mutated afterward.
 */
public record CandidateDetailDto(
    Integer numberOfSeasons,
    Integer numberOfEpisodes,
    BigDecimal imdbRating
) {
}
