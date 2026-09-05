package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;

/**
 * One aggregated keyword stat entry, backing {@code GET /api/v1/series/keywords}
 * (SERIES-019-AC-13). {@code averagePersonalRating} is {@code null}, not {@code 0}, when no
 * series carrying the keyword has a {@code personalRating} set. {@code averageBlendedRating}
 * (series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md, SERIES-047-AC-02) is
 * likewise {@code null}, not {@code 0}, when no carrying series has a
 * {@code RatingBlendUtil.blendedRating}.
 */
public record KeywordStatDto(
    String name,
    Integer seriesCount,
    BigDecimal averagePersonalRating,
    BigDecimal averageBlendedRating) {
}
