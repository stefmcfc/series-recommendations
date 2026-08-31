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
 * {@code voteCount} is TMDB's {@code vote_count} backing that average, passed through verbatim
 * ({@code series_spec_016_recommendation_vote_count.md}).
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
 * <p>{@code originCountry} (SERIES-023-AC-02) is the candidate's first {@code origin_country}
 * entry, passed through from {@link uk.co.stefirby.seriestracker.client.tmdb.TmdbCandidate}
 * verbatim. {@code tmdbId} (SERIES-023-AC-03) is the candidate's own TMDB id, already resolved
 * internally on every candidate -- exposed here so the frontend can request this specific
 * candidate's keywords ({@code GET /api/v1/series/recommendations/{tmdbId}/keywords}) without a
 * separate title-based re-lookup. See {@code
 * series_spec_023_recommendation_metadata_and_overview.md}.
 *
 * <p>{@code streamingProviders} (SERIES-020-AC-07) is the candidate's currently-available
 * {@code flatrate} (subscription-streaming) watch providers in the configured region ({@code
 * app.tmdb.watch-region}, default {@code GB}), resolved live per request -- never persisted,
 * never {@code null} (an empty list when none are found or the lookup fails). See {@code
 * series_spec_020_watch_providers.md}.
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
    Integer voteCount,
    List<StreamingProvider> streamingProviders,
    String imdbId,
    List<String> sourceTitles,
    Integer totalSourceCount,
    String originCountry,
    Integer tmdbId
) {

    /**
     * A single streaming service a recommended candidate is currently available on
     * (SERIES-020-AC-05), mapped from {@link uk.co.stefirby.seriestracker.client.tmdb.TmdbWatchProvider}.
     * {@code logoUrl} is already a fully-built URL ({@link
     * uk.co.stefirby.seriestracker.client.tmdb.TmdbClient#PROVIDER_LOGO_BASE_URL} + the raw {@code
     * logo_path}), or {@code null} when TMDB didn't supply a logo path -- callers never need to
     * know TMDB's base-URL-plus-path convention themselves.
     */
    public record StreamingProvider(String name, String logoUrl) {
    }
}
