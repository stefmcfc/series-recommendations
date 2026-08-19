# Spec 009: Sort by Personal Rating

**Status**: Not started
**No `frontend/` files are touched by this spec** — the sort control UI, star display/input, and the `personalRating` column on `SeriesList` are `frontend_spec_013_star_ratings.md`, a separate follow-up task.
**Priority**: P3 (small, self-contained UX gap)
**Depends on**: Spec 001 (`SeriesEntity.personalRating`), Spec 003 (`SeriesSearchService`, `SeriesSearchCriteria`)
**Backend Task**

## Overview

Adds sorting to both series-listing endpoints (`GET /api/v1/series` and `GET /api/v1/series/search`), which today have no user-controllable order at all: `search` always hard-sorts by `dateAdded` descending (`SeriesSearchService.search`), and `getAll` has no explicit ordering whatsoever. This is a small, self-contained gap — the frontend (`frontend_spec_013`) needs a `sortBy=personalRating` option to let a user sort their list by how highly they rated each series, and since `SeriesList` calls `getAll()` whenever no filter is active and `search()` otherwise, both endpoints need the same sort contract for the control to behave consistently regardless of whether a filter is applied.

**Design decisions**:
- **`getAll()` gains an explicit default order (`dateAdded` descending) where none existed before.** This is a small behavior addition, not a pure preservation of the status quo — today's `getAll()` order is whatever `SeriesRepository.findAll()` happens to return (undefined, incidentally insertion-like on SQLite). Giving it the same default as `search()` makes the two endpoints consistent with each other, which is what `SeriesList` actually needs (it switches between them transparently based on whether a filter is active), and a defined default order is strictly better than an undefined one.
- **Only two sort fields are supported: `dateAdded` (existing default) and `personalRating`** — not a general-purpose multi-field sort system. Nothing beyond `personalRating` was asked for, and a generic sort-by-any-column mechanism isn't warranted by one requirement.
- **Sorting logic is written once and shared** by `SeriesService.getAll()` and `SeriesSearchService.search()`, rather than duplicated — both need the identical `sortBy`/`sortDirection` → `Comparator<SeriesEntity>` resolution.
- **A series with a null `personalRating`, under `sortBy=personalRating`, always sorts last — regardless of `sortDirection`.** An unrated series isn't "lower than 1 star," it's simply not comparable; jumping it to the top under ascending order would be misleading.

---

## Requirements

### Requirement 1: Sortable Series Listing

**User story**: As a user, I want to sort my series list by my own rating, so my favorites (or the ones I'm least sure about) surface without needing to filter them out one range at a time.

#### Acceptance Criteria

- **SERIES-009-AC-01** [AUTO]: `GET /api/v1/series` and `GET /api/v1/series/search` shall each accept optional `sortBy` (`dateAdded` | `personalRating`, default `dateAdded`) and `sortDirection` (`asc` | `desc`, default `desc`) parameters.
- **SERIES-009-AC-02** [AUTO]: A `sortBy` value other than `dateAdded`/`personalRating` shall result in `400 Bad Request` (`IllegalArgumentException`), following `SeriesSearchService`'s existing invalid-`status`-value validation style.
- **SERIES-009-AC-03** [AUTO]: A `sortDirection` value other than `asc`/`desc` shall result in `400 Bad Request`, same style as `SERIES-009-AC-02`.
- **SERIES-009-AC-04** [AUTO]: Under `sortBy=personalRating`, a series with a null `personalRating` shall sort after every non-null-rated series, regardless of `sortDirection` (see Design Decisions).
- **SERIES-009-AC-05** [AUTO]: The `sortBy`/`sortDirection` → `Comparator<SeriesEntity>` resolution shall be implemented once and shared between `SeriesService.getAll()` and `SeriesSearchService.search()` — not duplicated.
- **SERIES-009-AC-06** [AUTO]: When neither `sortBy` nor `sortDirection` is supplied, `GET /api/v1/series/search` shall behave exactly as it does today (`dateAdded` descending, `SERIES-003`'s existing default); `GET /api/v1/series` shall newly apply that same default (see Design Decisions — this is the one observable behavior change from this spec for callers that don't pass either parameter).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `SeriesEntity.personalRating` (`1`–`5`, nullable) | `series_spec_001_entity.md` |
| `SeriesSearchService.search()`'s existing hardcoded `dateAdded` descending sort, `SeriesSearchCriteria`, invalid-`status` → `400` validation style | `series_spec_003_search.md` |
| Future frontend consumer: sort control, star display/input, `personalRating` column on `SeriesList` | `frontend_spec_013_star_ratings.md` (not yet written) |

---

## TDD Test Case Sketches

### `SeriesSearchServiceSpec.groovy`

```groovy
def "SERIES-009-AC-01/04: sorts by personalRating descending, nulls last"() {
    given: "three series: rating 3, rating 5, rating null"
        // ...

    when: "search is called with sortBy=personalRating, sortDirection=desc"
        def results = searchService.search(new SeriesSearchCriteria(sortBy: "personalRating", sortDirection: "desc"))

    then: "order is 5, 3, null"
        results*.personalRating == [5, 3, null]
}

def "SERIES-009-AC-04: nulls stay last even under ascending order"() {
    given: "three series: rating 3, rating 5, rating null"
        // ...

    when: "search is called with sortBy=personalRating, sortDirection=asc"
        def results = searchService.search(new SeriesSearchCriteria(sortBy: "personalRating", sortDirection: "asc"))

    then: "order is 3, 5, null -- not null, 3, 5"
        results*.personalRating == [3, 5, null]
}

def "SERIES-009-AC-02: an invalid sortBy value is rejected"() {
    when: "search is called with sortBy=notAField"
        searchService.search(new SeriesSearchCriteria(sortBy: "notAField"))

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
}
```

### `SeriesServiceSpec.groovy`

```groovy
def "SERIES-009-AC-06: getAll defaults to dateAdded descending"() {
    given: "three series added in a non-chronological insertion order"
        // ...

    when: "getAll() is called with no sort params"
        def results = seriesService.getAll(null, null)

    then: "results are ordered by dateAdded, most recent first"
        // ...
}
```

### `SeriesControllerSpec.groovy`

```groovy
def "SERIES-009-AC-03: an invalid sortDirection returns 400"() {
    when: "GET /api/v1/series?sortDirection=sideways is requested"
        def response = client.get().uri("/api/v1/series?sortDirection=sideways").exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}
```

---

## Acceptance Criteria Summary

- [ ] SERIES-009-AC-01: `sortBy`/`sortDirection` params on both listing endpoints
- [ ] SERIES-009-AC-02: invalid `sortBy` → 400
- [ ] SERIES-009-AC-03: invalid `sortDirection` → 400
- [ ] SERIES-009-AC-04: null `personalRating` always sorts last
- [ ] SERIES-009-AC-05: shared comparator resolution, not duplicated
- [ ] SERIES-009-AC-06: unset params → today's `search` default; new default for `getAll`
