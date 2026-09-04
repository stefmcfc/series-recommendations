# Spec 049: Country-of-Origin Stats

**Status**: Not started
**Priority**: P3 (analysis/quality-of-life feature — not core CRUD)
**Depends on**: Series Spec 047 (`series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md`, the `sortBy`/`sortDirection`/min-filter contract and `RatingBlendUtil` this spec reuses), Series Spec 046 (`series_spec_046_multi_origin_country.md`, the comma-joined multi-value `originCountry` column this spec parses)
**Backend Task**

## Overview

Unit 4 of 4 in the "Analysis/Trends" expansion. Gives Country of Origin the same aggregate-stats
treatment Keywords (`series_spec_019`/`series_spec_047`) and Genres (`series_spec_048`) already
have: how many tracked series originate from a given country, their average personal rating, and
their average blended (IMDb+TMDB) rating — same filter/sort contract as both siblings.

**Design decisions**:
- **Parses the comma-joined `originCountry` column, one contribution per listed country per
  series.** Since `series_spec_046`, `originCountry` can hold multiple ISO 3166-1 alpha-2 codes
  (e.g. `"GB,US"` for a co-production) rather than only the first. A series with `"GB,US"`
  contributes once to **both** `GB`'s and `US`'s aggregates — not split or fractional — matching
  how a multi-genre series already contributes fully to each of its genres (`series_spec_048`
  SERIES-048-AC-03) rather than dividing a single "vote" across them. This must be explicit: it's
  the natural reading, but left implicit it could easily be misimplemented as a 0.5-weighted
  contribution per country on a two-country series.
- **The DTO's `name` field holds the raw ISO 3166-1 alpha-2 code (e.g. `"GB"`), not a resolved
  display name** — consistent with every other place this app stores/returns origin country data
  (`SeriesEntity.originCountry`, `SeriesDto.originCountry`) and resolves a human-readable name only
  in the frontend, via `Intl.DisplayNames` (`formatCountryName`/`formatCountryNames`,
  `frontend_spec_085_multi_origin_country_display.md`). The backend has no locale-aware
  name-resolution dependency today and this spec doesn't introduce one.
- **A known, accepted limitation**: `sortBy=name` therefore sorts alphabetically by raw ISO code,
  not by the resolved display name a user actually sees (e.g. `"GB"` sorts under `G`, even though
  its displayed name "United Kingdom" would sort under `U`). This is the same trade-off implied by
  keeping name resolution frontend-only, and is called out here rather than silently accepted.
- **A series with a `null`/blank `originCountry` contributes to no country's aggregate at all** —
  there is no "Unknown" bucket — mirroring how a series with no keywords simply isn't counted
  toward any keyword stat.
- **Split logic**: `originCountry.split(",")`, no per-segment trimming — this column has never
  contained embedded whitespace (`series_spec_046`'s own bare-comma, no-space storage convention,
  also relied on by `formatCountryNames`), unlike `genres`, which does defensively trim
  (`RecommendationSourcingService.splitGenres`).
- **New endpoint and DTO shape mirror `series_spec_048`'s Genre stats exactly** — same `sortBy`/
  `sortDirection`/min-filter param contract, same null-handling for both averages, same
  `RatingBlendUtil` reuse — to keep this "the same treatment" across all three analyzed fields.

---

## Requirements

### Requirement 1: `GET /api/v1/series/origin-country/stats`

**User story**: As a user, I want to see which countries my tracked series most often originate
from and how I've rated shows from each, so I can spot patterns in what I actually enjoy, the same
way I already can for keywords and genres.

#### Acceptance Criteria

- **SERIES-049-AC-01** [AUTO]: A new `CountryStatDto` record (`dto` package) shall carry `name:
  String` (the raw ISO 3166-1 alpha-2 code), `seriesCount: Integer`, `averagePersonalRating:
  BigDecimal` (nullable), `averageBlendedRating: BigDecimal` (nullable) — the same shape as
  `KeywordStatDto`/`GenreStatDto`.
- **SERIES-049-AC-02** [AUTO]: A new `CountryStatsService` (`service` package) shall expose
  `List<CountryStatDto> getStats(String sortBy, String sortDirection, Integer minSeriesCount,
  BigDecimal minAveragePersonalRating, BigDecimal minAverageBlendedRating)`. It shall parse each
  tracked series' `originCountry` column by splitting on `,` (no trimming — matching this column's
  established no-space storage convention), computing one `CountryStatDto` per distinct code
  actually present, via in-memory aggregation over `seriesRepository.findAll()`.
- **SERIES-049-AC-03** [AUTO]: A series whose `originCountry` lists more than one code (e.g.
  `"GB,US"`) shall contribute once to **each** listed code's `seriesCount` and rating averages —
  not split or fractional. A series with a `null` or blank `originCountry` shall contribute to no
  country's aggregate.
- **SERIES-049-AC-04** [AUTO]: `seriesCount`, `averagePersonalRating`, and `averageBlendedRating`
  shall be computed with the exact null-handling `series_spec_047`/`series_spec_048` established:
  unrated/unblended series are excluded from their respective averages, not counted as `0`;
  `averageBlendedRating` uses the shared `RatingBlendUtil.blendedRating(SeriesEntity)`, unchanged.
- **SERIES-049-AC-05** [AUTO]: A new `SeriesOriginCountryController` shall expose `GET
  /api/v1/series/origin-country/stats`, delegating to `CountryStatsService.getStats`, accepting
  the exact same five optional params with the exact same defaults/soft-fallback/nulls-last/
  AND-combined filter semantics `series_spec_047`/`series_spec_048` established.
- **SERIES-049-AC-06** [AUTO]: The endpoint shall return `200 OK` with `ApiResponse<List
  <CountryStatDto>>` (`{ data, count }` envelope); no tracked series with any origin country
  yields `data: []`, `count: 0` — not an error.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `sortBy`/`sortDirection`/min-filter contract this spec copies exactly | `series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md` |
| `RatingBlendUtil.blendedRating`, reused unchanged | `series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md` Requirement 1 |
| `GenreStatDto`/`GenreStatsService` shape, null-handling, and "one contribution per tag" convention this spec mirrors | `series_spec_048_genre_stats.md` |
| Comma-joined multi-value `originCountry` column, no-space storage convention | `series_spec_046_multi_origin_country.md` |
| Frontend-only display-name resolution (`Intl.DisplayNames`) this spec's raw-code `name` field relies on | `frontend_spec_085_multi_origin_country_display.md`, `countryName.ts` |
| In-memory aggregation "fine at this app's scale" precedent | `series_spec_003_search.md` Service Layer |
| Frontend consumer | `frontend_spec_089_country_of_origin_stats_view.md` |

---

## TDD Test Case Sketches

### `CountryStatsServiceSpec.groovy`

```groovy
def "SERIES-049-AC-02/03: a multi-country series contributes once to each listed country"() {
    given: "a co-produced series (GB,US) and a single-country series (GB)"
        seriesRepository.save(new SeriesEntity(title: "A", originCountry: "GB,US"))
        seriesRepository.save(new SeriesEntity(title: "B", originCountry: "GB"))

    when: "getStats(null, null, null, null, null) is called"
        def stats = countryStatsService.getStats(null, null, null, null, null)

    then: "GB has seriesCount 2, US has seriesCount 1 -- not fractional"
        stats.find { it.name() == "GB" }.seriesCount() == 2
        stats.find { it.name() == "US" }.seriesCount() == 1
}

def "SERIES-049-AC-03: a series with no originCountry contributes to no aggregate"() {
    given: "a series with a null originCountry"
        seriesRepository.save(new SeriesEntity(title: "A", originCountry: null))

    when: "getStats(null, null, null, null, null) is called"
        def stats = countryStatsService.getStats(null, null, null, null, null)

    then: "the stats list is empty -- no 'Unknown' bucket"
        stats.isEmpty()
}

def "SERIES-049-AC-04: averages exclude unrated/unblended series, mirroring genre/keyword stats"() {
    given: "two GB series, one rated and blended, one neither"
        seriesRepository.save(new SeriesEntity(title: "A", originCountry: "GB", personalRating: 4, imdbRating: 8.0G))
        seriesRepository.save(new SeriesEntity(title: "B", originCountry: "GB"))

    when: "getStats(null, null, null, null, null) is called"
        def gb = countryStatsService.getStats(null, null, null, null, null).find { it.name() == "GB" }

    then: "both averages reflect only the one qualifying series"
        gb.averagePersonalRating() == 4.0G
        gb.averageBlendedRating() == 8.0G
}
```

### `SeriesOriginCountryControllerSpec.groovy`

```groovy
def "SERIES-049-AC-06: GET /api/v1/series/origin-country/stats returns the { data, count } envelope"() {
    when: "requested with no tracked series"
        def response = mockMvc.perform(get("/api/v1/series/origin-country/stats"))

    then: "200 with an empty list"
        response.andExpect(status().isOk())
        response.andExpect(jsonPath('$.data').isArray())
        response.andExpect(jsonPath('$.count').value(0))
}
```

---

## Acceptance Criteria Summary

- [ ] SERIES-049-AC-01: `CountryStatDto` (`name` = raw ISO code; same shape as siblings)
- [ ] SERIES-049-AC-02: `CountryStatsService.getStats(...)`, parses `originCountry` column
- [ ] SERIES-049-AC-03: multi-country series counted once per country, not fractionally; null/blank excluded entirely
- [ ] SERIES-049-AC-04: null-handling for both averages matches keyword/genre stats exactly
- [ ] SERIES-049-AC-05: `GET /api/v1/series/origin-country/stats` with the shared param contract
- [ ] SERIES-049-AC-06: `{ data, count }` envelope; empty state is not an error
