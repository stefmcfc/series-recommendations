# Series Spec 037: `SeriesSearchCriteria` Overhaul — Drop Max Rating/Started-Not-Finished, Add Min TMDB Rating + Year Range

**Status**: Not started
**Priority**: P3 (filter-field rework, no new sourcing capability — a cleanup + two genuinely new
filters)
**Depends on**: Series Spec 003 (`series_spec_003_search.md`, owns `SeriesSearchCriteria`/
`SeriesSearchService`) ✅, Series Spec 031 (`series_spec_031_custom_search_prefetch_filters.md`,
the "episode air date" year-range semantic this spec explicitly does **not** yet replicate — see
Design Decisions) ✅
**Area**: Backend (`dto/SeriesSearchCriteria.java`, `service/SeriesSearchService.java`,
`controller/SeriesController.java`) — paired with Frontend Spec 055
(`frontend_spec_055_search_filter_overhaul.md`)

## Overview

Confirmed (2026-08-29) via reading `SeriesSearchCriteria`/`SeriesSearchService`: this app's search
filter set has grown ad hoc across several specs (personal rating min/max, IMDb rating min/max, a
started-not-finished checkbox) with no TMDB rating filter and no year filter at all, despite
`SeriesEntity` carrying both `tmdbRating` and `year`. Per discussion, this spec:

1. **Removes** `maxPersonalRating`, `maxImdbRating`, and `startedNotFinished` — confirmed genuinely
   unused-after-removal (not partial deprecation): "min rating and above" is the useful shape for a
   rating floor; a max-rating ceiling and the started-not-finished checkbox are dropped outright,
   not hidden in the UI while the backend keeps carrying them (this app's own convention: don't keep
   unused API surface "just in case").
2. **Adds** `minTmdbRating` (mirroring `minImdbRating`'s existing shape exactly) and `yearMin`/
   `yearMax` (new — `SeriesEntity.year` has never been filterable before).

## Design Decisions

- **Year filtering in this spec matches only the single stored `year` field (the series' first-
  aired year) — a deliberate, documented stopgap, not the full semantic.** `series_spec_031`
  established that a TMDB-sourced year-range filter should match "does any episode air within this
  range," using TMDB's `air_date.gte`/`.lte` discover params specifically because a still-running
  show shouldn't be excluded just because it started before the range. `SeriesEntity` has no
  equivalent data today — only a single `year` (start year), no last-aired/end year — so this spec
  cannot replicate that semantic for tracked series without a schema change. **Explicitly deferred**:
  storing an end/last-air year and upgrading this filter to true "any episode in range" semantics is
  tracked separately in `.claude/ideas/future_ideas.md` ("Year range filtering + `YYYY-YYYY` display
  needs an end-year data column"), not part of this spec.
- **`minPersonalRating`/`minImdbRating` keep their existing null-handling convention exactly**
  (`matchesPersonalRating`/`matchesImdbRating`'s existing "a series with no value on this field only
  matches when no filter is set" rule) — simplified to drop the now-removed `max` half, not
  otherwise changed. `minTmdbRating` and `yearMin`/`yearMax` follow the identical convention for
  consistency.
- **A breaking change to `GET /api/v1/series/search`'s query contract** — `maxPersonalRating`/
  `maxImdbRating`/`startedNotFinished` stop being accepted (silently ignored by Spring's
  `@RequestParam` binding removal, not rejected — there's no reasonable case for erroring on an
  unrecognized param here, matching how this endpoint already behaves for any other unknown query
  string key). `API.md`/`CHANGELOG.md` must document this explicitly (Definition of Done) since it's
  a real, if low-traffic, contract change for a single-user personal app.

---

## Requirement 1: Remove `maxPersonalRating`, `maxImdbRating`, `startedNotFinished`

**User story**: As a developer, I want unused filter fields removed cleanly, not left as dead API
surface.

### SERIES-037-AC-01 [AUTO]
**Statement**: `SeriesSearchCriteria` shall no longer have `maxPersonalRating`, `maxImdbRating`, or
`startedNotFinished` fields (or their getters/setters). `SeriesController.search` shall no longer
accept `maxPersonalRating`/`maxImdbRating`/`startedNotFinished` as request parameters.
`SeriesSearchService.matchesStartedNotFinished` shall be removed entirely; `matchesPersonalRating`/
`matchesImdbRating` shall drop their `max` parameter, keeping the existing null-handling rule for
`min` alone.

**Test Case (Red)**:
```groovy
def "SERIES-037-AC-01: maxPersonalRating/maxImdbRating/startedNotFinished no longer filter results"() {
    given: "a series with personalRating=5, imdbRating=9.5, status=WATCHING"
        repository.save(new SeriesEntity(title: "Show", personalRating: 5, imdbRating: new BigDecimal("9.5"),
            status: SeriesStatus.WATCHING, currentSeason: 1))

    when: "search is called with only minPersonalRating set (no max, no startedNotFinished)"
        def criteria = new SeriesSearchCriteria(minPersonalRating: 3)
        def results = service.search(criteria)

    then: "the series is returned -- min-only filtering still works, removed fields have no getters to even set"
        results.size() == 1
}
```
**Test Case (Green)**: delete the three fields/getters/setters, the `matchesStartedNotFinished`
method and its call site, and the two removed `@RequestParam`s + their `c.setX(...)` lines in the
controller.

---

## Requirement 2: `minTmdbRating`

### SERIES-037-AC-02 [AUTO]
**Statement**: `SeriesSearchCriteria` shall gain `minTmdbRating` (`BigDecimal`).
`SeriesSearchService` shall gain `matchesTmdbRating(SeriesEntity, BigDecimal min)`, mirroring
`matchesImdbRating`'s exact null-handling: a series with `tmdbRating == null` matches only when
`min == null`; otherwise `s.getTmdbRating().compareTo(min) >= 0`.

**References**: `matchesImdbRating`'s existing shape, mirrored exactly for `tmdbRating`.

**Test Case (Red)**:
```groovy
def "SERIES-037-AC-02: minTmdbRating filters out series below the threshold"() {
    given: "two series, one above and one below the threshold"
        repository.save(new SeriesEntity(title: "High", tmdbRating: new BigDecimal("8.5")))
        repository.save(new SeriesEntity(title: "Low", tmdbRating: new BigDecimal("5.0")))

    when: "search is called with minTmdbRating=7.0"
        def results = service.search(new SeriesSearchCriteria(minTmdbRating: new BigDecimal("7.0")))

    then: "only the high-rated series is returned"
        results*.title == ["High"]
}

def "SERIES-037-AC-02: a series with no tmdbRating never matches a minTmdbRating filter"() {
    given: "a series with tmdbRating unset"
        repository.save(new SeriesEntity(title: "Unrated"))

    when: "search is called with minTmdbRating set"
        def results = service.search(new SeriesSearchCriteria(minTmdbRating: new BigDecimal("1.0")))

    then: "it's excluded"
        results.isEmpty()
}
```
**Test Case (Green)**: add the field/getter/setter, the `matchesTmdbRating` method, its call site in
`search()`'s filter chain, and the `@RequestParam(required = false) BigDecimal minTmdbRating` +
`c.setMinTmdbRating(minTmdbRating)` in the controller.

---

## Requirement 3: `yearMin`/`yearMax` (stopgap — matches the stored `year` field only)

### SERIES-037-AC-03 [AUTO]
**Statement**: `SeriesSearchCriteria` shall gain `yearMin`/`yearMax` (`Integer`).
`SeriesSearchService` shall gain `matchesYearRange(SeriesEntity, Integer yearMin, Integer yearMax)`,
mirroring `matchesPersonalRating`'s min/max null-handling shape exactly, matched against
`SeriesEntity.year` (the series' single stored start year — **not** an episode-air-date range; see
Design Decisions for why this is a documented stopgap).

**Test Case (Red)**:
```groovy
def "SERIES-037-AC-03: yearMin/yearMax filters against the stored year field"() {
    given: "three series with different years"
        repository.save(new SeriesEntity(title: "Old", year: 2005))
        repository.save(new SeriesEntity(title: "InRange", year: 2020))
        repository.save(new SeriesEntity(title: "New", year: 2030))

    when: "search is called with yearMin=2015, yearMax=2025"
        def results = service.search(new SeriesSearchCriteria(yearMin: 2015, yearMax: 2025))

    then: "only the in-range series is returned"
        results*.title == ["InRange"]
}

def "SERIES-037-AC-03: a series with no year never matches a yearMin/yearMax filter"() {
    given: "a series with year unset"
        repository.save(new SeriesEntity(title: "Unyeared"))

    when: "search is called with yearMin set"
        def results = service.search(new SeriesSearchCriteria(yearMin: 2000))

    then: "it's excluded"
        results.isEmpty()
}
```
**Test Case (Green)**: add the fields/getters/setters, `matchesYearRange`, its call site, and
`@RequestParam(required = false) Integer yearMin`/`yearMax` + setters in the controller.

---

## Implementation Notes

- **`API.md`** must document: three removed query params (`maxPersonalRating`/`maxImdbRating`/
  `startedNotFinished`, no longer accepted on `GET /api/v1/series/search`), two new ones
  (`minTmdbRating`, `yearMin`/`yearMax`) — flagged explicitly as a breaking change to this endpoint's
  contract, per this spec's own Design Decisions note.
- **`CHANGELOG.md`** gets a `## [Unreleased]` entry for the removed params (a real, if
  low-consequence, breaking API change) separate from the entry for the two new filters.

## Cross-References

| This spec | Source |
|---|---|
| `SeriesSearchCriteria`/`SeriesSearchService`, the classes this spec modifies | `series_spec_003_search.md` |
| The "episode air date" year-range semantic this spec deliberately doesn't yet replicate | `series_spec_031_custom_search_prefetch_filters.md` |
| Frontend consumer | `frontend_spec_055_search_filter_overhaul.md` |
| Deferred follow-up (end-year data column, true range semantics, `YYYY-YYYY` display) | `.claude/ideas/future_ideas.md` |

---

## Acceptance Criteria Summary

- [ ] SERIES-037-AC-01: `maxPersonalRating`/`maxImdbRating`/`startedNotFinished` removed entirely
- [ ] SERIES-037-AC-02: `minTmdbRating` filters correctly, including the no-rating case
- [ ] SERIES-037-AC-03: `yearMin`/`yearMax` filter against the stored `year` field, including the no-year case
