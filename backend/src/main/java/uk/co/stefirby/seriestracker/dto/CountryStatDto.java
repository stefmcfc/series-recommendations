package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;

/**
 * One aggregated country-of-origin stat entry, backing {@code
 * GET /api/v1/series/origin-country/stats} (series_spec_049_country_of_origin_stats.md,
 * SERIES-049-AC-01). Identical shape to {@link KeywordStatDto}/{@link GenreStatDto}: {@code name}
 * holds the raw ISO 3166-1 alpha-2 code (e.g. {@code "GB"}), not a resolved display name --
 * display-name resolution is frontend-only (see the spec's Design Decisions). {@code
 * averagePersonalRating} is {@code null}, not {@code 0}, when no series carrying the country has a
 * {@code personalRating} set, and {@code averageBlendedRating} is likewise {@code null}, not
 * {@code 0}, when no carrying series has a {@code RatingBlendUtil.blendedRating}.
 */
public record CountryStatDto(
    String name,
    Integer seriesCount,
    BigDecimal averagePersonalRating,
    BigDecimal averageBlendedRating) {
}
