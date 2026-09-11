# Series Spec 062: Rotten Tomatoes Sort Options & Missing-Rating Exclusion

**Status**: Implemented
**Priority**: P2 (extends an existing, frequently-used capability — list/search sorting)
**Depends on**: `series_spec_009_rating_sort.md` (established `SeriesSortResolver`, the six-member `sortBy` enum, and the nulls-last convention this spec partially supersedes), `series_spec_060_missing_ratings_filter.md` (introduced `rottenTomatoesRating`/`rottenTomatoesPopcornmeter` as tracked, independently-nullable fields with existing `missingRottenTomatoesRating`/`missingRottenTomatoesPopcornmeter` search-criteria filters this spec's new sort options complement)
**Area**: Backend (`service/SeriesSortResolver.java`, `service/SeriesService.java`, `service/SeriesSearchService.java`, `controller/SeriesController.java`, `dto/ApiResponse.java`)

## Overview

`SeriesSortResolver` currently supports six `sortBy` values (`dateAdded`, `personalRating`, `title`, `year`, `imdbRating`, `tmdbRating`), shared by both `GET /api/v1/series` (`SeriesService.getAll`) and `GET /api/v1/series/search` (`SeriesSearchService.search`). For every rating field, a series missing that rating is sorted to the end of the list (`comparingNullsLast`) but still shown.

This spec makes two changes:

1. **Adds two new sort options**: `rottenTomatoesRating` (Tomatometer) and `rottenTomatoesPopcornmeter` (audience score) — the two fields `series_spec_060` already made filterable via `missingRottenTomatoesRating`/`missingRottenTomatoesPopcornmeter`, now also sortable.
2. **Changes missing-value handling for every externally-sourced rating sort** (`imdbRating`, `tmdbRating`, and the two new Rotten Tomatoes fields): instead of sorting nulls to the end and still showing them, a series missing the rating being sorted on is now **excluded entirely** from the returned list, and the caller is told how many were excluded via a new `excludedCount` field on the response envelope (`ApiResponse`), so the frontend can render a message like "3 series meeting this criteria do not have Rotten Tomatoes ratings."

`personalRating`, `dateAdded`, `title`, and `year` are **not** affected — they keep today's nulls-last, still-shown behavior. `personalRating` is deliberately excluded even though it's also a "rating": an unrated series is a normal, everyday state (not yet watched/reviewed), not a data gap, so dropping it from the list would be far more disruptive than dropping the rare series missing an externally-sourced rating.

## Design Decisions

- **`isMissingRatingForSort` lives in `SeriesSortResolver`, alongside `resolve()`** — both are "what does this `sortBy` value mean" concerns, already the class's sole responsibility (per its existing class comment: "shared by `SeriesService.getAll()` and `SeriesSearchService.search()`... both listing endpoints need the identical behaviour for the same params"). A new package-private static method here, not a new class.
- **`resolveEffectiveSortBy` extracted as a small private helper**, mirroring the existing `resolveEffectiveDirection` pattern, and reused by both `resolve()` and `isMissingRatingForSort()` — keeps the null/blank-defaults-to-`dateAdded` rule defined exactly once.
- **Droppable fields are an explicit allow-list** (`imdbRating`, `tmdbRating`, `rottenTomatoesRating`, `rottenTomatoesPopcornmeter`), not "every rating except personalRating" computed some other way — the four are just named directly in a `switch`, matching this file's existing style (the `resolve()` switch already lists every field explicitly rather than deriving behavior generically).
- **Exclusion happens in `SeriesService`/`SeriesSearchService`, not inside `SeriesSortResolver`** — the resolver stays a pure "given these params, give me a comparator / a missing-predicate" helper with no stream/list logic of its own, consistent with its current shape (it returns a `Comparator`, it doesn't touch `List`s).
- **`SeriesSearchService`'s existing filter chain is refactored into a private `filteredEntities(SeriesSearchCriteria)` method** returning `List<SeriesEntity>` (everything `search()` already does except the final `.sorted()`/`.map()`), so both `search()` (drops missing-for-sort entries, returns the rest) and the new `countMissingForSort()` (counts exactly those dropped entries) operate over the identical pre-sort, post-every-other-filter population. This is a pure extraction — no behavior change to the existing filter chain itself.
- **`SeriesService.getAll(String, String)`'s return type is unchanged** (`List<SeriesDto>`) — its *content* now excludes missing-for-sort entries when `sortBy` is one of the four droppable fields, exactly like `search()`. A new sibling method, `countMissingForSort(String sortBy)`, is added for the controller to call separately. This keeps every existing caller/test of `getAll(String, String)` and `search(SeriesSearchCriteria)` working unchanged for every `sortBy` value already covered by existing tests (`personalRating`, `dateAdded`, invalid values) — only new tests are needed for the four droppable fields, nothing existing needs to change shape.
- **`ApiResponse<T>` gains a third field, `long excludedCount` (default `0`), plus a matching 3-arg constructor** — `ApiResponse(T data, long count, long excludedCount)`. The existing 1-arg and 2-arg constructors leave it at `0`, so every other endpoint's response shape is unaffected beyond one new always-present field defaulting to `0` — the same pattern this envelope already uses for `count` (present and meaningful only for list endpoints, `1` elsewhere, but never omitted).
- **Two DB reads per request for `search()`** (once inside `search()`, once inside `countMissingForSort()`) is an accepted, documented trade-off, not an oversight — this is a personal-scale, single-user, SQLite-backed app (per `README.md`/`tech.md`); a second `repository.findAll()` plus the same in-memory filter chain is not a meaningful cost here, and avoiding it would mean returning a combined result record from `search()` and updating all ~49 existing call sites in `SeriesSearchServiceSpec.groovy` that currently treat its return value as a plain `List<SeriesDto>` — a large, purely mechanical diff with no behavioral benefit at this scale.
- **`excludedCount` reflects the *pre-sort, post-every-other-filter* population** — i.e., for `search()`, it's computed after title/genre/status/rating-threshold/year/etc. filters already ran, matching the user's own framing ("if the rating for any series in the pre-sort has a missing rating"). For `getAll()` (no search criteria), the "pre-sort" population is simply every tracked series.

---

## Requirement 1: Rotten Tomatoes ratings are sortable

**User story**: As a user, I want to sort My Series (and search results) by Rotten Tomatoes Tomatometer or Popcornmeter score, the same way I can already sort by IMDb or TMDB rating.

### SERIES-062-AC-01 [AUTO]
**Statement**: `SeriesSortResolver.resolve()` shall accept `"rottenTomatoesRating"` and `"rottenTomatoesPopcornmeter"` as valid `sortBy` values, each producing a comparator ordering by that field, nulls last, honoring `sortDirection`.

**References**: `service/SeriesSortResolver.java` — `VALID_SORT_BY` (line 17-18), the `resolve()` switch (lines 45-52), `comparingNullsLast` (lines 65-69).

**Test Case (Red)**:
```groovy
def "SERIES-062-AC-01: getAll sorts by rottenTomatoesRating, nulls last"() {
  given: "three series with different Rotten Tomatoes ratings"
      seriesService.create(new SeriesDto(title: "RT Sort A", rottenTomatoesRating: 60))
      seriesService.create(new SeriesDto(title: "RT Sort B", rottenTomatoesRating: 95))
      seriesService.create(new SeriesDto(title: "RT Sort C"))

  when: "getAll() is called with sortBy=rottenTomatoesRating, sortDirection=desc"
      def results = seriesService.getAll("rottenTomatoesRating", "desc")
      def scoped = results.findAll { it.title.startsWith("RT Sort") }

  then: "results are ordered by rottenTomatoesRating descending -- the missing-value series is excluded, not sorted last (Requirement 2)"
      scoped*.title == ["RT Sort B", "RT Sort A"]
}

def "SERIES-062-AC-01b: getAll sorts by rottenTomatoesPopcornmeter"() {
  given: "two series with different Popcornmeter scores"
      seriesService.create(new SeriesDto(title: "Popcorn A", rottenTomatoesPopcornmeter: 70))
      seriesService.create(new SeriesDto(title: "Popcorn B", rottenTomatoesPopcornmeter: 90))

  when: "getAll() is called with sortBy=rottenTomatoesPopcornmeter, sortDirection=asc"
      def results = seriesService.getAll("rottenTomatoesPopcornmeter", "asc")
      def scoped = results.findAll { it.title.startsWith("Popcorn") }

  then: "results are ordered ascending"
      scoped*.title == ["Popcorn A", "Popcorn B"]
}
```
**Test Case (Green)**: add both values to `VALID_SORT_BY` and two new `case` branches to `resolve()`'s switch, each using `comparingNullsLast` exactly like `imdbRating`'s.

---

## Requirement 2: Sorting by an externally-sourced rating excludes series missing it

**User story**: As a user sorting by Rotten Tomatoes (or IMDb/TMDB) rating, I want the list to only show series that actually have that rating, with a way to know how many were left out — not have unrated series clutter the bottom of the list.

### SERIES-062-AC-02 [AUTO]
**Statement**: `SeriesSortResolver` shall expose `static boolean isMissingRatingForSort(SeriesEntity entity, String sortBy)`, returning `true` if and only if the effective `sortBy` (after the same null/blank-defaults-to-`dateAdded` resolution `resolve()` applies) is one of `imdbRating`, `tmdbRating`, `rottenTomatoesRating`, `rottenTomatoesPopcornmeter`, and the entity's corresponding field is `null`.

**References**: `resolveEffectiveDirection` (lines 24-26) as the pattern for the new `resolveEffectiveSortBy` helper; `SeriesEntity.getImdbRating()`/`getTmdbRating()`/`getRottenTomatoesRating()`/`getRottenTomatoesPopcornmeter()`.

**Test Case (Red)**: covered indirectly via `SERIES-062-AC-03`/`AC-04` below (this is a package-private helper with no direct spec file — same as `resolve()` itself, exercised only through `SeriesService`/`SeriesSearchService`).

**Test Case (Green)**: implement `isMissingRatingForSort` with a `switch` over the four droppable fields, `default -> false`.

---

### SERIES-062-AC-03 [AUTO]
**Statement**: `SeriesService.getAll(String sortBy, String sortDirection)` shall exclude from its returned list any series for which `SeriesSortResolver.isMissingRatingForSort(series, sortBy)` is `true`.

**References**: `service/SeriesService.java` — `doGetAll` (lines 263-270).

**Test Case (Red)**:
```groovy
def "SERIES-062-AC-03: getAll excludes series missing the sorted-on rating"() {
  given: "one series with an IMDb rating, one without"
      seriesService.create(new SeriesDto(title: "Has IMDb", imdbRating: 7.5))
      seriesService.create(new SeriesDto(title: "No IMDb"))

  when: "getAll() is called with sortBy=imdbRating"
      def results = seriesService.getAll("imdbRating", "desc")
      def titles = results*.title

  then: "the series without an IMDb rating is excluded entirely, not sorted last"
      titles.contains("Has IMDb")
      !titles.contains("No IMDb")
}

def "SERIES-062-AC-03b: getAll does not exclude on a non-droppable sortBy"() {
  given: "a series with no personal rating"
      seriesService.create(new SeriesDto(title: "Unrated"))

  when: "getAll() is called with sortBy=personalRating"
      def results = seriesService.getAll("personalRating", "desc")

  then: "the unrated series is still present"
      results*.title.contains("Unrated")
}
```
**Test Case (Green)**: add `.filter(s -> !SeriesSortResolver.isMissingRatingForSort(s, sortBy))` to `doGetAll`'s stream, before `.sorted(comparator)`.

---

### SERIES-062-AC-04 [AUTO]
**Statement**: `SeriesSearchService.search(SeriesSearchCriteria)` shall exclude from its returned list any series for which `SeriesSortResolver.isMissingRatingForSort(series, criteria.getSortBy())` is `true`, applied after every other criteria filter.

**References**: `service/SeriesSearchService.java` — the `search()` filter chain (lines 48-61).

**Test Case (Red)**:
```groovy
def "SERIES-062-AC-04: search excludes series missing the sorted-on Rotten Tomatoes rating"() {
  given: "one matching series with a Rotten Tomatoes rating, one matching series without"
      seriesService.create(new SeriesDto(title: "RT Search Has", genres: "Drama", rottenTomatoesRating: 80))
      seriesService.create(new SeriesDto(title: "RT Search Missing", genres: "Drama"))

  when: "search is called with sortBy=rottenTomatoesRating and an unrelated matching filter"
      def criteria = new SeriesSearchCriteria(genres: ["Drama"], sortBy: "rottenTomatoesRating")
      def results = searchService.search(criteria)
      def titles = results*.title

  then: "only the series with the rating is returned"
      titles.contains("RT Search Has")
      !titles.contains("RT Search Missing")
}
```
**Test Case (Green)**: extract the existing filter chain into `filteredEntities(criteria)`, then have `search()` apply `.filter(s -> !SeriesSortResolver.isMissingRatingForSort(s, criteria.getSortBy()))` to its result before sorting/mapping.

---

### SERIES-062-AC-05 [AUTO]
**Statement**: `SeriesService` shall expose `long countMissingForSort(String sortBy)`, returning the number of tracked series for which `isMissingRatingForSort` is `true` for the given `sortBy`.

**References**: `service/SeriesService.java`.

**Test Case (Red)**:
```groovy
def "SERIES-062-AC-05: countMissingForSort counts series missing the sorted-on rating"() {
  given: "two series with a TMDB rating, one without"
      seriesService.create(new SeriesDto(title: "TMDB Count A", tmdbRating: 7.0))
      seriesService.create(new SeriesDto(title: "TMDB Count B", tmdbRating: 8.0))
      seriesService.create(new SeriesDto(title: "TMDB Count C"))

  when: "countMissingForSort is called with sortBy=tmdbRating"
      def count = seriesService.countMissingForSort("tmdbRating")

  then: "it reports at least the one series known to be missing a TMDB rating"
      count >= 1
}

def "SERIES-062-AC-05b: countMissingForSort returns 0 for a non-droppable sortBy"() {
  expect:
      seriesService.countMissingForSort("personalRating") == 0
}
```
**Test Case (Green)**: `repository.findAll().stream().filter(s -> SeriesSortResolver.isMissingRatingForSort(s, sortBy)).count()`.

---

### SERIES-062-AC-06 [AUTO]
**Statement**: `SeriesSearchService` shall expose `long countMissingForSort(SeriesSearchCriteria criteria)`, returning the number of series matching every criteria filter *except* the sort-based exclusion that are missing the sorted-on rating.

**References**: `service/SeriesSearchService.java`.

**Test Case (Red)**:
```groovy
def "SERIES-062-AC-06: countMissingForSort counts within the filtered population"() {
  given: "two Drama series match the filter; one has a Rotten Tomatoes rating, one doesn't; a non-Drama series without the rating is out of scope"
      seriesService.create(new SeriesDto(title: "Count Has", genres: "Drama", rottenTomatoesRating: 80))
      seriesService.create(new SeriesDto(title: "Count Missing", genres: "Drama"))
      seriesService.create(new SeriesDto(title: "Count Out Of Scope", genres: "Comedy"))

  when: "countMissingForSort is called with the same Drama + rottenTomatoesRating criteria"
      def criteria = new SeriesSearchCriteria(genres: ["Drama"], sortBy: "rottenTomatoesRating")
      def count = searchService.countMissingForSort(criteria)

  then: "only the in-scope, rating-missing series is counted"
      count == 1
}
```
**Test Case (Green)**: `filteredEntities(criteria).stream().filter(s -> SeriesSortResolver.isMissingRatingForSort(s, criteria.getSortBy())).count()`.

---

## Requirement 3: The API surfaces the excluded count

**User story**: As a frontend developer, I need the excluded-count alongside the (already-filtered) list in one response, so the UI can show "N series... do not have X ratings" without a second round trip.

### SERIES-062-AC-07 [AUTO]
**Statement**: `ApiResponse<T>` shall gain a `long excludedCount` field (default `0`) and a constructor `ApiResponse(T data, long count, long excludedCount)`; the existing 1-arg and 2-arg constructors shall leave `excludedCount` at `0`.

**References**: `dto/ApiResponse.java`.

**Test Case (Green)**: add the field, getter/setter, and 3-arg constructor. No dedicated spec file exists for this small DTO today (consistent with the project's existing state) — covered end-to-end by `SERIES-062-AC-08`/`AC-09` below via the real HTTP response body.

---

### SERIES-062-AC-08 [AUTO]
**Statement**: `GET /api/v1/series?sortBy=rottenTomatoesRating` shall return `excludedCount` equal to the number of series excluded for missing that rating, alongside the (already-excluding) `data` array.

**References**: `controller/SeriesController.java` — `getAll` (lines 72-78).

**Test Case (Red)**:
```groovy
def "SERIES-062-AC-08: GET /api/v1/series reports excludedCount when sorting by a droppable rating"() {
  given: "one series with a Rotten Tomatoes rating, one without"
      seriesService.create(new SeriesDto(title: "Controller RT Has", rottenTomatoesRating: 88))
      seriesService.create(new SeriesDto(title: "Controller RT Missing"))

  when: "a GET request is made with sortBy=rottenTomatoesRating"
      def result = mockMvc.perform(get("/api/v1/series").param("sortBy", "rottenTomatoesRating"))

  then: "the response reports at least one excluded series, and the excluded series is not in data"
      result.andExpect(status().isOk())
      def body = objectMapper.readValue(result.andReturn().response.contentAsString, Map)
      body.excludedCount >= 1
      !body.data*.title.contains("Controller RT Missing")
}
```
**Test Case (Green)**: `SeriesController.getAll` computes `seriesService.countMissingForSort(sortBy)` and passes it to `new ApiResponse<>(list, list.size(), excludedCount)`.

---

### SERIES-062-AC-09 [AUTO]
**Statement**: `GET /api/v1/series/search?sortBy=rottenTomatoesPopcornmeter` shall return `excludedCount` equal to the number of *criteria-matching* series excluded for missing that rating.

**References**: `controller/SeriesController.java` — `search` (lines 103-136).

**Test Case (Red)**:
```groovy
def "SERIES-062-AC-09: GET /api/v1/series/search reports excludedCount for the filtered population"() {
  given: "one Drama series with a Popcornmeter score, one Drama series without"
      seriesService.create(new SeriesDto(title: "Search RT Has", genres: "Drama", rottenTomatoesPopcornmeter: 75))
      seriesService.create(new SeriesDto(title: "Search RT Missing", genres: "Drama"))

  when: "a GET request is made with genre=Drama&sortBy=rottenTomatoesPopcornmeter"
      def result = mockMvc.perform(
        get("/api/v1/series/search")
          .param("genre", "Drama")
          .param("sortBy", "rottenTomatoesPopcornmeter")
      )

  then: "excludedCount reflects the one matching-but-missing series"
      result.andExpect(status().isOk())
      def body = objectMapper.readValue(result.andReturn().response.contentAsString, Map)
      body.excludedCount == 1
}
```
**Test Case (Green)**: `SeriesController.search` computes `searchService.countMissingForSort(c)` and passes it to `new ApiResponse<>(results, results.size(), excludedCount)`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `SeriesSortResolver`, the six-member `sortBy` enum, nulls-last convention this spec extends | `series_spec_009_rating_sort.md` |
| `rottenTomatoesRating`/`rottenTomatoesPopcornmeter` fields, existing `missingRottenTomatoes*` search filters | `series_spec_060_missing_ratings_filter.md` |
| Response envelope this spec extends | `dto/ApiResponse.java` |
| Frontend consumer of the new sort options and `excludedCount` field | `frontend_spec_119_rating_sort_missing_value_exclusion.md` (companion spec) |

---

## Acceptance Criteria Summary

- [x] SERIES-062-AC-01: `rottenTomatoesRating`/`rottenTomatoesPopcornmeter` are valid, working sort options
- [x] SERIES-062-AC-02: `SeriesSortResolver.isMissingRatingForSort` correctly identifies the four droppable fields
- [x] SERIES-062-AC-03: `SeriesService.getAll` excludes series missing the sorted-on rating
- [x] SERIES-062-AC-04: `SeriesSearchService.search` excludes series missing the sorted-on rating, after other filters
- [x] SERIES-062-AC-05: `SeriesService.countMissingForSort` reports the excluded count
- [x] SERIES-062-AC-06: `SeriesSearchService.countMissingForSort` reports the excluded count within the filtered population
- [x] SERIES-062-AC-07: `ApiResponse` gains `excludedCount` (default 0) and a 3-arg constructor
- [x] SERIES-062-AC-08: `GET /api/v1/series` surfaces `excludedCount`
- [x] SERIES-062-AC-09: `GET /api/v1/series/search` surfaces `excludedCount`
