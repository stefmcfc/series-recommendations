package uk.co.stefirby.seriestracker.client;

import java.util.List;

/**
 * A single TV series result from {@link TmdbClient#search(String)} ({@code GET /search/tv}) --
 * TMDB's raw response fields mapped onto this app's own naming, per
 * {@code series_spec_012_tmdb_lookup_fallback.md} Requirement 2.
 *
 * <p>Deliberately distinct from {@link TmdbCandidate}: unlike the recommendation/similar/
 * discover endpoints, {@code /search/tv} also returns {@code original_name}, surfaced here as
 * {@code originalTitle} to help a user disambiguate a title catalogued under a different
 * original-language name (e.g. "Money Heist" / "La Casa de Papel") -- {@code null} when absent
 * or identical to {@code title}.
 */
public record TmdbSearchCandidate(
    int tmdbId,
    String title,
    String originalTitle,
    Integer year,
    String posterPath,
    List<Integer> genreIds
) {
}
