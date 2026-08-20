package uk.co.stefirby.seriestracker.client;

import java.util.List;

/**
 * TMDB's own full detail for a single TV series, from {@link TmdbClient#details(int)}
 * ({@code GET /tv/{id}}) -- used as the degraded-fallback data source in
 * {@code SeriesLookupService.resolveTmdbCandidate} when OMDb has no record for a resolved
 * {@code imdbId}, or none resolves at all, per
 * {@code series_spec_012_tmdb_lookup_fallback.md} Requirement 3.
 *
 * <p>{@code genreIds} is extracted from this endpoint's {@code genres} field, which -- unlike
 * the flat {@code genre_ids} integer array {@link TmdbCandidate}/{@link TmdbSearchCandidate}
 * are built from -- is an array of {@code {id, name}} objects; only each entry's {@code id} is
 * kept here.
 */
public record TmdbSeriesDetail(
    String title,
    Integer year,
    List<Integer> genreIds,
    String posterPath,
    Integer numberOfSeasons,
    Integer numberOfEpisodes
) {
}
