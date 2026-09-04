package uk.co.stefirby.seriestracker.client.tmdb;

import uk.co.stefirby.seriestracker.model.ProductionStatus;

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
 *
 * <p>{@code productionStatus} (SERIES-018-AC-02) is parsed from this same endpoint's {@code
 * status} field via {@link ProductionStatus#fromTmdbStatus(String)} -- folded into this single
 * {@code GET /tv/{id}} call rather than a separate request, since {@code
 * SeriesRefreshService}'s refresh already calls {@link TmdbClient#details(int)} for the other
 * TMDB-sourced fields above; a second call per refreshed series would needlessly double TMDB
 * traffic during a rate-limited bulk refresh (see {@code series_spec_018_series_refresh.md}).
 *
 * <p>{@code originCountries} (SERIES-021-AC-02, widened to every entry by SERIES-046-AC-01) is
 * every entry of this same endpoint's {@code origin_country} array -- an empty list, not
 * {@code null}, when absent or empty -- see {@code series_spec_021_origin_country.md} and
 * {@code series_spec_046_multi_origin_country.md}.
 *
 * <p>{@code overview} (SERIES-023-AC-08) is parsed from this same endpoint's {@code overview}
 * field via the same {@code str(...)} helper applied to every other string field here -- zero
 * extra TMDB traffic, since this call is already made for every other field above. See
 * {@code series_spec_023_recommendation_metadata_and_overview.md}.
 *
 * <p>{@code lastAirYear} (SERIES-039-AC-01) is the year component of this same endpoint's
 * {@code last_air_date} field -- for an ended show, its true end year; for a still-running
 * show, the year of the most recently aired episode so far. {@code null} when the field is
 * absent or unparseable, same posture as every other best-effort field here. See
 * {@code series_spec_039_last_air_year.md}.
 */
public record TmdbSeriesDetail(
    String title,
    Integer year,
    List<Integer> genreIds,
    String posterPath,
    Integer numberOfSeasons,
    Integer numberOfEpisodes,
    BigDecimal voteAverage,
    Integer voteCount,
    ProductionStatus productionStatus,
    List<String> originCountries,
    String overview,
    Integer lastAirYear
) {
}
