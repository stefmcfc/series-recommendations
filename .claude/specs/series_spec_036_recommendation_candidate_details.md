# Series Spec 036: Recommendation Candidate Details (Season/Episode Counts + IMDb Rating)

**Status**: Implemented — `dto/CandidateDetailDto.java` (new),
`service/recommendation/RecommendationService.java` (`getDetailsForCandidate`),
`controller/SeriesRecommendationController.java` (`GET .../details`), tests in
`RecommendationServiceSpec.groovy` and `SeriesControllerRecommendationsSpec.groovy`, `API.md`.
**Priority**: P3 (quality-of-life — fills a confirmed, longstanding gap: a recommendation candidate
never showed anything beyond what TMDB's discover/recommendations response already carries)
**Depends on**: Series Spec 006 (`series_spec_006_recommendations.md`, owns
`RecommendationService.getKeywordsForCandidate`, the direct precedent for this spec's on-demand,
tmdbId-scoped, best-effort-degrading shape) ✅, Series Spec 005 (`series_spec_005_omdb_lookup.md`,
owns `OmdbClient.ratingsForImdbId`) ✅
**Area**: Backend (`client/TmdbClient.java` — no change, `details(int)` already exists; new
`dto/CandidateDetailDto.java`, `controller/SeriesRecommendationController.java`,
`service/RecommendationService.java`) — paired with Frontend Spec 053
(`frontend_spec_053_recommendation_candidate_detail.md`)

## Overview

Confirmed (2026-08-29): `RecommendationDto` today carries `tmdbRating` but not season/episode
counts or an IMDb rating, even though the data to fill both already exists elsewhere in this
codebase:

- `TmdbClient.details(int tmdbId)` (already used by `SeriesLookupService` when adding a new series)
  returns a `TmdbSeriesDetail` record that already includes `numberOfSeasons`/`numberOfEpisodes` —
  no new TMDB field-parsing needed.
- `OmdbClient.ratingsForImdbId(String imdbId)` already resolves an IMDb rating given an imdbId, and
  `RecommendationDto`/the frontend `Recommendation` type already carry `imdbId` for every
  candidate — no extra lookup step needed to obtain one.

This spec exposes both, on-demand, via a new endpoint — mirroring the existing "Show keywords"
precedent (`GET /api/v1/series/recommendations/{tmdbId}/keywords`) exactly: not folded into the
bulk `recommend()` response (would cost a TMDB + OMDb call per card in a 10-20 result list the user
never asked to expand), best-effort per data source (a TMDB or OMDb failure degrades that one field
to `null`, never fails the whole request).

## Design Decisions

- **New endpoint**: `GET /api/v1/series/recommendations/{tmdbId}/details?imdbId={imdbId}` —
  `tmdbId` as a path param (matching the keywords endpoint's existing convention), `imdbId` as an
  **optional** query param (a candidate could theoretically lack one, though in practice today's
  sourcing always resolves one before a candidate reaches the frontend) rather than a second path
  segment, since it's meaningful independently of `tmdbId` and follows this project's existing
  optional-query-param conventions elsewhere.
- **`CandidateDetailDto(Integer numberOfSeasons, Integer numberOfEpisodes, BigDecimal imdbRating)`**
  — a new record, three fields, all nullable (any of the three can fail to resolve independently).
- **Response envelope mirrors `GET /api/v1/series/{id}`'s single-object shape**
  (`ApiResponse<CandidateDetailDto>`, via `new ApiResponse<>(dto)`), not the list-plus-`count` shape
  the keywords/recommendations endpoints use — this is a single object, not a collection, so the
  `count` field the list endpoints carry would be meaningless here.
- **Each of the three fields degrades independently, never a whole-request failure.** A TMDB
  `details(tmdbId)` failure leaves `numberOfSeasons`/`numberOfEpisodes` both `null`; an absent
  `imdbId` or an OMDb `ratingsForImdbId` failure (unresolvable id, key unset, network failure) leaves
  `imdbRating` `null`. Both failure paths are caught and logged (`log.info`, matching
  `getKeywordsForCandidate`'s existing posture), never propagated as an error response — the
  endpoint always returns `200` with whatever it could resolve.
- **No new TMDB/OMDb client methods** — `TmdbClient.details`/`OmdbClient.ratingsForImdbId` are
  reused exactly as they already exist; this spec only adds the orchestration and endpoint around
  them.

---

## Requirement 1: `RecommendationService` resolves candidate details on demand

**User story**: As a user viewing a recommendation, I want to see how many seasons/episodes it has
and its IMDb rating, without every card in the list paying for that lookup up front.

### SERIES-036-AC-01 [AUTO]
**Statement**: `RecommendationService` shall gain `getDetailsForCandidate(int tmdbId, String
imdbId)`, returning a `CandidateDetailDto` with `numberOfSeasons`/`numberOfEpisodes` resolved via
`TmdbClient.details(tmdbId)` and `imdbRating` resolved via `OmdbClient.ratingsForImdbId(imdbId)`
when `imdbId` is non-blank.

**References**: `TmdbClient.details`, `TmdbSeriesDetail.numberOfSeasons`/`numberOfEpisodes`,
`OmdbClient.ratingsForImdbId`, `OmdbRatings.imdbRating`.

**Test Case (Red)**:
```groovy
def "SERIES-036-AC-01: resolves season/episode counts and IMDb rating"() {
    given: "TMDB and OMDb both resolve successfully"
        tmdbClient.details(1396) >> new TmdbSeriesDetail("Breaking Bad", 2008, [18], "/p.jpg", 5, 62,
            new BigDecimal("8.9"), 15000, ProductionStatus.ENDED, "US", "overview")
        omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.5"), 96)

    when: "getDetailsForCandidate is called"
        def result = service.getDetailsForCandidate(1396, "tt0903747")

    then: "all three fields are populated"
        result.numberOfSeasons() == 5
        result.numberOfEpisodes() == 62
        result.imdbRating() == new BigDecimal("9.5")
}
```
**Test Case (Green)**: new `CandidateDetailDto` record; `getDetailsForCandidate` calls both clients
and assembles the DTO.

---

### SERIES-036-AC-02 [AUTO]
**Statement**: If `TmdbClient.details` throws (`ExternalServiceException`), `numberOfSeasons`/
`numberOfEpisodes` shall both be `null` in the result — not a propagated exception — while
`imdbRating` still resolves normally if OMDb succeeds independently.

**Test Case (Red)**:
```groovy
def "SERIES-036-AC-02: a TMDB failure nulls the season/episode fields without failing the request"() {
    given: "TMDB fails, OMDb succeeds"
        tmdbClient.details(1396) >> { throw new ExternalServiceException("TMDB", "unavailable") }
        omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.5"), 96)

    when: "getDetailsForCandidate is called"
        def result = service.getDetailsForCandidate(1396, "tt0903747")

    then: "season/episode are null, IMDb rating still resolved, no exception thrown"
        result.numberOfSeasons() == null
        result.numberOfEpisodes() == null
        result.imdbRating() == new BigDecimal("9.5")
}
```
**Test Case (Green)**: wrap the `tmdbClient.details` call in its own try/catch, independent of the
OMDb call.

---

### SERIES-036-AC-03 [AUTO]
**Statement**: If `imdbId` is `null`/blank, or `OmdbClient.ratingsForImdbId` throws
(`ExternalServiceException` or `EntityNotFoundException`), `imdbRating` shall be `null` — not a
propagated exception — while `numberOfSeasons`/`numberOfEpisodes` still resolve normally if TMDB
succeeds independently.

**Test Case (Red)**:
```groovy
def "SERIES-036-AC-03: a blank imdbId or OMDb failure nulls imdbRating without failing the request"() {
    given: "TMDB succeeds, imdbId is blank"
        tmdbClient.details(1396) >> new TmdbSeriesDetail("Breaking Bad", 2008, [18], "/p.jpg", 5, 62,
            new BigDecimal("8.9"), 15000, ProductionStatus.ENDED, "US", "overview")

    when: "getDetailsForCandidate is called with a blank imdbId"
        def result = service.getDetailsForCandidate(1396, "")

    then: "imdbRating is null, season/episode still resolved, no exception thrown, OMDb never called"
        result.imdbRating() == null
        result.numberOfSeasons() == 5
        0 * omdbClient.ratingsForImdbId(_)
}
```
**Test Case (Green)**: guard the OMDb call on `imdbId != null && !imdbId.isBlank()`; wrap the call
itself in its own try/catch alongside the blank-guard.

---

## Requirement 2: `GET /api/v1/series/recommendations/{tmdbId}/details`

### SERIES-036-AC-04 [AUTO]
**Statement**: `SeriesRecommendationController` shall expose `GET
/api/v1/series/recommendations/{tmdbId}/details?imdbId={imdbId}`, returning `200` with
`ApiResponse<CandidateDetailDto>` (single-object envelope, matching `GET /api/v1/series/{id}`'s
shape — no `count` field).

**References**: `SeriesController.getById`'s `ApiResponse<SeriesDto>` envelope, the pattern this
mirrors.

**Test Case (Red)**:
```groovy
def "SERIES-036-AC-04: GET .../details returns a single-object envelope"() {
    given: "the service resolves a detail DTO"
        recommendationService.getDetailsForCandidate(1396, "tt0903747") >>
            new CandidateDetailDto(5, 62, new BigDecimal("9.5"))

    when: "GET /api/v1/series/recommendations/1396/details?imdbId=tt0903747 is requested"
        def response = client.get().uri("/api/v1/series/recommendations/1396/details?imdbId=tt0903747").exchange()

    then: "the response is 200 with the detail DTO under data, no count field"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.data.numberOfSeasons").isEqualTo(5)
        response.expectBody().jsonPath("\$.count").doesNotExist()
}
```
**Test Case (Green)**: new controller method, `@PathVariable int tmdbId`, `@RequestParam(required =
false) String imdbId`, delegating to `recommendationService.getDetailsForCandidate`.

---

### SERIES-036-AC-05 [AUTO] (regression guard)
**Statement**: The existing `GET /api/v1/series/recommendations/{tmdbId}/keywords` endpoint shall be
entirely unaffected by this spec — no shared code path changed beyond both living in the same
controller.

**Test Case (Green)**: no change to `getKeywordsForCandidate`/its controller method; existing
`SeriesRecommendationControllerSpec.groovy` keywords tests continue to pass unmodified.

---

## Implementation Notes

- **`API.md`** gains a new endpoint entry: `GET /api/v1/series/recommendations/{tmdbId}/details`,
  documenting the optional `imdbId` query param and the independently-nullable three fields.
- No `RUNBOOK.md` change — no new config property, no new external-service key requirement (reuses
  the existing `app.tmdb.api-key`/`app.omdb.api-key`).

## Cross-References

| This spec | Source |
|---|---|
| `TmdbClient.details`, `TmdbSeriesDetail` | Already exists (used by `SeriesLookupService`) |
| `OmdbClient.ratingsForImdbId`, `OmdbRatings` | `series_spec_005_omdb_lookup.md` |
| On-demand, best-effort-degrading precedent this spec mirrors exactly | `series_spec_006_recommendations.md` (`getKeywordsForCandidate`) |
| Frontend consumer | `frontend_spec_053_recommendation_candidate_detail.md` |
| The original "no fuller detail view" gap this spec closes half of | `.claude/ideas/future_ideas.md` ("Recommendation cards have no fuller detail/expand view beyond keywords") |

---

## Acceptance Criteria Summary

- [x] SERIES-036-AC-01: `getDetailsForCandidate` resolves all three fields on success
- [x] SERIES-036-AC-02: a TMDB failure nulls season/episode without failing the request
- [x] SERIES-036-AC-03: a blank imdbId or OMDb failure nulls imdbRating without failing the request
- [x] SERIES-036-AC-04: `GET .../details` returns a single-object envelope
- [x] SERIES-036-AC-05: the existing keywords endpoint is unaffected
