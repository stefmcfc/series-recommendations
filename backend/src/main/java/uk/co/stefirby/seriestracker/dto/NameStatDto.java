package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;

/**
 * One aggregated stat entry keyed by a distinct name, shared by the three otherwise-identical
 * response shapes formerly named {@code KeywordStatDto} (backing {@code GET /api/v1/series/keywords},
 * SERIES-019-AC-13), {@code GenreStatDto} (backing {@code GET /api/v1/series/genres/stats},
 * series_spec_048_genre_stats.md, SERIES-048-AC-01), and {@code CountryStatDto} (backing {@code
 * GET /api/v1/series/origin-country/stats}, series_spec_049_country_of_origin_stats.md,
 * SERIES-049-AC-01 -- {@code name} there holds the raw ISO 3166-1 alpha-2 code, e.g. {@code "GB"},
 * not a resolved display name; display-name resolution is frontend-only).
 *
 * <p>{@code averagePersonalRating} is {@code null}, not {@code 0}, when no series carrying the
 * name has a {@code personalRating} set. {@code averageBlendedRating} is likewise {@code null},
 * not {@code 0}, when no carrying series has a {@code RatingBlendUtil.blendedRating}.
 */
public record NameStatDto(
    String name,
    Integer seriesCount,
    BigDecimal averagePersonalRating,
    BigDecimal averageBlendedRating) {
}
