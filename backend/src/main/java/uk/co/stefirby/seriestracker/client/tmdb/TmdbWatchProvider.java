package uk.co.stefirby.seriestracker.client.tmdb;

/**
 * A single flatrate (subscription-streaming) watch provider entry, as returned by
 * {@code GET /tv/{tmdbId}/watch/providers}'s {@code results.{region}.flatrate[]} array --
 * see {@code series_spec_020_watch_providers.md} (SERIES-020-AC-01). {@code providerName}/
 * {@code logoPath} are TMDB's {@code provider_name}/{@code logo_path} verbatim; {@code
 * logoPath} is a bare path, not a URL -- see {@link TmdbClient#PROVIDER_LOGO_BASE_URL}.
 */
public record TmdbWatchProvider(String providerName, String logoPath) {
}
