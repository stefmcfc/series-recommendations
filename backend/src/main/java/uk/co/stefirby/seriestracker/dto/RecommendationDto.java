package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * A single suggested series returned by {@code GET /api/v1/series/recommendations}. Not a
 * persisted series (no {@code id}) -- mirrors {@link SeriesLookupDto}'s rationale for being
 * its own DTO rather than reusing {@link SeriesDto}.
 *
 * <p>{@code tmdbRating} is TMDB's {@code vote_average}, deliberately never conflated with
 * {@code imdbRating} -- they're different rating systems on different scales/methodologies.
 *
 * <p>{@code sourceTitles} holds the first {@code maxSourcesShown} (default 3, {@code
 * series_spec_015_multi_source_recommendations.md} SERIES-015-AC-13) titles of every watched
 * series that contributed to this recommendation, best-first by the canonical per-candidate
 * source ordering -- an empty list, never {@code null}, for a candidate sourced only via
 * genre/keyword discovery. {@code totalSourceCount} is the true, uncapped count of
 * contributing sources, unaffected by {@code maxSourcesShown} -- together they let a future
 * frontend build a "Because you watched X, Y and N more" label without re-deriving
 * attribution itself (SERIES-015-AC-09/10/11).
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
    List<String> sourceTitles,
    Integer totalSourceCount
) {
}
