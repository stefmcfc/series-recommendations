# Spec 028: Prevent Duplicate Series on Create

**Status**: Not started
**Priority**: P2 (data-integrity bug — a live-review report confirmed the same title can be added multiple times with no warning, observed twice in practice with "Breaking Bad")
**Depends on**: Series Spec 002 (`series_spec_002_crud.md`, `POST /api/v1/series`, `SeriesService.create`) ✅, Series Spec 006 (`series_spec_006_recommendations.md`, `SeriesRepository.existsByImdbId`, already used elsewhere) ✅
**Backend Task**

## Overview

`SeriesService.create` has no duplicate check at all — the same series can be added to the tracked list any number of times, with no error and no indication anything is wrong. `SeriesRepository.existsByImdbId` already exists and is already used by `RecommendationService` to exclude already-tracked series from automatic recommendation sourcing, but `SeriesService.create` never calls it.

## Design Decisions

- **Duplicate detection keys on `imdbId`, not `title`.** Titles aren't unique (two different shows can share a name), but `imdbId` is IMDb's own stable identifier and is already the field this app uses everywhere else to mean "this specific show" (`existsByImdbId`, `findTvIdByImdbId`, refresh, ignore-list). A series added without an `imdbId` at all (manual entry with no lookup) has nothing to key duplicate detection on and is not blocked — this mirrors `refreshFromTmdb`/`refreshFromOmdb` already silently no-op-ing for series with no `imdbId`.
- **Reuses the existing `ConflictException` → `409 Conflict` mapping**, rather than introducing a new exception type. `ConflictException`'s own doc comment currently says "currently only" used for the in-progress-bulk-refresh case — this spec is the second use, so that comment is updated (not narrowed in behavior, just no longer describing itself as the only caller).
- **Blocks outright rather than warning-and-allowing.** The report is about a hard duplicate (the exact same tracked show, added again by mistake) — there's no legitimate reason to track the same `imdbId` twice, so a hard `409` is the correct response, not a soft confirmation step. If a genuine desire to re-add a deleted-then-re-discovered series ever comes up, deleting removes the row entirely (no orphaned `imdbId` staying "taken"), so this doesn't trap a user who legitimately wants to re-track something they removed.
- **No new frontend work is required beyond a regression check.** `AddSeriesForm.handleSubmit`'s existing `catch` block already renders any `ApiError.message` via its generic `submitError` banner (`role="alert"`) — a `409` with a clear message will surface through that existing path with zero new code. See `frontend_spec_038_duplicate_series_error_display.md` for the confirming test.

---

## Requirement 1: Reject a Duplicate `imdbId` on Create

**User story**: As a user, I want to be stopped from adding a series I'm already tracking, so I don't end up with duplicate rows for the same show.

### SERIES-028-AC-01 [AUTO]
**Statement**: When `POST /api/v1/series` is requested with a non-blank `imdbId` that already matches an existing tracked series (`SeriesRepository.existsByImdbId`), `SeriesService.create` shall throw `ConflictException` with a message naming the conflicting title, resulting in a `409 Conflict` response. No entity shall be persisted.

**References**: `SeriesService.create`, `SeriesRepository.existsByImdbId`, `exception/ConflictException.java`.

**Test Case (Red)**:
```groovy
def "SERIES-028-AC-01: creating a series with an already-tracked imdbId returns 409"() {
    given: "an existing tracked series"
        seriesService.create(new SeriesDto(title: "Breaking Bad", imdbId: "tt0903747"))

    when: "the same imdbId is submitted again"
        def response = client.post().uri("/api/v1/series")
            .body(new SeriesDto(title: "Breaking Bad", imdbId: "tt0903747"))
            .exchange()

    then: "the response is 409, and no second row was created"
        response.expectStatus().isEqualTo(409)
        seriesRepository.findAll().count { it.imdbId == "tt0903747" } == 1
}
```

**Test Case (Green)**: at the top of `SeriesService.create`, after the existing title-blank check, add:
```java
if (dto.getImdbId() != null && !dto.getImdbId().isBlank()
        && repository.existsByImdbId(dto.getImdbId())) {
    throw new ConflictException("A series with this IMDb ID is already tracked: " + dto.getTitle());
}
```

---

### SERIES-028-AC-02 [AUTO]
**Statement**: A `POST /api/v1/series` request with a blank or absent `imdbId` shall not be subject to duplicate checking, even if another series shares the same title — creation proceeds normally.

**References**: `SeriesService.create`.

**Test Case (Red)**:
```groovy
def "SERIES-028-AC-02: two series with the same title but no imdbId are both allowed"() {
    given: "an existing series with no imdbId"
        seriesService.create(new SeriesDto(title: "Some Show"))

    when: "another series with the same title and no imdbId is created"
        def result = seriesService.create(new SeriesDto(title: "Some Show"))

    then: "creation succeeds"
        result.id != null
        seriesRepository.findAll().count { it.title == "Some Show" } == 2
}
```

**Test Case (Green)**: the `imdbId` blank/null guard in AC-01's implementation already covers this — explicit regression test.

---

### SERIES-028-AC-03 [AUTO]
**Statement**: `PATCH /api/v1/series/{id}` (update) shall not be subject to this duplicate check — updating an existing series' other fields, including setting/changing its own `imdbId`, is unaffected by this spec.

**References**: `SeriesService.update` (unchanged).

**Test Case (Red)**: none — explicit non-goal, confirmed by the absence of any change to `SeriesService.update` and by the existing update test suite passing unmodified.

**Test Case (Green)**: n/a.

---

## Cross-References

| This spec | Source |
|---|---|
| `SeriesRepository.existsByImdbId`'s existing usage (recommendation sourcing exclusion) this spec reuses for a second purpose | `series_spec_006_recommendations.md` |
| `ConflictException` → `409` mapping this spec reuses | `series_spec_018_series_refresh.md` (`SERIES-018-AC-14`, the bulk-refresh-in-progress case) |
| `POST /api/v1/series`, `SeriesService.create` | `series_spec_002_crud.md` |
| Frontend consumer (regression-confirming test only, no new UI code) | `frontend_spec_038_duplicate_series_error_display.md` |

---

## Acceptance Criteria Summary

- [ ] SERIES-028-AC-01: duplicate `imdbId` on create → `409 Conflict`, nothing persisted
- [ ] SERIES-028-AC-02: blank/absent `imdbId` is never subject to duplicate checking
- [ ] SERIES-028-AC-03: update is unaffected (explicit non-goal)
