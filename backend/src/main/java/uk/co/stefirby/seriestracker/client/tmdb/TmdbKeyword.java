package uk.co.stefirby.seriestracker.client.tmdb;

/**
 * A single TMDB keyword entry, as returned by {@code GET /tv/{tmdbId}/keywords}'s
 * {@code results[]} array -- see {@code series_spec_019_keyword_tracking.md}
 * (SERIES-019-AC-05).
 */
public record TmdbKeyword(Integer id, String name) {
}
