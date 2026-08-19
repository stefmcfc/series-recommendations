package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;

/**
 * A single suggested series returned by {@code GET /api/v1/series/recommendations}. Not a
 * persisted series (no {@code id}) -- mirrors {@link SeriesLookupDto}'s rationale for being
 * its own DTO rather than reusing {@link SeriesDto}.
 *
 * <p>{@code tmdbRating} is TMDB's {@code vote_average}, deliberately never conflated with
 * {@code imdbRating} -- they're different rating systems on different scales/methodologies.
 *
 * <p>A record: always built fully, in one place ({@code RecommendationService.toDto}), and
 * never mutated afterward -- see the "Records over classes" guidance in this project's Java
 * conventions.
 */
public record RecommendationDto(
    String title,
    Integer year,
    String genres,
    String overview,
    String posterUrl,
    BigDecimal tmdbRating,
    String imdbId,
    String sourceTitle
) {
}
