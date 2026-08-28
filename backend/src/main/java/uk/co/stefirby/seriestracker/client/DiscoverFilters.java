package uk.co.stefirby.seriestracker.client;

import java.math.BigDecimal;

/**
 * Parameter object for {@link TmdbClient#discover(java.util.List, java.util.List, String,
 * DiscoverFilters)}'s optional {@code discover/tv} filter params (SERIES-031-AC-01/02/03) --
 * introduced instead of growing {@code discover()}'s positional parameter list further (it
 * already carried {@code genreIds}/{@code keywordIds}/{@code sortBy} plus the pre-existing
 * {@code minVoteCount}; adding {@code minTmdbRating}/{@code yearMin}/{@code yearMax}
 * individually would take it to 7). Lives alongside {@link TmdbClient} rather than in {@code
 * dto/} since it's an internal shape for one client method's parameters, not an API-facing DTO.
 *
 * <p>Each field is sent as its own {@code discover/tv} query param only when actually set,
 * mirroring {@code minVoteCount}'s pre-existing "{@code 0} means omit the param entirely"
 * convention: {@code vote_count.gte} when {@code minVoteCount > 0}, {@code vote_average.gte}
 * when {@code minTmdbRating != null}, {@code air_date.gte} (formatted {@code {yearMin}-01-01})
 * when {@code yearMin != null}, {@code air_date.lte} (formatted {@code {yearMax}-12-31}) when
 * {@code yearMax != null}.
 *
 * <p>{@code air_date.gte}/{@code .lte} filter by TMDB's <em>episode</em> air date, not a
 * show's first-air date -- a deliberate semantic upgrade over the post-fetch {@code
 * matchesYearRange} check, so a still-running older show can match a recent year range (see
 * {@code series_spec_031_custom_search_prefetch_filters.md}'s Overview).
 */
public record DiscoverFilters(int minVoteCount, BigDecimal minTmdbRating, Integer yearMin, Integer yearMax) {

    /** No filters set -- every field at its "omit the param" value. */
    public static final DiscoverFilters NONE = new DiscoverFilters(0, null, null, null);
}
