package uk.co.stefirby.seriestracker.client.omdb;

import java.math.BigDecimal;

/**
 * Result of an {@link OmdbClient#ratingsForImdbId(String)} call -- OMDb's raw response
 * narrowed to just the two rating fields this app still sources from OMDb once TMDB became
 * the primary lookup source (series_spec_017_tmdb_primary_lookup.md). Replaces the old
 * 9-field {@code OmdbLookupResult}, which carried title/year/genres/season-episode counts
 * that TMDB's own detail endpoint now supplies exclusively.
 *
 * <p>Either field may be {@code null} if OMDb reported it as {@code "N/A"}, or simply didn't
 * include a rating from that source -- Rotten Tomatoes in particular is absent from the
 * overwhelming majority of OMDb's TV records (see this spec's Design Decisions).
 */
public record OmdbRatings(
    BigDecimal imdbRating,
    Integer rottenTomatoesRating
) {
}
