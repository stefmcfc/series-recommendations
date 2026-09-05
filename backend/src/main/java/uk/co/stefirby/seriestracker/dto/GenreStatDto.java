package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;

/**
 * One aggregated genre stat entry, backing {@code GET /api/v1/series/genres/stats}
 * (series_spec_048_genre_stats.md, SERIES-048-AC-01). Identical shape to {@link
 * KeywordStatDto}: {@code averagePersonalRating} is {@code null}, not {@code 0}, when no series
 * carrying the genre has a {@code personalRating} set, and {@code averageBlendedRating} is
 * likewise {@code null}, not {@code 0}, when no carrying series has a {@code
 * RatingBlendUtil.blendedRating}.
 */
public record GenreStatDto(
    String name,
    Integer seriesCount,
    BigDecimal averagePersonalRating,
    BigDecimal averageBlendedRating) {
}
