# Series Spec 030: Explicit Clear-to-Null for Optional Series Fields

**Status**: Not started
**Priority**: P3 (data-correction gap — no way to remove a previously-set optional value short of editing the
database directly)
**Depends on**: Series Spec 002 (`series_spec_002_crud.md`, owns `PATCH /api/v1/series/{id}` and `SeriesDto`'s
existing "null means no change" partial-update convention this spec extends) ✅
**Area**: Backend (`dto/SeriesDto.java`, `service/SeriesService.java`) — paired with Frontend Spec 044
(`frontend_spec_044_edit_series_clear_fields.md`) for the UI half.

## Overview

`SeriesService.update` treats every `null` field on the incoming `SeriesDto` as "not sent, leave unchanged" —
confirmed by reading `applyMetadataUpdates`/`applyRatingAndPersonalUpdates`, every one of which is an `if
(dto.getX() != null) entity.setX(dto.getX())`. This is the correct, intentional partial-update convention (see
`series_spec_002`), but it has one real gap: there is currently **no way to explicitly set an optional field back
to `null`**. A user who wants to remove a personal rating, or clear a stray Rotten Tomatoes score, has no path to
do that via the API — `null` on the wire is structurally indistinguishable from "I didn't touch this field."

This spec adds a `clearedFields: List<String>` field to `SeriesDto`, read only on `PATCH`, naming which optional
fields should be explicitly nulled — resolving the ambiguity without introducing a wrapper type
(`JsonNullable<T>` or similar) across every field, and without giving every field a second "was this present"
shadow field. `clearedFields` is purely additive: a request that omits it behaves byte-identical to today.

## Design Decisions

- **A companion `clearedFields: List<String>` field, not a type change to every existing field.** Considered and
  rejected: wrapping every optional field in a `JsonNullable<T>`-style type (a real, common solution to this exact
  problem) — rejected here because it would touch all ~13 optional fields' types and every read site across
  `SeriesService`, `SeriesDto`, and the frontend's own typed request shape, for a feature only `EditSeriesForm`'s
  Clear buttons will ever actually trigger. A companion list is a small, additive, easily-reverted change instead.
- **Only a fixed, explicit set of fields may appear in `clearedFields`** — the optional, genuinely-nullable fields
  a user can meaningfully "unset": `year`, `genres`, `tags`, `totalSeasons`, `totalEpisodes`, `currentSeason`,
  `currentEpisode`, `imdbRating`, `rottenTomatoesRating`, `rottenTomatoesPopcornmeter`, `personalRating`,
  `personalNotes`, `posterUrl`. `title`/`status` are required (never clearable); `excludeFromRecommendations`/
  `flaggedForRewatch` are booleans with no meaningful "unset" state (always an explicit `true`/`false` already,
  same reasoning `SeriesDto`'s own existing boxed-`Boolean` javadoc gives for why they're partial-update-capable
  in the first place — but there's no "blank" checkbox state to clear *to*). An unrecognized name in
  `clearedFields` is rejected with a 400, not silently ignored — matching this app's existing "reject clearly
  wrong input rather than silently no-op" posture (e.g. `currentSeason > totalSeasons`).
- **A field present in `clearedFields` must not simultaneously carry a non-null value for that same field in the
  same request** — that's a self-contradictory instruction ("set this to X" and "clear this" at once). Rejected
  with a 400 rather than picking a silent precedence rule, since a well-behaved client (the paired frontend spec)
  never legitimately produces this shape, so hitting it at all indicates a bug worth surfacing loudly.
- **Clearing is applied as its own first pass, before the existing field-patch passes** — critical for
  `currentSeason`'s existing validation against `totalSeasons`: if a request clears `totalSeasons` while also
  setting/keeping `currentSeason`, the clear must land on `entity` *before* `applyCurrentSeason` reads
  `entity.getTotalSeasons()` for its `newCurrentSeason > totalSeasons` check — otherwise a stale (about-to-be-
  cleared) `totalSeasons` value could produce a false validation failure. Ordering: `applyClearedFields` runs
  first in `update()`, before `applyMetadataUpdates`/`applyRatingAndPersonalUpdates`/`applyCurrentSeason`/
  `applyStatusUpdate` (all unchanged).
- **No backend change to `POST /api/v1/series` (create).** `clearedFields` is only meaningful against an existing
  entity with a value to remove — a brand-new series has nothing to clear, and `SeriesService.create` doesn't
  read it (matching `tmdbId`'s existing precedent as a field this same `SeriesDto` carries but only one of
  create/update actually reads).

---

## Requirement 1: `clearedFields` nulls the named fields

**User story**: As a user, I want to remove a previously-set optional value (e.g. a personal rating I no longer
want recorded) via the same edit I'd use to change anything else.

### SERIES-030-AC-01 [AUTO]
**Statement**: When `PATCH /api/v1/series/{id}` is requested with `clearedFields` containing a recognized
clearable field name, the `SeriesService` shall set that field to `null` on the entity, regardless of the field's
current value.

**References**: `dto/SeriesDto.java` (new `clearedFields` field), `service/SeriesService.java` (new
`applyClearedFields`).

**Test Case (Red)**:
```groovy
def "SERIES-030-AC-01: clearedFields nulls personalRating"() {
    given: "a series with a personal rating set"
        def entity = repository.save(new SeriesEntity(title: "Show", personalRating: 4))

    when: "PATCH is requested with clearedFields: [personalRating]"
        def dto = new SeriesDto()
        dto.clearedFields = ["personalRating"]
        def result = service.update(entity.id, dto)

    then: "personalRating is null in the response"
        result.personalRating == null

    and: "it's null in the persisted entity too"
        repository.findById(entity.id).get().personalRating == null
}
```
**Test Case (Green)**: add `clearedFields` to `SeriesDto`; implement `applyClearedFields`, called first in
`update()`.

---

### SERIES-030-AC-02 [AUTO]
**Statement**: Fields not named in `clearedFields` and not present (non-null) in the request body shall remain
unchanged — the existing partial-update convention, unaffected by this spec.

**Test Case (Red)**:
```groovy
def "SERIES-030-AC-02: unrelated fields are unaffected by clearedFields"() {
    given: "a series with title, personalRating, and genres set"
        def entity = repository.save(new SeriesEntity(title: "Show", personalRating: 4, genres: "Drama"))

    when: "PATCH clears only personalRating"
        def dto = new SeriesDto()
        dto.clearedFields = ["personalRating"]
        def result = service.update(entity.id, dto)

    then: "genres and title are untouched"
        result.genres == "Drama"
        result.title == "Show"
}
```
**Test Case (Green)**: no new logic — confirms `applyClearedFields` only touches named fields, existing passes
behave as today.

---

### SERIES-030-AC-03 [AUTO]
**Statement**: If `clearedFields` contains a name that isn't one of the recognized clearable fields (the 13 listed
in Design Decisions), the request shall be rejected with a 400 and a field-level message, before any update is
applied.

**Test Case (Red)**:
```groovy
def "SERIES-030-AC-03: an unrecognized field name in clearedFields is rejected"() {
    given: "a series exists"
        def entity = repository.save(new SeriesEntity(title: "Show"))

    when: "PATCH is requested with clearedFields containing an unclearable/unknown field"
        def dto = new SeriesDto()
        dto.clearedFields = ["title"]
        service.update(entity.id, dto)

    then: "an IllegalArgumentException is thrown (mapped to 400 by GlobalExceptionHandler)"
        thrown(IllegalArgumentException)

    and: "the entity is unchanged"
        repository.findById(entity.id).get().title == "Show"
}
```
**Test Case (Green)**: `applyClearedFields` validates every name against a fixed `Set<String>
CLEARABLE_FIELDS`, throwing before mutating the entity.

---

### SERIES-030-AC-04 [AUTO]
**Statement**: If a field name appears in `clearedFields` while the same request also carries a non-null value
for that field, the request shall be rejected with a 400, rather than either value silently winning.

**Test Case (Red)**:
```groovy
def "SERIES-030-AC-04: a field cannot be both cleared and set in the same request"() {
    given: "a series exists"
        def entity = repository.save(new SeriesEntity(title: "Show", personalRating: 4))

    when: "PATCH both clears and sets personalRating"
        def dto = new SeriesDto()
        dto.clearedFields = ["personalRating"]
        dto.personalRating = 3
        service.update(entity.id, dto)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
}
```
**Test Case (Green)**: `applyClearedFields` checks each named field's corresponding `dto` getter is `null`
before proceeding; throws if not.

---

### SERIES-030-AC-05 [AUTO]
**Statement**: When a request clears `totalSeasons` while also setting `currentSeason` in the same request, the
existing `currentSeason`-vs-`totalSeasons` validation shall evaluate against the newly-cleared (`null`)
`totalSeasons`, not its pre-request value — i.e. the clear takes effect before that validation runs.

**Test Case (Red)**:
```groovy
def "SERIES-030-AC-05: clearing totalSeasons is applied before currentSeason validation"() {
    given: "a series with totalSeasons=5, currentSeason=3"
        def entity = repository.save(
            new SeriesEntity(title: "Show", totalSeasons: 5, currentSeason: 3))

    when: "PATCH clears totalSeasons and sets currentSeason=8 in the same request"
        def dto = new SeriesDto()
        dto.clearedFields = ["totalSeasons"]
        dto.currentSeason = 8
        def result = service.update(entity.id, dto)

    then: "no exception -- there's no longer a totalSeasons to exceed"
        result.currentSeason == 8
        result.totalSeasons == null
}
```
**Test Case (Green)**: ordering already established in Design Decisions — `applyClearedFields` runs before
`applyCurrentSeason`.

---

### SERIES-030-AC-06 [AUTO]
**Statement**: `title` and `status` (required fields) and `excludeFromRecommendations`/`flaggedForRewatch`
(booleans with no clearable "unset" state) shall be rejected as `clearedFields` entries — they are not members of
the recognized clearable-field set.

**Test Case (Red)**:
```groovy
def "SERIES-030-AC-06: required/boolean fields cannot be cleared"() {
    given: "a series exists"
        def entity = repository.save(new SeriesEntity(title: "Show", status: SeriesStatus.WATCHING))

    when: "PATCH attempts to clear excludeFromRecommendations"
        def dto = new SeriesDto()
        dto.clearedFields = ["excludeFromRecommendations"]
        service.update(entity.id, dto)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)

    where:
        fieldName << ["title", "status", "excludeFromRecommendations", "flaggedForRewatch"]
}
```
**Test Case (Green)**: same `CLEARABLE_FIELDS` set from AC-03 — these four are deliberately excluded from it.

---

## Implementation Notes

- `CLEARABLE_FIELDS` is a `private static final Set<String>` constant on `SeriesService` (or a small dedicated
  holder class if it needs sharing elsewhere later — not needed yet, one consumer today).
- `applyClearedFields`'s per-field nulling is a straightforward `switch` (or small `Map<String, Consumer<SeriesEntity>>`)
  over the 13 recognized names — whichever reads more clearly matching this file's existing style for
  `applyMetadataUpdates`/`applyRatingAndPersonalUpdates`'s sequences of `if` blocks; a `switch` is likely the
  better fit here since every branch is a single `entity.setX(null)` with no shared condition.
- **`API.md` needs updating** (Definition of Done) — `PATCH /api/v1/series/{id}`'s request body gains the new
  optional `clearedFields: string[]` field; document the 13 valid values and the 400 cases (AC-03/AC-04).

## Cross-References

| This spec | Source |
|---|---|
| `PATCH /api/v1/series/{id}`'s existing partial-update ("null means no change") convention this spec extends | `series_spec_002_crud.md` |
| `SeriesDto`'s existing input-only field precedent (`tmdbId`, read only by `create`) this spec's `clearedFields` (read only by `update`) mirrors in the opposite direction | `series_spec_019_keyword_tracking.md`'s `SeriesDto.tmdbId` javadoc |
| `currentSeason`-vs-`totalSeasons` validation this spec's ordering decision protects | `series_spec_001_entity.md` / `SeriesService.applyCurrentSeason` |
| Frontend UI (per-field Clear buttons) producing `clearedFields` | `frontend_spec_044_edit_series_clear_fields.md` |

---

## Acceptance Criteria Summary

- [ ] SERIES-030-AC-01: `clearedFields` nulls the named field
- [ ] SERIES-030-AC-02: unrelated fields are unaffected
- [ ] SERIES-030-AC-03: an unrecognized field name is rejected (400)
- [ ] SERIES-030-AC-04: a field cannot be both cleared and set in one request (400)
- [ ] SERIES-030-AC-05: clearing is applied before `currentSeason` validation
- [ ] SERIES-030-AC-06: required/boolean fields cannot be cleared (400)
