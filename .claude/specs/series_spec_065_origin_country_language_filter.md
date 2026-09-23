# Series Spec 065: Filter My Series by Origin Country / Original Language

**Status**: Complete
**Priority**: P3 (extends existing search/export filtering to two fields — `originCountry`,
`originalLanguage` — that already exist on `SeriesEntity` and are already displayed, but have no
filter yet)
**Depends on**: `series_spec_037_search_filter_overhaul.md` (established the `SeriesSearchCriteria` /
`SeriesSearchService` filter-stage pattern this spec extends), `series_spec_021_origin_country.md`
(introduced `SeriesEntity.originCountry`), `series_spec_046_multi_origin_country.md` (widened
`originCountry` to a comma-joined multi-value string — the shape `matchesOriginCountry` must handle),
`series_spec_061_series_original_language.md` (introduced `SeriesEntity.originalLanguage`, documented
single-value-only), `series_spec_063_rotten_tomatoes_min_rating_filter.md` (closest recent precedent —
same shape of change: two new fields threaded through `SeriesSearchCriteria`/`SeriesSearchService`/both
controller endpoints)
**Area**: Backend (`dto/SeriesSearchCriteria.java`, `service/SeriesSearchService.java`,
`controller/SeriesController.java`) — paired with `frontend_spec_128_origin_country_language_filter.md`
for the UI.

## Overview

`SeriesEntity.originCountry` (comma-joined ISO 3166-1 alpha-2 codes, e.g. `"GB,US"`) and
`SeriesEntity.originalLanguage` (a single ISO 639-1 code, e.g. `"en"`) already exist on every tracked
series and are already displayed on the frontend, but neither is filterable today — `GET
/api/v1/series/search` and `GET /api/v1/series/export` have no query params for either. This spec adds
`originCountry` (repeatable, OR-matched) and `originalLanguage` (single, exact-matched) as two new,
independent filters on both endpoints, following the exact pattern this app already uses for its other
categorical filters (`genres`, `status`).

## Design Decisions

- **`originCountry` is multi-value and OR/substring-matched, mirroring `matchesGenres` exactly —
  because `SeriesEntity.originCountry` has the identical comma-joined multi-value shape as
  `SeriesEntity.genres`** (`series_spec_046`'s widening from a single code to a comma-joined list of
  every TMDB-reported origin country). A series co-produced across two countries should match a filter
  naming either one, the same way a series tagged with two genres matches a filter naming either.
- **`originalLanguage` is single-value and exact-matched, mirroring `matchesStatus`'s shape — because
  `SeriesEntity.originalLanguage` is documented single-value-only** (`series_spec_061`'s own Design
  Decisions: "No multi-value widening needed, unlike `originCountry`... TMDB's `original_language` is
  always a single code"). There is no OR-semantics question here the way there is for `originCountry` —
  a series has exactly one original language or none. Match is case-sensitive `String.equals`, matching
  `matchesStatus`'s own shape exactly, not the case-insensitive `equalsIgnoreCase` `matchesKeywords`
  uses for free-text keyword names — `originalLanguage` is a raw ISO 639-1 code, always lowercase both
  as TMDB reports it and as the frontend's own `LANGUAGE_OPTION_CODES` list sends it
  (`frontend_spec_098`), so there's no free-text case variance to guard against here.
- **Both new fields are inserted into `SeriesSearchCriteria` alongside the file's other
  categorical/exact-match fields (`genres`/`excludeGenres`/`keywords`/`status`), immediately after
  `status` and before the numeric rating fields** — keeps the DTO's existing categorical-then-numeric
  grouping intact rather than interleaving a new categorical pair among the rating thresholds.
- **Available on both `/search` and `/export`**, like `genres`/`status`/every rating threshold —
  unlike the missing-rating booleans (`series_spec_060`), which are search-only. `originCountry`/
  `originalLanguage` are inclusion filters in the same family as genre/status/rating thresholds, not a
  presence check, so — following `minRottenTomatoesRating`'s own precedent (`series_spec_063`'s Design
  Decisions, itself following `minImdbRating`/`minTmdbRating`) — they belong wherever the other
  inclusion filters already work, on both endpoints.
- **`buildCriteria`'s shared-field signature widens by 2 params** (from the current 10 to 12), inserted
  alongside `status` to match the DTO's own new field placement — consistent with how every other
  shared field is threaded through today, and with how `series_spec_063` widened this same signature by
  2 for its own pair of new fields.
- **No new backend range/format validation** — matches `originCountry`/`originalLanguage`'s own
  existing posture everywhere else in this codebase (`series_spec_021`/`series_spec_061`'s Design
  Decisions: "no format validation... trust the upstream API's own data"). A filter value that matches
  nothing simply returns zero results, the same as an unrecognized genre or keyword does today.

---

## Requirement 1: Origin country and original language filter series by inclusion

**User story**: As a user searching or exporting my series, I want to filter to only series originating
from a country I choose, or in a language I choose, the same way I already can by genre or status.

### SERIES-065-AC-01 [AUTO]
**Statement**: `SeriesSearchCriteria` shall gain `List<String> originCountry` and `String
originalLanguage` fields with public getters/setters, inserted immediately after the existing `status`
field/accessor pair.

**References**: `dto/SeriesSearchCriteria.java` line 16 (`status` field), line 17 (`minPersonalRating`,
the field immediately after — the insertion point), lines 64-65 (`status`'s accessors).

**Test Case (Green)**: add the two fields and their getters/setters. No dedicated test — covered
end-to-end by AC-02/AC-03/AC-04 below, consistent with how this DTO's existing fields have no
standalone unit test file (see `series_spec_063`'s own AC-01 for the same precedent).

---

### SERIES-065-AC-02 [AUTO]
**Statement**: `SeriesSearchService.search()` shall exclude series whose `originCountry` doesn't contain
(case-insensitive substring match) any of `criteria.getOriginCountry()`'s entries when that criterion is
set — a series with no `originCountry` at all never matches an active filter; a `null`/empty criterion
is a no-op. `SeriesSearchService.search()` shall also exclude series whose `originalLanguage` doesn't
case-sensitively equal `criteria.getOriginalLanguage()` when that criterion is set — a series with no
`originalLanguage` never matches an active filter; a `null`/blank criterion is a no-op.

**References**: `service/SeriesSearchService.java` lines 66-81 (`filteredEntities`'s existing filter
chain — `matchesStatus` at line 71 is the insertion point), lines 100-105 (`matchesGenres`, the pattern
`matchesOriginCountry` mirrors), lines 129-132 (`matchesStatus`, the pattern `matchesOriginalLanguage`
mirrors).

**Test Case (Red)**:
```groovy
def "SERIES-065-AC-02: search matches a series on any of its comma-joined origin countries"() {
  given: "a co-produced series, a single-country series, and a series with no origin country at all"
      seriesService.create(new SeriesDto(title: "Origin Co-Production", originCountry: "GB,US"))
      seriesService.create(new SeriesDto(title: "Origin Single", originCountry: "FR"))
      seriesService.create(new SeriesDto(title: "Origin Missing"))

  when: "search is called with originCountry=[US]"
      def criteria = new SeriesSearchCriteria(originCountry: ["US"])
      def titles = searchService.search(criteria)*.title

  then: "only the series carrying that country (anywhere in its comma-joined value) is returned"
      titles.contains("Origin Co-Production")
      !titles.contains("Origin Single")
      !titles.contains("Origin Missing")
}

def "SERIES-065-AC-02b: search excludes a series whose originalLanguage doesn't match"() {
  given: "one series in English, one in Korean, one with no language set"
      seriesService.create(new SeriesDto(title: "Language English", originalLanguage: "en"))
      seriesService.create(new SeriesDto(title: "Language Korean", originalLanguage: "ko"))
      seriesService.create(new SeriesDto(title: "Language Missing"))

  when: "search is called with originalLanguage=en"
      def criteria = new SeriesSearchCriteria(originalLanguage: "en")
      def titles = searchService.search(criteria)*.title

  then: "only the exactly-matching series is returned"
      titles.contains("Language English")
      !titles.contains("Language Korean")
      !titles.contains("Language Missing")
}

def "SERIES-065-AC-02c: null originCountry/originalLanguage criteria are a no-op"() {
  given: "a series with no origin country or language set"
      seriesService.create(new SeriesDto(title: "Origin No-Op"))

  when: "search is called with no origin criteria set"
      def titles = searchService.search(new SeriesSearchCriteria())*.title

  then: "the series is still returned"
      titles.contains("Origin No-Op")
}
```
**Test Case (Green)**: add `matchesOriginCountry`/`matchesOriginalLanguage` methods:
```java
private boolean matchesOriginCountry(SeriesEntity s, List<String> originCountry) {
    if (originCountry == null || originCountry.isEmpty()) return true;
    if (s.getOriginCountry() == null || s.getOriginCountry().isBlank()) return false;
    String lower = s.getOriginCountry().toLowerCase(Locale.ROOT);
    return originCountry.stream().anyMatch(c -> lower.contains(c.toLowerCase(Locale.ROOT)));
}

private boolean matchesOriginalLanguage(SeriesEntity s, String originalLanguage) {
    if (originalLanguage == null || originalLanguage.isBlank()) return true;
    return s.getOriginalLanguage() != null && s.getOriginalLanguage().equals(originalLanguage);
}
```
Insert both as new `.filter(...)` stages in `filteredEntities`, immediately after the existing
`matchesStatus` stage and before `matchesPersonalRating` — matching `SeriesSearchCriteria`'s own new
field placement (AC-01).

---

### SERIES-065-AC-03 [AUTO]
**Statement**: `GET /api/v1/series/search` shall accept a repeatable `originCountry` query parameter and
a single `originalLanguage` query parameter and apply them via `SeriesSearchService.search()`.

**References**: `controller/SeriesController.java` — the `/search` endpoint's `@RequestParam` list
(lines 104-124) and its call into `buildCriteria` (line 126-127).

**Test Case (Red)**:
```groovy
def "SERIES-065-AC-03: GET /api/v1/series/search honors originCountry"() {
  given: "one series matching, one not"
      seriesService.create(new SeriesDto(title: "Controller Origin Has", originCountry: "GB,US"))
      seriesService.create(new SeriesDto(title: "Controller Origin Low", originCountry: "FR"))

  when: "a GET request is made with originCountry=US"
      def result = mockMvc.perform(get("/api/v1/series/search").param("originCountry", "US"))

  then: "only the matching series is returned"
      result.andExpect(status().isOk())
      result.andExpect(jsonPath('$.data.length()').value(1))
      result.andExpect(jsonPath('$.data[0].title').value("Controller Origin Has"))
}

def "SERIES-065-AC-03b: GET /api/v1/series/search honors originalLanguage"() {
  given: "one series in the requested language, one not"
      seriesService.create(new SeriesDto(title: "Controller Language Has", originalLanguage: "en"))
      seriesService.create(new SeriesDto(title: "Controller Language Low", originalLanguage: "ko"))

  when: "a GET request is made with originalLanguage=en"
      def result = mockMvc.perform(get("/api/v1/series/search").param("originalLanguage", "en"))

  then: "only the matching series is returned"
      result.andExpect(status().isOk())
      result.andExpect(jsonPath('$.data.length()').value(1))
      result.andExpect(jsonPath('$.data[0].title').value("Controller Language Has"))
}
```
**Test Case (Green)**: add `@RequestParam(required = false) List<String> originCountry` and
`@RequestParam(required = false) String originalLanguage` to the `/search` endpoint signature, threaded
through `buildCriteria`.

---

### SERIES-065-AC-04 [AUTO]
**Statement**: `GET /api/v1/series/export` shall also accept and apply `originCountry`/
`originalLanguage`, matching `genre`/`status`/every rating threshold's existing availability on both
endpoints.

**References**: `controller/SeriesController.java` — the `/export` endpoint's `@RequestParam` list
(lines 144-155), `buildCriteria`'s Javadoc (lines 186-193, currently documents a 10-field shared set —
needs updating to 12).

**Test Case (Red)**:
```groovy
def "SERIES-065-AC-04: GET /api/v1/series/export honors originCountry and originalLanguage"() {
  given: "one series matching both filters, one matching neither"
      seriesService.create(new SeriesDto(
          title: "Export Origin Has", originCountry: "GB,US", originalLanguage: "en"))
      seriesService.create(new SeriesDto(
          title: "Export Origin Low", originCountry: "FR", originalLanguage: "fr"))

  when: "an export request is made with format=json, originCountry=US and originalLanguage=en"
      def result = mockMvc.perform(
        get("/api/v1/series/export")
          .param("format", "json")
          .param("originCountry", "US")
          .param("originalLanguage", "en")
      )

  then: "only the matching series is included"
      result.andExpect(status().isOk())
      result.andReturn().response.contentAsString.contains("Export Origin Has")
      !result.andReturn().response.contentAsString.contains("Export Origin Low")
}
```
**Test Case (Green)**: add the same two `@RequestParam`s to `/export`, widen `buildCriteria`'s signature
by 2 params (inserted alongside `status`, per AC-01's placement) so both endpoints share the same
construction path, update its Javadoc from 10 to 12 shared fields.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `SeriesEntity.originCountry`, its comma-joined multi-value shape `matchesOriginCountry` mirrors | `series_spec_021_origin_country.md`, `series_spec_046_multi_origin_country.md` |
| `SeriesEntity.originalLanguage`, its documented single-value-only shape `matchesOriginalLanguage` mirrors | `series_spec_061_series_original_language.md` |
| `matchesGenres`/`matchesStatus` patterns this spec's two new predicates mirror exactly, `SeriesSearchCriteria`'s existing filter-stage/DTO conventions | `series_spec_037_search_filter_overhaul.md` |
| Closest recent precedent — identical shape of change (two new fields threaded through `SeriesSearchCriteria`/`SeriesSearchService`/both controller endpoints) | `series_spec_063_rotten_tomatoes_min_rating_filter.md` |
| Frontend consumer of these new query params | `frontend_spec_128_origin_country_language_filter.md` (companion spec) |

---

## Acceptance Criteria Summary

- [x] SERIES-065-AC-01: `SeriesSearchCriteria` gains the two new fields
- [x] SERIES-065-AC-02: `SeriesSearchService.search()` filters correctly on both new fields, null/empty-criterion no-op
- [x] SERIES-065-AC-03: `GET /api/v1/series/search` accepts and applies both new params
- [x] SERIES-065-AC-04: `GET /api/v1/series/export` accepts and applies both new params
