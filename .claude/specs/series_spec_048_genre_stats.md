# Spec 048: Genre Stats

**Status**: Done
**Priority**: P3 (analysis/quality-of-life feature — not core CRUD)
**Depends on**: Series Spec 047 (`series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md`, the `sortBy`/`sortDirection`/min-filter contract and `RatingBlendUtil` this spec reuses), Series Spec 010 (`series_spec_010_genre_dropdown.md`, `SeriesEntity.genres` comma-delimited storage)
**Backend Task**

## Overview

Unit 3 of 4 in the "Analysis/Trends" expansion. Gives Genres the same aggregate-stats treatment
`series_spec_019`/`series_spec_047` already gave Keywords: how many tracked series carry a given
genre, their average personal rating, and their average blended (IMDb+TMDB) rating — filterable
and sortable with the exact same contract `series_spec_047` established, so this is "the same
treatment," not a similar-but-different one.

**Design decisions**:
- **In-memory aggregation over `seriesRepository.findAll()`, parsing the delimited `genres`
  string** — the same approach `KeywordStatsService` uses (`series_spec_019` SERIES-019-AC-14),
  not a normalized join table. Genres were deliberately *not* normalized when keywords were
  (`series_spec_019`'s own Design Decisions: "keyword stats need `COUNT`/`AVG`-style aggregation,
  which a delimited string column can't support without parsing every row on every query" —
  genres/tags didn't need that at the time). This spec is exactly the case that reasoning
  anticipated, and resolves it the same way that reasoning already endorsed: parse on read, same
  "fine at this app's scale" precedent, rather than a schema migration.
- **Split/trim/filter-empty logic mirrors `RecommendationSourcingService.splitGenres`'s existing
  behavior** (comma-delimited, no space, each value trimmed, empty segments dropped) — same
  interpretation of the `genres` column used elsewhere in the codebase, so a series stored as
  `"Drama,Sci-Fi"` contributes once to each of `Drama` and `Sci-Fi`'s aggregates, not treated as a
  single combined tag.
- **New endpoint lives on the existing `SeriesGenreController`, not a new controller class.**
  Unlike Keywords (which got its own controller during `tooling_spec_002`'s decomposition pass),
  genre-related endpoints are still small enough to share one controller; `GET
  /api/v1/series/genres/stats` is added alongside the existing static-taxonomy `GET
  /api/v1/series/genres`, both delegating to their respective services per the thin-controller
  convention.
- **`GenreStatDto` and the query contract are identical in shape to `KeywordStatDto` and
  `series_spec_047`'s params** (`sortBy` ∈ `name`/`seriesCount`/`averagePersonalRating`/
  `averageBlendedRating`, `sortDirection`, `minSeriesCount`/`minAveragePersonalRating`/
  `minAverageBlendedRating`) — deliberately copied rather than re-derived, since consistency
  across the three analyzed fields is the point of this expansion.

---

## Requirements

### Requirement 1: `GET /api/v1/series/genres/stats`

**User story**: As a user, I want to see which genres appear most often across my tracked series
and how I've rated shows in each, so I can spot patterns in what I actually enjoy, the same way I
already can for keywords.

#### Acceptance Criteria

- **SERIES-048-AC-01** [AUTO]: A new `GenreStatDto` record (`dto` package) shall carry `name:
  String`, `seriesCount: Integer`, `averagePersonalRating: BigDecimal` (nullable),
  `averageBlendedRating: BigDecimal` (nullable) — the same shape as `KeywordStatDto`.
- **SERIES-048-AC-02** [AUTO]: A new `GenreStatsService` (`service` package) shall expose
  `List<GenreStatDto> getStats(String sortBy, String sortDirection, Integer minSeriesCount,
  BigDecimal minAveragePersonalRating, BigDecimal minAverageBlendedRating)`. It shall parse each
  tracked series' `genres` column via the same split/trim/filter-empty logic as
  `RecommendationSourcingService.splitGenres` (comma-delimited, no space, trimmed, empty segments
  dropped), computing one `GenreStatDto` per distinct genre name actually present, via in-memory
  aggregation over `seriesRepository.findAll()`.
- **SERIES-048-AC-03** [AUTO]: A series listing the same genre more than once (a malformed/
  duplicate entry in the delimited string) shall contribute to that genre's `seriesCount` only
  once — de-duplicated per series, not per raw occurrence.
- **SERIES-048-AC-04** [AUTO]: `seriesCount`, `averagePersonalRating`, and `averageBlendedRating`
  shall be computed with the exact null-handling `series_spec_047` established for
  `KeywordStatDto` (`SERIES-047-AC-03`, `series_spec_019` SERIES-019-AC-15): unrated/unblended
  series are excluded from their respective averages, not counted as `0`; `averageBlendedRating`
  uses the shared `RatingBlendUtil.blendedRating(SeriesEntity)` from `series_spec_047`, unchanged.
- **SERIES-048-AC-05** [AUTO]: `SeriesGenreController` shall gain `GET
  /api/v1/series/genres/stats`, delegating to `GenreStatsService.getStats`, accepting the exact
  same five optional params, with the exact same defaults/soft-fallback/nulls-last/AND-combined
  filter semantics `series_spec_047` established for `GET /series/keywords`
  (SERIES-047-AC-04–AC-13) — `sortBy` (`name`|`seriesCount`|`averagePersonalRating`|
  `averageBlendedRating`), `sortDirection` (`asc`|`desc`), `minSeriesCount`,
  `minAveragePersonalRating`, `minAverageBlendedRating`.
- **SERIES-048-AC-06** [AUTO]: The endpoint shall return `200 OK` with `ApiResponse<List
  <GenreStatDto>>` (`{ data, count }` envelope, matching `GET /series/keywords`/`GET
  /series/genres`); no tracked series with any genres yields `data: []`, `count: 0` — not an
  error.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `sortBy`/`sortDirection`/min-filter contract this spec copies exactly | `series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md` |
| `RatingBlendUtil.blendedRating`, reused unchanged | `series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md` Requirement 1 |
| `KeywordStatDto`/`KeywordStatsService` shape and null-handling this spec mirrors | `series_spec_019_keyword_tracking.md` Requirement 4 |
| `genres` comma-delimited storage, existing static-taxonomy `GET /series/genres` endpoint/envelope | `series_spec_010_genre_dropdown.md` |
| Split/trim/filter-empty logic this spec mirrors | `RecommendationSourcingService.splitGenres` |
| In-memory aggregation "fine at this app's scale" precedent | `series_spec_003_search.md` Service Layer |
| Frontend consumer | `frontend_spec_088_genre_stats_view.md` |

---

## TDD Test Case Sketches

### `GenreStatsServiceSpec.groovy`

```groovy
def "SERIES-048-AC-02/03: aggregates genres from the delimited column, de-duplicated per series"() {
    given: "two series, one carrying Drama+Sci-Fi, one carrying Drama twice (malformed)"
        seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama,Sci-Fi"))
        seriesRepository.save(new SeriesEntity(title: "B", genres: "Drama,Drama"))

    when: "getStats(null, null, null, null, null) is called"
        def stats = genreStatsService.getStats(null, null, null, null, null)

    then: "Drama has seriesCount 2 (not 3), Sci-Fi has seriesCount 1"
        stats.find { it.name() == "Drama" }.seriesCount() == 2
        stats.find { it.name() == "Sci-Fi" }.seriesCount() == 1
}

def "SERIES-048-AC-04: averages exclude unrated/unblended series, mirroring keyword stats"() {
    given: "two Drama series, one rated and blended, one neither"
        seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama", personalRating: 4, imdbRating: 8.0G))
        seriesRepository.save(new SeriesEntity(title: "B", genres: "Drama"))

    when: "getStats(null, null, null, null, null) is called"
        def drama = genreStatsService.getStats(null, null, null, null, null).find { it.name() == "Drama" }

    then: "both averages reflect only the one qualifying series"
        drama.averagePersonalRating() == 4.0G
        drama.averageBlendedRating() == 8.0G
}
```

### `SeriesGenreControllerSpec.groovy`

```groovy
def "SERIES-048-AC-06: GET /api/v1/series/genres/stats returns the { data, count } envelope"() {
    when: "requested with no tracked series"
        def response = mockMvc.perform(get("/api/v1/series/genres/stats"))

    then: "200 with an empty list"
        response.andExpect(status().isOk())
        response.andExpect(jsonPath('$.data').isArray())
        response.andExpect(jsonPath('$.count').value(0))
}

def "SERIES-048-AC-05: sortBy/sortDirection/min-filter params behave identically to /series/keywords"() {
    when: "requested with minSeriesCount=99 (nothing qualifies)"
        def response = mockMvc.perform(get("/api/v1/series/genres/stats").param("minSeriesCount", "99"))

    then: "200 with an empty list, not an error"
        response.andExpect(status().isOk())
        response.andExpect(jsonPath('$.count').value(0))
}
```

---

## Acceptance Criteria Summary

- [x] SERIES-048-AC-01: `GenreStatDto` (same shape as `KeywordStatDto`)
- [x] SERIES-048-AC-02: `GenreStatsService.getStats(...)`, parses delimited `genres` column
- [x] SERIES-048-AC-03: duplicate genre entries within one series de-duplicated
- [x] SERIES-048-AC-04: null-handling for both averages matches keyword stats exactly
- [x] SERIES-048-AC-05: `GET /api/v1/series/genres/stats` with the shared param contract
- [x] SERIES-048-AC-06: `{ data, count }` envelope; empty state is not an error
