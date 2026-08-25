# Spec 020: Streaming/Network Watch Providers on Recommendations

**Status**: Backend done (this spec's Requirements 1–2); frontend consumer is `frontend_spec_025_watch_providers.md`, a separate follow-up.

Implementation notes / judgment calls:
- `RecommendationService.streamingProviders` includes a defensive `null` guard around `TmdbClient.watchProviders`'s return value in addition to the `ExternalServiceException` catch the spec calls for. `watchProviders` itself never returns `null` (SERIES-020-AC-02) — this is defense-in-depth only, added because Spock's `Mock()` (unlike `Stub()`) returns `null`, not an empty collection, for an unstubbed method call, and `toDto` now calls `watchProviders` unconditionally for every candidate; without the guard, every pre-existing `RecommendationServiceSpec` test that doesn't care about streaming providers would need its own explicit stub.
- `watchRegion` is appended as the 9th constructor parameter on `RecommendationService`, after `maxPerSource`, matching the order `@Value`-injected tuning constants were already added in.

**Priority**: P3 (informational display addition — not core CRUD)
**Depends on**: Series Spec 006 (Recommendations, `RecommendationDto`/`RecommendationService.toDto`) ✅, Series Spec 016 (`voteCount` passthrough precedent) ✅
**Backend Task**

## Overview

Adds, to each recommendation only (never to a tracked series), which streaming service(s) currently carry it in a configured region — UK by default. Sourced from TMDB's `GET /tv/{tv_id}/watch/providers`, which TMDB itself republishes from **JustWatch** under a license that requires attributing JustWatch specifically (separate from, and in addition to, this app's existing TMDB attribution notice, `series_spec_006_recommendations.md`). This is purely informational: availability changes constantly, so the data is always fetched live per request and never persisted — no new column, no new table.

**Design decisions**:
- **Only the `flatrate` (subscription-streaming) category is surfaced, not `rent`/`buy`/`ads`.** TMDB's `results.{region}` object separates these into distinct arrays. `flatrate` ("is this on a service I likely already pay for") is the category that matches the feature's actual intent — "is this just watchable right now" — while `rent`/`buy` are per-title purchase options and `ads` is a smaller, less consistently populated category. Deliberately narrowed rather than silently dropped: a future spec can add the others if wanted.
- **Region is a single configured value (`app.tmdb.watch-region`, default `GB`), not a per-request parameter.** This is a single-user personal app with one household's viewing region — a `region` query parameter on `GET /recommendations` would be unused surface area (YAGNI).
- **Resolution is best-effort and non-fatal**, matching every other upstream-call posture in this app (`OmdbClient`/`TmdbClient`'s existing graceful-degradation convention, `tooling_spec_001` Requirement 1): a failed or empty lookup yields an empty `streamingProviders` list on that one candidate, never an error for the whole `/recommendations` response.
- **Fetched live, once per candidate, per `/recommendations` request — not cached or persisted.** TMDB's own upstream data from JustWatch only refreshes once per 24h, and this app's request volume (single user, on-demand) doesn't warrant adding a caching layer for this first pass.
- **No new frontend consumer type reuse from `SeriesDto`** — this is `RecommendationDto`-only, mirroring how `tmdbRating`/`voteCount` (Spec 016) are recommendation-only fields with no tracked-series equivalent.

---

## Requirements

### Requirement 1: `TmdbClient.watchProviders`

**User story**: As a developer, I want a single method that resolves a TMDB TV id to its UK flatrate-streaming providers, so `RecommendationService` doesn't need to know TMDB's raw response shape.

#### Acceptance Criteria

- **SERIES-020-AC-01** [AUTO]: `TmdbClient` shall gain `List<TmdbWatchProvider> watchProviders(int tmdbId, String regionCode)`, calling `GET /tv/{tmdbId}/watch/providers` and extracting `results.{regionCode}.flatrate[]` — each entry mapped to a new record `TmdbWatchProvider(String providerName, String logoPath)` from that entry's `provider_name`/`logo_path`.
- **SERIES-020-AC-02** [AUTO]: If `results` is absent, or has no entry for `regionCode`, or that entry has no `flatrate` array, `watchProviders` shall return an empty list — not `null`, not an exception.
- **SERIES-020-AC-03** [AUTO]: `TmdbClient` shall gain a `PROVIDER_LOGO_BASE_URL` constant (`"https://image.tmdb.org/t/p/w92"`), mirroring the existing `POSTER_BASE_URL` constant's role — the single owner of this literal for every caller building a provider logo URL from a `logo_path`.
- **SERIES-020-AC-04** [AUTO]: `watchProviders` shall follow the same `ExternalServiceException`-on-failure contract as every other `TmdbClient` method (unset API key, or any `RestClientException`) — callers, not this method, are responsible for treating that as non-fatal.

---

### Requirement 2: Recommendation Enrichment

**User story**: As a user browsing recommendations, I want to see which streaming service a suggested show is currently on, so I know whether I can actually watch it without doing my own research first.

#### Acceptance Criteria

- **SERIES-020-AC-05** [AUTO]: `RecommendationService.toDto` shall call `tmdbClient.watchProviders(c.tmdbId(), watchRegion)` for each candidate (`watchRegion` injected via `@Value("${app.tmdb.watch-region:GB}")`, same constructor-injection pattern as `maxSourceSeries`/`maxCandidates`, `series_spec_007`), mapping each `TmdbWatchProvider` to a new `RecommendationDto.StreamingProvider(String name, String logoUrl)` with `logoUrl` built as `TmdbClient.PROVIDER_LOGO_BASE_URL + logoPath` (or `null` if `logoPath` is `null`).
- **SERIES-020-AC-06** [AUTO]: If `watchProviders` throws (any reason — unset key, network failure), `RecommendationService.toDto` shall catch it, log it, and use an empty `streamingProviders` list for that one candidate — this shall not fail or omit the candidate from the overall `/recommendations` response.
- **SERIES-020-AC-07** [AUTO]: `RecommendationDto` shall gain a `List<StreamingProvider> streamingProviders` field, positioned after `voteCount` — an empty list (never `null`) when no flatrate providers are found for the configured region.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationDto`, `RecommendationService.toDto`, `TmdbCandidate.tmdbId` | `series_spec_006_recommendations.md` |
| `voteCount`'s verbatim-passthrough precedent this spec's `streamingProviders` field mirrors | `series_spec_016_recommendation_vote_count.md` |
| `TmdbClient.POSTER_BASE_URL` pattern `PROVIDER_LOGO_BASE_URL` mirrors; `@Value`-injected TMDB tuning constant pattern (`max-source-series`) `watch-region` mirrors | `series_spec_007_recommendation_sourcing.md`, `backend/src/main/resources/application.yml` |
| Never-fail-the-request-on-upstream-degradation policy | `tooling_spec_001_code_quality_security.md` Requirement 1 |
| TMDB attribution notice this spec's JustWatch attribution sits alongside | `series_spec_006_recommendations.md`, `frontend_spec_025_watch_providers.md` |
| Frontend consumer | `frontend_spec_025_watch_providers.md` |

**Operational note**: implementing this spec adds a new configurable property (`app.tmdb.watch-region`) — per this project's Definition of Done, `RUNBOOK.md`'s Environment Variables section should be updated alongside the implementation, same as `app.tmdb.max-source-series` was.

---

## TDD Test Case Sketches

### `TmdbClientSpec.groovy`

```groovy
def "SERIES-020-AC-01: extracts flatrate providers for the given region"() {
    given: "TMDB /tv/1396/watch/providers returns GB flatrate results"
        // mockServer expects GET /tv/1396/watch/providers, responds with
        // { results: { GB: { flatrate: [ { provider_name: "Netflix", logo_path: "/abc.jpg" } ] } } }

    when: "watchProviders(1396, 'GB') is called"
        def result = tmdbClient.watchProviders(1396, "GB")

    then: "the Netflix entry is mapped"
        result == [new TmdbWatchProvider("Netflix", "/abc.jpg")]
}

def "SERIES-020-AC-02: no entry for the region returns an empty list, not an error"() {
    given: "TMDB /tv/1396/watch/providers returns results with no GB key"
        // { results: { US: { flatrate: [...] } } }

    when: "watchProviders(1396, 'GB') is called"
        def result = tmdbClient.watchProviders(1396, "GB")

    then: "the result is empty"
        result.isEmpty()
}
```

### `RecommendationServiceSpec.groovy`

```groovy
def "SERIES-020-AC-05: toDto populates streamingProviders from TmdbClient.watchProviders"() {
    given: "a candidate resolves to one GB flatrate provider"
        tmdbClient.watchProviders(_, "GB") >> [new TmdbWatchProvider("Netflix", "/abc.jpg")]

    when: "recommend(...) is called"
        def results = recommendationService.recommend(20)

    then: "the DTO carries the mapped provider with a built logo URL"
        results[0].streamingProviders() == [
            new RecommendationDto.StreamingProvider("Netflix", TmdbClient.PROVIDER_LOGO_BASE_URL + "/abc.jpg")
        ]
}

def "SERIES-020-AC-06: a watchProviders failure yields an empty list, not a failed request"() {
    given: "TmdbClient.watchProviders throws for one candidate"
        tmdbClient.watchProviders(_, "GB") >> { throw new ExternalServiceException("TMDB down") }

    when: "recommend(...) is called"
        def results = recommendationService.recommend(20)

    then: "the candidate is still returned, with an empty streamingProviders list"
        results[0].streamingProviders() == []
}
```

---

## Acceptance Criteria Summary

- [x] SERIES-020-AC-01: `TmdbClient.watchProviders(tmdbId, regionCode)`, mapped `TmdbWatchProvider` record
- [x] SERIES-020-AC-02: no region match → empty list, not an error
- [x] SERIES-020-AC-03: `PROVIDER_LOGO_BASE_URL` constant
- [x] SERIES-020-AC-04: `ExternalServiceException` on failure, same as every other `TmdbClient` method
- [x] SERIES-020-AC-05: `toDto` populates `streamingProviders` via `app.tmdb.watch-region`-configured lookup
- [x] SERIES-020-AC-06: lookup failure is non-fatal, empty list for that candidate
- [x] SERIES-020-AC-07: `RecommendationDto.streamingProviders` field, never `null`
