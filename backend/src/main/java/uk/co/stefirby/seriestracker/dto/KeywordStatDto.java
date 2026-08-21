package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;

/**
 * One aggregated keyword stat entry, backing {@code GET /api/v1/series/keywords}
 * (SERIES-019-AC-13). {@code averagePersonalRating} is {@code null}, not {@code 0}, when no
 * series carrying the keyword has a {@code personalRating} set.
 */
public record KeywordStatDto(String name, Integer seriesCount, BigDecimal averagePersonalRating) {
}
