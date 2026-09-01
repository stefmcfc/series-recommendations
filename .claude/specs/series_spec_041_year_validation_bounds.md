# Series Spec 041: Correct `year` Validation Bounds, Fix Silent 500 on Any Range Violation

**Status**: Implemented — `exception/GlobalExceptionHandler.java` (new `ConstraintViolationException`
and `TransactionSystemException` handlers), `model/SeriesEntity.java` (`year`'s `@Min`/`@Max`
bounds), `service/SeriesService.java` (new `validateYearRange`, called from `validateCreate` and
`applyMetadataUpdates`), plus their Spock specs (`GlobalExceptionHandlerSpec`, `SeriesEntitySpec`,
`SeriesServiceSpec`, `SeriesControllerSpec`). Paired frontend half (`frontend_spec_061`) handled
separately.
**Priority**: P2 (correctness bug — `year`'s upper bound is a hardcoded constant that is already
wrong today and goes stale every year; a range violation on `year` or any other bounded numeric
field currently returns `500 Internal Server Error` instead of a proper `400`)
**Depends on**: Series Spec 001 (`series_spec_001_entity`, owns `SeriesEntity`'s original `@Min`/`@Max`
annotations) ✅, Series Spec 002 (`series_spec_002_crud.md`, owns `SeriesService.create`/`update`)
✅, Series Spec 031 (`series_spec_031_custom_search_prefetch_filters`, the `1900`–`current year + 1` bound this spec brings
`SeriesEntity.year` in line with, already established for `RecommendationCriteria.yearMin/yearMax`
via `RecommendationCriteriaValidator`) ✅
**Area**: Backend (`model/SeriesEntity.java`, `service/SeriesService.java`,
`exception/GlobalExceptionHandler.java`) — paired with Frontend Spec 061
(`frontend_spec_061_year_validation_bounds.md`), which brings `AddSeriesForm`/`EditSeriesForm`'s
own `year` bounds in line with the same `1900`–`current year + 1` range.

## Overview

`SeriesEntity.year` is annotated `@Min(1)` / `@Max(2026)` — both wrong. The floor of `1` accepts
absurd values (year `1` is not a real constraint), and the ceiling is a hardcoded literal that
already needs bumping today and will again every single year going forward. This app already has
the correct bound established elsewhere: `RecommendationCriteriaValidator.validateYearRange`
enforces `1900`–`Year.now(clock).getValue() + 1` for `RecommendationCriteria.yearMin`/`yearMax`
(`SERIES-031-AC-12`), and the frontend's `yearBounds.ts` mirrors it (`MIN_VALID_YEAR = 1900`,
`MAX_VALID_YEAR = new Date().getFullYear() + 1`) for `SearchFilter`/`RecommendationControls`. Only
`SeriesEntity.year` itself was never brought in line with that convention.

Separately, and more seriously: confirmed live (via direct `PATCH` against a running instance) that
submitting an out-of-range value for `year` — or `totalSeasons`, `totalEpisodes`, `currentSeason`,
`currentEpisode`, `imdbRating`, `rottenTomatoesRating`, or `rottenTomatoesPopcornmeter` — via
`POST`/`PATCH /api/v1/series` returns `500 Internal Server Error`, not a `400`. `SeriesService.
update` never calls any validation method before `repository.save(entity)`; the only thing
rejecting an out-of-range value today is `SeriesEntity`'s own `@Min`/`@Max`/`@DecimalMin`/
`@DecimalMax` annotations, validated automatically by Hibernate at flush time. That validation
failure is a `jakarta.validation.ConstraintViolationException`, which `GlobalExceptionHandler` has
no handler for — it falls through to the catch-all `Exception.class` handler and becomes a `500`.
(`SeriesService.create`'s `validateCreate` manually re-checks `title`/`imdbId`/`imdbRating` up
front specifically to get a clean `400` for those three — but that pre-check doesn't exist for
`update` at all, and never existed for `totalSeasons`/`totalEpisodes`/`currentSeason`/
`currentEpisode`/`rottenTomatoesRating`/`rottenTomatoesPopcornmeter` on either path.) This spec
fixes the gap at its root — a missing exception handler — rather than hand-rolling a matching manual
pre-check for every bounded field on both `create` and `update`.

## Design Decisions

- **`GlobalExceptionHandler` gains a `ConstraintViolationException` handler**, translating any
  entity-level Bean Validation failure into a clean `400` with a readable message — the same
  `field: message` joining style `MethodArgumentNotValidException`'s existing handler already uses.
  This alone fixes the `500` for `totalSeasons`/`totalEpisodes`/`currentSeason`/`currentEpisode`/
  `imdbRating`/`rottenTomatoesRating`/`rottenTomatoesPopcornmeter` on both `create` and `update`,
  since Hibernate already validates all of them via `SeriesEntity`'s existing annotations at
  `repository.save()` time — no change needed to those annotations or to `SeriesService` itself for
  this part.
- **`year`'s upper bound cannot be fixed the same way**, because a Bean Validation annotation's
  attributes must be compile-time constants — `@Max` can never express "current year + 1"
  dynamically. `@Max(value = 2026, ...)` is removed from `SeriesEntity.year` entirely (there is no
  static replacement value that stays correct), and `@Min` is corrected from `1` to `1900`, which
  *is* a legitimate static floor.
- **The dynamic upper-bound check moves to `SeriesService`, imperatively**, mirroring
  `RecommendationCriteriaValidator.validateYearRange`'s exact pattern: an injected `Clock` (already
  a `SeriesService` constructor dependency, used for `dateAdded`/`lastRefreshedAt`/`dateCompleted`)
  resolves `Year.now(clock).getValue() + 1` at request time, so the bound stays correct as years
  pass with no code change required. Violating it throws `IllegalArgumentException` — the same
  exception type (and resulting clean `400` via the already-existing handler) `validateCreate`
  already uses for its `imdbRating`/`title`/`imdbId` checks, kept consistent rather than routing
  this one case through the new `ConstraintViolationException` path above.
- **This check runs on both `create` and `update`**, closing a second, independent gap: `update`
  has never validated `year` at all beyond the (buggy) entity annotation — a `year` regression
  wasn't just returning the wrong status code on `update`, the dynamic upper bound genuinely didn't
  exist there before this spec.
- **`SeriesEntitySpec.groovy`'s two existing entity-level `year` tests move to `SeriesServiceSpec.
  groovy`**, since the upper bound stops being an entity annotation this spec can test at that
  layer — see Implementation Notes.

---

## Requirement 1: A Bean Validation range violation returns `400`, not `500`

**User story**: As a user (or the frontend on my behalf), I want a clear, actionable error when I
submit an out-of-range value, not a generic server error that gives no indication what was wrong.

### SERIES-041-AC-01 [AUTO]
**Statement**: `GlobalExceptionHandler` shall handle `jakarta.validation.ConstraintViolationException`
by responding `400 Bad Request` with `ApiResponse.error(...)` carrying a message listing each
violated property and its constraint message, mirroring the existing
`MethodArgumentNotValidException` handler's `field: message` joining style.

**References**: `GlobalExceptionHandler.handleValidation` (existing precedent to mirror);
`SeriesEntity`'s `@Min`/`@Max`/`@DecimalMin`/`@DecimalMax` annotations (the source of the violations
this handler now catches).

**Test Case (Red)**:
```groovy
def "SERIES-041-AC-01: an out-of-range totalSeasons via update returns 400, not 500"() {
    given: "an existing series"
        def existing = seriesService.create(new SeriesDto(title: "Show"))

    when: "update is called with an invalid totalSeasons"
        def response = restTemplate.exchange(
            "/api/v1/series/${existing.id}", HttpMethod.PATCH,
            new HttpEntity<>(new SeriesDto(totalSeasons: -1)), String)

    then: "the response is 400, not 500"
        response.statusCode == HttpStatus.BAD_REQUEST
}
```
**Test Case (Green)**: add
```java
@ExceptionHandler(ConstraintViolationException.class)
public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(ConstraintViolationException ex) {
    String message = ex.getConstraintViolations().stream()
        .map(v -> v.getPropertyPath() + ": " + v.getMessage())
        .collect(Collectors.joining(", "));
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(message));
}
```
to `GlobalExceptionHandler`, ordered ahead of the catch-all `Exception.class` handler (Spring
dispatches to the most specific matching `@ExceptionHandler` regardless of declaration order, so
this is a correctness note, not a strict ordering requirement).

---

### SERIES-041-AC-02 [AUTO] (regression guard)
**Statement**: A valid `create`/`update` request shall be entirely unaffected by this handler —
`ConstraintViolationException` is only ever thrown when a genuine violation exists, so no existing
passing request path changes behavior.

**Test Case (Green)**: no code change — regression guard confirming every existing
`SeriesServiceSpec.groovy`/`SeriesControllerSpec.groovy` happy-path test still passes unmodified.

---

## Requirement 2: `year` validates against `1900`–current year + 1, matching this app's existing convention

**User story**: As a user, I want to be told a specific, sensible range when I enter an invalid
year, not have the request silently fail or reject a value based on a stale hardcoded ceiling.

### SERIES-041-AC-03 [AUTO]
**Statement**: `SeriesEntity.year`'s `@Min` shall be corrected from `1` to `1900`, and its
`@Max(value = 2026, ...)` annotation shall be removed.

**References**: `MIN_VALID_YEAR` (`RecommendationCriteriaValidator.java`, `frontend/src/utils/
yearBounds.ts`) — the same floor this app already established elsewhere.

**Test Case (Green)**: annotation-only change to `SeriesEntity.java`; verified indirectly by
AC-04/AC-05's service-level tests below (a direct entity-level `@Max` test no longer applies, since
there is no longer a static upper bound to assert against at that layer).

---

### SERIES-041-AC-04 [AUTO]
**Statement**: `SeriesService.create` and `SeriesService.update` shall each reject a `year` outside
`1900`–`Year.now(clock).getValue() + 1` (inclusive) with `IllegalArgumentException`, resolving the
upper bound at request time via the already-injected `Clock` — never a hardcoded literal.

**References**: `RecommendationCriteriaValidator.validateYearRange` (the pattern this mirrors);
`SeriesService`'s existing `Clock` constructor dependency.

**Test Case (Red)**:
```groovy
def "SERIES-041-AC-04: create rejects a year beyond current year + 1"() {
    given: "a fixed clock at 2026-08-31"
        def fixedClock = Clock.fixed(Instant.parse("2026-08-31T00:00:00Z"), ZoneOffset.UTC)
        def service = new SeriesService(seriesRepository, keywordSyncService, fixedClock)

    when: "create is called with year 2028 (current year + 2)"
        service.create(new SeriesDto(title: "Show", year: 2028))

    then: "an IllegalArgumentException is thrown"
        def ex = thrown(IllegalArgumentException)
        ex.message.contains("1900")

    when: "create is called with year 2027 (current year + 1, the boundary)"
        def result = service.create(new SeriesDto(title: "Show 2", year: 2027))

    then: "it succeeds"
        result.year == 2027
}

def "SERIES-041-AC-04: update rejects a year below 1900"() {
    given: "an existing series with no year set"
        def existing = seriesService.create(new SeriesDto(title: "Show"))

    when: "update sets year to 1899"
        seriesService.update(existing.id, new SeriesDto(year: 1899))

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
}
```
**Test Case (Green)**: a new private `validateYearRange(Integer year)` in `SeriesService`
(`if (year != null && (year < 1900 || year > Year.now(clock).getValue() + 1)) throw new
IllegalArgumentException(...)`), called from `validateCreate` (for `dto.getYear()`) and from
`applyMetadataUpdates` (before applying `dto.getYear()` onto the entity).

---

### SERIES-041-AC-05 [AUTO] (regression guard)
**Statement**: A `year` within `1900`–current year + 1 shall continue to be accepted on both
`create` and `update`, exactly as today.

**Test Case (Green)**: covered by AC-04's own boundary assertion (`year: 2027` succeeding) plus
existing passing tests using ordinary years (e.g. `2019`) elsewhere in `SeriesServiceSpec.groovy`,
confirmed unaffected.

---

## Implementation Notes

- **`SeriesEntitySpec.groovy`'s `"should reject year > current year"` and `"should accept year <=
  current year"` tests must be removed**, not left alongside the new service-level tests — the
  upper bound is no longer an entity annotation, so there is nothing left for a direct
  `validator.validate(series)` call against the bare entity to catch for that case. Their coverage
  is replaced by `SERIES-041-AC-04`'s new `SeriesServiceSpec.groovy` tests.
- **`API.md`** should note that `year` is validated against `1900`–current year + 1 (not a fixed
  upper bound), and that any range violation on a numeric field now returns `400` with a descriptive
  message rather than `500`.
- **Discovered during implementation**: `SeriesEntity`'s actual INSERT/UPDATE is deferred to flush
  time, and `@Transactional`'s auto-flush-then-commit happens inside `JpaTransactionManager.
  doCommit` -- *after* `SeriesService.update`/`create` has already returned control to the
  transactional proxy. So the `ConstraintViolationException` Hibernate throws at flush time never
  reaches `GlobalExceptionHandler.handleConstraintViolation` directly; Spring wraps it (via a
  `jakarta.persistence.RollbackException`) in a `org.springframework.transaction.
  TransactionSystemException` first. `GlobalExceptionHandler` needed a second handler,
  `handleTransactionSystemException`, that unwraps `TransactionSystemException.getRootCause()` and
  delegates to `handleConstraintViolation` when it's a `ConstraintViolationException` -- confirmed
  via `SeriesControllerSpec`'s real `MockMvc` PATCH test (SERIES-041-AC-01), which failed with the
  single `ConstraintViolationException` handler alone until this was added.

## Cross-References

| This spec | Source |
|---|---|
| `1900`–current year + 1 convention this spec brings `year` in line with | `series_spec_031_custom_search_prefetch_filters` (`SERIES-031-AC-12`, `RecommendationCriteriaValidator.validateYearRange`) |
| Frontend mirror of the same bound | `frontend/src/utils/yearBounds.ts` (`MIN_VALID_YEAR`/`MAX_VALID_YEAR`) |
| `SeriesService.create`/`validateCreate`, the existing `IllegalArgumentException` precedent this reuses | `series_spec_002_crud.md` |
| `MethodArgumentNotValidException` handler style this spec's new handler mirrors | `exception/GlobalExceptionHandler.java` |
| Paired frontend change | `frontend_spec_061_year_validation_bounds.md` |

---

## Acceptance Criteria Summary

- [x] SERIES-041-AC-01: `ConstraintViolationException` returns `400`, not `500`
- [x] SERIES-041-AC-02: valid requests are unaffected by the new handler (regression guard)
- [x] SERIES-041-AC-03: `SeriesEntity.year`'s `@Min` corrected to `1900`, `@Max(2026)` removed
- [x] SERIES-041-AC-04: `create`/`update` reject `year` outside `1900`–current year + 1 via `IllegalArgumentException`
- [x] SERIES-041-AC-05: a `year` within bounds is still accepted (regression guard)
