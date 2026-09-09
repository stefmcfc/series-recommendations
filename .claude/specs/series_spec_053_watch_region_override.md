# Spec 053: Watch-Region Per-Request Override

**Status**: Implemented
**Priority**: P3 (settings/quality-of-life enhancement to an existing feature, not core CRUD)
**Depends on**: `series_spec_020_watch_providers.md` (`WatchProviderService`, the original single-configured-region design this spec revises), `series_spec_007_recommendation_sourcing.md` (`RecommendationCriteria`, the pattern for adding a new optional recommendations query param)
**Backend Task**

## Overview

`WatchProviderService.watchRegion` (default `GB`) is a constructor-injected `@Value`, used for
every streaming-availability lookup — both `GET /api/v1/series/{id}/watch-providers` and every
candidate in `GET /api/v1/series/recommendations`. Today it's fixed at startup with no way to
change it short of an env var + restart. This spec adds an optional per-request `region` override
to both endpoints, mirroring `series_spec_052`'s skip-threshold override exactly: no persisted
setting, the injected default is unchanged and still governs any request that doesn't pass one.

## Design Decisions

- **This revises `series_spec_020`'s original "single configured value, not a per-request
  parameter" design decision — explicitly, not silently.** That decision's own rationale was about
  not needing per-request *multi-tenant* variability ("a single-user personal app has one
  household's viewing region") — it was never an argument against letting that one household
  *change* its region over time (moved, traveling, curious about another market). A per-request
  override satisfies exactly that without contradicting the original reasoning: there's still
  effectively one ambient value in practice (the frontend always resolves and sends one), it's
  just no longer frozen at backend-startup time.
- **Per-request override, not a persisted setting — same reasoning as `series_spec_052`.** This
  app still has zero settings/preference persistence anywhere backend-side. Inventing one just for
  a single string value would repeat the same disproportionate-infrastructure mistake that spec
  explicitly avoided.
- **The override threads through as a plain method parameter on `WatchProviderService` and
  `RecommendationDtoAssembler.toDto`, not a request-scoped bean or stored field** — both classes
  are singleton `@Service` beans; `RecommendationDtoAssembler.toDto` already takes a per-call
  parameter this way (`effectiveMaxSourcesShown`), so this follows an existing, established
  pattern rather than introducing a new one.
- **No new validation beyond what TMDB itself already tolerates.** An unrecognized region code
  passed to `TmdbClient.watchProviders` simply yields no results for that region (TMDB's own
  behavior) — no new backend-side allow-list is introduced; the frontend half of this spec pair is
  responsible for only ever sending a recognized ISO 3166-1 alpha-2 code.

## Requirements

### Requirement 1: `GET /api/v1/series/{id}/watch-providers` accepts an optional region override

**User story**: As a user, I want to check a tracked series' streaming availability in a region
other than the one baked into the server's configuration.

#### Acceptance Criteria

- **SERIES-053-AC-01** [AUTO]: `WatchProviderService.streamingProviders` shall accept an
  additional `String regionOverride` parameter, resolving the effective region as
  `regionOverride != null ? regionOverride : watchRegion` before calling
  `tmdbClient.watchProviders(tmdbId, effectiveRegion)`.
- **SERIES-053-AC-02** [AUTO]: `WatchProviderService.getStreamingProvidersForSeries` shall accept
  and forward the same `regionOverride` parameter through to `streamingProviders`.
- **SERIES-053-AC-03** [AUTO]: `SeriesWatchProviderController.watchProviders` shall accept an
  optional `@RequestParam(required = false) String region`, forwarded to
  `getStreamingProvidersForSeries`.
- **SERIES-053-AC-04** [AUTO]: Omitting `region` shall behave identically to today — the injected
  `app.tmdb.watch-region` default governs.

---

### Requirement 2: `GET /api/v1/series/recommendations` accepts the same override for every candidate

**User story**: As a user browsing recommendations, I want every candidate's streaming
availability shown for my chosen region, not always the server's configured default.

#### Acceptance Criteria

- **SERIES-053-AC-05** [AUTO]: `RecommendationCriteria` shall gain a `region` field (`String`,
  nullable).
- **SERIES-053-AC-06** [AUTO]: `SeriesRecommendationController`'s recommendations endpoint shall
  accept an optional `@RequestParam(required = false) String region`, set on the built
  `RecommendationCriteria`.
- **SERIES-053-AC-07** [AUTO]: `RecommendationDtoAssembler.toDto` shall accept an additional
  `String regionOverride` parameter, forwarded to `watchProviderService.streamingProviders`;
  `RecommendationService` shall pass `criteria.getRegion()` at its existing `toDto` call site.
- **SERIES-053-AC-08** [AUTO]: Omitting `region` on the recommendations request shall behave
  identically to today for every candidate in the response.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Original single-configured-region design this spec revises, and why (documented above) | `series_spec_020_watch_providers.md` |
| Per-request-override pattern (resolve-once, injected default unchanged) this spec mirrors | `series_spec_052_refresh_skip_threshold_override.md` |
| Existing per-call-parameter precedent on `RecommendationDtoAssembler`/`RecommendationService` (`effectiveMaxSourcesShown`) this spec's `regionOverride` threading follows | `backend/src/main/java/uk/co/stefirby/seriestracker/service/recommendation/RecommendationDtoAssembler.java`, `RecommendationService.java` |
| `RecommendationCriteria`'s existing shape/convention for a new optional query param | `series_spec_007_recommendation_sourcing.md` |
| Frontend consumer of this spec's new request shape | `frontend_spec_102_settings_watch_region.md` |

---

## TDD Test Case Sketches

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/service/tmdb/WatchProviderServiceSpec.groovy` (additions)

```groovy
def "SERIES-053-AC-01: a region override resolves in place of the injected default"() {
    given: "a candidate tmdbId"
        def tmdbId = 123

    when: "streamingProviders is called with a region override"
        service.streamingProviders(tmdbId, "US")

    then: "tmdbClient.watchProviders is called with the override, not the injected default"
        1 * tmdbClient.watchProviders(tmdbId, "US") >> []
}

def "SERIES-053-AC-04: a null region override falls back to the injected default"() {
    when: "streamingProviders is called with no override"
        service.streamingProviders(123, null)

    then: "tmdbClient.watchProviders is called with the injected default"
        1 * tmdbClient.watchProviders(123, "GB") >> []
}
```

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/controller/SeriesWatchProviderControllerSpec.groovy` (additions, or new file if none exists — check during implementation)

```groovy
def "SERIES-053-AC-03: region query param is forwarded to the service"() {
    when: "GET /watch-providers is requested with ?region=US"
        def response = client.get().uri("/api/v1/series/${id}/watch-providers?region=US").exchange()

    then: "the service receives the override"
        1 * watchProviderService.getStreamingProvidersForSeries(id, "US") >> []
}
```

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/service/recommendation/RecommendationServiceSpec.groovy` (additions)

```groovy
def "SERIES-053-AC-07: region from criteria is forwarded to every candidate's toDto call"() {
    given: "criteria with a region override"
        def criteria = new RecommendationCriteria(region: "US")

    when: "recommendations are assembled"
        service.getRecommendations(criteria)

    then: "the assembler receives the override for each candidate"
        // assert dtoAssembler.toDto invoked with regionOverride == "US"
}
```

**Test Case (Green)**: implement the parameter threading through all four layers until the specs
above pass.

---

## Acceptance Criteria Summary

- [x] SERIES-053-AC-01: `streamingProviders` resolves an override in place of the injected default
- [x] SERIES-053-AC-02: `getStreamingProvidersForSeries` forwards the override
- [x] SERIES-053-AC-03: watch-providers endpoint accepts an optional `region` param
- [x] SERIES-053-AC-04: omitted `region` is fully backward compatible
- [x] SERIES-053-AC-05: `RecommendationCriteria` gains a `region` field
- [x] SERIES-053-AC-06: recommendations endpoint accepts and sets `region` on criteria
- [x] SERIES-053-AC-07: `RecommendationDtoAssembler.toDto` forwards the override per candidate
- [x] SERIES-053-AC-08: omitted `region` on recommendations is fully backward compatible
