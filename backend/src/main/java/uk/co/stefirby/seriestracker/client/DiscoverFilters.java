package uk.co.stefirby.seriestracker.client;

import java.math.BigDecimal;
import java.util.List;

/**
 * Parameter object for {@link TmdbClient#discover(java.util.List, java.util.List, String,
 * DiscoverFilters)}'s optional {@code discover/tv} filter params (SERIES-031-AC-01/02/03,
 * SERIES-032-AC-01/02) -- introduced instead of growing {@code discover()}'s positional
 * parameter list further (it already carried {@code genreIds}/{@code keywordIds}/{@code
 * sortBy} plus the pre-existing {@code minVoteCount}; adding {@code minTmdbRating}/{@code
 * yearMin}/{@code yearMax}/{@code language}/{@code countries} individually would take it to 9).
 * Lives alongside {@link TmdbClient} rather than in {@code dto/} since it's an internal shape
 * for one client method's parameters, not an API-facing DTO.
 *
 * <p>Each field is sent as its own {@code discover/tv} query param only when actually set,
 * mirroring {@code minVoteCount}'s pre-existing "{@code 0} means omit the param entirely"
 * convention: {@code vote_count.gte} when {@code minVoteCount > 0}, {@code vote_average.gte}
 * when {@code minTmdbRating != null}, {@code air_date.gte} (formatted {@code {yearMin}-01-01})
 * when {@code yearMin != null}, {@code air_date.lte} (formatted {@code {yearMax}-12-31}) when
 * {@code yearMax != null}, {@code with_original_language} when {@code language} is non-blank,
 * {@code with_origin_country} (comma-joined) when {@code countries} is non-empty.
 *
 * <p>{@code air_date.gte}/{@code .lte} filter by TMDB's <em>episode</em> air date, not a
 * show's first-air date -- a deliberate semantic upgrade over the post-fetch {@code
 * matchesYearRange} check, so a still-running older show can match a recent year range (see
 * {@code series_spec_031_custom_search_prefetch_filters.md}'s Overview).
 *
 * <p>{@code language} stays single-select (TMDB's {@code with_original_language} accepts one
 * value only), while {@code countries} is multi-select, OR-matched, comma-joined into a single
 * {@code with_origin_country} param -- a deliberate asymmetry, not an oversight (see {@code
 * series_spec_032_custom_search_language_country_filters.md}'s Overview).
 */
public record DiscoverFilters(int minVoteCount, BigDecimal minTmdbRating, Integer yearMin, Integer yearMax,
                               String language, List<String> countries) {

    /** No filters set -- every field at its "omit the param" value. */
    public static final DiscoverFilters NONE = new DiscoverFilters(0, null, null, null, null, List.of());
}
