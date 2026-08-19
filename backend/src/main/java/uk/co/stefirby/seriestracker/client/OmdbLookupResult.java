package uk.co.stefirby.seriestracker.client;

import java.math.BigDecimal;

/**
 * Normalized result of an {@link OmdbClient} title lookup -- OMDb's raw response fields
 * mapped onto this app's own naming/types, per the field-mapping table in
 * {@code series_spec_005_omdb_lookup.md}. Any field OMDb reported as {@code "N/A"} (or
 * simply didn't include) is {@code null} here.
 */
public record OmdbLookupResult(
    String title,
    Integer year,
    String genres,
    Integer totalSeasons,
    Integer totalEpisodes,
    BigDecimal imdbRating,
    Integer metacriticRating,
    Integer rottenTomatoesRating,
    String posterUrl
) {
}
