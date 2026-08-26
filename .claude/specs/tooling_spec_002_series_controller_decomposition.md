# Tooling Spec 002: Series Controller Decomposition

**Status**: Not started
**Priority**: P2 (repo hygiene — doesn't block product feature work)
**Depends on**: none
**Area**: Tooling (backend-only, cross-cutting within `controller/`)

---

## Overview

`SeriesController` has grown to ~20 endpoints (`GET`/`POST`/`PATCH`/`DELETE` CRUD, search,
export, TMDB lookup, recommendations, ignore-list, refresh, watch-providers, genres, keyword
stats) behind 11 injected collaborators and a `@SuppressWarnings("java:S107")`. This spec
splits it into one `@RestController` per resource area so each class stays thin, injects only
the services it actually uses, and won't be visually overwhelmed if Swagger/OpenAPI annotations
are added later.

This is a pure refactor: every endpoint keeps its exact HTTP method, path (still under
`@RequestMapping("/api/v1/series")`), request parameters, and response contract. No new
product behavior. Like `tooling_spec_001`, each requirement below can be picked up
independently — there's no ordering dependency between the six controller extractions, only
between each extraction and the final "trim the core controller" step (Requirement 8), which
must come last so no endpoint is briefly served by two controllers at once (a double-mapping
Spring context failure).

The decomposition is validated against the *existing* Spock suite, not new tests: six of the
seven current `SeriesController*Spec.groovy` files already isolate one resource area apiece,
and all seven are `@SpringBootTest` + `@AutoConfigureMockMvc` tests that drive real HTTP paths
— none construct `SeriesController` directly or reference it by class name. So the acceptance
criteria below are verified by confirming those files pass **unmodified** against the new
controller layout, not by writing new test code.

---

## Requirements

### Requirement 1: Shared UUID Path Pattern

**User story**: As a developer, I want the `{id}` UUID path constraint defined once, so three
controllers referencing it can't silently drift apart.

`SeriesController.UUID_PATH_PATTERN` constrains `{id}` to an actual UUID shape (see
`SERIES-017-AC-01/05`) so a non-UUID literal path segment doesn't ambiguously match ahead of
falling through to a 404. After decomposition, three classes need this same regex
(`SeriesController`, `SeriesRefreshController`, `SeriesWatchProviderController`).

#### Acceptance Criteria

- **TOOLING-002-AC-01** `[AUTO]`: A new `controller/UuidPathPattern.java` shall define the UUID
  path-matching regex previously inlined as `SeriesController.UUID_PATH_PATTERN`, as the single
  source every controller constraining an `{id}` path variable references.
- **TOOLING-002-AC-02** `[AUTO]`: When a non-UUID literal path segment (e.g. the historical
  `/lookup`) is requested where `{id}` is expected, the constraining regex shall behave
  identically to the pre-refactor `SeriesController` — falling through to an unmapped-path 404,
  not a UUID-conversion 400 (`SERIES-017-AC-01/05`, already covered by
  `SeriesControllerLookupSpec`'s three "no longer mapped (404)" cases).

---

### Requirement 2: `SeriesRefreshController`

**User story**: As a developer, I want the refresh/bulk-refresh endpoints in their own
controller, so refresh concerns don't sit inside the CRUD controller.

#### Acceptance Criteria

- **TOOLING-002-AC-03** `[AUTO]`: When `POST /api/v1/series/{id}/refresh`,
  `POST /api/v1/series/{id}/acknowledge-new-content`, `POST /api/v1/series/refresh-all`, or
  `GET /api/v1/series/refresh-all/status` is requested, the `SeriesRefreshController` shall
  serve it with a request/response contract identical to the pre-refactor `SeriesController`,
  delegating to `SeriesRefreshService`/`BulkRefreshService` unchanged.
- **TOOLING-002-AC-04** `[AUTO]`: The `SeriesRefreshController` constructor shall inject only
  `SeriesRefreshService` and `BulkRefreshService`.

---

### Requirement 3: `SeriesLookupController`

**User story**: As a developer, I want the TMDB lookup endpoints in their own controller,
separate from the CRUD resource they help populate.

#### Acceptance Criteria

- **TOOLING-002-AC-05** `[AUTO]`: When `GET /api/v1/series/lookup/search-tmdb` or
  `GET /api/v1/series/lookup/resolve-tmdb` is requested, the `SeriesLookupController` shall
  serve it with an identical contract, delegating to `SeriesLookupService` unchanged —
  including the existing blank-`title` 400 rejection (`IllegalArgumentException("title is
  required")`).
- **TOOLING-002-AC-06** `[AUTO]`: The `SeriesLookupController` constructor shall inject only
  `SeriesLookupService`.

---

### Requirement 4: `SeriesRecommendationController`

**User story**: As a developer, I want the recommendation endpoints in their own controller,
matching the existing dedicated `RecommendationService`.

#### Acceptance Criteria

- **TOOLING-002-AC-07** `[AUTO]`: When `GET /api/v1/series/recommendations` or
  `GET /api/v1/series/recommendations/{tmdbId}/keywords` is requested, the
  `SeriesRecommendationController` shall serve it with an identical contract — including the
  existing `limit` clamp to `[1, 50]` and the full `RecommendationCriteria` field mapping —
  delegating to `RecommendationService` unchanged.
- **TOOLING-002-AC-08** `[AUTO]`: The `SeriesRecommendationController` constructor shall inject
  only `RecommendationService`.

---

### Requirement 5: `SeriesWatchProviderController`

**User story**: As a developer, I want the per-series streaming-availability check in its own
controller, since it's a series-lookup concern reusing recommendation infrastructure, not a
recommendation itself.

#### Acceptance Criteria

- **TOOLING-002-AC-09** `[AUTO]`: When `GET /api/v1/series/{id}/watch-providers` is requested,
  the `SeriesWatchProviderController` shall serve it with an identical contract, delegating to
  `RecommendationService.getStreamingProvidersForSeries` unchanged, constraining `{id}` via the
  shared `UuidPathPattern` (Requirement 1).
- **TOOLING-002-AC-10** `[AUTO]`: The `SeriesWatchProviderController` constructor shall inject
  only `RecommendationService`.

---

### Requirement 6: `SeriesGenreController`

**User story**: As a developer, I want the genre-taxonomy endpoint in its own controller.

#### Acceptance Criteria

- **TOOLING-002-AC-11** `[AUTO]`: When `GET /api/v1/series/genres` is requested, the
  `SeriesGenreController` shall serve it with an identical contract, delegating to
  `TmdbGenreTable.allAliasNames()` unchanged.
- **TOOLING-002-AC-12** `[AUTO]`: The `SeriesGenreController` constructor shall inject only
  `TmdbGenreTable`.

---

### Requirement 7: `SeriesKeywordController`

**User story**: As a developer, I want the keyword-stats endpoint in its own controller,
separate from genre taxonomy and from the `/search` endpoint's own (unrelated) `keyword` query
param.

#### Acceptance Criteria

- **TOOLING-002-AC-13** `[AUTO]`: When `GET /api/v1/series/keywords` is requested, the
  `SeriesKeywordController` shall serve it with an identical contract, delegating to
  `KeywordStatsService.getStats(sortBy)` unchanged.
- **TOOLING-002-AC-14** `[AUTO]`: The `SeriesKeywordController` constructor shall inject only
  `KeywordStatsService`.

---

### Requirement 8: Trimmed `SeriesController` Core

**User story**: As a developer, I want the original controller reduced to the CRUD/search/
export/ignore-list surface it was always conceptually anchored on, once every other resource
area has its own class.

Must be implemented last among Requirements 1–8: removing an endpoint from `SeriesController`
in the same change as adding it to its new controller (never leaving both mapped at once)
avoids a transient Spring `IllegalStateException` for an ambiguous mapping.

#### Acceptance Criteria

- **TOOLING-002-AC-15** `[AUTO]`: After decomposition, `SeriesController` shall retain exactly
  `POST /api/v1/series`, `GET /api/v1/series`, `GET /api/v1/series/{id}`,
  `PATCH /api/v1/series/{id}`, `DELETE /api/v1/series/{id}`, `GET /api/v1/series/search`,
  `GET /api/v1/series/export`, and `POST /api/v1/series/ignored`, injecting only
  `SeriesService`, `SeriesSearchService`, `SeriesExportService`, `IgnoredSeriesService`, and
  `Clock`.
- **TOOLING-002-AC-16** `[AUTO]`: Where `SeriesController`'s constructor takes 5 parameters
  (down from 11), the `@SuppressWarnings("java:S107")` annotation shall be removed, since the
  parameter count no longer needs the suppression it was added for.

---

### Requirement 9: Existing Test Suite Passes Unmodified

**User story**: As a developer, I want the decomposition validated by the test suite that
already anticipates it, with zero test-file edits, so the refactor's correctness rests on
tests that predate (and aren't shaped by) the refactor itself.

Note on `SeriesControllerKeywordsSpec.groovy`: two of its four cases
(`SERIES-019-AC-20`/`SERIES-019-AC-21`) actually exercise `GET /api/v1/series/search`'s
`keyword` query param, not the `/keywords` stats endpoint — i.e. this one file spans both
`SeriesKeywordController` (Requirement 7) and the trimmed `SeriesController` (Requirement 8).
That's fine and expected: MockMvc dispatches by path, not by which class declares it, so the
file needs no split of its own.

#### Acceptance Criteria

- **TOOLING-002-AC-17** `[AUTO]`: The existing `SeriesControllerSpec`,
  `SeriesControllerRefreshSpec`, `SeriesControllerLookupSpec`,
  `SeriesControllerRecommendationsSpec`, `SeriesControllerWatchProvidersSpec`,
  `SeriesControllerGenresSpec`, and `SeriesControllerKeywordsSpec` files shall pass unmodified
  (zero diff to any `*Spec.groovy` file) once the full decomposition (Requirements 1–8) lands.

**Test Case (Red → Green)**:
```groovy
// No new test code is written for this spec. The "red" state is the mid-refactor moment
// where an endpoint has been added to its new controller but not yet removed from
// SeriesController — Spring fails to start the application context with an ambiguous
// mapping error, which gradlew.bat test surfaces as every test in the module failing to
// load. The "green" state is reached once each extraction's matching removal lands in the
// same commit (per Requirement 8's ordering note), at which point these pre-existing cases
// resume passing exactly as before the refactor:

def "SERIES-018-AC-01: POST /api/v1/series/{id}/refresh returns 404 for an unknown id"() {
    // SeriesControllerRefreshSpec.groovy -- exercises SeriesRefreshController post-refactor
}

def "SERIES-012-AC-20/22: GET /api/v1/series/lookup/search-tmdb returns 200 with a list of candidates"() {
    // SeriesControllerLookupSpec.groovy -- exercises SeriesLookupController post-refactor
}

def "SERIES-006-AC-26/27/28: returns 200 with the envelope, using the default limit of 20"() {
    // SeriesControllerRecommendationsSpec.groovy -- exercises SeriesRecommendationController post-refactor
}

def "SERIES-026-AC-01: GET /api/v1/series/{id}/watch-providers returns 200 with a StreamingProvider list"() {
    // SeriesControllerWatchProvidersSpec.groovy -- exercises SeriesWatchProviderController post-refactor
}

def "SERIES-010-AC-04/05/06: GET /api/v1/series/genres returns 200 with the full sorted alias list"() {
    // SeriesControllerGenresSpec.groovy -- exercises SeriesGenreController post-refactor
}

def "SERIES-019-AC-17: GET /api/v1/series/keywords returns 200 with the envelope shape, empty when nothing tracked has keywords"() {
    // SeriesControllerKeywordsSpec.groovy -- exercises SeriesKeywordController post-refactor
}

def "POST /api/v1/series should create a series"() {
    // SeriesControllerSpec.groovy -- exercises the trimmed SeriesController post-refactor
}
```

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `SeriesController.java` (pre-refactor) | `backend/src/main/java/uk/co/stefirby/seriestracker/controller/` |
| `UUID_PATH_PATTERN` / `SERIES-017-AC-01/05` | `series_spec_017_tmdb_primary_lookup.md` |
| `RecommendationService.getStreamingProvidersForSeries` / `SERIES-026-AC-01..05` | `series_spec_026_series_watch_providers.md` |
| `KeywordStatsService` / `SERIES-019-AC-17` | `series_spec_019_keyword_tracking.md` |
| Existing controller specs | `backend/src/test/groovy/uk/co/stefirby/seriestracker/controller/SeriesController*Spec.groovy` (all seven, unmodified) |

---

## Acceptance Criteria Summary

- [ ] TOOLING-002-AC-01: `UuidPathPattern` defines the shared `{id}` regex
- [ ] TOOLING-002-AC-02: Non-UUID path segments still 404, not 400, across all consumers
- [ ] TOOLING-002-AC-03: `SeriesRefreshController` serves refresh/bulk-refresh endpoints identically
- [ ] TOOLING-002-AC-04: `SeriesRefreshController` injects only `SeriesRefreshService`/`BulkRefreshService`
- [ ] TOOLING-002-AC-05: `SeriesLookupController` serves lookup endpoints identically
- [ ] TOOLING-002-AC-06: `SeriesLookupController` injects only `SeriesLookupService`
- [ ] TOOLING-002-AC-07: `SeriesRecommendationController` serves recommendation endpoints identically
- [ ] TOOLING-002-AC-08: `SeriesRecommendationController` injects only `RecommendationService`
- [ ] TOOLING-002-AC-09: `SeriesWatchProviderController` serves the watch-providers endpoint identically
- [ ] TOOLING-002-AC-10: `SeriesWatchProviderController` injects only `RecommendationService`
- [ ] TOOLING-002-AC-11: `SeriesGenreController` serves the genres endpoint identically
- [ ] TOOLING-002-AC-12: `SeriesGenreController` injects only `TmdbGenreTable`
- [ ] TOOLING-002-AC-13: `SeriesKeywordController` serves the keywords endpoint identically
- [ ] TOOLING-002-AC-14: `SeriesKeywordController` injects only `KeywordStatsService`
- [ ] TOOLING-002-AC-15: Trimmed `SeriesController` retains exactly the CRUD/search/export/ignored endpoints and 5 dependencies
- [ ] TOOLING-002-AC-16: `@SuppressWarnings("java:S107")` removed from `SeriesController`
- [ ] TOOLING-002-AC-17: All seven existing `SeriesController*Spec.groovy` files pass unmodified
