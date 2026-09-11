# Series Spec 063: Rotten Tomatoes Minimum-Rating Filter

**Status**: Not started
**Priority**: P3 (extends existing min-rating filtering to a field that already has sort/missing-value support)
**Depends on**: `series_spec_037_search_filter_overhaul.md` (established `minImdbRating`/`minTmdbRating` — the pattern this spec mirrors), `series_spec_060_missing_ratings_filter.md` (introduced `rottenTomatoesRating`/`rottenTomatoesPopcornmeter` as independently-filterable fields via the `missingRottenTomatoes*` booleans), `series_spec_062_rating_sort_missing_value_exclusion.md` (RT already sortable — this spec adds the remaining "filter by minimum value" capability so RT reaches parity with IMDb/TMDB across sort, missing-check, and now minimum-value filtering)
**Area**: Backend (`dto/SeriesSearchCriteria.java`, `service/SeriesSearchService.java`, `controller/SeriesController.java`)

## Overview

`GET /api/v1/series/search` and `GET /api/v1/series/export` already support `minImdbRating`/`minTmdbRating` (both `BigDecimal`, 0-10 scale). Rotten Tomatoes ratings (`rottenTomatoesRating` — Tomatometer, `rottenTomatoesPopcornmeter` — Popcornmeter, both `Integer`, 0-100 scale) have no equivalent minimum-value filter today — only the boolean "is this rating missing" filters from `series_spec_060`. This spec adds `minRottenTomatoesRating`/`minRottenTomatoesPopcornmeter` as two new, independent minimum-value filters, mirroring `minTmdbRating`'s exact shape and null-handling.

## Design Decisions

- **Two independent `Integer` fields, not one combined field** — matches how this app already treats RT as two independent ratings everywhere else (sort options, missing-value booleans): `rottenTomatoesRating`/`rottenTomatoesPopcornmeter` are separate, unrelated scores (critic vs. audience), never combined.
- **`Integer`, not `BigDecimal`** — matches `SeriesEntity.rottenTomatoesRating`/`rottenTomatoesPopcornmeter`'s own type (a whole-number 0-100 percentage, unlike IMDb/TMDB's decimal 0-10 scale). The comparison is a plain `Integer` `>=`, not `BigDecimal.compareTo`.
- **No new backend range validation** (no `@Min`/`@Max` annotations) — deliberately matches `minImdbRating`/`minTmdbRating`'s existing behavior on this exact DTO today: neither has any backend bounds-checking on `/search`/`/export` (confirmed by reading `SeriesSearchCriteria.java`/`SeriesSearchService.java` — no annotations, no validator class touches this path; that's a different, unrelated validator guarding only the separate `/recommendations` endpoint). Adding new validation here that IMDb/TMDB don't have would be an inconsistency, not an improvement — "validated as per the other ratings" means matching that existing (client-side-constrained-only) behavior, not introducing something new.
- **Available on both `/search` and `/export`**, like `minImdbRating`/`minTmdbRating` — unlike the missing-rating booleans (`series_spec_060`), which are search-only. RT minimum-rating filtering is a threshold filter in the same family as the other ratings, not a presence check, so it should work everywhere the other rating thresholds do.
- **`buildCriteria`'s shared-field signature widens by 2 params** (rather than setting the two new fields ad hoc per endpoint) since both `/search` and `/export` need them identically — consistent with how the existing 8 shared fields are threaded through today.

---

## Requirement 1: Minimum Rotten Tomatoes rating filters series by a threshold

**User story**: As a user searching or exporting my series, I want to filter to only series with a Rotten Tomatoes Tomatometer or Popcornmeter score at or above a value I choose, the same way I already can for IMDb and TMDB ratings.

### SERIES-063-AC-01 [AUTO]
**Statement**: `SeriesSearchCriteria` shall gain `Integer minRottenTomatoesRating` and `Integer minRottenTomatoesPopcornmeter` fields with public getters/setters, inserted after the existing `minTmdbRating` field/accessor pair.

**References**: `dto/SeriesSearchCriteria.java` line 21 (`minTmdbRating` field), lines 65-66 (its accessors).

**Test Case (Green)**: add the two fields and their getters/setters. No dedicated test — covered end-to-end by AC-02/AC-03/AC-05 below, consistent with how this DTO's existing fields have no standalone unit test file.

---

### SERIES-063-AC-02 [AUTO]
**Statement**: `SeriesSearchService.search()` shall exclude series whose `rottenTomatoesRating` is `null` or below `criteria.getMinRottenTomatoesRating()` when that criterion is set; a `null` criterion is a no-op (all series pass). Identical behavior for `rottenTomatoesPopcornmeter`/`minRottenTomatoesPopcornmeter`.

**References**: `service/SeriesSearchService.java` lines 73-75 (`filteredEntities`'s existing `matchesImdbRating`/`matchesTmdbRating`/`matchesYearRange` filter chain), lines 144-147 (`matchesTmdbRating`, the method being mirrored).

**Test Case (Red)**:
```groovy
def "SERIES-063-AC-02: search excludes series below the minimum Rotten Tomatoes rating"() {
  given: "one series meeting the threshold, one below it, one with no rating at all"
      seriesService.create(new SeriesDto(title: "RT Min Has", rottenTomatoesRating: 85))
      seriesService.create(new SeriesDto(title: "RT Min Low", rottenTomatoesRating: 40))
      seriesService.create(new SeriesDto(title: "RT Min Missing"))

  when: "search is called with minRottenTomatoesRating=60"
      def criteria = new SeriesSearchCriteria(minRottenTomatoesRating: 60)
      def titles = searchService.search(criteria)*.title

  then: "only the series meeting the threshold is returned"
      titles.contains("RT Min Has")
      !titles.contains("RT Min Low")
      !titles.contains("RT Min Missing")
}

def "SERIES-063-AC-02b: search excludes series below the minimum Popcornmeter rating"() {
  given: "one series meeting the threshold, one below it"
      seriesService.create(new SeriesDto(title: "Popcorn Min Has", rottenTomatoesPopcornmeter: 90))
      seriesService.create(new SeriesDto(title: "Popcorn Min Low", rottenTomatoesPopcornmeter: 50))

  when: "search is called with minRottenTomatoesPopcornmeter=70"
      def criteria = new SeriesSearchCriteria(minRottenTomatoesPopcornmeter: 70)
      def titles = searchService.search(criteria)*.title

  then: "only the series meeting the threshold is returned"
      titles.contains("Popcorn Min Has")
      !titles.contains("Popcorn Min Low")
}

def "SERIES-063-AC-02c: a null minRottenTomatoesRating is a no-op"() {
  given: "a series with no Rotten Tomatoes rating at all"
      seriesService.create(new SeriesDto(title: "RT Min No-Op"))

  when: "search is called with no RT criteria set"
      def titles = searchService.search(new SeriesSearchCriteria())*.title

  then: "the series is still returned"
      titles.contains("RT Min No-Op")
}
```
**Test Case (Green)**: add `matchesRottenTomatoesRating`/`matchesRottenTomatoesPopcornmeter` methods mirroring `matchesTmdbRating`'s exact null-handling shape but comparing `Integer` directly:
```java
private boolean matchesRottenTomatoesRating(SeriesEntity s, Integer min) {
    if (s.getRottenTomatoesRating() == null) return min == null;
    return min == null || s.getRottenTomatoesRating() >= min;
}
private boolean matchesRottenTomatoesPopcornmeter(SeriesEntity s, Integer min) {
    if (s.getRottenTomatoesPopcornmeter() == null) return min == null;
    return min == null || s.getRottenTomatoesPopcornmeter() >= min;
}
```
Insert both as new `.filter(...)` stages in `filteredEntities`, after the existing `matchesTmdbRating` stage (line 74) and before `matchesYearRange` (line 75).

---

### SERIES-063-AC-03 [AUTO]
**Statement**: `GET /api/v1/series/search` shall accept `minRottenTomatoesRating`/`minRottenTomatoesPopcornmeter` query parameters and apply them via `SeriesSearchService.search()`.

**References**: `controller/SeriesController.java` — the `/search` endpoint's `@RequestParam` list and its call into `buildCriteria`.

**Test Case (Red)**:
```groovy
def "SERIES-063-AC-03: GET /api/v1/series/search honors minRottenTomatoesRating"() {
  given: "one series meeting the threshold, one below it"
      seriesService.create(new SeriesDto(title: "Controller RT Has", rottenTomatoesRating: 85))
      seriesService.create(new SeriesDto(title: "Controller RT Low", rottenTomatoesRating: 40))

  when: "a GET request is made with minRottenTomatoesRating=60"
      def result = mockMvc.perform(get("/api/v1/series/search").param("minRottenTomatoesRating", "60"))

  then: "only the series meeting the threshold is returned"
      result.andExpect(status().isOk())
      result.andExpect(jsonPath('$.data.length()').value(1))
      result.andExpect(jsonPath('$.data[0].title').value("Controller RT Has"))
}
```
**Test Case (Green)**: add `@RequestParam(required = false) Integer minRottenTomatoesRating`/`minRottenTomatoesPopcornmeter` to the `/search` endpoint signature, threaded through `buildCriteria`.

---

### SERIES-063-AC-04 [AUTO]
**Statement**: `GET /api/v1/series/export` shall also accept and apply `minRottenTomatoesRating`/`minRottenTomatoesPopcornmeter`, matching `minImdbRating`/`minTmdbRating`'s existing availability on both endpoints.

**References**: `controller/SeriesController.java` — the `/export` endpoint's `@RequestParam` list, `buildCriteria`'s Javadoc (currently documents an 8-field shared set — needs updating to 10).

**Test Case (Red)**:
```groovy
def "SERIES-063-AC-04: GET /api/v1/series/export honors minRottenTomatoesRating"() {
  given: "one series meeting the threshold, one below it"
      seriesService.create(new SeriesDto(title: "Export RT Has", rottenTomatoesRating: 85))
      seriesService.create(new SeriesDto(title: "Export RT Low", rottenTomatoesRating: 40))

  when: "an export request is made with format=json and minRottenTomatoesRating=60"
      def result = mockMvc.perform(
        get("/api/v1/series/export").param("format", "json").param("minRottenTomatoesRating", "60")
      )

  then: "only the series meeting the threshold is included"
      result.andExpect(status().isOk())
      result.getResponse().contentAsString.contains("Export RT Has")
      !result.getResponse().contentAsString.contains("Export RT Low")
}
```
**Test Case (Green)**: add the same two `@RequestParam`s to `/export`, widen `buildCriteria`'s signature by 2 params so both endpoints share the same construction path, update its Javadoc.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `minImdbRating`/`minTmdbRating` pattern this spec mirrors exactly | `series_spec_037_search_filter_overhaul.md` |
| `rottenTomatoesRating`/`rottenTomatoesPopcornmeter` fields, existing missing-value booleans | `series_spec_060_missing_ratings_filter.md` |
| RT sort options (parity this spec extends to minimum-value filtering) | `series_spec_062_rating_sort_missing_value_exclusion.md` |
| Frontend consumer of these new query params | `frontend_spec_122_rating_filter_and_step_refinements.md` (companion spec) |

---

## Acceptance Criteria Summary

- [ ] SERIES-063-AC-01: `SeriesSearchCriteria` gains the two new fields
- [ ] SERIES-063-AC-02: `SeriesSearchService.search()` filters correctly on both new fields, null-criterion no-op
- [ ] SERIES-063-AC-03: `GET /api/v1/series/search` accepts and applies both new params
- [ ] SERIES-063-AC-04: `GET /api/v1/series/export` accepts and applies both new params
