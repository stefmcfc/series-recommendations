package uk.co.stefirby.seriestracker.client;

import java.math.BigDecimal;
import java.util.List;

/**
 * TMDB's own full detail for a single TV series, from {@link TmdbClient#details(int)}
 * ({@code GET /tv/{id}}) -- per {@code series_spec_017_tmdb_primary_lookup.md}, this is now
 * this app's sole, unconditional data source for a series' title/year/genres/season-episode
 * counts/TMDB rating when resolving a picked TMDB search candidate
 * ({@code SeriesLookupService.resolveTmdbCandidate}); OMDb is consulted only afterward, as an
 * optional enrichment for {@code imdbRating}/{@code rottenTomatoesRating}.
 *
 * <p>{@code genreIds} is extracted from this endpoint's {@code genres} field, which -- unlike
 * the flat {@code genre_ids} integer array {@link TmdbCandidate}/{@link TmdbSearchCandidate}
 * are built from -- is an array of {@code {id, name}} objects; only each entry's {@code id} is
 * kept here.
 *
 * <p>{@code voteAverage}/{@code voteCount} (SERIES-017-AC-11) are parsed from this endpoint's
 * {@code vote_average}/{@code vote_count} fields, the same TMDB concept {@link TmdbCandidate}
 * already carries under those same field names.
 */
public record TmdbSeriesDetail(
    String title,
    Integer year,
    List<Integer> genreIds,
    String posterPath,
    Integer numberOfSeasons,
    Integer numberOfEpisodes,
    BigDecimal voteAverage,
    Integer voteCount
) {
}
