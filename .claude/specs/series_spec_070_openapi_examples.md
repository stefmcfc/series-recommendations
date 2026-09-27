# Series Spec 070: OpenAPI Response/Request Examples

**Status**: Implemented
**Priority**: P4 (documentation quality — no behavior change to any endpoint)
**Depends on**:
- `series_spec_069_controller_interface_extraction.md` (this spec's annotations live on the `*Api` interfaces that spec created — the whole reason that split happened first)
- `series_spec_067_openapi_annotation_pass.md` (this spec mines status-code behavior from the `@Operation` descriptions that spec already wrote, rather than re-deriving it)
**Area**: Backend (all 9 `*Api` interfaces under `backend/src/main/java/uk/co/stefirby/seriestracker/controller/`, plus `config/OpenApiConfig.java` for shared response components — no DTO/service/repository changes)

## Overview

`series_spec_066` gave every endpoint a documented request/response *shape* (param names, types,
field types) for free from the method signatures. `series_spec_067` gave that shape *meaning*
(what a parameter accepts, what a non-obvious behavior does). Neither gives a developer exploring
Swagger UI an actual example payload — today, "Try it out" starts from an empty/default-value form
with no sense of what a realistic request or response looks like, for bodies *or* for query/path
parameters. This spec adds concrete `@ExampleObject` request and response bodies, plus `example =`
values on the existing `@Parameter` annotations for query and path parameters, so Swagger UI's
"Try it out" form shows real, working values a developer can read, copy, or just hit "Execute" on
directly.

`series_spec_069` split every controller into a `*Api` interface specifically so annotations
wouldn't keep piling onto the implementation classes — this spec is the reason that split was worth
doing now rather than later: example payloads are the single noisiest annotation surface springdoc
offers (multi-line JSON blocks per status code, per endpoint), and they land entirely on the already
contract-only interfaces, never touching the now-clean implementation classes.

## Design Decisions

- **Shared error-response components, defined once, referenced everywhere — not repeated per
  operation.** Confirmed by reading `GlobalExceptionHandler.java`: every error response in this app
  shares one uniform envelope, `ApiResponse<Void>` (`{"data":null,"error":"<message>","count":0,
  "excludedCount":0}`) — only the `error` message text and HTTP status vary by case. This is a real
  architectural fact, not a simplification invented for this spec. `OpenApiConfig.java` (already
  built by `series_spec_066`) gets a new `.components(new Components().addResponses(...))` block
  defining four reusable named responses — `BadRequest` (400), `NotFound` (404), `Conflict` (409),
  `BadGateway` (502) — each with one representative example message. Every operation that can
  actually return one of these (per the status codes already named in its existing `@Operation`
  description, written by `series_spec_067`) attaches it via `@ApiResponse(responseCode = "404",
  ref = "#/components/responses/NotFound")` — a one-line reference, not a repeated JSON block.
  Generic `500` is deliberately not included — it's the unmapped-exception fallback
  (`GlobalExceptionHandler.handleUnexpected`), never a documented, expected behavior of any specific
  endpoint, so it doesn't belong in any operation's own contract.
- **Success response examples are genuinely per-operation** — unlike the shared error shapes, every
  endpoint's success body is different, so these are real, concrete `@ExampleObject(value = "...")`
  blocks, one per operation, using Java text blocks (`"""..."""`, already idiomatic on this
  project's Java 25 toolchain) for readability over an escaped single-line string.
- **Canonical example data**: reuse "The Office" (2005, Comedy, 9 seasons) as the running example
  series wherever a full `SeriesDto`-shaped example is needed — this is `RUNBOOK.md`'s own existing
  curl example, so examples across Swagger UI, `RUNBOOK.md`, and a developer's first `curl` attempt
  all agree with each other rather than introducing a second, different illustrative show. Other
  endpoints (genre/keyword/origin-country stats, recommendations) use whatever data is natural to
  illustrate that endpoint's own shape.
- **Examples are illustrative, not exhaustive.** `SeriesDto` alone has 25+ fields; an example does
  not need to populate every one — include enough to be genuinely useful (a real title, realistic
  ratings, a real status) without turning every example into a wall of mostly-irrelevant JSON.
- **Request-body examples** for the endpoints that take one (`SeriesController.create`/`update`/
  `ignore`, `SeriesRefreshController.refreshAll`, `FilterProfileController.create`/`update`) go on
  the Swagger `@RequestBody`'s own `content = @Content(examples = @ExampleObject(...))` — same
  mechanism `series_spec_067` already used for `refreshAll`'s/`create`'s body *description*, now
  extended with an actual example value alongside it. `importSeries` (multipart file upload) has no
  JSON request body to exemplify — out of scope for that one endpoint.
- **Query and path parameter examples**, extending the same empty-form problem to non-body inputs.
  Every `@Parameter`-annotated `@RequestParam`/`@PathVariable` across the 9 interfaces already
  carries a `description` (from `series_spec_067`) but no `example` — Swagger UI's "Try it out"
  form still starts blank for these today. This spec adds `example = "..."` to each parameter's
  existing `@Parameter` annotation (extending an annotation already there, not introducing a new
  one). Same "illustrative, not exhaustive" principle as the response-body examples: each operation
  gets examples on its most illustrative 2-4 parameters (the ones that most show off that
  operation's behavior — a realistic sort/filter combo, a resolvable ID) rather than annotating
  literally every parameter, especially on the 21-parameter `recommendations` endpoint. Reuses the
  same canonical values already established elsewhere: `title=office`/`status=WATCHING` for
  `search` and `format=json` for `export` (matching `RUNBOOK.md`'s own existing curl examples for
  those exact endpoints, same reasoning as the canonical-series choice above). `UUID` path
  variables (`id`) use the standard placeholder UUID (`3fa85f64-5717-4562-b3fc-2c963f66afa6`) —
  the one already conventional across OpenAPI examples generally — rather than a fabricated one
  specific to this app. `tmdbId`/`imdbId` examples should reuse The Office's real TMDB/IMDb IDs;
  `backend-dev` should confirm the actual values via a live `lookupSearchTmdb` call during
  implementation rather than guessing a plausible-looking number, so the example a developer copies
  is genuinely resolvable against the real TMDB/OMDb APIs, not a fabricated ID that 404s.
- **Still no DTO/`@Schema` annotations.** Same boundary `series_spec_067` and `series_spec_069` both
  drew — every example in this spec lives on an `@Operation`'s `@ApiResponse`/`@RequestBody`
  annotations on the interface, never as `@Schema(example = ...)` on a DTO field. Keeps this spec's
  surface bounded to the 9 interfaces (+ `OpenApiConfig`), not a second pass over 13+ DTO classes.
- **No behavior change whatsoever** — same guarantee as `series_spec_066`/`067`/`069`. Every
  existing Spock spec (behavior and `series_spec_067`'s `*OpenApiSpec` ones) must continue passing
  unmodified; verification is against the generated `/v3/api-docs` JSON, not application behavior.
- **Status codes per operation are mined from the existing `@Operation` descriptions, not
  re-derived.** `series_spec_067` already established, in reviewed prose, which errors apply to
  which endpoint (e.g. `FilterProfileController.create`'s description already states "A
  blank/missing name returns 400... a duplicate within the same area returns 409" — that operation
  gets `BadRequest` + `Conflict` refs, nothing more). Grep each interface's own `@Operation`
  description for `400`/`404`/`409`/`502` mentions as the source of truth for which refs to attach,
  rather than re-analyzing controller/service code from scratch.
- **One AC per controller** (9 total), matching `series_spec_067`/`069`'s own established
  granularity. Each AC below gives 2-3 concrete example payloads to anchor the pattern for that
  controller; the same treatment (success example + applicable shared error refs + request-body
  example where relevant) applies to every other operation in that controller, not just the ones
  quoted.
- **No pilot/checkpoint this time.** Unlike `series_spec_069`, the risky part — does Spring MVC/
  springdoc actually resolve annotations declared on an interface a controller `implements` — is
  already proven. This spec is "more of the same kind of annotation," not a new mechanism, so it's
  scoped as one straight implementation pass, same shape as `series_spec_067`.

---

## Requirement 1: Shared error-response components (`config/OpenApiConfig.java`)

**User story**: As a developer, I want every endpoint's documented error responses to show a real
example, without every one of ~28 operations repeating the same JSON block for "here's what a 404
looks like."

### SERIES-070-AC-01 [AUTO]
**Statement**: `OpenApiConfig.customOpenAPI()` shall add a `Components` object to the returned
`OpenAPI` bean, registering four named, reusable responses — `BadRequest` (400), `NotFound` (404),
`Conflict` (409), `BadGateway` (502) — each with `content` of media type `application/json`
containing one `ApiResponse<Void>`-shaped example (`{"data":null,"error":"<representative
message>","count":0,"excludedCount":0}`) illustrating that error's shape. `GET /v3/api-docs`'s
`components.responses` object shall contain all four.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/config/OpenApiConfig.java`;
`backend/src/main/java/uk/co/stefirby/seriestracker/exception/GlobalExceptionHandler.java` (source
of the uniform error envelope shape being documented).

**Test Case (Red)**:
```groovy
def "SERIES-070-AC-01: /v3/api-docs registers the 4 shared error-response components"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "components.responses contains all 4 named responses, each with an example"
        result.andExpect(status().isOk())
        for (name in ['BadRequest', 'NotFound', 'Conflict', 'BadGateway']) {
            result.andExpect(jsonPath("\$.components.responses.${name}").exists())
        }
}
```
**Test Case (Green)**: extend `OpenApiConfig.customOpenAPI()` with the `Components`/`addResponses`
block described above.

---

## Requirement 2: Series CRUD & Search/Export (`SeriesControllerApi`)

### SERIES-070-AC-02 [AUTO]
**Statement**: `SeriesControllerApi.create` shall carry a request-body example (a realistic "The
Office" payload — `title`, `year`, `genres`, `totalSeasons`) and a `201` response example (the same
series with a generated `id`/`dateAdded`); `getById` shall carry a `200` response example plus a
`NotFound` (404) ref; `update` shall carry a request-body example (a partial body — e.g. just
`personalRating`/`currentSeason`) and reference `NotFound`; `search` shall carry a `200` response
example (a short array, 1-2 series) illustrating the `{data, count, excludedCount}` envelope with a
non-zero `excludedCount`; `export` shall carry a `200` example showing a few lines of the actual
export shape for at least one format. Every other method in this controller (`getAll`, `delete`,
`ignore`, `importSeries`, `importStatus`) gets the same treatment (a success example, plus
`NotFound`/`Conflict`/`BadRequest` refs per what its existing `@Operation` description already
states) — not individually quoted here, same pattern. In addition: every `id` path variable in this
controller (`getById`/`update`/`delete`/`ignore`) shall carry the placeholder-UUID `@Parameter`
example; `getAll`'s `sortBy`/`sortDirection` shall carry example values (`"personalRating"`,
`"desc"`); `search`'s `title`/`status`/`genre` parameters shall carry example values (`"office"`,
`"WATCHING"`, `"Comedy"`) matching `RUNBOOK.md`'s own existing curl example; `export`'s `format`
parameter's example shall be `"json"`, also matching `RUNBOOK.md`.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesControllerApi.java`.

**Test Case (Red)**:
```groovy
def "SERIES-070-AC-02: POST /api/v1/series documents a request example and a 201 response example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the create operation carries both a request body example and a 201 response example"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series.post.requestBody.content.application/json.examples').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series.post.responses.201.content.application/json.examples').exists())
}

def "SERIES-070-AC-02: GET /api/v1/series/{id} references the shared NotFound response"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the 404 response is present for getById"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/{id}.get.responses.404").exists())
}

def "SERIES-070-AC-02: GET /api/v1/series/search documents parameter examples"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the title and status parameters carry example values"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/search.get.parameters[?(@.name=='title')].example").exists())
        result.andExpect(jsonPath("\$.paths./api/v1/series/search.get.parameters[?(@.name=='status')].example").exists())
}

def "SERIES-070-AC-02: GET /api/v1/series/{id} documents a path variable example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the id path parameter carries an example UUID"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/{id}.get.parameters[?(@.name=='id')].example").exists())
}
```
**Test Case (Green)**: add `@ApiResponse`/`@ExampleObject`/`@RequestBody(content=...)` annotations
to `SeriesControllerApi` per the Statement above, referencing `SERIES-070-AC-01`'s shared components
for every error case, plus `example =` values on the `@Parameter` annotations named above.

---

## Requirement 3: Genres (`SeriesGenreControllerApi`)

### SERIES-070-AC-03 [AUTO]
**Statement**: `SeriesGenreControllerApi.genres()` shall carry a `200` example (a short list of
genre name strings); `genreStats()` shall carry a `200` example (2-3 `NameStatDto`-shaped entries
showing `seriesCount`/`averagePersonalRating`/`averageBlendedRating`, including one with a `null`
average to illustrate that case). `genreStats()`'s `sortBy`/`onlyCompleted` parameters shall carry
example values (`"seriesCount"`, `true`).

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesGenreControllerApi.java`.

**Test Case (Red)**:
```groovy
def "SERIES-070-AC-03: GET /api/v1/series/genres/stats documents a 200 response example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the genreStats operation's 200 response carries an example"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/genres/stats.get.responses.200.content.application/json.examples').exists())
}

def "SERIES-070-AC-03: GET /api/v1/series/genres/stats documents a sortBy parameter example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the sortBy parameter carries an example value"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/genres/stats.get.parameters[?(@.name=='sortBy')].example").exists())
}
```
**Test Case (Green)**: add the `@ApiResponse`/`@ExampleObject` annotations described above, plus
`example =` values on the `sortBy`/`onlyCompleted` `@Parameter` annotations.

---

## Requirement 4: Keywords (`SeriesKeywordControllerApi`)

### SERIES-070-AC-04 [AUTO]
**Statement**: `SeriesKeywordControllerApi.keywords()` shall carry a `200` example (2-3
`NameStatDto`-shaped keyword entries, mirroring `AC-03`'s genre-stats example shape). Its
`sortBy`/`onlyCompleted` parameters shall carry example values, same as `AC-03`.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesKeywordControllerApi.java`
(the pilot interface from `series_spec_069` — this AC is the first place its content changes since
that spec).

**Test Case (Red)**:
```groovy
def "SERIES-070-AC-04: GET /api/v1/series/keywords documents a 200 response example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the keywords operation's 200 response carries an example"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/keywords.get.responses.200.content.application/json.examples').exists())
}

def "SERIES-070-AC-04: GET /api/v1/series/keywords documents a sortBy parameter example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the sortBy parameter carries an example value"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/keywords.get.parameters[?(@.name=='sortBy')].example").exists())
}
```
**Test Case (Green)**: add the `@ApiResponse`/`@ExampleObject` annotation described above, plus
`example =` values on the `sortBy`/`onlyCompleted` `@Parameter` annotations.

---

## Requirement 5: Lookup (`SeriesLookupControllerApi`)

### SERIES-070-AC-05 [AUTO]
**Statement**: `SeriesLookupControllerApi.lookupSearchTmdb()` shall carry a `200` example (2-3 TMDB
search-result candidates); `lookupResolveTmdb()` shall carry a `200` example showing the merged
TMDB+OMDb shape, and reference `NotFound` for an unresolvable `tmdbId`. `lookupSearchTmdb()`'s
`title` parameter shall carry the example value `"The Office"`; `lookupResolveTmdb()`'s `tmdbId`
parameter shall carry The Office's real TMDB id as its example (confirmed via a live
`lookupSearchTmdb` call during implementation, per this spec's Design Decisions, rather than a
guessed placeholder).

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesLookupControllerApi.java`.

**Test Case (Red)**:
```groovy
def "SERIES-070-AC-05: GET .../lookup/resolve-tmdb documents a 200 example and references NotFound"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "both the 200 example and the 404 reference are present"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/lookup/resolve-tmdb.get.responses.200.content.application/json.examples').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series/lookup/resolve-tmdb.get.responses.404').exists())
}

def "SERIES-070-AC-05: GET .../lookup/search-tmdb documents a title parameter example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the title parameter carries an example value"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/lookup/search-tmdb.get.parameters[?(@.name=='title')].example").exists())
}
```
**Test Case (Green)**: add the annotations described above, plus `example =` values on the
`title`/`tmdbId` `@Parameter` annotations.

---

## Requirement 6: Origin Country (`SeriesOriginCountryControllerApi`)

### SERIES-070-AC-06 [AUTO]
**Statement**: `SeriesOriginCountryControllerApi.originCountryStats()` shall carry a `200` example
(2-3 entries keyed by raw ISO 3166-1 alpha-2 codes, e.g. `US`/`GB`, mirroring `AC-03`'s stats shape).
Its `sortBy`/`onlyCompleted` parameters shall carry example values, same as `AC-03`.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesOriginCountryControllerApi.java`.

**Test Case (Red)**:
```groovy
def "SERIES-070-AC-06: GET .../origin-country/stats documents a 200 response example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's 200 response carries an example"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/origin-country/stats.get.responses.200.content.application/json.examples').exists())
}

def "SERIES-070-AC-06: GET .../origin-country/stats documents a sortBy parameter example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the sortBy parameter carries an example value"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/origin-country/stats.get.parameters[?(@.name=='sortBy')].example").exists())
}
```
**Test Case (Green)**: add the annotation described above, plus `example =` values on the
`sortBy`/`onlyCompleted` `@Parameter` annotations.

---

## Requirement 7: Recommendations (`SeriesRecommendationControllerApi`)

**User story**: As a developer, I want the 21-parameter `recommendations` endpoint — the most
complex in this API — to show a real example response, so I can see the actual shape of a
recommendation card (source titles, ratings, streaming providers) without constructing a request by
hand first.

### SERIES-070-AC-07 [AUTO]
**Statement**: `SeriesRecommendationControllerApi.recommendations()` shall carry a `200` example (2
candidate entries, at least one with more than one `sourceTitles` entry, showing the
`RecommendationDto` shape including `streamingProviders`) and reference `BadGateway` (per its
existing description's `app.tmdb.api-key`/502 note) and `BadRequest` (per its mutual-exclusivity
400 note); `recommendationKeywords()` shall carry a `200` example (a short keyword list, empty-list
case noted in the description already, doesn't need its own example); `recommendationDetails()`
shall carry a `200` example showing at least one of its three fields as `null` (illustrating the
independent-degradation behavior `series_spec_067` already documented in prose). Given this
operation's 21 parameters, only its most illustrative subset gets `@Parameter` examples — `limit`
(`10`), `genres` (`"Comedy"`), `yearMin`/`yearMax` (`2015`/`2024`) — not all 21; `recommendationKeywords()`/
`recommendationDetails()`'s `tmdbId` path variable shall carry The Office's real TMDB id as its
example (same live-verification approach as `AC-05`), and `recommendationDetails()`'s optional
`imdbId` parameter shall carry The Office's real IMDb id.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesRecommendationControllerApi.java`.

**Test Case (Red)**:
```groovy
def "SERIES-070-AC-07: GET /api/v1/series/recommendations documents a 200 example and error refs"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the 200 example and both error references are present"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/recommendations.get.responses.200.content.application/json.examples').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series/recommendations.get.responses.502').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series/recommendations.get.responses.400').exists())
}

def "SERIES-070-AC-07: recommendationDetails documents a null-field example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the details endpoint's 200 example shows independent degradation"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/recommendations/{tmdbId}/details.get.responses.200.content.application/json.examples').exists())
}

def "SERIES-070-AC-07: GET /api/v1/series/recommendations documents parameter examples"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the limit and genres parameters carry example values"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/recommendations.get.parameters[?(@.name=='limit')].example").exists())
        result.andExpect(jsonPath("\$.paths./api/v1/series/recommendations.get.parameters[?(@.name=='genres')].example").exists())
}
```
**Test Case (Green)**: add the annotations described above to `SeriesRecommendationControllerApi`,
including `example =` values on the `limit`/`genres`/`yearMin`/`yearMax`/`tmdbId`/`imdbId`
`@Parameter` annotations.

---

## Requirement 8: Watch Providers & Refresh (`SeriesWatchProviderControllerApi`/`SeriesRefreshControllerApi`)

### SERIES-070-AC-08 [AUTO]
**Statement**: `SeriesWatchProviderControllerApi.watchProviders()` shall carry two `200` examples —
one with providers present, one an empty list (illustrating the never-502 fallback its description
already states) — and reference `NotFound`. `SeriesRefreshControllerApi.refresh()` shall carry a
`200` example (`{series, omdbRefreshed, tmdbRefreshed}`) and reference `NotFound`;
`acknowledgeNewContent()` shall reference `NotFound`; `refreshAll()` shall carry a request-body
example (`{"skipThresholdMinutesOverride": 30}`) and a `202` response example, plus reference
`Conflict` (per its existing "409 if a job is already running" note); `refreshAllStatus()` shall
carry a `200` example showing the job-status lifecycle shape. `watchProviders()`'s `id` path
variable and `region` parameter shall carry example values (the placeholder UUID, `"US"`);
`refresh()`/`acknowledgeNewContent()`'s `id` path variable shall carry the same placeholder UUID.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesWatchProviderControllerApi.java`,
`backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesRefreshControllerApi.java`.

**Test Case (Red)**:
```groovy
def "SERIES-070-AC-08: watchProviders documents both a present and an empty-list example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the 200 response carries examples (plural) rather than a single example"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/watch-providers.get.responses.200.content.application/json.examples.length()')
          .value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)))
}

def "SERIES-070-AC-08: refreshAll documents a request-body example and references Conflict"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the request body example and the 409 reference are both present"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/refresh-all.post.requestBody.content.application/json.examples').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series/refresh-all.post.responses.409').exists())
}

def "SERIES-070-AC-08: GET .../watch-providers documents id and region parameter examples"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the id and region parameters carry example values"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/{id}/watch-providers.get.parameters[?(@.name=='id')].example").exists())
        result.andExpect(jsonPath("\$.paths./api/v1/series/{id}/watch-providers.get.parameters[?(@.name=='region')].example").exists())
}
```
**Test Case (Green)**: add the annotations described above to both interfaces, plus `example =`
values on the `id`/`region` `@Parameter` annotations.

---

## Requirement 9: Filter Profiles (`FilterProfileControllerApi`)

### SERIES-070-AC-09 [AUTO]
**Statement**: `FilterProfileControllerApi.list()` shall carry a `200` example (2 saved profiles for
one area) and reference `BadRequest` (unrecognized `area`); `create()` shall carry a request-body
example (`{"area": "MY_SERIES", "name": "No animation", "criteria": {...}}`, reusing the existing
`@RequestBody` description's own worked example if one already fits) and a `201` response example,
plus reference `BadRequest` and `Conflict` (both already named in its existing description);
`update()` shall carry a request-body example (a partial `{"name": "..."}` body) and reference
`Conflict`/`NotFound`; `delete()` shall reference `NotFound`. `list()`'s `area` parameter shall
carry the example value `"MY_SERIES"`; `update()`/`delete()`'s `id` path variable shall carry the
placeholder UUID.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/FilterProfileControllerApi.java`.

**Test Case (Red)**:
```groovy
def "SERIES-070-AC-09: POST /api/v1/filter-profiles documents a request example and error refs"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the request body example and both error references are present"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/filter-profiles.post.requestBody.content.application/json.examples').exists())
        result.andExpect(jsonPath('$.paths./api/v1/filter-profiles.post.responses.400').exists())
        result.andExpect(jsonPath('$.paths./api/v1/filter-profiles.post.responses.409').exists())
}

def "SERIES-070-AC-09: GET /api/v1/filter-profiles documents an area parameter example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the area parameter carries an example value"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/filter-profiles.get.parameters[?(@.name=='area')].example").exists())
}
```
**Test Case (Green)**: add the annotations described above to `FilterProfileControllerApi`, plus
`example =` values on the `area`/`id` `@Parameter` annotations.

---

## Requirement 10: Live verification

### SERIES-070-AC-10 [MANUAL]
**Statement**: With the application running, a manual check shall confirm `/swagger-ui.html`
renders every documented example correctly (readable JSON, no malformed/truncated text blocks) for
a sample of at least one operation per controller, and that the 4 shared error-response components
appear correctly wherever referenced (not just once, globally). The same check shall confirm that
"Try it out" pre-fills the documented example values for query and path parameters (not just
request/response bodies) on that same sample of operations.

**References**: Live app instance; `/v3/api-docs`, `/swagger-ui.html`.

**How verified**: start the backend, open `/swagger-ui.html`, expand a sample of endpoints across
different controllers, confirm each shows a populated, valid-JSON example in both the request body
(where applicable) and at least one response code — including expanding a `404`/`409`/`400`/`502`
response section to confirm the shared component's example renders correctly there too, not just in
`/v3/api-docs`'s raw JSON. Additionally, click "Try it out" on that same sample of operations and
confirm the annotated query/path parameter fields (e.g. `search`'s `title`/`status`, `getById`'s
`id`) are pre-filled with their documented example values rather than left blank, and that
`lookupResolveTmdb`'s/`recommendationDetails`'s `tmdbId`/`imdbId` examples actually resolve
successfully against the live TMDB/OMDb APIs when executed.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| The interfaces this spec adds examples to | `series_spec_069_controller_interface_extraction.md` |
| The `@Operation` descriptions this spec mines for applicable status codes | `series_spec_067_openapi_annotation_pass.md` |
| The uniform error-response envelope this spec's shared components document | `exception/GlobalExceptionHandler.java` |
| The `OpenAPI` bean this spec extends with `Components` | `series_spec_066_openapi_swagger_dependency.md`, `config/OpenApiConfig.java` |
| Canonical example series ("The Office") reused for consistency | `RUNBOOK.md`'s own existing curl example |

---

## Acceptance Criteria Summary

- [x] SERIES-070-AC-01: 4 shared error-response components (`BadRequest`/`NotFound`/`Conflict`/`BadGateway`) registered in `OpenApiConfig`
- [x] SERIES-070-AC-02: `SeriesControllerApi` — request/response examples + error refs across all 10 methods + `id`/`sortBy`/`sortDirection`/`title`/`status`/`genre`/`format` parameter examples
- [x] SERIES-070-AC-03: `SeriesGenreControllerApi` — response examples + `sortBy`/`onlyCompleted` parameter examples
- [x] SERIES-070-AC-04: `SeriesKeywordControllerApi` — response example + `sortBy`/`onlyCompleted` parameter examples
- [x] SERIES-070-AC-05: `SeriesLookupControllerApi` — response examples + `NotFound` ref + `title`/`tmdbId` parameter examples
- [x] SERIES-070-AC-06: `SeriesOriginCountryControllerApi` — response example + `sortBy`/`onlyCompleted` parameter examples
- [x] SERIES-070-AC-07: `SeriesRecommendationControllerApi` — response examples + `BadGateway`/`BadRequest` refs + `limit`/`genres`/`yearMin`/`yearMax`/`tmdbId`/`imdbId` parameter examples
- [x] SERIES-070-AC-08: `SeriesWatchProviderControllerApi`/`SeriesRefreshControllerApi` — response/request examples + `NotFound`/`Conflict` refs + `id`/`region` parameter examples
- [x] SERIES-070-AC-09: `FilterProfileControllerApi` — request/response examples + `BadRequest`/`Conflict`/`NotFound` refs + `area`/`id` parameter examples
- [x] SERIES-070-AC-10 [MANUAL]: live Swagger UI check across a sample of endpoints, all 4 shared error components, and pre-filled query/path parameter examples in "Try it out"
