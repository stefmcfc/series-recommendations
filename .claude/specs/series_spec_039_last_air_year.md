# Series Spec 039: `lastAirYear` — True Episode-In-Range Year Filtering

**Status**: Implemented — `client/TmdbSeriesDetail.java`, `client/TmdbClient.java`,
`model/SeriesEntity.java`, `dto/SeriesDto.java`, `dto/SeriesLookupDto.java`,
`service/SeriesLookupService.java`, `service/SeriesRefreshService.java`,
`service/SeriesSearchService.java`, `service/SeriesService.java`,
`resources/db/migration/V010__add_last_air_year_to_series.sql`, plus their Spock specs
(`TmdbClientSpec`, `SeriesLookupServiceSpec`, `SeriesRefreshServiceSpec`, `SeriesSearchServiceSpec`,
`SeriesServiceSpec`). Frontend half (`frontend_spec_058`) not yet built.
**Priority**: P3 (upgrades `series_spec_037`'s documented stopgap to the semantic it deferred)
**Depends on**: Series Spec 037 (`series_spec_037_search_filter_overhaul.md`, owns the `yearMin`/
`yearMax` filter this spec upgrades) ✅ required, Series Spec 031
(`series_spec_031_custom_search_prefetch_filters.md`, the "does any episode air in this range,"
`air_date.gte`/`.lte` semantic this spec replicates for tracked series via stored data instead of a
live TMDB call) ✅, Series Spec 018/021 (own the `TmdbClient.details`/refresh re-resolution pattern
this spec's `lastAirYear` resolution mirrors) ✅
**Area**: Backend (`client/TmdbSeriesDetail.java`, `client/TmdbClient.java`,
`model/SeriesEntity.java`, `dto/SeriesDto.java`, `service/SeriesLookupService.java`,
`service/SeriesRefreshService.java`, `service/SeriesSearchService.java`) — paired with Frontend
Spec 058 (`frontend_spec_058_series_year_range_display.md`)

## Overview

Confirmed (2026-08-29): `series_spec_037`'s `yearMin`/`yearMax` filter matches only
`SeriesEntity.year` (a single stored start year) — an explicitly documented stopgap, since
`SeriesEntity` has no end/last-air year to check a true range against. This spec closes that gap:
adds `lastAirYear` (sourced from TMDB's `last_air_date`, not currently parsed anywhere in this
codebase), resolved at create/refresh time the same way `productionStatus`/`originCountry` already
are, and upgrades the year-range filter to a real interval-overlap check — "does this series' known
airing span intersect the requested range" — matching the semantic `series_spec_031` already
established for TMDB-sourced recommendation candidates, but computed against stored data instead of
a live TMDB call (tracked series aren't re-fetched from TMDB on every search).

## Design Decisions

- **`lastAirYear` is the year of TMDB's `last_air_date` for the most recently aired episode** — for
  an ended show, its true end year; for a still-running show, the year of the most recent episode
  that's actually aired so far (TMDB does not report an end date for a show that hasn't ended,
  `last_air_date` reflects "most recent episode," not "final episode"). This is enough for the
  filtering purpose below regardless of whether the show has ended — a running show's episodes
  aired so far are a real, correct signal for "does it overlap this year range."
- **Interval-overlap filtering, not a re-derivation of `productionStatus`.** A series' known airing
  span is `[year, lastAirYear ?? year]` (falls back to `year` alone when `lastAirYear` is unset —
  e.g. not yet resolved, or resolution failed). It matches a `[yearMin, yearMax]` query when
  `(yearMax == null || year <= yearMax) && (yearMin == null || effectiveEnd >= yearMin)` — the
  standard interval-overlap test. This needs no knowledge of `productionStatus` at all; whether the
  show is still airing doesn't change whether its aired-so-far span overlaps a given range.
- **Resolved exactly like `productionStatus`/`originCountry`**: at create time via
  `SeriesLookupService` (round-tripped through the create `SeriesDto`, `series_spec_017`/`021`'s
  established pattern — not re-derived independently in `SeriesService.create`), and re-resolved on
  every refresh (`SeriesRefreshService`, since a running show's `lastAirYear` genuinely changes as
  new episodes air — unlike `productionStatus`, this field is expected to change over a tracked
  show's lifetime, which is exactly why refresh re-resolves it).
- **`lastAirYear` is nullable and best-effort**, same posture as every other TMDB-sourced field in
  this app — an unresolvable id, missing key, or network failure leaves it `null`/unchanged, never
  fails the surrounding create/refresh call.

---

## Requirement 1: `TmdbSeriesDetail.lastAirYear`

### SERIES-039-AC-01 [AUTO]
**Statement**: `TmdbSeriesDetail` shall gain `lastAirYear` (`Integer`), parsed from TMDB's
`last_air_date` field (the year component) by `TmdbClient.details`. An absent or unparseable
`last_air_date` shall result in `null`, not an error — same posture as this method's existing
unmapped-`productionStatus` handling.

**Test Case (Red)**:
```groovy
def "SERIES-039-AC-01: details() parses last_air_date into lastAirYear"() {
    given: "TMDB returns a last_air_date"
        mockTmdbResponse('{"last_air_date": "2024-11-15", ...}')

    when: "details is called"
        def result = tmdbClient.details(1396)

    then: "lastAirYear is the year component"
        result.lastAirYear() == 2024
}
```
**Test Case (Green)**: parse `last_air_date` (`YYYY-MM-DD`) the same way `year`/`first_air_date` is
already parsed elsewhere in this class, extracting just the year.

---

## Requirement 2: `SeriesEntity.lastAirYear` — resolved at create and refresh

### SERIES-039-AC-02 [AUTO]
**Statement**: `SeriesEntity` shall gain a nullable `lastAirYear` (`Integer`) column, added via a
new Flyway migration. `SeriesDto` shall gain a matching field, settable (not output-only) — mirroring
`productionStatus`/`originCountry`'s existing round-trip convention.

**Test Case (Green)**: new migration; entity/DTO field + getter/setter, no behavior beyond storage.

---

### SERIES-039-AC-03 [AUTO]
**Statement**: `SeriesLookupService` shall resolve `lastAirYear` from `TmdbClient.details` at
lookup time, round-tripped through the create `SeriesDto` the same way `productionStatus`/
`originCountry` already are.

**Test Case (Red)**:
```groovy
def "SERIES-039-AC-03: lookup resolves lastAirYear onto the create DTO"() {
    given: "TMDB details resolves a lastAirYear"
        tmdbClient.details(1396) >> new TmdbSeriesDetail("Show", 2020, [18], "/p.jpg", 3, 24,
            new BigDecimal("8.0"), 500, ProductionStatus.ENDED, "US", "overview", 2023)

    when: "lookup resolves the series"
        def dto = lookupService.resolve(1396)

    then: "lastAirYear is populated"
        dto.lastAirYear() == 2023
}
```
**Test Case (Green)**: add `lastAirYear` to whichever DTO/round-trip `SeriesLookupService` already
builds for `productionStatus`/`originCountry`.

---

### SERIES-039-AC-04 [AUTO]
**Statement**: `SeriesRefreshService` shall re-resolve `lastAirYear` on every refresh (single or
bulk), the same way it already re-resolves `productionStatus`/`originCountry` — updating it when
TMDB returns a value, leaving the existing stored value unchanged on failure/absence.

**Test Case (Red)**:
```groovy
def "SERIES-039-AC-04: refresh re-resolves lastAirYear"() {
    given: "an existing series and a fresh TMDB detail lookup with a newer lastAirYear"
        def existing = new SeriesEntity(title: "Show", imdbId: "tt1234567", lastAirYear: 2022)
        tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1396)
        tmdbClient.details(1396) >> new TmdbSeriesDetail("Show", 2020, [18], "/p.jpg", 4, 32,
            new BigDecimal("8.0"), 500, ProductionStatus.RETURNING_SERIES, "US", "overview", 2024)

    when: "refresh runs"
        refreshService.refresh(existing)

    then: "lastAirYear is updated"
        existing.lastAirYear == 2024
}
```
**Test Case (Green)**: `if (detail.lastAirYear() != null) { entity.setLastAirYear(detail.lastAirYear()); }`,
added alongside the existing `productionStatus`/`originCountry` conditional sets.

---

## Requirement 3: Upgrade `yearMin`/`yearMax` to interval-overlap filtering

### SERIES-039-AC-05 [AUTO]
**Statement**: `SeriesSearchService.matchesYearRange` shall be upgraded to interval-overlap
semantics: a series matches when `(yearMax == null || year <= yearMax) && (yearMin == null ||
effectiveEnd >= yearMin)`, where `effectiveEnd = lastAirYear ?? year`. A series with no `year` at
all still never matches when any bound is set (unchanged from `series_spec_037`'s existing
null-handling).

**References**: Replaces `series_spec_037`'s `SERIES-037-AC-03` implementation (not its ID or
statement — that AC's *stated* contract, "filters against `SeriesEntity.year`," is superseded by
this spec's fuller semantic; per this project's ID-immutability convention, `SERIES-037-AC-03` is
marked superseded in `series_spec_037.md`, not rewritten).

**Test Case (Red)**:
```groovy
def "SERIES-039-AC-05: a running show matches a range it started before but is still airing through"() {
    given: "a show that started in 2018, most recently aired in 2024, still running"
        repository.save(new SeriesEntity(title: "Long Runner", year: 2018, lastAirYear: 2024))

    when: "search is called with yearMin=2022, yearMax=2023"
        def results = service.search(new SeriesSearchCriteria(yearMin: 2022, yearMax: 2023))

    then: "it matches -- its aired span (2018-2024) overlaps 2022-2023, even though it started earlier"
        results*.title == ["Long Runner"]
}

def "SERIES-039-AC-05: a series with no lastAirYear falls back to matching on year alone"() {
    given: "a series with year but no lastAirYear (not yet resolved)"
        repository.save(new SeriesEntity(title: "Unresolved", year: 2020))

    when: "search is called with yearMin=2020, yearMax=2020"
        def results = service.search(new SeriesSearchCriteria(yearMin: 2020, yearMax: 2020))

    then: "it matches via the year-only fallback"
        results*.title == ["Unresolved"]
}
```
**Test Case (Green)**: rewrite `matchesYearRange`'s comparison to the overlap formula above,
computing `effectiveEnd` from `lastAirYear` with a fallback to `year`.

---

## Implementation Notes

- **`series_spec_037_search_filter_overhaul.md`** needs a matching edit: mark `SERIES-037-AC-03`
  superseded (pointing here), per this project's ID-immutability convention — same treatment as
  `series_spec_034` gave `SERIES-008-AC-05`.
- **`API.md`** — no query-param contract change (`yearMin`/`yearMax` already exist from
  `series_spec_037`); note the semantic upgrade in prose.
- **Frontend consumer for display**: `frontend_spec_058_series_year_range_display.md`.

## Cross-References

| This spec | Source |
|---|---|
| `yearMin`/`yearMax`, the stopgap this spec upgrades | `series_spec_037_search_filter_overhaul.md` (`SERIES-037-AC-03`, superseded) |
| The "any episode in range" semantic this spec replicates for tracked series | `series_spec_031_custom_search_prefetch_filters.md` |
| `productionStatus`/`originCountry` resolution pattern this spec mirrors | `series_spec_017_tmdb_primary_lookup.md`, `series_spec_021_origin_country.md`, `series_spec_018_series_refresh.md` |
| Frontend consumer | `frontend_spec_058_series_year_range_display.md` |

---

## Acceptance Criteria Summary

- [x] SERIES-039-AC-01: `TmdbSeriesDetail.lastAirYear` parses `last_air_date` correctly
- [x] SERIES-039-AC-02: `SeriesEntity`/`SeriesDto` gain `lastAirYear`
- [x] SERIES-039-AC-03: lookup resolves `lastAirYear` onto the create DTO
- [x] SERIES-039-AC-04: refresh re-resolves `lastAirYear`
- [x] SERIES-039-AC-05: `yearMin`/`yearMax` use true interval-overlap matching
