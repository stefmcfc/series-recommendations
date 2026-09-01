# Series Spec 034: Enforce `excludeFromRecommendations` for Explicit Series Selection

**Status**: Implemented (2026-09-01) — `service/recommendation/RecommendationSourcingService.java` (`resolveSourcePool`/`automaticPool`), `test/groovy/uk/co/stefirby/seriestracker/service/recommendation/RecommendationSourcingServiceSpec.groovy`. Frontend follow-up is `frontend_spec_050`, not yet done.
**Priority**: P2 (product decision reversal — a "don't use this for recommendations" flag that can be silently bypassed by hand-picking the series undermines the point of the flag)
**Depends on**: Series Spec 007 (`series_spec_007_recommendation_sourcing.md`, owns `resolveSourcePool`/`explicitPool`/`automaticPool`) ✅, Series Spec 008 (`series_spec_008_series_lifecycle_data.md`, owns the flag itself and the `SERIES-008-AC-05` decision this spec reverses) ✅
**Area**: Backend (`service/RecommendationSourcingService.java`) — paired with Frontend Spec 050 (`frontend_spec_050_exclude_from_recommendations_ui.md`), which stops the "Use My Series" Specific Series picker from ever offering an excluded series as a selectable option in the first place.

## Overview

`series_spec_008` deliberately designed `excludeFromRecommendations` to suppress only *automatic*
watched-pool sourcing, explicitly allowing an explicit `seriesIds` selection to bypass it
(`SERIES-008-AC-05`) — the stated reasoning: "naming a series explicitly in a single request is a
much stronger, one-off statement of intent that should win over a standing preference." Confirmed
live in `RecommendationSourcingService.resolveSourcePool`/`explicitPool`/`automaticPool`
(2026-08-29): this is exactly how the code behaves today, and it's covered by an existing Spock
test (`RecommendationSourcingServiceSpec.groovy`, `"SERIES-008-AC-05: an explicit seriesIds
selection is not filtered by excludeFromRecommendations"`) — a deliberate, tested design, not a
bug.

**Decided in discussion (2026-08-29)**: that reasoning no longer holds. A user marking a series
"exclude from recommendations" expects that to be an absolute rule, not a preference that can be
silently overridden by hand-picking it in the Specific Series picker. This spec makes the flag
apply uniformly — an excluded series is never used as a recommendation source, whether sourced
automatically or picked explicitly.

## Design Decisions

- **The filter moves into `resolveSourcePool`'s shared predicate**, applied identically after
  either `explicitPool` or `automaticPool` resolves the raw pool, rather than being duplicated
  separately inside both. `automaticPool`'s own inline `!e.isExcludeFromRecommendations()` check
  becomes redundant and is removed — the shared filter in `resolveSourcePool` becomes the single
  place this rule lives.
- **Excluded ids are silently dropped, not rejected as an error.** Mirrors `automaticPool`'s
  existing posture (ineligible series — wrong status, missing `imdbId` — are quietly omitted, never
  an error) rather than `explicitPool`'s separate "unknown id" validation (`SERIES-007-AC-09`),
  which is a different failure mode (the id doesn't exist at all) and is unaffected by this change.
  If every requested id turns out to be excluded, the pool is simply empty and `sourceFromPool`'s
  existing empty-pool short-circuit applies — no new empty-pool handling needed.
- **Scope is limited to `explicitPool`/`resolveSourcePool`.** `trending`, `topRated`, and Custom
  Search (`sourceByGenreOrKeyword`) don't source from the user's own tracked series at all, so the
  flag has never applied to them and continues not to — this spec doesn't touch those paths.
- **This reverses `SERIES-008-AC-05`.** Per this project's ID-immutability convention, that AC's ID
  and statement are preserved verbatim in `series_spec_008.md`, marked superseded with a pointer to
  this spec's `SERIES-034-AC-01`, rather than rewritten or deleted (see Implementation Notes).

---

## Requirement 1: `excludeFromRecommendations` applies uniformly to every source pool

**User story**: As a user, I want a series I've marked "exclude from recommendations" to never be
used as a recommendation source, whether that's through the automatic pool or by hand-picking it in
the Specific Series picker — the flag should mean what it says.

### SERIES-034-AC-01 [AUTO]
**Statement**: `RecommendationSourcingService.resolveSourcePool` shall exclude any series with
`excludeFromRecommendations == true` from the resolved pool, regardless of whether the pool came
from `explicitPool(seriesIds)` or `automaticPool()`.

**References**: `RecommendationSourcingService.resolveSourcePool`/`explicitPool`/`automaticPool`.
Reverses `SERIES-008-AC-05` (`series_spec_008_series_lifecycle_data.md`).

**Test Case (Red)**:
```groovy
def "SERIES-034-AC-01: an explicit seriesIds selection IS filtered by excludeFromRecommendations"() {
    given: "a COMPLETED series with excludeFromRecommendations=true"
        def excluded = completedSeries("Excluded Show", "tt3333333", LocalDateTime.now())
        excluded.excludeFromRecommendations = true
        excluded.id = UUID.randomUUID()
        seriesRepository.findAllById([excluded.id]) >> [excluded]

    and: "criteria explicitly selects that series"
        def criteria = new RecommendationCriteria(seriesIds: [excluded.id.toString()])

    when: "sourceFromPool is called"
        def result = sourcingService.sourceFromPool(criteria, 20)

    then: "the excluded series is NOT consulted, and the pool is empty"
        0 * tmdbClient.findTvIdByImdbId("tt3333333")
        result.isEmpty()
}
```
**Test Case (Green)**: move the `!e.isExcludeFromRecommendations()` predicate from
`automaticPool`'s stream filter into `resolveSourcePool`'s shared `pool.stream().filter(...)`
chain (alongside the existing `minSourceRating` check), so it applies after either
pool-resolution branch.

**Implementation note**: this replaces the existing `RecommendationSourcingServiceSpec.groovy`
test `"SERIES-008-AC-05: an explicit seriesIds selection is not filtered by
excludeFromRecommendations"` — that test asserts the exact opposite of this AC and must be
rewritten (not left alongside this one) as part of the same change. See Implementation Notes.

---

### SERIES-034-AC-02 [AUTO]
**Statement**: When an explicit `seriesIds` selection consists entirely of excluded series,
`resolveSourcePool` shall return an empty pool, and `sourceFromPool` shall return an empty
candidate list without error (reusing its existing empty-pool short-circuit) — not an
`IllegalArgumentException`.

**Test Case (Red)**:
```groovy
def "SERIES-034-AC-02: an all-excluded seriesIds selection yields an empty pool, not an error"() {
    given: "two excluded COMPLETED series"
        def a = completedSeries("A", "tt1111111", LocalDateTime.now())
        a.excludeFromRecommendations = true
        a.id = UUID.randomUUID()
        def b = completedSeries("B", "tt2222222", LocalDateTime.now())
        b.excludeFromRecommendations = true
        b.id = UUID.randomUUID()
        seriesRepository.findAllById([a.id, b.id]) >> [a, b]
        def criteria = new RecommendationCriteria(seriesIds: [a.id.toString(), b.id.toString()])

    when: "sourceFromPool is called"
        def result = sourcingService.sourceFromPool(criteria, 20)

    then: "no exception is thrown and the result is empty"
        result.isEmpty()
        0 * tmdbClient.findTvIdByImdbId(_)
}
```
**Test Case (Green)**: falls out of AC-01's fix directly — `sourceFromPool`'s existing `if
(pool.isEmpty())` short-circuit (unchanged) already handles this once the pool is correctly
filtered down to nothing.

---

### SERIES-034-AC-03 [AUTO]
**Statement**: A `seriesIds` selection that mixes excluded and non-excluded ids shall silently
drop only the excluded ones — the non-excluded ids are still used as sources.

**Test Case (Red)**:
```groovy
def "SERIES-034-AC-03: a mixed seriesIds selection sources only the non-excluded series"() {
    given: "one excluded and one eligible COMPLETED series, both explicitly selected"
        def excluded = completedSeries("Excluded", "tt1111111", LocalDateTime.now())
        excluded.excludeFromRecommendations = true
        excluded.id = UUID.randomUUID()
        def eligible = completedSeries("Eligible", "tt2222222", LocalDateTime.now())
        eligible.id = UUID.randomUUID()
        seriesRepository.findAllById([excluded.id, eligible.id]) >> [excluded, eligible]
        def criteria = new RecommendationCriteria(seriesIds: [excluded.id.toString(), eligible.id.toString()])

    when: "sourceFromPool is called"
        sourcingService.sourceFromPool(criteria, 20)

    then: "only the eligible series is consulted"
        0 * tmdbClient.findTvIdByImdbId("tt1111111")
        1 * tmdbClient.findTvIdByImdbId("tt2222222") >> Optional.empty()
}
```
**Test Case (Green)**: same shared filter as AC-01 — no additional logic beyond it.

---

### SERIES-034-AC-04 [AUTO] (regression guard)
**Statement**: `explicitPool`'s existing behavior of throwing `IllegalArgumentException` for a
`seriesIds` entry that doesn't match any existing `SeriesEntity` at all (`SERIES-007-AC-09`) shall
be unaffected by this spec — only ids that exist but are excluded are silently dropped
(AC-01/AC-03); ids that don't exist continue to error.

**Test Case (Green)**: no code change — regression guard mirroring the existing `"SERIES-007-AC-09:
an unknown series id in seriesIds is rejected"` test, confirmed to still pass unmodified since
`explicitPool`'s own existence check runs before `resolveSourcePool`'s new exclusion filter, and
this spec doesn't touch that check.

---

## Implementation Notes

- **`series_spec_008_series_lifecycle_data.md` needs a matching edit**, not just this new spec:
  mark `SERIES-008-AC-05` superseded (`~~**SERIES-008-AC-05** [AUTO]~~ — superseded by
  `SERIES-034-AC-01`: <original statement unchanged>`), update its Acceptance Criteria Summary
  checklist line, and append a dated note to its Design Decisions bullet pointing here — per this
  project's ID-immutability convention (`.claude/steering/ears_format.md`), the original AC text is
  never reworded or deleted.
- **`RecommendationSourcingServiceSpec.groovy`'s existing `"SERIES-008-AC-05: ..."` test must be
  rewritten**, not left in place alongside the new `SERIES-034-AC-01` test — it currently asserts
  the exact behavior this spec reverses.
- **`API.md`** should note that `seriesIds` entries referencing an excluded series are now silently
  dropped from the effective source pool rather than being honored — a behavior change worth
  documenting explicitly, the same way `series_spec_033`'s Implementation Notes flagged its own
  routing change.
- Javadoc on `automaticPool()` currently explains the "applies here, not in `explicitPool`" split —
  needs rewriting once the filter moves to `resolveSourcePool`, since that explanation becomes
  inaccurate.

## Cross-References

| This spec | Source |
|---|---|
| `resolveSourcePool`/`explicitPool`/`automaticPool`, the methods this spec changes | `series_spec_007_recommendation_sourcing.md` Requirements 4/6 |
| The flag and the original `SERIES-008-AC-05` decision this spec reverses | `series_spec_008_series_lifecycle_data.md` Requirement 1 |
| Paired frontend change — Specific Series picker stops offering excluded series at all | `frontend_spec_050_exclude_from_recommendations_ui.md` |
| Existing "unknown id" validation this spec leaves unchanged | `series_spec_007_recommendation_sourcing.md` (`SERIES-007-AC-09`) |

---

## Acceptance Criteria Summary

- [x] SERIES-034-AC-01: `excludeFromRecommendations` filters the pool regardless of explicit vs. automatic resolution
- [x] SERIES-034-AC-02: an all-excluded explicit selection yields an empty pool, not an error
- [x] SERIES-034-AC-03: a mixed selection sources only the non-excluded series
- [x] SERIES-034-AC-04: unknown-id validation (`SERIES-007-AC-09`) is unaffected
