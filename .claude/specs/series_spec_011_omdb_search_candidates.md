# Spec 011: OMDb Search Candidates & Disambiguated Lookup

**Status**: ✅ Implemented — new `client/OmdbSearchCandidate.java` record; `OmdbClient` gains `search(String title)` (`s=`) and `lookupByImdbId(String imdbId)` (`i=`), both sharing `lookup(String title)`'s (`t=`) mapping/aggregation logic via a new private `performLookup(identifierParam, identifierValue, notFoundMessage)` and a parameterized `aggregateEpisodeCount(identifierParam, identifierValue, totalSeasons)`; new `dto/SeriesLookupCandidateDto.java`; `SeriesLookupService` gains `search`/`lookupByImdbId`; `SeriesController`'s `GET /api/v1/series/lookup` gains an optional `imdbId` param (mutually exclusive with `title`) and a new `GET /api/v1/series/lookup/search` endpoint. Tests: additions to `client/OmdbClientSpec.groovy`, `service/SeriesLookupServiceSpec.groovy`, `controller/SeriesControllerLookupSpec.groovy`. Full suite green (`gradlew.bat test`); no deviations from the spec's own field-mapping assumptions were found necessary to flag (see Implementation Notes below for what was actually verified vs. left as a carried-forward caveat). **Superseded by `series_spec_017_tmdb_primary_lookup.md`**: OMDb search (`s=`) and its candidate-disambiguation flow are removed entirely — TMDB search (`series_spec_012`) is the sole search path now. Kept for historical/traceability reference; no AC here is renumbered or deleted.
**Priority**: P2 (quality-of-life / correctness fix for adding series — not core CRUD)
**Depends on**: `series_spec_005_omdb_lookup.md` (✅ Implemented)
**Backend Task**

## Overview

`series_spec_005_omdb_lookup.md` built `GET /api/v1/series/lookup?title=`, backed by OMDb's `t=` ("best single match") parameter. That parameter does its own internal fuzzy title matching server-side and can only ever return one candidate — looking up "Spooks" returns OMDb's guess "Spooks: Code 9" (a spin-off) instead of the intended "Spooks", with no way for the app to know a better match might exist. This spec adds a second OMDb integration path, the `s=` (search) parameter, which returns multiple lightweight candidates for a title, plus a way to resolve one specific candidate (by its `imdbId`) to the full lookup detail `series_spec_005` already produces. Together these let the frontend (`frontend_spec_015_lookup_candidate_picker.md`) show the user a disambiguation step instead of silently trusting OMDb's guess.

**Design decisions**:
- **`OmdbClient.search`'s "no matches" outcome is a normal empty list, not `EntityNotFoundException`** — a deliberate divergence from `lookup(String title)`'s existing not-found semantics (`SERIES-005-AC-09`). A title-based *search* naturally has zero results sometimes; that's not exceptional, the same way `GET /api/v1/series/search` already treats "no matches" as a normal empty `200`, not a `404` (`series_spec_003_search.md`). `lookupByImdbId`, by contrast, keeps `lookup(String title)`'s existing not-found-is-an-error semantics, because a specific `imdbId` is expected to resolve — if it doesn't, that's a real failure (a stale/bad id), not a routine empty result.
- **`lookup(String title)` and the new `lookupByImdbId(String imdbId)` share one private mapping/aggregation implementation**, parameterized by which OMDb query param carries the identifier (`t=` vs `i=`). Both endpoints return the exact same OMDb response shape (`series_spec_005`'s field-mapping table applies unchanged to `i=` lookups), so duplicating that mapping code for a second public method would just be copy-paste drift waiting to happen.
- **One endpoint for full-detail lookup, not two.** Rather than adding a second `GET /api/v1/series/lookup/{imdbId}`-style endpoint, the existing `GET /api/v1/series/lookup` gains an optional `imdbId` param, mutually exclusive with the existing `title` param (exactly one of the two required). This keeps "get full lookup detail" as a single endpoint with two ways to identify what to look up, while the lightweight candidate list gets its own dedicated `GET /api/v1/series/lookup/search` sub-path (a genuinely different response shape, so it isn't shoehorned into the same endpoint).
- **Mutual exclusivity follows the existing `RecommendationService.validate` pattern** (`backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationService.java` lines 126–136): throw `IllegalArgumentException` for an invalid combination of params, which `GlobalExceptionHandler`'s existing `IllegalArgumentException` → `400` handler already covers — no new exception type or handler needed.
- **OMDb's `s=` response shape is documented-but-unverified against a live call**, same caveat `series_spec_005` already carried for the `t=` shape. `backend-dev` should verify the exact response shape against the real API early during implementation (particularly the `Search` array key name and per-entry field names) and flag any discrepancy rather than silently guessing, same as before.

---

## Requirements

### Requirement 1: `OmdbClient.search` — Lightweight Candidate Search

**User story**: As a developer, I want a way to ask OMDb for *all* its candidate matches for a title, not just its single best guess, so the app can offer disambiguation instead of trusting OMDb's internal fuzzy match blindly.

#### Acceptance Criteria

- **SERIES-011-AC-01** [AUTO]: `OmdbClient` shall expose a new public method `search(String title)` returning `List<OmdbSearchCandidate>`, calling `GET {base-url}/?apikey={key}&type=series&s={title}` (OMDb's search parameter, distinct from the existing `t=` title-lookup parameter).
- **SERIES-011-AC-02** [AUTO]: `OmdbClient.search` shall map each entry of the response's `Search[]` array onto an `OmdbSearchCandidate(title, year, imdbId, posterUrl)`, per the field-mapping table below, reusing the existing `extractYear`/`str` parsing helpers and the `"N/A"`-is-absent convention already established for `lookup()` (`SERIES-005-AC-10`).
- **SERIES-011-AC-03** [AUTO]: When OMDb reports `"Response": "False"` for a search call, `OmdbClient.search` shall return an empty list — not throw `EntityNotFoundException` — since "no matches" is this method's normal outcome, not an error (see design decisions above).
- **SERIES-011-AC-04** [AUTO]: If the search call fails for any other reason (network error, timeout, unexpected non-200, unparseable body) or `app.omdb.api-key` is unset, `OmdbClient.search` shall throw `ExternalServiceException`, same semantics as the existing `lookup()` path (`SERIES-005-AC-17`).

**Field mapping** (OMDb raw, per entry in `Search[]` → `OmdbSearchCandidate`):

| OMDb field | Example raw value | Mapped field | Parsing notes |
|---|---|---|---|
| `Title` | `"Spooks"` | `title` | passthrough |
| `Year` | `"2002–2011"` | `year` | extract the first 4-digit number, reusing `extractYear` (same helper `lookup()` already uses) |
| `imdbID` | `"tt0290403"` | `imdbId` | passthrough via `str(...)`; `null` if absent or `"N/A"` |
| `Poster` | `"https://m.media-amazon.com/..."` or `"N/A"` | `posterUrl` | passthrough via `str(...)`; `null` if `"N/A"` |

**New type**: `client/OmdbSearchCandidate.java` — a record `(String title, Integer year, String imdbId, String posterUrl)`, colocated with `OmdbLookupResult` in the `client` package (it's an internal, OMDb-shaped carrier type, not an API-facing DTO — mirrors how `OmdbLookupResult` isn't itself returned from any controller).

---

### Requirement 2: `OmdbClient.lookupByImdbId` — Exact Detail Lookup

**User story**: As a developer, I want to fetch the same full detail `lookup(String title)` already produces, but keyed by an exact IMDb id instead of a fuzzy title, so that once a user has picked a specific candidate, resolving it is authoritative rather than another guess.

#### Acceptance Criteria

- **SERIES-011-AC-05** [AUTO]: `OmdbClient` shall expose a new public method `lookupByImdbId(String imdbId)` returning `OmdbLookupResult`, calling `GET {base-url}/?apikey={key}&type=series&i={imdbId}` (OMDb's exact-id parameter).
- **SERIES-011-AC-06** [AUTO]: `OmdbClient`'s title-based (`t=`) and imdbId-based (`i=`) lookups, including their per-season episode-count aggregation calls (`series_spec_005` Requirement 4), shall share one private implementation parameterized only by which identifier query param is sent — the two public methods (`lookup`, `lookupByImdbId`) shall not duplicate field-mapping or aggregation code, and each aggregation call shall use the same identifier type as its originating lookup (`t={title}&Season={n}` or `i={imdbId}&Season={n}` respectively, never mixed).
- **SERIES-011-AC-07** [AUTO]: When OMDb reports `"Response": "False"` for a `lookupByImdbId` call, `OmdbClient` shall throw `EntityNotFoundException` with a message identifying the searched imdbId (e.g. `"No OMDb results for imdbId: {imdbId}"`) — same not-found semantics as `lookup(String title)` (`SERIES-005-AC-09`), since a specific imdbId is expected to resolve.
- **SERIES-011-AC-08** [AUTO]: If the `lookupByImdbId` call fails for any other reason, or `app.omdb.api-key` is unset, `OmdbClient` shall throw `ExternalServiceException`, same semantics as `lookup(String title)` (`SERIES-005-AC-17`).

---

### Requirement 3: `SeriesLookupCandidateDto`

**User story**: As a developer, I want the search-candidate shape isolated from `SeriesLookupDto`, so a lightweight candidate list and a full lookup result don't get conflated.

#### Acceptance Criteria

- **SERIES-011-AC-09** [AUTO]: A new `SeriesLookupCandidateDto` (`dto` package) shall expose `title`, `year`, `imdbId`, `posterUrl` via plain getters/setters (no Lombok, per this repo's convention), following the existing `SeriesLookupDto` style — deliberately distinct from `SeriesLookupDto`, since a search candidate carries even less data than a full lookup result (no `genres`/ratings/season counts).

---

### Requirement 4: `SeriesLookupService` Additions

**User story**: As a developer, I want the search-and-resolve flow available at the service layer in the same thin delegate-and-map style the existing lookup already uses, so the controller stays equally thin for both paths.

#### Acceptance Criteria

- **SERIES-011-AC-10** [AUTO]: `SeriesLookupService` shall gain `search(String title) -> List<SeriesLookupCandidateDto>`, delegating to `OmdbClient.search` and mapping each `OmdbSearchCandidate` onto a `SeriesLookupCandidateDto`, mirroring the existing `lookup(String title)` method's thin delegate-and-map style.
- **SERIES-011-AC-11** [AUTO]: `SeriesLookupService` shall gain `lookupByImdbId(String imdbId) -> SeriesLookupDto`, delegating to `OmdbClient.lookupByImdbId` and mapping the result exactly as `lookup(String title)` already maps `OmdbLookupResult` onto `SeriesLookupDto`, allowing `EntityNotFoundException`/`ExternalServiceException` to propagate unchanged (same pattern as the existing method).

---

### Requirement 5: `GET /api/v1/series/lookup/search` Endpoint

**User story**: As a user, I want to search a title and see the candidates OMDb actually has, so I can pick the right one instead of hoping OMDb's single best guess is correct.

#### Acceptance Criteria

- **SERIES-011-AC-12** [AUTO]: `SeriesController` shall expose `GET /api/v1/series/lookup/search?title={title}` (required query param), delegating to `SeriesLookupService.search(String title)`.
- **SERIES-011-AC-13** [AUTO]: A blank (present-but-whitespace-only) or missing `title` query param on this endpoint shall return `400 Bad Request` — missing is caught by Spring's own required-`@RequestParam` validation (`MissingServletRequestParameterException` → 400, already handled by `GlobalExceptionHandler`); blank-but-present is caught by an explicit `title.isBlank()` check throwing `IllegalArgumentException`, mirroring the existing `/lookup` endpoint's own blank-title handling.
- **SERIES-011-AC-14** [AUTO]: On success, including the zero-matches case, the endpoint shall return `200 OK` with `ApiResponse<List<SeriesLookupCandidateDto>>` — an empty array is a valid, non-error result (per `SERIES-011-AC-03`), never a `404`.

---

### Requirement 6: `GET /api/v1/series/lookup` — `imdbId` Param

**User story**: As a user, I want to confirm a specific candidate I picked and get its full detail, so the form gets filled in from an authoritative match rather than another guess.

#### Acceptance Criteria

- **SERIES-011-AC-15** [AUTO]: `GET /api/v1/series/lookup` shall gain a new optional `imdbId` query param, mutually exclusive with the existing `title` param.
- **SERIES-011-AC-16** [AUTO]: If neither `title` nor `imdbId` is supplied, or both are supplied, the endpoint shall return `400 Bad Request` (`IllegalArgumentException`, mirroring `RecommendationService.validate`'s mutual-exclusivity pattern — see design decisions above). A blank/whitespace-only value for either param counts as "not supplied" for this check, matching how a blank `title` is already treated by the existing endpoint.
- **SERIES-011-AC-17** [AUTO]: When `imdbId` is supplied (and `title` is not), the endpoint shall delegate to `SeriesLookupService.lookupByImdbId` and return `200 OK` with `ApiResponse<SeriesLookupDto>`, with the same not-found (`404`) / upstream-failure (`502`) semantics as the existing title-based path.
- **SERIES-011-AC-18** [AUTO]: When `title` is supplied (and `imdbId` is not), the endpoint's existing behavior (`SERIES-005-AC-13` through `AC-18`) is unchanged.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `OmdbLookupResult`/`lookup(String title)` contract, `N/A`-is-absent mapping convention, `ExternalServiceException`/`EntityNotFoundException` semantics | `series_spec_005_omdb_lookup.md` |
| `imdbId` field on `OmdbLookupResult`/`SeriesLookupDto` (already present, reused unchanged here) | `series_spec_006_recommendations.md` (`SERIES-006-AC-04`) |
| "Empty result is a normal `200`, not a `404`" precedent | `series_spec_003_search.md` |
| Mutual-exclusivity validation pattern (`IllegalArgumentException` → 400) | `RecommendationService.validate`, `series_spec_007_recommendation_sourcing.md` |
| `ApiResponse<T>` envelope, `GlobalExceptionHandler`'s existing exception-to-status mappings | `series_spec_002_crud.md`, `GlobalExceptionHandler.java` |
| Frontend consumer of both new endpoints | `frontend_spec_015_lookup_candidate_picker.md` |

---

## TDD Test Case Sketches

### `OmdbClientSpec.groovy` (additions)

```groovy
def "SERIES-011-AC-01/02: search maps every entry of the Search array onto OmdbSearchCandidate"() {
    given: "OMDb responds to a search with two candidates"
        def body = '''
            {
              "Search": [
                {"Title":"Spooks","Year":"2002–2011","imdbID":"tt0290403","Poster":"https://example.com/spooks.jpg"},
                {"Title":"Spooks: Code 9","Year":"2008–2008","imdbID":"tt1219342","Poster":"N/A"}
              ],
              "totalResults": "2",
              "Response": "True"
            }
        '''
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
            .andExpect(method(HttpMethod.GET))
            .andExpect(queryParam("apikey", API_KEY))
            .andExpect(queryParam("type", "series"))
            .andExpect(queryParam("s", "Spooks"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

    when: "OmdbClient.search('Spooks') is called"
        def result = client().search("Spooks")

    then: "both candidates are mapped, with N/A poster treated as null"
        result.size() == 2
        result[0].title() == "Spooks"
        result[0].year() == 2002
        result[0].imdbId() == "tt0290403"
        result[0].posterUrl() == "https://example.com/spooks.jpg"
        result[1].title() == "Spooks: Code 9"
        result[1].posterUrl() == null
}

def "SERIES-011-AC-03: Response=False returns an empty list, not an exception"() {
    given: "OMDb responds with no matches"
        def body = '{"Response":"False","Error":"Series not found!"}'
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

    when: "OmdbClient.search(...) is called"
        def result = client().search("Nonexistent Show 12345")

    then: "the result is an empty list, no exception is thrown"
        result == []
}

def "SERIES-011-AC-04: a non-2xx response from OMDb raises ExternalServiceException"() {
    given: "OMDb responds with a server error"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
            .andRespond(withServerError())

    when: "OmdbClient.search(...) is called"
        client().search("Any Show")

    then: "an ExternalServiceException is raised"
        thrown(ExternalServiceException)
}

def "SERIES-011-AC-05/06: lookupByImdbId maps the same fields as lookup(title), using i= instead of t="() {
    given: "OMDb responds to an i= request with a full series"
        def body = '''
            {
              "Response": "True",
              "Title": "Spooks",
              "Year": "2002–2011",
              "Genre": "Action, Drama, Thriller",
              "totalSeasons": "10",
              "imdbRating": "7.9",
              "Poster": "https://example.com/spooks.jpg",
              "imdbID": "tt0290403"
            }
        '''
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
            .andExpect(queryParam("i", "tt0290403"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))
        (1..10).each { season ->
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andExpect(queryParam("i", "tt0290403"))
                .andExpect(queryParam("Season", season as String))
                .andRespond(withSuccess(
                    "{\"Response\":\"True\",\"Episodes\":${episodesJson(1)}}", MediaType.APPLICATION_JSON))
        }

    when: "OmdbClient.lookupByImdbId('tt0290403') is called"
        def result = client().lookupByImdbId("tt0290403")

    then: "every field is mapped, and per-season aggregation used i=, not t="
        result.title() == "Spooks"
        result.totalSeasons() == 10
        result.totalEpisodes() == 10
        result.imdbId() == "tt0290403"

    and:
        mockServer.verify()
}

def "SERIES-011-AC-07: Response=False for lookupByImdbId raises a not-found outcome identifying the imdbId"() {
    given: "an OMDb response of Response=False"
        def body = '{"Response":"False","Error":"Incorrect IMDb ID."}'
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

    when: "OmdbClient.lookupByImdbId('tt9999999') is called"
        client().lookupByImdbId("tt9999999")

    then: "a not-found signal is raised, identifying the searched imdbId"
        def ex = thrown(EntityNotFoundException)
        ex.message.contains("tt9999999")
}

def "SERIES-011-AC-08: a non-2xx response from OMDb raises ExternalServiceException"() {
    given: "OMDb responds with a server error"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
            .andRespond(withServerError())

    when: "OmdbClient.lookupByImdbId(...) is called"
        client().lookupByImdbId("tt0290403")

    then: "an ExternalServiceException is raised"
        thrown(ExternalServiceException)
}
```

### `SeriesLookupServiceSpec.groovy` (additions)

```groovy
def "SERIES-011-AC-10: maps each OmdbSearchCandidate onto a SeriesLookupCandidateDto"() {
    given: "OmdbClient resolves two candidates for the requested title"
        def candidates = [
            new OmdbSearchCandidate("Spooks", 2002, "tt0290403", "https://example.com/spooks.jpg"),
            new OmdbSearchCandidate("Spooks: Code 9", 2008, "tt1219342", null),
        ]
        omdbClient.search("Spooks") >> candidates

    when: "the title is searched"
        def dtos = lookupService.search("Spooks")

    then: "each candidate is mapped onto a SeriesLookupCandidateDto"
        dtos.size() == 2
        dtos[0].title == "Spooks"
        dtos[0].imdbId == "tt0290403"
        dtos[1].posterUrl == null
}

def "SERIES-011-AC-10: an empty candidate list maps to an empty DTO list"() {
    given: "OmdbClient resolves no candidates"
        omdbClient.search("Nonexistent Show") >> []

    when: "the title is searched"
        def dtos = lookupService.search("Nonexistent Show")

    then: "the result is an empty list"
        dtos == []
}

def "SERIES-011-AC-11: maps a successful lookupByImdbId onto a SeriesLookupDto"() {
    given: "OmdbClient resolves a full result for the requested imdbId"
        def omdbResult = new OmdbLookupResult(
            "Spooks", 2002, "Action, Drama, Thriller", 10, 86,
            new BigDecimal("7.9"), null, null, "https://example.com/spooks.jpg", "tt0290403"
        )
        omdbClient.lookupByImdbId("tt0290403") >> omdbResult

    when: "the imdbId is looked up"
        def dto = lookupService.lookupByImdbId("tt0290403")

    then: "every field is mapped, matching lookup(title)'s existing mapping"
        dto.title == "Spooks"
        dto.imdbId == "tt0290403"
}

def "SERIES-011-AC-11: propagates EntityNotFoundException from OmdbClient"() {
    given: "OmdbClient reports no match for the imdbId"
        omdbClient.lookupByImdbId("tt9999999") >> { throw new EntityNotFoundException("No OMDb results for imdbId: tt9999999") }

    when: "the imdbId is looked up"
        lookupService.lookupByImdbId("tt9999999")

    then: "the not-found exception propagates unchanged"
        thrown(EntityNotFoundException)
}
```

### `SeriesControllerLookupSpec.groovy` (additions)

```groovy
def "SERIES-011-AC-12/14: GET /api/v1/series/lookup/search returns 200 with a list of candidates"() {
    given: "the lookup service resolves two candidates for the requested title"
        def candidates = [
            new SeriesLookupCandidateDto(title: "Spooks", year: 2002, imdbId: "tt0290403", posterUrl: "https://example.com/spooks.jpg"),
        ]
        when(seriesLookupService.search("Spooks")).thenReturn(candidates)

    when: "the search endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search").param("title", "Spooks"))

    then: "the candidates are returned under the data envelope"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data[0].title').value("Spooks"))
        result.andExpect(jsonPath('$.data[0].imdbId').value("tt0290403"))
}

def "SERIES-011-AC-14: zero matches still returns 200 with an empty array"() {
    given: "the lookup service resolves no candidates"
        when(seriesLookupService.search("Nonexistent")).thenReturn([])

    when: "the search endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search").param("title", "Nonexistent"))

    then: "the response is 200 with an empty data array, not a 404"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data').isArray())
        result.andExpect(jsonPath('$.data.length()').value(0))
}

def "SERIES-011-AC-13: a blank title on the search endpoint returns 400 without calling the service"() {
    when: "the search endpoint is invoked with a blank title"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search").param("title", "  "))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())

    and: "the lookup service is never invoked"
        verifyNoInteractions(seriesLookupService)
}

def "SERIES-011-AC-16: supplying neither title nor imdbId returns 400"() {
    when: "the lookup endpoint is invoked with neither param"
        def result = mockMvc.perform(get("/api/v1/series/lookup"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
}

def "SERIES-011-AC-16: supplying both title and imdbId returns 400"() {
    when: "the lookup endpoint is invoked with both params"
        def result = mockMvc.perform(
            get("/api/v1/series/lookup").param("title", "Spooks").param("imdbId", "tt0290403"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
}

def "SERIES-011-AC-17: an imdbId-only request delegates to lookupByImdbId and returns 200"() {
    given: "the lookup service resolves a full result for the requested imdbId"
        def dto = new SeriesLookupDto(title: "Spooks", imdbId: "tt0290403")
        when(seriesLookupService.lookupByImdbId("tt0290403")).thenReturn(dto)

    when: "the lookup endpoint is invoked with only imdbId"
        def result = mockMvc.perform(get("/api/v1/series/lookup").param("imdbId", "tt0290403"))

    then: "the mapped fields are returned under the data envelope"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data.title').value("Spooks"))
}
```

**Test Case (Green)** for every sketch above: implement `OmdbSearchCandidate`, `OmdbClient.search`/`lookupByImdbId` (and the shared private mapping helper), `SeriesLookupCandidateDto`, `SeriesLookupService.search`/`lookupByImdbId`, and the two `SeriesController` endpoint changes until the specs above pass.

---

## Implementation Notes (Verification Against Live OMDb)

This spec's own OMDb response-shape assumptions (Requirement 1's field-mapping table for
`Search[]`, and the claim that `i=` lookups return the same field shape as `t=` lookups) were
verified against a live OMDb call during implementation, using the API key already present in
the gitignored `backend/application-local.yml` (added by `#38`). No discrepancy was found —
unlike `series_spec_005`'s own Implementation Notes, this spec's shape assumptions needed no
correction:

1. **`s=` search response shape matches exactly.** A live `GET ...&type=series&s=Spooks` call
   returned a top-level `Search` array (not e.g. `results` or `Search_Results`), with each
   entry carrying `Title`, `Year`, `imdbID`, and `Poster` fields exactly as documented, plus an
   unused `Type` field (already excluded from `OmdbSearchCandidate`'s mapping, as intended —
   the `type=series` query param already restricts entries to series). A `Response: False`
   call (a nonsense search string) returned `{"Response":"False","Error":"Series not found!"}`,
   the same shape `lookup(String title)` already handles.
2. **`i=` lookup returns the identical field shape to `t=` lookup**, confirming
   SERIES-011-AC-06's premise that `lookup`/`lookupByImdbId` can safely share one mapping
   implementation. One incidental observation, not a spec defect: an `i=` call's `type=series`
   query param does **not** appear to filter/reject a non-series imdbId the way `t=`/`s=` do —
   a live call against an arbitrary `tt...` id that actually belongs to a movie still returned
   `"Response":"True"` (with `"Type":"movie"` in the raw body, a field this app doesn't map).
   This doesn't require a code change: `lookupByImdbId` is only ever reached in practice via an
   imdbId the frontend obtained from this same app's own `/lookup/search` results (which are
   already series-filtered via `s=`), so a mismatched `Type` from a hand-crafted `imdbId` query
   param is an edge case no worse than a user hand-typing an unrelated `imdbId` today — flagged
   here for visibility, not treated as an AC gap.

## Acceptance Criteria Summary

- [x] SERIES-011-AC-01: `OmdbClient.search(title)` calls `s=` against OMDb
- [x] SERIES-011-AC-02: maps `Search[]` entries onto `OmdbSearchCandidate`
- [x] SERIES-011-AC-03: `Response: False` on search → empty list, not an exception
- [x] SERIES-011-AC-04: search upstream failure / unset key → `ExternalServiceException`
- [x] SERIES-011-AC-05: `OmdbClient.lookupByImdbId(imdbId)` calls `i=` against OMDb
- [x] SERIES-011-AC-06: `lookup`/`lookupByImdbId` share one mapping/aggregation implementation, aggregation uses matching identifier type
- [x] SERIES-011-AC-07: `Response: False` on `lookupByImdbId` → `EntityNotFoundException` identifying the imdbId
- [x] SERIES-011-AC-08: `lookupByImdbId` upstream failure / unset key → `ExternalServiceException`
- [x] SERIES-011-AC-09: `SeriesLookupCandidateDto` shape
- [x] SERIES-011-AC-10: `SeriesLookupService.search(title)` delegate-and-map
- [x] SERIES-011-AC-11: `SeriesLookupService.lookupByImdbId(imdbId)` delegate-and-map
- [x] SERIES-011-AC-12: `GET /api/v1/series/lookup/search?title=` endpoint
- [x] SERIES-011-AC-13: blank/missing `title` on search endpoint → 400
- [x] SERIES-011-AC-14: 200 + `ApiResponse<List<SeriesLookupCandidateDto>>`, empty array never 404
- [x] SERIES-011-AC-15: `GET /api/v1/series/lookup` gains optional `imdbId` param
- [x] SERIES-011-AC-16: neither/both `title`/`imdbId` supplied → 400
- [x] SERIES-011-AC-17: `imdbId`-only request → 200 + `ApiResponse<SeriesLookupDto>` via `lookupByImdbId`
- [x] SERIES-011-AC-18: `title`-only request behavior unchanged from `series_spec_005`
