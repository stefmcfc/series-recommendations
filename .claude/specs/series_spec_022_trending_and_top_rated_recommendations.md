# Spec 022: Trending & Top-Rated Recommendation Sourcing

**Status**: Implemented (2026-08-24). Files touched: `backend/src/main/java/uk/co/stefirby/seriestracker/client/TmdbClient.java` (`trending(String)`, `discoverTopRated(int)`), `backend/src/main/java/uk/co/stefirby/seriestracker/dto/RecommendationCriteria.java` (`sourceMode`, `trendingWindow`), `backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationService.java` (sourcing branch, validation, trending's ranking-bypass path), `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesController.java` (`sourceMode`/`trendingWindow` request params), plus new/extended Spock specs `TmdbClientSpec.groovy`, `RecommendationServiceSpec.groovy`, `SeriesControllerRecommendationsSpec.groovy`.
**Live TMDB verification outcome**: confirmed working exactly as assumed. Both `GET /trending/tv/week` and `GET /discover/tv?sort_by=vote_average.desc&vote_count.gte=100` were hit directly against the real TMDB API (using the key in `backend/application-local.yml`) before implementation. Both returned the same `{"page":1,"results":[...]}` envelope every other `TmdbClient` method already relies on, with every field this spec depends on present on each result (`id`, `name`, `first_air_date`, `overview`, `poster_path`, `vote_average`, `genre_ids`, `vote_count`, `original_language`). `vote_count.gte=100` was verified to actually filter (every returned result had `vote_count >= 100`), and `sort_by=vote_average.desc` was verified to actually sort (results were in non-increasing `vote_average` order). No deviation from the spec's assumed contract was needed.
**No `frontend/` files are touched by this spec** — the mode-selector UI is `frontend_spec_027_trending_and_top_rated_controls.md`, a separate follow-up task.
**Priority**: P3 (discovery feature extension, explicitly flagged by the user as needing TMDB feasibility verification before implementation)
**Depends on**: Series Spec 006 (`RecommendationService`, `TmdbClient`, `TmdbCandidate`, candidate filter/dedupe pipeline, `GET /api/v1/series/recommendations`), Series Spec 007 (directed sourcing modes, output filters, ranking/diversity cap — this spec adds two more sourcing modes into the same pipeline)
**Backend Task**

## Overview

Adds two more recommendation sourcing modes, requested by the user alongside genre/keyword direct sourcing (`series_spec_007_recommendation_sourcing.md`) but not part of that spec's scope: **"Popular right now"** (globally trending shows on TMDB, independent of the user's own watch history, excluding anything already tracked) and **"Highest rated"** (TMDB's top-rated shows overall, with a minimum vote-count floor so a handful of 10/10 votes doesn't dominate). Both are, like genre/keyword sourcing, a way to ask "show me something interesting" without reference to what the user has watched — they slot into `RecommendationService`'s existing candidate pipeline (dedupe, already-added/already-ignored exclusion, output filters) rather than introducing a parallel code path.

**Feasibility note (flagged explicitly by the user, unverified in this environment):** this spec assumes TMDB's publicly documented `GET /trending/tv/{time_window}` (globally trending TV, `time_window` = `day` or `week`) and `GET /discover/tv?sort_by=vote_average.desc&vote_count.gte={n}` (highest-rated with a minimum vote-count floor) endpoints exist and behave as documented — no `APP_TMDB_API_KEY` was available while writing this spec, the same recurring caveat every prior TMDB-facing spec in this project has flagged (`series_spec_006`, `series_spec_007`, `series_spec_019`'s Design Decisions). `backend-dev` should verify both endpoints against a real API key early during implementation, in particular the exact response envelope shape for `/trending/tv/{time_window}` (assumed here to be the same `{"results": [...]}` shape every other `TmdbClient` method already relies on).

**Design decisions**:
- **Both new modes are additional values of a single `sourceMode` request parameter, mutually exclusive with `seriesIds`/`genres`/`keywords` and with each other** — extending, not duplicating, `series_spec_007`'s existing "at most one directed-sourcing mode" contract (`SERIES-007-AC-17`'s `seriesIds` + `genres`/`keywords` mutual exclusion). A request combining e.g. `sourceMode=trending` with `seriesIds` is rejected the same way a `seriesIds` + `genres` combination already is.
- **Trending mode bypasses the watched pool entirely and does not re-rank TMDB's own ordering.** `GET /trending/tv/{time_window}` already returns results pre-sorted by TMDB's own popularity metric — that ordering *is* the feature ("what's popular right now"). Feeding it through `series_spec_007`'s `rankScore`/diversity-cap pipeline (`SERIES-007-AC-21`/`AC-22`, which assumes a `sourceTitle`-attributable candidate or blends toward `tmdbRating`) would silently discard the one thing this mode is for. Trending candidates keep TMDB's returned relative order; output filters (Requirement 8 of `series_spec_007`) still apply, since "no unwanted genre/language/too-obscure" remains a reasonable ask regardless of sourcing mode.
- **Top-rated mode reuses the existing `minVoteCount` output filter as the actual TMDB query parameter, not just a post-hoc filter.** Passing it straight through as `vote_count.gte` on the `/discover/tv?sort_by=vote_average.desc` call sources higher-confidence candidates directly rather than fetching a wide pool and mostly discarding it — a meaningfully cheaper request pattern than sourcing broadly and filtering after the fact. The existing post-hoc `minVoteCount` output filter (`SERIES-007-AC-25`) still runs afterward too (a harmless no-op once the source query already enforced it), so this mode needs no bespoke filter-skipping logic.
- **Both modes exclude already-tracked and already-ignored series via the exact existing mechanism** (`SERIES-006-AC-23`, `existsByImdbId` against both `SeriesRepository` and `IgnoredSeriesRepository`) — this is what satisfies the user's own framing ("filters out what's already on series list") for trending mode, and it's not a new behavior, just the same filter every other sourcing mode in this pipeline already goes through.
- **Candidates from both modes have a `null` `sourceTitle`**, same convention as genre/keyword-sourced candidates (`SERIES-007-AC-16`) — neither is attributable to one specific watched series.
- **`maxPerSource` (the diversity cap, `SERIES-007-AC-22`) does not apply to either mode**, for the same reason it already doesn't apply to genre/keyword-sourced candidates: there is no per-source-series attribution to cap.

---

## Requirements

### Requirement 1: `TmdbClient` — Trending & Top-Rated Support

**User story**: As a developer, I want dedicated client methods for TMDB's trending and top-rated-discovery endpoints, so `RecommendationService` doesn't need to know TMDB's raw request/response shape for either.

#### Acceptance Criteria

- **SERIES-022-AC-01** [AUTO]: `TmdbClient` shall gain `trending(String timeWindow)`, calling `GET /trending/tv/{timeWindow}` and mapping the response's `results[]` array to `TmdbCandidate` the same way `recommendations`/`similar`/`discover` already do (`SERIES-006-AC-09`, `SERIES-007-AC-23`'s `voteCount`/`originalLanguage` fields included).
- **SERIES-022-AC-02** [AUTO]: `timeWindow` shall accept only `"day"` or `"week"`; any other value shall throw `IllegalArgumentException` before any TMDB call is attempted, following the same fail-fast validation style as `SeriesSearchService`'s invalid-`status` check.
- **SERIES-022-AC-03** [AUTO]: `TmdbClient` shall gain `discoverTopRated(int minVoteCount)`, calling `GET /discover/tv?sort_by=vote_average.desc&vote_count.gte={minVoteCount}`, mapped identically to `SERIES-022-AC-01`.
- **SERIES-022-AC-04** [AUTO]: Both new methods shall preserve the order TMDB returns results in — no client-side re-sorting.
- **SERIES-022-AC-05** [AUTO]: Like every other `TmdbClient` method, a failed call (network error, timeout, unexpected non-200, unparseable body, unset API key) shall throw `ExternalServiceException` (`SERIES-006-AC-13`'s existing contract) — never for an empty or partially-malformed successful response, which shall instead yield an empty list (same `listOfMaps`-backed posture as every sibling method, `SERIES-019-AC-06`'s precedent).

---

### Requirement 2: Directed Sourcing — Trending

**User story**: As a user, I want to see what other people are watching globally right now, without it being filtered through my own watch history, so I can discover something outside my usual taste.

#### Acceptance Criteria

- **SERIES-022-AC-06** [AUTO]: `GET /api/v1/series/recommendations` shall accept an optional `sourceMode` parameter with allowed values `trending` and `topRated` (Requirement 3 covers the latter).
- **SERIES-022-AC-07** [AUTO]: When `sourceMode=trending`, `RecommendationService` shall bypass the watched pool and title-based/genre-based sourcing entirely (`series_spec_006` Requirement 4/5 do not run) and source via `TmdbClient.trending(timeWindow)` instead, where `timeWindow` is read from an additional optional `trendingWindow` parameter (`day` | `week`, default `week` — a week-scoped window is less noisy for a "what's popular right now" framing than day-to-day churn).
- **SERIES-022-AC-08** [AUTO]: Trending candidates shall retain TMDB's own returned relative order through `RecommendationService`'s pipeline — Requirement 7 of `series_spec_007` (ranking/diversity cap) does not run for this mode (see Design Decisions); Requirement 8 of `series_spec_007` (output filters: `minTmdbRating`/`minVoteCount`/`yearMin`/`yearMax`/`excludeGenres`/`language`) still runs, in TMDB's returned order, before the result is truncated to `limit`.
- **SERIES-022-AC-09** [AUTO]: Trending candidates shall have a `null` `sourceTitle`.
- **SERIES-022-AC-10** [AUTO]: A trending candidate already matching an existing tracked series (any status) or an ignored series shall be excluded, via the same `existsByImdbId` checks as every other mode (`SERIES-006-AC-23`).

---

### Requirement 3: Directed Sourcing — Top Rated

**User story**: As a user, I want to see TMDB's highest-rated shows overall, with enough votes behind the rating to actually trust it, so I can find acclaimed shows I haven't heard of yet.

#### Acceptance Criteria

- **SERIES-022-AC-11** [AUTO]: When `sourceMode=topRated`, `RecommendationService` shall bypass the watched pool and title-based/genre-based sourcing entirely and source via `TmdbClient.discoverTopRated(minVoteCount)`, where `minVoteCount` is the same request parameter already defined by `series_spec_007` (`SERIES-007-AC-25`, defaulting to `20` when not supplied).
- **SERIES-022-AC-12** [AUTO]: The existing post-hoc `minVoteCount` output filter (`SERIES-007-AC-25`) still applies to top-rated candidates after sourcing — a no-op in the ordinary case since the source query already enforced the same floor, but not skipped, keeping this mode's filtering logic identical to every other mode's rather than a special case.
- **SERIES-022-AC-13** [AUTO]: Top-rated candidates shall have a `null` `sourceTitle`.
- **SERIES-022-AC-14** [AUTO]: A top-rated candidate already matching an existing tracked series (any status) or an ignored series shall be excluded, via the same `existsByImdbId` checks as every other mode (`SERIES-006-AC-23`).
- **SERIES-022-AC-15** [AUTO]: Requirement 7 of `series_spec_007` (ranking/diversity cap) applies normally to top-rated candidates (unlike trending, `SERIES-022-AC-08`) — since `rankScore` for a `null`-`sourceTitle` candidate is already just `tmdbRating` (`SERIES-007-AC-21`), this coincides with the source query's own `vote_average.desc` ordering rather than conflicting with it.

---

### Requirement 4: Mutual Exclusivity & Validation

**User story**: As a developer, I want an invalid combination of sourcing parameters rejected clearly, so the service never has to silently guess which sourcing intent wins.

#### Acceptance Criteria

- **SERIES-022-AC-16** [AUTO]: A request specifying `sourceMode` together with any of `seriesIds`, `genres`, or `keywords` shall respond `400 Bad Request` — extending `SERIES-007-AC-17`'s existing mutual-exclusivity rule to include the two new modes.
- **SERIES-022-AC-17** [AUTO]: A `sourceMode` value other than `trending`/`topRated` shall respond `400 Bad Request`, following the existing `IllegalArgumentException` → `400` validation style (`SeriesSearchService`'s invalid-`status` precedent, already reused by `series_spec_007`).
- **SERIES-022-AC-18** [AUTO]: A `trendingWindow` value other than `day`/`week` shall respond `400 Bad Request`, same style as `SERIES-022-AC-17`. Supplying `trendingWindow` while `sourceMode` is not `trending` is not an error — it is simply ignored, following this project's general soft-tolerance posture for parameters that don't apply to the active mode (mirroring `SERIES-007-AC-20`'s "ignored, no-op" treatment of `minSourceRating` under genre/keyword mode).
- **SERIES-022-AC-19** [AUTO]: When `sourceMode` is not supplied, behavior is unchanged from `series_spec_007` — automatic watched-pool sourcing (or `seriesIds`/`genres`/`keywords` directed sourcing, if supplied) exactly as today.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationService`, `TmdbClient`, `TmdbCandidate`, candidate filter/dedupe pipeline (`existsByImdbId` exclusion, deduplication) | `series_spec_006_recommendations.md` |
| Directed sourcing modes, mutual-exclusivity `400` rule this spec extends, output filters (Requirement 8), ranking/diversity cap (Requirement 7), `null`-`sourceTitle` convention | `series_spec_007_recommendation_sourcing.md` |
| TMDB endpoint assumptions unverified against a live API key — same recurring caveat | `series_spec_006_recommendations.md`, `series_spec_007_recommendation_sourcing.md`, `series_spec_019_keyword_tracking.md` |
| Never-leak-internals policy for upstream failures | `tooling_spec_001_code_quality_security.md` Requirement 1 |
| Future frontend consumer: sourcing-mode selector for the two new modes | `frontend_spec_027_trending_and_top_rated_controls.md` (not yet written) |

---

## TDD Test Case Sketches

### `TmdbClientSpec.groovy` (Requirement 1)

```groovy
def "SERIES-022-AC-01: trending() maps TMDB's trending/tv response to TmdbCandidate"() {
    given: "TMDB GET /trending/tv/week returns two results"
        // ...

    when: "TmdbClient.trending('week') is called"
        def result = tmdbClient.trending("week")

    then: "both candidates are mapped in the returned order"
        result.size() == 2
}

def "SERIES-022-AC-02: an invalid timeWindow is rejected before any TMDB call"() {
    when: "TmdbClient.trending('month') is called"
        tmdbClient.trending("month")

    then: "an IllegalArgumentException is thrown, no TMDB call is made"
        thrown(IllegalArgumentException)
}

def "SERIES-022-AC-03: discoverTopRated sends vote_count.gte and sort_by=vote_average.desc"() {
    given: "a mocked TMDB server expecting GET /discover/tv?sort_by=vote_average.desc&vote_count.gte=100"
        // ...

    when: "TmdbClient.discoverTopRated(100) is called"
        tmdbClient.discoverTopRated(100)

    then: "the expected request was made"
        // MockRestServiceServer verification
}
```

### `RecommendationServiceSpec.groovy` (Requirements 2–4)

```groovy
def "SERIES-022-AC-07/08/09: trending mode bypasses the watched pool and preserves TMDB order"() {
    given: "3 COMPLETED series exist (would normally source title-based candidates), TMDB trending returns 5 results in a fixed order"
        // ...

    when: "recommend(20, sourceMode: 'trending') is called"
        def results = recommendationService.recommend(20, [sourceMode: "trending"])

    then: "no title-based sourcing occurs; results preserve TMDB's returned order and have sourceTitle == null"
        0 * tmdbClient.recommendations(_)
        results*.sourceTitle.every { it == null }
}

def "SERIES-022-AC-10: an already-tracked trending candidate is excluded"() {
    given: "one trending candidate matches an existing tracked series' imdbId"
        // ...

    when: "recommend(20, sourceMode: 'trending') is called"
        def results = recommendationService.recommend(20, [sourceMode: "trending"])

    then: "that candidate is not present"
        results.every { it.imdbId != existingSeries.imdbId }
}

def "SERIES-022-AC-11/12: topRated mode sources via discoverTopRated with the effective minVoteCount"() {
    given: "minVoteCount defaults to 20"
        // ...

    when: "recommend(20, sourceMode: 'topRated') is called"
        recommendationService.recommend(20, [sourceMode: "topRated"])

    then: "discoverTopRated is called with 20"
        1 * tmdbClient.discoverTopRated(20)
}

def "SERIES-022-AC-16: sourceMode combined with seriesIds is rejected"() {
    when: "GET /api/v1/series/recommendations?sourceMode=trending&seriesIds={id} is requested"
        def response = client.get().uri("/api/v1/series/recommendations?sourceMode=trending&seriesIds=" + validId).exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}

def "SERIES-022-AC-17: an unrecognized sourceMode value is rejected"() {
    when: "GET /api/v1/series/recommendations?sourceMode=bogus is requested"
        def response = client.get().uri("/api/v1/series/recommendations?sourceMode=bogus").exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}
```

---

## Acceptance Criteria Summary

- [x] SERIES-022-AC-01: `TmdbClient.trending(timeWindow)`
- [x] SERIES-022-AC-02: invalid `timeWindow` rejected before any TMDB call
- [x] SERIES-022-AC-03: `TmdbClient.discoverTopRated(minVoteCount)`
- [x] SERIES-022-AC-04: both new methods preserve TMDB's returned order
- [x] SERIES-022-AC-05: failures raise `ExternalServiceException`; malformed/empty responses yield `[]`
- [x] SERIES-022-AC-06: `sourceMode` request param (`trending`/`topRated`)
- [x] SERIES-022-AC-07: trending mode bypasses watched pool, uses `trendingWindow` (default `week`)
- [x] SERIES-022-AC-08: trending candidates keep TMDB order; ranking/diversity cap skipped
- [x] SERIES-022-AC-09: trending candidates have `sourceTitle == null`
- [x] SERIES-022-AC-10: already-tracked/ignored trending candidates excluded
- [x] SERIES-022-AC-11: topRated mode sources via `discoverTopRated(minVoteCount)`
- [x] SERIES-022-AC-12: existing `minVoteCount` output filter still applied (no-op in the ordinary case)
- [x] SERIES-022-AC-13: topRated candidates have `sourceTitle == null`
- [x] SERIES-022-AC-14: already-tracked/ignored topRated candidates excluded
- [x] SERIES-022-AC-15: ranking/diversity cap applies normally to topRated candidates
- [x] SERIES-022-AC-16: `sourceMode` + `seriesIds`/`genres`/`keywords` → 400
- [x] SERIES-022-AC-17: unrecognized `sourceMode` value → 400
- [x] SERIES-022-AC-18: unrecognized `trendingWindow` → 400; ignored (no-op) outside `trending` mode
- [x] SERIES-022-AC-19: no `sourceMode` → unchanged `series_spec_007` behavior
