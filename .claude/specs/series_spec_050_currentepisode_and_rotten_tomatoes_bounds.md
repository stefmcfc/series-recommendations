# Series Spec 050: `currentEpisode` Bound and Rotten Tomatoes Rating Range Validation

**Status**: Complete
**Priority**: P3
**Depends on**: none (mirrors existing `currentSeason`/`totalSeasons` and `imdbRating` validation already in `SeriesService`)
**Area**: Backend (`service/SeriesService.java`)

## Overview

Two real, currently-unvalidated gaps in `SeriesService`, found while scoping a frontend validation request (`frontend_spec_091`) and confirmed by reading the service directly. First: `applyCurrentSeason` rejects a `currentSeason` update that exceeds `totalSeasons`, but the equivalent `currentEpisode`/`totalEpisodes` pair has no check at all — `update()` sets `currentEpisode` unconditionally inside `applyMetadataUpdates`. This asymmetry was a **deliberate** decision at the time (`frontend_spec_004`'s Design Decisions: "the backend doesn't do that check either, so adding one client-side would create a false rejection the server wouldn't agree with") — this spec closes it on the backend first, so the frontend fix land on top of matching server behavior rather than reintroducing that same mismatch in the other direction. Second: `rottenTomatoesRating`/`rottenTomatoesPopcornmeter` have no range validation anywhere in the service — not on `create()`, not on `update()` — confirmed via grep across `SeriesDto`/`SeriesService` (no `@Min`/`@Max` annotation, no imperative bounds check). Both are freely re-editable on every update (no TMDB-managed lock, unlike `totalSeasons`/`totalEpisodes`/`imdbRating`), so today the API will silently persist e.g. `rottenTomatoesRating: 500` sent directly (bypassing the frontend's own 0–100 check, which only guards the UI form).

## Design Decisions

- **`applyCurrentEpisode` mirrors `applyCurrentSeason` exactly** — same method shape (read `dto.getCurrentEpisode()`, compare against `entity.getTotalEpisodes()`, throw `IllegalArgumentException` with the same message format), same call site (alongside `applyCurrentSeason` in `update()`, after `applyMetadataUpdates` — for the same reason documented in `update()`'s own Javadoc: `totalEpisodes` may be patched by `applyMetadataUpdates` in the same request, and the just-patched value must be what the cross-check reads). Extracted out of `applyMetadataUpdates` (where `currentEpisode` is set today, unconditionally) into its own method, matching where `currentSeason` already lives.
- **Rotten Tomatoes bounds are checked via one shared helper, called from both `validateCreate` and `applyRatingAndPersonalUpdates`** — not duplicated inline in each, and not scoped to only one entry point (unlike the existing, narrower `imdbRating` check, which only runs in `validateCreate` and has no equivalent re-check in the `update()` path today). Deliberately not fixing that pre-existing `imdbRating`-on-update gap here — out of scope for this spec, which is about the two fields actually raised (`currentEpisode`, Rotten Tomatoes); flagged here as a related follow-up worth its own spec if it matters in practice, not silently left unmentioned.
- **`totalSeasons`/`totalEpisodes` bounds (e.g. rejecting `0` or negative) are explicitly out of scope.** Confirmed via `series_spec_040_tmdb_managed_field_lock.md`: both are TMDB-managed and lock once non-null (`applyMetadataUpdates`'s `dto.getX() != null && entity.getX() == null` guard) — a manual PATCH essentially only ever sets them once, for a manually-added series with no TMDB match yet. Lower risk, no concrete gap raised against this path; the frontend's own client-side check (`frontend_spec_091`) already covers the common case (typing garbage into a UI form) without needing a matching server-side bound for a field this narrowly write-once.
- **Error messages follow the exact casing/format already established**: `currentSeason`'s existing message is `"currentSeason (" + value + ") cannot exceed totalSeasons (" + total + ")"` (camelCase field names, parenthesized values) — `applyCurrentEpisode`'s message mirrors this precisely. The Rotten Tomatoes messages follow the existing `imdbRating` message's plain-English style (`"IMDb rating must be between 0.0 and 10.0"`) rather than the camelCase style, since both existing precedents already disagree with each other and the Rotten Tomatoes fields have no camelCase precedent of their own to match.

## Requirements

### Requirement 1: `currentEpisode` cannot exceed `totalEpisodes`

**User Story**: As a user, I want the API to reject a `currentEpisode` update that's impossible given the series' total episode count, the same way it already does for `currentSeason`.

#### SERIES-050-AC-01 [AUTO]: Update rejects `currentEpisode` beyond `totalEpisodes`
**Statement**: If an update's `currentEpisode` exceeds the entity's `totalEpisodes`, then `SeriesService.update` shall throw `IllegalArgumentException` and shall not persist the change.

**Rationale**: Mirrors the existing `currentSeason`/`totalSeasons` guard — closes the asymmetry `frontend_spec_004` originally left open pending this exact fix.

**References**:
- Service: `SeriesService.java` (`applyCurrentSeason`, the pattern being mirrored; `applyMetadataUpdates`, where `currentEpisode` is set today with no check)
- Related: `frontend_spec_004_edit_delete_series.md` (Design Decisions, the original "backend doesn't check this either" rationale this spec supersedes)

**Test Case (Red)**:
```groovy
def "SERIES-050-AC-01: rejects update with currentEpisode beyond totalEpisodes"() {
    given: "a series has been created with a total episode count"
        def created = seriesService.create(new SeriesDto(
          title: "Show",
          totalEpisodes: 10
        ))

    and: "an update DTO with a currentEpisode beyond the total"
        def updateDto = new SeriesDto(currentEpisode: 20)

    when: "the series is updated"
        seriesService.update(created.id, updateDto)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
}
```

**Test Case (Green)**: extract `applyCurrentEpisode(SeriesEntity entity, SeriesDto dto)` mirroring `applyCurrentSeason`'s shape; call it from `update()` alongside `applyCurrentSeason`; remove the old unconditional `currentEpisode` set from `applyMetadataUpdates`.

#### SERIES-050-AC-02 [AUTO]: Update still accepts a valid `currentEpisode`
**Statement**: While an update's `currentEpisode` is within the entity's `totalEpisodes` (or `totalEpisodes` is null), `SeriesService.update` shall persist the new `currentEpisode`.

**Rationale**: Regression guard — the existing, currently-passing "should update series with new progress" test already covers `currentEpisode: 10` against `totalEpisodes: 201`; this AC makes that coverage explicit under the new method rather than relying on it implicitly.

**Test Case (Red)**:
```groovy
def "SERIES-050-AC-02: accepts currentEpisode within totalEpisodes"() {
    given: "a series has been created with a total episode count"
        def created = seriesService.create(new SeriesDto(
          title: "Show",
          totalEpisodes: 10
        ))

    when: "the series is updated with a currentEpisode within range"
        def result = seriesService.update(created.id, new SeriesDto(currentEpisode: 5))

    then: "the update succeeds"
        result.currentEpisode == 5
}
```

**Test Case (Green)**: `applyCurrentEpisode` only throws when `totalEpisodes != null && newCurrentEpisode > totalEpisodes`, exactly mirroring `applyCurrentSeason`'s own null-safety.

### Requirement 2: Rotten Tomatoes rating/popcornmeter bounds

**User Story**: As the API's data integrity backstop, I want out-of-range Rotten Tomatoes values rejected server-side, not just caught by the frontend form.

#### SERIES-050-AC-03 [AUTO]: Create rejects an out-of-range `rottenTomatoesRating`
**Statement**: If `rottenTomatoesRating` is provided and is outside `0`–`100`, then `SeriesService.create` shall throw `IllegalArgumentException` and shall not persist the series.

**Rationale**: No bounds check exists anywhere today — a direct API call bypasses the frontend form's own 0–100 check entirely.

**References**:
- Service: `SeriesService.java` (`validateCreate`, alongside the existing `imdbRating` bounds check it mirrors in spirit)
- DTO: `dto/SeriesDto.java` (`rottenTomatoesRating`, `Integer`, currently no `@Min`/`@Max`)

**Test Case (Red)**:
```groovy
def "SERIES-050-AC-03: rejects create with rottenTomatoesRating out of range"() {
    when: "a series is created with an out-of-range rottenTomatoesRating"
        seriesService.create(new SeriesDto(title: "Show", rottenTomatoesRating: 150))

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
}
```

**Test Case (Green)**: add a shared `validateRottenTomatoesBounds(SeriesDto dto)` private method, called from `validateCreate`.

#### SERIES-050-AC-04 [AUTO]: Update rejects an out-of-range `rottenTomatoesRating`
**Statement**: If an update's `rottenTomatoesRating` is outside `0`–`100`, then `SeriesService.update` shall throw `IllegalArgumentException` and shall not persist the change.

**Rationale**: `rottenTomatoesRating` is freely re-editable on every update (no TMDB-managed lock) — the create-time check alone wouldn't cover the far more common edit-after-the-fact path.

**Test Case (Red)**:
```groovy
def "SERIES-050-AC-04: rejects update with rottenTomatoesRating out of range"() {
    given: "a series has been created"
        def created = seriesService.create(new SeriesDto(title: "Show"))

    when: "the series is updated with an out-of-range rottenTomatoesRating"
        seriesService.update(created.id, new SeriesDto(rottenTomatoesRating: -5))

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
}
```

**Test Case (Green)**: call the same `validateRottenTomatoesBounds(dto)` helper from `applyRatingAndPersonalUpdates`, before setting the field.

#### SERIES-050-AC-05 [AUTO]: Create and update reject an out-of-range `rottenTomatoesPopcornmeter`
**Statement**: If `rottenTomatoesPopcornmeter` is provided and is outside `0`–`100` on either `create` or `update`, then `SeriesService` shall throw `IllegalArgumentException` and shall not persist the value.

**Rationale**: Same gap, same fix, for the Popcornmeter (audience) score alongside the Tomatometer (critic) score.

**Test Case (Red)**:
```groovy
def "SERIES-050-AC-05: rejects out-of-range rottenTomatoesPopcornmeter on create and update"() {
    when: "a series is created with an out-of-range rottenTomatoesPopcornmeter"
        seriesService.create(new SeriesDto(title: "Show", rottenTomatoesPopcornmeter: 101))

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)

    when: "an existing series is updated with an out-of-range rottenTomatoesPopcornmeter"
        def created = seriesService.create(new SeriesDto(title: "Show 2"))
        seriesService.update(created.id, new SeriesDto(rottenTomatoesPopcornmeter: -1))

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
}
```

**Test Case (Green)**: `validateRottenTomatoesBounds` checks both fields (each independently null-safe — only validated when provided), called from both `validateCreate` and `applyRatingAndPersonalUpdates`.

#### SERIES-050-AC-06 [AUTO]: Valid Rotten Tomatoes values are still accepted
**Statement**: While `rottenTomatoesRating` and `rottenTomatoesPopcornmeter` are within `0`–`100` (or absent), `SeriesService` shall persist them on both `create` and `update`.

**Rationale**: Regression guard — the boundary values `0` and `100` themselves must not be rejected (an off-by-one in `<`/`>` vs `<=`/`>=` would silently break legitimate 0% or 100% scores).

**Test Case (Red)**:
```groovy
def "SERIES-050-AC-06: accepts boundary values 0 and 100"() {
    when: "a series is created with boundary Rotten Tomatoes values"
        def result = seriesService.create(new SeriesDto(
          title: "Show",
          rottenTomatoesRating: 0,
          rottenTomatoesPopcornmeter: 100
        ))

    then: "both values are persisted unchanged"
        result.rottenTomatoesRating == 0
        result.rottenTomatoesPopcornmeter == 100
}
```

**Test Case (Green)**: bounds check uses `< 0 || > 100` (inclusive range), matching the frontend's own `validateRottenTomatoesRating`/`validateRottenTomatoesPopcornmeter` logic in `seriesFormValidation.ts`.

## Cross-References

| Concept | Location |
|---|---|
| `currentSeason`/`totalSeasons` cross-check being mirrored | `service/SeriesService.java` (`applyCurrentSeason`) |
| `imdbRating` bounds check being mirrored in spirit (create-only; a documented, deliberately-not-fixed-here gap) | `service/SeriesService.java` (`validateCreate`) |
| TMDB-managed field lock (why `totalSeasons`/`totalEpisodes` bounds are out of scope) | `series_spec_040_tmdb_managed_field_lock.md` |
| Original "backend doesn't check `currentEpisode` either" decision this spec supersedes | `frontend_spec_004_edit_delete_series.md` (Design Decisions) |
| Frontend consumer of this backend behavior | `frontend_spec_091_series_form_validation_and_persistent_cta.md` |
| `IllegalArgumentException` → HTTP 400 mapping | `exception/GlobalExceptionHandler.java` |

## Acceptance Criteria Summary

- [x] SERIES-050-AC-01: Update rejects `currentEpisode` beyond `totalEpisodes`
- [x] SERIES-050-AC-02: Update still accepts a valid `currentEpisode`
- [x] SERIES-050-AC-03: Create rejects an out-of-range `rottenTomatoesRating`
- [x] SERIES-050-AC-04: Update rejects an out-of-range `rottenTomatoesRating`
- [x] SERIES-050-AC-05: Create and update reject an out-of-range `rottenTomatoesPopcornmeter`
- [x] SERIES-050-AC-06: Valid Rotten Tomatoes values (including boundaries) are still accepted
