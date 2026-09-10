# Spec 060: Missing Ratings Filter

**Status**: Implemented — `dto/SeriesSearchCriteria.java`, `controller/SeriesController.java`,
`service/SeriesSearchService.java` (backend half only; frontend half tracked separately in
`frontend_spec_116_missing_ratings_filter_ui.md`)
**Priority**: P3 (quality-of-life filter for an existing, real data-completeness gap)
**Depends on**: `series_spec_037_search_filter_overhaul.md` (owns `SeriesSearchCriteria`'s
`minImdbRating`/`minTmdbRating` fields this spec sits alongside), `series_spec_008_series_lifecycle_data.md`
(owns `flaggedForRewatch`, the nullable-`Boolean` filter shape this spec's four new fields mirror)
**Area**: Backend (`dto/SeriesSearchCriteria.java`, `controller/SeriesController.java`,
`service/SeriesSearchService.java`) — paired with Frontend Spec 116
(`frontend_spec_116_missing_ratings_filter_ui.md`)

## Overview

Raised 2026-09-10: the user wants a way to find tracked series missing an IMDb, TMDB, or Rotten
Tomatoes rating, so they can go fill the gap in manually. Confirmed via reading the code and this
project's own prior specs that this is a real, known data-completeness gap, not a hypothetical one:

- `tmdbRating` is auto-sourced from TMDB on every add/refresh and is essentially always populated.
- `imdbRating` is auto-sourced via OMDb (best-effort, gated by `app.omdb.api-key`) — can be null if
  the key is unset or the call fails.
- `rottenTomatoesRating` (Tomatometer) is technically auto-fetched via OMDb's `Ratings[]` array
  today, but `series_spec_027`'s own live investigation already found OMDb returns it for only a
  small minority of TV series; `series_spec_009` excluded it from sortable fields for exactly this
  reason ("too often null to sort meaningfully"). This spec doesn't change that — it surfaces the
  gap, it doesn't close it.
- `rottenTomatoesPopcornmeter` has **no data source at all**, sanctioned or not —
  `SeriesEntity`'s own existing comment confirms it's "purely user-entered." No official Rotten
  Tomatoes API exists, and scraping their website directly would violate their Terms of Use and be
  fragile to markup changes — not attempted by this app, and this spec doesn't change that either.

Given none of this can be reliably auto-improved, the practical fix is a filter: let the user find
exactly which series need manual attention, for each rating independently.

## Design Decisions

- **Four independent nullable-`Boolean` fields, not one combined flag** — `missingImdbRating`,
  `missingTmdbRating`, `missingRottenTomatoesRating`, `missingRottenTomatoesPopcornmeter` — matching
  this app's existing per-field philosophy (`minImdbRating`/`minTmdbRating` are already separate
  fields, not one combined "low rating" flag). Each mirrors `flaggedForRewatch`'s exact existing
  shape: `null`/absent is a no-op, `true` restricts results.
- **When more than one is `true`, a series matches if it's missing *any* of the checked ratings —
  not all of them.** This is a deliberate OR-among-these-four-fields composition, different from
  this pipeline's usual all-AND composition across different criteria fields (genre AND status AND
  year-range, etc.). The reasoning: this filter's job is "show me what I still need to fix," an
  inclusive to-do list — checking a second box should broaden the list, not narrow it to the rare
  case of a series missing *both* specific ratings simultaneously. The four flags are therefore
  evaluated together in one new predicate method, not as four independently-ANDed filter stages.
  This combined-OR predicate still ANDs with every other criteria field as normal (e.g. combined
  with a genre filter, results are "matches the genre AND is missing at least one checked rating").
- **No entity or migration change.** This only filters on existing, already-nullable
  `SeriesEntity` columns (`imdbRating`, `tmdbRating`, `rottenTomatoesRating`,
  `rottenTomatoesPopcornmeter`) — a null value already means "not set" for all four.
- **No attempt to improve auto-sourcing coverage.** Explicitly out of scope, per this spec's own
  Overview — OMDb's low Rotten Tomatoes coverage for TV series and Popcornmeter's total absence of
  any data source are pre-existing, unfixable-by-this-app facts, not bugs this spec addresses.

---

## Requirement 1: `SeriesSearchCriteria` gains four missing-rating fields

**User story**: As a user, I want to search for series missing a specific rating, the same way I
can already search by a minimum rating threshold.

### SERIES-060-AC-01 [AUTO]
**Statement**: `SeriesSearchCriteria` shall gain four new nullable `Boolean` fields —
`missingImdbRating`, `missingTmdbRating`, `missingRottenTomatoesRating`,
`missingRottenTomatoesPopcornmeter` — each with a getter/setter pair, mirroring the existing
`flaggedForRewatch` field's shape exactly.

**References**: `dto/SeriesSearchCriteria.java` (existing `flaggedForRewatch` field, the shape this
mirrors).

**Test Case (Green)**: field/getter/setter addition, verified by every test case below compiling
and passing.

---

### SERIES-060-AC-02 [AUTO]
**Statement**: `GET /api/v1/series/search` shall accept four new optional query params —
`missingImdbRating`, `missingTmdbRating`, `missingRottenTomatoesRating`,
`missingRottenTomatoesPopcornmeter` (each `Boolean`) — setting them onto the `SeriesSearchCriteria`
passed to `SeriesSearchService`, mirroring `flaggedForRewatch`'s existing `@RequestParam` wiring
exactly.

**References**: `controller/SeriesController.java`'s `search` method (existing `flaggedForRewatch`
param, the wiring this mirrors).

**Test Case (Green)**: four new `@RequestParam(required = false) Boolean` params, set onto the
criteria object before it's passed to the search service — covered by
`SeriesControllerSpec.groovy`'s existing search-endpoint test shape, extended with one new
assertion per field (or a single param combination, matching whatever granularity that spec's
existing `flaggedForRewatch` test already uses).

---

## Requirement 2: Missing-rating matching, OR-composed among the four flags

**User story**: As a user, I want checking more than one "missing" box to show me everything
missing at least one of those ratings, not only series missing all of them at once.

### SERIES-060-AC-03 [AUTO]
**Statement**: When none of the four missing-rating fields is `true`, `SeriesSearchService` shall
apply no missing-rating restriction (a no-op, consistent with every other unset criteria field).

**Test Case (Red)**:
```groovy
def "SERIES-060-AC-03: no missing-rating criteria set returns everything, same as today"() {
    given: "a series with every rating set and one with none"
        seriesService.create(new SeriesDto(title: "Fully Rated", imdbRating: 8.0, tmdbRating: 7.5,
            rottenTomatoesRating: 90, rottenTomatoesPopcornmeter: 85))
        seriesService.create(new SeriesDto(title: "No Ratings At All"))

    when: "search is called with no missing-rating criteria"
        def results = searchService.search(new SeriesSearchCriteria())

    then: "both series are returned"
        results.size() == 2
}
```
**Test Case (Green)**: `matchesMissingRatings` returns `true` immediately when all four fields are
null/false.

---

### SERIES-060-AC-04 [AUTO]
**Statement**: When exactly one missing-rating field is `true`, `SeriesSearchService` shall return
only series where that specific rating is `null`.

**Test Case (Red)**:
```groovy
def "SERIES-060-AC-04: missingImdbRating=true returns only series with a null imdbRating"() {
    given: "one series with an imdbRating, one without"
        seriesService.create(new SeriesDto(title: "Has IMDb", imdbRating: 8.0))
        seriesService.create(new SeriesDto(title: "No IMDb"))

    when: "search is called with missingImdbRating: true"
        def criteria = new SeriesSearchCriteria(missingImdbRating: true)
        def results = searchService.search(criteria)

    then: "only the series without an imdbRating is returned"
        results*.title == ["No IMDb"]
}
```
**Test Case (Green)**: `matchesMissingRatings` checks `s.getImdbRating() == null` when
`missingImdbRating` is `true`.

---

### SERIES-060-AC-05 [AUTO]
**Statement**: When more than one missing-rating field is `true`, `SeriesSearchService` shall
return a series if it's `null` on **any** of the checked fields (OR among the checked flags), not
only series `null` on all of them.

**Test Case (Red)**:
```groovy
def "SERIES-060-AC-05: multiple missing-rating flags OR together"() {
    given: "one series missing only imdbRating, one missing only tmdbRating, one missing neither"
        seriesService.create(new SeriesDto(title: "Missing IMDb Only", tmdbRating: 7.0))
        seriesService.create(new SeriesDto(title: "Missing TMDB Only", imdbRating: 8.0))
        seriesService.create(new SeriesDto(title: "Missing Neither", imdbRating: 8.0, tmdbRating: 7.0))

    when: "search is called with both missingImdbRating and missingTmdbRating true"
        def criteria = new SeriesSearchCriteria(missingImdbRating: true, missingTmdbRating: true)
        def results = searchService.search(criteria)

    then: "both partially-missing series are returned, the fully-rated one is not"
        results*.title as Set == ["Missing IMDb Only", "Missing TMDB Only"] as Set
}
```
**Test Case (Green)**: `matchesMissingRatings` ORs each checked flag's own null-check together,
rather than ANDing them.

---

### SERIES-060-AC-06 [AUTO]
**Statement**: `missingRottenTomatoesRating`/`missingRottenTomatoesPopcornmeter` shall behave
identically to `missingImdbRating`/`missingTmdbRating` above, checked against
`SeriesEntity.rottenTomatoesRating`/`rottenTomatoesPopcornmeter` respectively.

**Test Case (Red)**:
```groovy
def "SERIES-060-AC-06: missingRottenTomatoesPopcornmeter=true returns only series without one"() {
    given: "one series with a Popcornmeter score, one without"
        seriesService.create(new SeriesDto(title: "Has Popcornmeter", rottenTomatoesPopcornmeter: 85))
        seriesService.create(new SeriesDto(title: "No Popcornmeter"))

    when: "search is called with missingRottenTomatoesPopcornmeter: true"
        def criteria = new SeriesSearchCriteria(missingRottenTomatoesPopcornmeter: true)
        def results = searchService.search(criteria)

    then: "only the series without one is returned"
        results*.title == ["No Popcornmeter"]
}
```
**Test Case (Green)**: same predicate, extended to the two Rotten Tomatoes fields.

---

## Implementation Notes

- **`API.md`** — `GET /api/v1/series/search`'s entry gains the four new query params, documented
  with the OR-among-themselves composition explained (so it isn't mistaken for the pipeline's usual
  AND behavior).
- **`RUNBOOK.md`** — no changes needed (no new config property).

## Cross-References

| This spec | Source |
|---|---|
| `minImdbRating`/`minTmdbRating`, the sibling rating-filter fields this sits alongside | `series_spec_037_search_filter_overhaul.md` |
| `flaggedForRewatch`, the nullable-`Boolean` filter shape this mirrors | `series_spec_008_series_lifecycle_data.md` |
| Rotten Tomatoes' low OMDb coverage for TV series, confirmed pre-existing | `series_spec_027_rotten_tomatoes_popcornmeter_and_refresh_safety.md` |
| `rottenTomatoesRating` excluded from sortable fields for the same low-coverage reason | `series_spec_009_rating_sort.md` |
| Frontend consumer | `frontend_spec_116_missing_ratings_filter_ui.md` |

## Acceptance Criteria Summary

- [x] SERIES-060-AC-01: `SeriesSearchCriteria` gains four missing-rating fields
- [x] SERIES-060-AC-02: `GET /series/search` accepts the four new query params
- [x] SERIES-060-AC-03: no missing-rating criteria set is a no-op
- [x] SERIES-060-AC-04: a single missing-rating flag filters correctly
- [x] SERIES-060-AC-05: multiple missing-rating flags OR together
- [x] SERIES-060-AC-06: Rotten Tomatoes fields behave identically to IMDb/TMDB
