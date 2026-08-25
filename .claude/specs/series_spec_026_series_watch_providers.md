# Spec 026: On-Demand Streaming Availability for a Tracked Series

**Status**: Done. Implemented on `feature/series-watch-providers-check`: `RecommendationService.getStreamingProvidersForSeries(UUID)` (new method, reuses the existing private `streamingProviders(int)` helper verbatim) and `SeriesController#watchProviders` (`GET /api/v1/series/{id}/watch-providers`). Covered by `SeriesControllerWatchProvidersSpec` (controller/MockMvc, all five ACs end to end) and new unit tests added to `RecommendationServiceSpec` (same five ACs at the service level, mocking `SeriesRepository`/`TmdbClient` directly). No deviations from the spec as written — implementation matches the design decisions and Green test-case guidance exactly.
**Priority**: P3 (informational, on-demand only — mirrors Series Spec 020's own priority)
**Depends on**: Series Spec 020 (`series_spec_020_watch_providers.md`, `TmdbClient.watchProviders`/`PROVIDER_LOGO_BASE_URL`, `RecommendationDto.StreamingProvider`, `app.tmdb.watch-region` config — all reused unchanged) ✅, Series Spec 002 (`series_spec_002_crud.md`, `SeriesEntity`/`GET /api/v1/series/{id}`) ✅, Series Spec 018 (`series_spec_018_series_refresh.md`, `TmdbClient.findTvIdByImdbId`'s tmdbId-from-imdbId resolution precedent, `SeriesEntity` never caching a `tmdbId`) ✅
**Backend Task**

## Overview

A live-review request: users want a way to check where a *tracked* series is currently streaming, but only on demand — useful right before starting something in `BACKLOG`, irrelevant once `WATCHING` (you already know), and irrelevant once `COMPLETED` (unless flagged for rewatch). This is explicitly **not** persisted — streaming availability changes constantly, and the whole point is a fresh, live check at the moment it's actually useful, not a stale cached value living on the entity.

This is a small, almost entirely reuse-driven addition: Series Spec 020 already built everything the lookup itself needs (`TmdbClient.watchProviders`, the region config, the `StreamingProvider` shape). The only new work is resolving a *tracked* series' `tmdbId` (which, like every other TMDB-derived field on a tracked series, is never cached on `SeriesEntity` — see Series Spec 018's own `findTvIdByImdbId` precedent) and exposing it via a new endpoint.

**No new backend types, config, or client method are introduced.** `RecommendationDto.StreamingProvider`, `TmdbClient.watchProviders`/`PROVIDER_LOGO_BASE_URL`, and `app.tmdb.watch-region` are all reused exactly as Series Spec 020 built them.

## Design Decisions

- **New method lives on `RecommendationService`, not a new service class.** `RecommendationService` already has every dependency this needs constructor-injected — `seriesRepository` (to look up the tracked series), `tmdbClient` (`findTvIdByImdbId`/`watchProviders`), and `watchRegion` — plus the exact mapping-and-graceful-degradation logic already exists as its private `streamingProviders(int tmdbId)` helper (added by Series Spec 020). A new small dedicated service would duplicate that wiring for one method; reusing the existing private helper (widened to package-private or called through a new public wrapper) avoids that duplication entirely. This is a pragmatic reuse call, not a strict "recommendations vs. tracked series" domain boundary — flagged here so it isn't mistaken for an oversight.
- **Never persisted.** No column, no field written back to `SeriesEntity`. The response is computed fresh on every call, mirroring Series Spec 020's own "fetched live, never cached" posture for recommendation candidates.
- **Graceful degradation all the way down, matching Series Spec 020 exactly** — this is a "nice to know, not critical" lookup, not a hard dependency: a tracked series with no `imdbId`, an `imdbId` TMDB can't resolve to a `tmdbId`, or a `watchProviders` call that itself fails, all yield an **empty list with a `200 OK`** — never a `4xx`/`5xx` for those cases. The *only* error response is a `404` for a genuinely unknown series `id` (the tracked series itself doesn't exist), matching every other `/series/{id}/*` endpoint's existing convention (`getById`/`update`/`delete`/`refresh`).
- **Region reuses `app.tmdb.watch-region` unchanged** — same single-configured-region rationale as Series Spec 020 (a personal app, one household's viewing region); no per-request region override.

---

## Requirement 1: `GET /api/v1/series/{id}/watch-providers`

**User story**: As a user deciding whether to start a series in my backlog, I want to check where it's currently streaming, on demand, so I don't have to look it up myself elsewhere.

### SERIES-026-AC-01 [AUTO]
**Statement**: `SeriesController` shall expose `GET /api/v1/series/{id}/watch-providers`, delegating to a new `RecommendationService.getStreamingProvidersForSeries(UUID id)`, returning `ApiResponse<List<RecommendationDto.StreamingProvider>>` with `count` set to the list size (mirroring the existing `GET /recommendations/{tmdbId}/keywords` endpoint's response shape).

**References**: `SeriesController.java` (new endpoint, alongside `refresh`/`acknowledgeNewContent`), `RecommendationService.java`, `RecommendationDto.StreamingProvider` (Series Spec 020).

**Test Case (Red)**:
```groovy
def "SERIES-026-AC-01: GET /api/v1/series/{id}/watch-providers returns 200 with a StreamingProvider list"() {
    given: "an existing series with a resolvable imdbId"
        def created = seriesService.create(new SeriesDto(title: "Ozark", imdbId: "tt5071412"))
        when(tmdbClient.findTvIdByImdbId("tt5071412")).thenReturn(Optional.of(69740))
        when(tmdbClient.watchProviders(69740, "GB")).thenReturn([new TmdbWatchProvider("Netflix", "/abc.jpg")])

    when: "the endpoint is requested"
        def response = client.get().uri("/api/v1/series/${created.id}/watch-providers").exchange()

    then: "the response is 200 with the mapped provider"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.data[0].name").isEqualTo("Netflix")
        response.expectBody().jsonPath("\$.count").isEqualTo(1)
}
```

**Test Case (Green)**: add the controller method and `RecommendationService.getStreamingProvidersForSeries`.

---

### SERIES-026-AC-02 [AUTO]
**Statement**: If `id` does not match an existing tracked series, the endpoint shall respond `404 Not Found` (`EntityNotFoundException`, same pattern as `getById`/`update`/`delete`/`refresh`).

**References**: `exception/EntityNotFoundException.java`, `exception/GlobalExceptionHandler.java`.

**Test Case (Red)**:
```groovy
def "SERIES-026-AC-02: an unknown series id returns 404"() {
    when: "the endpoint is requested with a random UUID"
        def response = client.get().uri("/api/v1/series/" + UUID.randomUUID() + "/watch-providers").exchange()

    then: "the response is 404"
        response.expectStatus().isNotFound()
}
```

**Test Case (Green)**: `seriesRepository.findById(id).orElseThrow(() -> new EntityNotFoundException(...))` at the top of `getStreamingProvidersForSeries`.

---

### SERIES-026-AC-03 [AUTO]
**Statement**: If the series' `imdbId` is `null` or blank, `getStreamingProvidersForSeries` shall return an empty list — never an error.

**References**: `RecommendationService.getStreamingProvidersForSeries`.

**Test Case (Red)**:
```groovy
def "SERIES-026-AC-03: a series with no imdbId yields an empty list, not an error"() {
    given: "a series with no imdbId"
        def created = seriesService.create(new SeriesDto(title: "No IMDb Link"))

    when: "the endpoint is requested"
        def response = client.get().uri("/api/v1/series/${created.id}/watch-providers").exchange()

    then: "the response is 200 with an empty list"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.count").isEqualTo(0)
}
```

**Test Case (Green)**: guard clause returning `List.of()` before attempting TMDB resolution.

---

### SERIES-026-AC-04 [AUTO]
**Statement**: If `TmdbClient.findTvIdByImdbId` returns empty (TMDB has no matching show for that `imdbId`), `getStreamingProvidersForSeries` shall return an empty list — never an error.

**References**: `TmdbClient.findTvIdByImdbId(String)` (Series Spec 018 precedent).

**Test Case (Red)**:
```groovy
def "SERIES-026-AC-04: an unresolvable imdbId yields an empty list, not an error"() {
    given: "a series whose imdbId TMDB can't resolve"
        def created = seriesService.create(new SeriesDto(title: "Obscure Show", imdbId: "tt9999999"))
        when(tmdbClient.findTvIdByImdbId("tt9999999")).thenReturn(Optional.empty())

    when: "the endpoint is requested"
        def response = client.get().uri("/api/v1/series/${created.id}/watch-providers").exchange()

    then: "the response is 200 with an empty list"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.count").isEqualTo(0)
}
```

**Test Case (Green)**: `tmdbClient.findTvIdByImdbId(imdbId).map(this::streamingProviders).orElse(List.of())`.

---

### SERIES-026-AC-05 [AUTO]
**Statement**: `getStreamingProvidersForSeries` shall reuse the existing `streamingProviders(int tmdbId)` mapping helper (Series Spec 020, `SERIES-020-AC-05`/`AC-06`) once a `tmdbId` is resolved — including its existing graceful-degradation behavior on a `watchProviders` failure (empty list, not an error) and its existing `logoUrl`-building/`app.tmdb.watch-region` behavior. No new mapping or exception-handling logic is introduced by this spec.

**References**: `RecommendationService.streamingProviders(int)` (already implemented, Series Spec 020).

**Test Case (Red)**:
```groovy
def "SERIES-026-AC-05: a watchProviders failure yields an empty list, not an error, reusing the existing helper"() {
    given: "a series with a resolvable tmdbId, but TMDB's watch-providers call fails"
        def created = seriesService.create(new SeriesDto(title: "Ozark", imdbId: "tt5071412"))
        when(tmdbClient.findTvIdByImdbId("tt5071412")).thenReturn(Optional.of(69740))
        when(tmdbClient.watchProviders(69740, "GB")).thenThrow(new ExternalServiceException("TMDB down"))

    when: "the endpoint is requested"
        def response = client.get().uri("/api/v1/series/${created.id}/watch-providers").exchange()

    then: "the response is still 200, with an empty list"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.count").isEqualTo(0)
}
```

**Test Case (Green)**: call the existing private `streamingProviders(tmdbId)` helper directly — no new try/catch needed, it already exists.

---

## Cross-References

| This spec | Source |
|---|---|
| `TmdbClient.watchProviders`, `PROVIDER_LOGO_BASE_URL`, `RecommendationDto.StreamingProvider`, `RecommendationService.streamingProviders(int)` (all reused unchanged), `app.tmdb.watch-region` | `series_spec_020_watch_providers.md` |
| `TmdbClient.findTvIdByImdbId`, the "`SeriesEntity` never caches a `tmdbId`" precedent this spec follows | `series_spec_018_series_refresh.md` |
| `SeriesEntity`/`GET /api/v1/series/{id}` 404 convention | `series_spec_002_crud.md` |
| Frontend consumer | `frontend_spec_036_series_watch_providers_display.md` (not yet written at the time this spec was authored) |

---

## Acceptance Criteria Summary

- [x] SERIES-026-AC-01: `GET /api/v1/series/{id}/watch-providers` returns `ApiResponse<List<StreamingProvider>>`
- [x] SERIES-026-AC-02: unknown series id → 404
- [x] SERIES-026-AC-03: no `imdbId` → empty list, not an error
- [x] SERIES-026-AC-04: unresolvable `imdbId` → empty list, not an error
- [x] SERIES-026-AC-05: reuses the existing `streamingProviders(int)` helper verbatim, including its failure handling
