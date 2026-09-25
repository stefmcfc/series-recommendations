# Series Spec 067: OpenAPI Annotation Pass — Port API.md Prose into Swagger

**Status**: Implemented
**Priority**: P4 (documentation quality — no behavior change to any endpoint)
**Depends on**: `series_spec_066_openapi_swagger_dependency.md` (annotations are inert without springdoc on the classpath to read them)
**Area**: Backend (all 9 `@RestController` classes under `backend/src/main/java/uk/co/stefirby/seriestracker/controller/`, plus `API.md` cross-reference only — no DTO/service/repository changes)

## Overview

`series_spec_066` gets a Swagger UI that already shows every endpoint's request/response *shape* (param names, types, required-vs-optional, response field types) for free, straight from the method signatures — but none of the *meaning*. Verified directly by reading the code: `SeriesRecommendationController.recommendations()` (`GET /api/v1/series/recommendations`) alone has 19 `@RequestParam`s with zero Javadoc — what `sourceMode`/`discoverSortBy`/`trendingWindow` actually accept and do exists today only as prose in `API.md`'s "Recommendations" section. This spec's job is to port that existing prose into `@Operation(summary=..., description=...)` on each controller method and `@Parameter(description=...)` on each significant parameter, so Swagger UI becomes self-sufficient without anyone needing to cross-reference `API.md` at the same time.

`API.md`'s own section structure already groups 1:1 with the 9 controllers below (confirmed via `grep -n "^#" API.md`) — this spec follows that same grouping, one AC per controller.

## Design Decisions

- **This is a content-relocation pass, not new documentation.** Every `@Operation`/`@Parameter` description written here must be traceable back to something `API.md` already says today (paraphrased and shortened to annotation-appropriate prose — a sentence or two, not full paragraphs). If an implementer notices something genuinely undocumented anywhere (not even in `API.md`), that's a separate future concern, not something to fold into this pass — keeps this spec's scope bounded to "relocate," not "also improve."
- **One AC per controller, not per endpoint or per parameter.** With ~25 endpoints across 9 controllers and some single endpoints (`recommendations`) carrying 19 parameters, per-parameter ACs would make this spec unreadable for no real benefit — each AC below names every endpoint in its controller and gives 2-3 concrete example descriptions to anchor the pattern; the same treatment (paraphrase the cited `API.md` range into `@Operation`/`@Parameter` text) applies to every other parameter on that controller not explicitly quoted here.
- **No DTO annotations in this pass.** `@Schema(description = ...)` on DTO fields (`SeriesDto`, `RecommendationDto`, etc.) is a natural follow-on but is a different, larger surface (13 DTO classes) with its own scope-creep risk — explicitly out of scope here. This spec covers controller method/parameter annotations only.
- **No behavior change whatsoever.** Every change in this spec is a Java annotation on an existing method/parameter — no method body, DTO, service, or repository is touched. Verification therefore checks the *generated OpenAPI JSON* (via `series_spec_066`'s `/v3/api-docs` endpoint), not application behavior, which is provably unchanged (existing Spock specs for these controllers continue passing unmodified).
- **`UuidPathPattern.java` is not a controller** (a shared path-variable regex constant, confirmed by reading it) — excluded from this spec's scope entirely, same as it was excluded from the controller count in `series_spec_066`.

---

## Requirement 1: Series CRUD & Search/Export (`SeriesController`, `API.md` lines 22-155)

**User story**: As a developer exploring the API in Swagger UI, I want the series CRUD, search, export, and import endpoints to explain their non-obvious behavior (the TMDB-managed field lock, `clearedFields`, the four missing-rating filters' OR semantics) without leaving Swagger UI to check `API.md`.

### SERIES-067-AC-01 [AUTO]
**Statement**: Every method in `SeriesController` (`create`, `getAll`, `getById`, `update`, `delete`, `ignore`, `search`, `export`, `importSeries`, `importStatus`) shall carry an `@Operation(summary = ...)`; parameters whose meaning isn't obvious from their name/type alone shall carry `@Parameter(description = ...)`. At minimum:
- `update`'s `@Operation` description shall mention that `title`/`year`/`genres`/`totalSeasons`/`totalEpisodes`/`imdbRating` are TMDB-managed and silently ignored once non-null, and that `clearedFields` can reopen one for manual edit (sourced from `API.md` lines 46-75).
- `search`'s `genre`/`excludeGenre` parameters shall each carry a `@Parameter(description = ...)` noting they're repeatable, substring-matched, and that exclusion wins over inclusion on conflict (sourced from `API.md` lines 109-113).
- `search`'s four `missing*Rating` parameters shall each carry a `@Parameter(description = ...)` noting they're OR'd together with each other but AND'd with every other filter (sourced from `API.md` lines 115-125).

**Rationale**: This controller carries the single largest concentration of non-obvious, behavior-changing rules in the whole API (the field lock, `clearedFields`, the missing-ratings OR/AND asymmetry) — exactly the content most likely to trip someone up if only the bare param shape is visible.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesController.java`. Source prose: `API.md` lines 22-155 ("Series CRUD" and "Search & Export" sections).

**Test Case (Red)**:
```groovy
package uk.co.stefirby.seriestracker.controller

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesControllerOpenApiSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "SERIES-067-AC-01: PATCH /api/v1/series/{id} documents the TMDB-managed field lock"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the PATCH operation's description mentions the field-lock behavior"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}.patch.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("TMDB")))
  }
}
```
**Test Case (Green)**: add the `@Operation`/`@Parameter` annotations described above to `SeriesController`.

---

## Requirement 2: Genres (`SeriesGenreController`, `API.md` lines 157-190)

**User story**: As a developer, I want the genre-vocabulary and genre-stats endpoints to explain what "stats" actually aggregates and how the three minimum-value filters combine.

### SERIES-067-AC-02 [AUTO]
**Statement**: `SeriesGenreController.genres()` and `genreStats()` shall each carry an `@Operation(summary = ...)`. `genreStats`'s `sortBy`, `minSeriesCount`, `minAveragePersonalRating`, `minAverageBlendedRating`, and `onlyCompleted` parameters shall each carry a `@Parameter(description = ...)` — at minimum, `minAverageBlendedRating`'s description shall note it's the unweighted average of a genre's carrying series' IMDb/TMDB ratings, excluding series with neither set (sourced from `API.md` lines 170-190).

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesGenreController.java`. Source prose: `API.md` lines 157-190.

**Test Case (Red)**:
```groovy
def "SERIES-067-AC-02: GET /api/v1/series/genres/stats documents averageBlendedRating"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the minAverageBlendedRating parameter carries a non-empty description"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath(
          '$.paths./api/v1/series/genres/stats.get.parameters[?(@.name=="minAverageBlendedRating")].description'
        ).exists())
}
```
**Test Case (Green)**: add the annotations described above to `SeriesGenreController`.

---

## Requirement 3: Import (`SeriesController`'s import endpoints — covered by AC-01's scope, verified separately since it's a distinct sub-flow)

**User story**: As a developer, I want the async import job's dual JSON/CSV shape and its distinction between a rejecting `400` and a per-row `errorCount` explained in Swagger UI.

### SERIES-067-AC-03 [AUTO]
**Statement**: `SeriesController.importSeries()`'s `@Operation` description shall note the dual JSON/CSV dispatch-by-extension behavior and that a duplicate `imdbId` counts toward `skippedCount` rather than failing the job; `importStatus()`'s `@Operation` description shall note the `IDLE`/`IN_PROGRESS`/`COMPLETED`/`FAILED` status lifecycle (sourced from `API.md` lines 194-227).

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesController.java` (`importSeries`, `importStatus` methods — same file as AC-01, called out as its own AC since it's a distinct sub-flow within the controller).

**Test Case (Red)**:
```groovy
def "SERIES-067-AC-03: POST /api/v1/series/import documents dual-format dispatch"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the import operation's description mentions both supported formats"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/import.post.description')
          .value(org.hamcrest.Matchers.allOf(
            org.hamcrest.Matchers.containsStringIgnoringCase("json"),
            org.hamcrest.Matchers.containsStringIgnoringCase("csv"))))
}
```
**Test Case (Green)**: add the annotations described above.

---

## Requirement 4: Keywords (`SeriesKeywordController`, `API.md` lines 229-260)

### SERIES-067-AC-04 [AUTO]
**Statement**: `SeriesKeywordController.keywords()` shall carry an `@Operation(summary = ...)`; its `sortBy` parameter's `@Parameter(description = ...)` shall list the four accepted values and note an unrecognized value falls back to the default rather than `400` (sourced from `API.md` lines 240-246); its three minimum-value filter parameters shall each carry a `@Parameter(description = ...)` noting they're AND-combined and that a `null` average never satisfies a `minAverage*` filter (sourced from `API.md` lines 248-255).

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesKeywordController.java`. Source prose: `API.md` lines 229-260.

**Test Case (Red)**:
```groovy
def "SERIES-067-AC-04: GET /api/v1/series/keywords documents sortBy's fallback behavior"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the sortBy parameter's description mentions the fallback-to-default behavior"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath(
          '$.paths./api/v1/series/keywords.get.parameters[?(@.name=="sortBy")].description'
        ).exists())
}
```
**Test Case (Green)**: add the annotations described above to `SeriesKeywordController`.

---

## Requirement 5: Lookup (`SeriesLookupController`, `API.md` lines 262-278)

### SERIES-067-AC-05 [AUTO]
**Statement**: `SeriesLookupController.lookupSearchTmdb()` and `lookupResolveTmdb()` shall each carry an `@Operation(summary = ...)` noting TMDB is the sole search source and that `resolve-tmdb` additionally merges in OMDb ratings when TMDB resolves an `imdbId` (sourced from `API.md` lines 264-278).

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesLookupController.java`.

**Test Case (Red)**:
```groovy
def "SERIES-067-AC-05: GET .../lookup/resolve-tmdb documents the OMDb merge"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the resolve-tmdb operation's description mentions OMDb"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/lookup/resolve-tmdb.get.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("OMDb")))
}
```
**Test Case (Green)**: add the annotations described above.

---

## Requirement 6: Origin Country (`SeriesOriginCountryController`, `API.md` lines 280-309)

### SERIES-067-AC-06 [AUTO]
**Statement**: `SeriesOriginCountryController.originCountryStats()` shall carry an `@Operation(summary = ...)` noting a series listing multiple origin-country codes contributes once to *each* code's aggregate, not fractionally, and that `name` is the raw ISO 3166-1 alpha-2 code, not a resolved display name (sourced from `API.md` lines 284-298).

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesOriginCountryController.java`.

**Test Case (Red)**:
```groovy
def "SERIES-067-AC-06: GET .../origin-country/stats documents multi-country contribution"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions the raw ISO code, not a display name"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/origin-country/stats.get.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("ISO")))
}
```
**Test Case (Green)**: add the annotation described above.

---

## Requirement 7: Recommendations (`SeriesRecommendationController`, `API.md` lines 311-474)

**User story**: As a developer, I want the 19-parameter `recommendations` endpoint — by far the most complex in this API — to explain sourcing modes, the pre-fetch/post-fetch filter asymmetry, and the on-demand candidate-detail endpoints, without needing `API.md` open in a second tab.

### SERIES-067-AC-07 [AUTO]
**Statement**: `SeriesRecommendationController.recommendations()`'s `@Operation` description shall summarize the four sourcing modes (`useMySeries`/`trending`/`topRated`/Custom Search) and their mutual-exclusivity rules; its `sourceMode`, `discoverSortBy`, `trendingWindow`, `countries`, `excludeGenres`, and `excludeKeywords` parameters shall each carry a `@Parameter(description = ...)`. `recommendationKeywords()` and `recommendationDetails()` shall each carry an `@Operation(summary = ...)` noting they're on-demand, per-candidate lookups deliberately not folded into the bulk `recommendations` response, and that `recommendationDetails`' three fields degrade independently to `null` on their respective source's failure rather than erroring (sourced from `API.md` lines 313-474).

**Rationale**: This is the endpoint the original exploration identified as the concrete example of the gap (19 undocumented params) — the highest-value single AC in this spec.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesRecommendationController.java`. Source prose: `API.md` lines 311-474 ("Recommendations" section).

**Test Case (Red)**:
```groovy
def "SERIES-067-AC-07: GET /api/v1/series/recommendations documents sourceMode"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the sourceMode parameter carries a non-empty description mentioning useMySeries"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath(
          '$.paths./api/v1/series/recommendations.get.parameters[?(@.name=="sourceMode")].description'
        ).exists())
}

def "SERIES-067-AC-07: recommendationDetails documents independent field degradation"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions independent null degradation"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath(
          '$.paths./api/v1/series/recommendations/{tmdbId}/details.get.description'
        ).value(org.hamcrest.Matchers.containsStringIgnoringCase("null")))
}
```
**Test Case (Green)**: add the annotations described above to `SeriesRecommendationController`.

---

## Requirement 8: Watch Providers & Refresh (`SeriesWatchProviderController`/`SeriesRefreshController`, `API.md` lines 476-546)

### SERIES-067-AC-08 [AUTO]
**Statement**: `SeriesWatchProviderController.watchProviders()`'s `@Operation` description shall note it never fails with `502` even when TMDB is unreachable, always returning `200` with an empty list in that case. `SeriesRefreshController`'s four methods (`refresh`, `acknowledgeNewContent`, `refreshAll`, `refreshAllStatus`) shall each carry an `@Operation(summary = ...)`; `refresh`'s description shall note it ignores the skip threshold (that only applies to bulk refresh) and the new-content-detection/status-reactivation side effect; `refreshAll`'s `skipThresholdMinutesOverride` body field shall carry a `@Parameter(description = ...)` noting it overrides the default for that one run only (sourced from `API.md` lines 478-546).

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesWatchProviderController.java`, `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesRefreshController.java`.

**Test Case (Red)**:
```groovy
def "SERIES-067-AC-08: watchProviders documents its never-502 behavior"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions the empty-list fallback"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/watch-providers.get.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("empty")))
}

def "SERIES-067-AC-08: refresh documents that it ignores the skip threshold"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions the skip threshold"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/refresh.post.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("skip")))
}
```
**Test Case (Green)**: add the annotations described above to both controllers.

---

## Requirement 9: Filter Profiles (`FilterProfileController`, `API.md` lines 548-581)

### SERIES-067-AC-09 [AUTO]
**Statement**: `FilterProfileController`'s four methods (`list`, `create`, `update`, `delete`) shall each carry an `@Operation(summary = ...)`; `list`/`create`'s `area` parameter shall carry a `@Parameter(description = ...)` listing the five valid values (`MY_SERIES`, `USE_MY_SERIES`, `RECOMMENDATION_FILTERS`, `CUSTOM_SEARCH`, `ANALYSIS_FILTERS`); `create`/`update`'s `@Operation` descriptions shall note uniqueness is scoped to `(area, name)`, not `name` alone (sourced from `API.md` lines 548-581).

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/FilterProfileController.java`.

**Test Case (Red)**:
```groovy
def "SERIES-067-AC-09: GET /api/v1/filter-profiles documents the five valid area values"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the area parameter's description lists at least one valid value"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath(
          '$.paths./api/v1/filter-profiles.get.parameters[?(@.name=="area")].description'
        ).value(org.hamcrest.Matchers.containsStringIgnoringCase("MY_SERIES")))
}
```
**Test Case (Green)**: add the annotations described above to `FilterProfileController`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| The dependency this spec's annotations require to have any visible effect | `series_spec_066_openapi_swagger_dependency.md` |
| Every description written here traces back to | `API.md` (line ranges cited per-AC above) |
| The 9 controllers this spec annotates | `.claude/steering/structure.md`'s backend controller listing |
| Existing Spock specs for these controllers, unaffected by this pass (no behavior change) | `backend/src/test/groovy/uk/co/stefirby/seriestracker/controller/*Spec.groovy` |

---

## Acceptance Criteria Summary

- [x] SERIES-067-AC-01: `SeriesController`'s CRUD/search/export endpoints documented (field lock, `clearedFields`, missing-ratings OR/AND asymmetry)
- [x] SERIES-067-AC-02: `SeriesGenreController` documented (genre vocabulary, genre stats + its three min-value filters)
- [x] SERIES-067-AC-03: `SeriesController`'s import/import-status endpoints documented (dual JSON/CSV dispatch, job status lifecycle)
- [x] SERIES-067-AC-04: `SeriesKeywordController` documented (`sortBy` fallback behavior, AND-combined min-value filters)
- [x] SERIES-067-AC-05: `SeriesLookupController` documented (TMDB-sole-source, OMDb merge on resolve)
- [x] SERIES-067-AC-06: `SeriesOriginCountryController` documented (multi-country contribution, raw ISO code)
- [x] SERIES-067-AC-07: `SeriesRecommendationController` documented (4 sourcing modes, pre/post-fetch filter asymmetry, on-demand detail endpoints)
- [x] SERIES-067-AC-08: `SeriesWatchProviderController`/`SeriesRefreshController` documented (never-502 fallback, skip-threshold override)
- [x] SERIES-067-AC-09: `FilterProfileController` documented (5 valid `area` values, `(area, name)`-scoped uniqueness)
