# Series Spec 033: "Use My Series" Sourcing Requires an Explicit Signal — No More Silent Fallback

**Status**: Implemented (2026-08-28) -- `backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationDefaults.java`,
`backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationCriteriaValidator.java`,
`backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationService.java`,
`backend/src/main/java/uk/co/stefirby/seriestracker/dto/RecommendationCriteria.java` (javadoc only),
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/RecommendationCriteriaValidatorSpec.groovy`,
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/RecommendationServiceSpec.groovy`,
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/RecommendationSourcingServiceSpec.groovy`.
Frontend half (`frontend_spec_049`) implemented in the same PR/branch, per this spec's own deployment note --
see that spec for the paired frontend change.
**Priority**: P2 (correctness fix — confirmed live: a Custom Search request with only `minTmdbRating` set
silently returns "Use My Series" pool-based candidates instead of a real TMDB discover query, bypassing
`series_spec_031`'s pre-fetch filtering entirely)
**Depends on**: Series Spec 007 (`series_spec_007_recommendation_sourcing.md`, owns the pool-based sourcing this
spec stops silently defaulting to) ✅. Series Spec 022 (`series_spec_022_trending_and_top_rated_recommendations.md`,
established the `sourceMode` field this spec extends with a third value) ✅. Series Spec 031
(`series_spec_031_custom_search_prefetch_filters.md`, the exact spec whose pre-fetch filtering this bug was
silently bypassing) ✅.
**Area**: Backend (`dto/RecommendationCriteria.java`, `service/RecommendationCriteriaValidator.java`,
`service/RecommendationService.java`) — paired with Frontend Spec 049
(`frontend_spec_049_use_my_series_explicit_mode.md`) for the request-building change.

## Overview

Confirmed live during `series_spec_031`'s review (2026-08-28): requesting recommendations with only
`minTmdbRating` set (no `genres`/`keywords`) returns candidates with `sourceTitles`/`totalSourceCount`
populated — i.e. **"Use My Series" pool-based sourcing**, not Custom Search's TMDB `discover/tv` call. Root
cause: `RecommendationService.doRecommend` currently decides "Use My Series" (`sourceFromPool`) by
**elimination** — it's whatever's left when the request isn't `trending`/`topRated`/genre-or-keyword-directed.
There has never been an explicit signal for "this is a Use My Series request" at all; the backend infers it from
absence. Setting a Custom Search field TMDB doesn't consider "directing" (rating, year) is indistinguishable
from an empty request, so it falls through to the same default as truly-empty input.

**Decided in discussion**: "Use My Series" pool sourcing should only ever run when explicitly requested.
Everything else — including a request with literally nothing set — should go to Custom Search's `discover/tv`
call instead, which handles an unfiltered query perfectly well (TMDB's own "most popular overall," driven by
whatever `sort_by` applies). Custom Search stops being "the mode you reach by having genre/keyword criteria" and
becomes the actual default/fallback path; "Use My Series" becomes the one mode requiring an explicit signal.

## Design Decisions

- **`sourceMode` gains a third value: `"useMySeries"`**, sent only when that tab is active (paired frontend
  spec). Reuses the existing `sourceMode` field/enum shape from `series_spec_022` rather than introducing a
  second concept — `RecommendationDefaults` gains a `SOURCE_MODE_USE_MY_SERIES = "useMySeries"` constant
  alongside the existing `SOURCE_MODE_TOP_RATED`.
- **`seriesIds` being non-empty is *also* sufficient to trigger "Use My Series" sourcing**, independent of
  whether `sourceMode=useMySeries` was also sent. `seriesIds` has no meaning outside "Use My Series" context —
  requiring the explicit `sourceMode` value in addition would be a pure footgun for any direct API caller
  (`curl`, a future consumer) that sets `seriesIds` without also remembering the new field. The frontend always
  sends both together regardless (paired spec), so this is a robustness floor, not the primary mechanism.
- **Custom Search (`sourceByGenreOrKeyword`) becomes the new default/fallback branch** — reached whenever the
  request is neither `trending`, `topRated`, nor "Use My Series" (`sourceMode=useMySeries` or `seriesIds` set).
  It no longer requires `genres`/`keywords` to be present; `TmdbClient.discover()` already omits
  `with_genres`/`with_keywords` when their lists are empty (existing behavior, confirmed unchanged), so an
  entirely empty Custom Search request naturally becomes an unfiltered `discover/tv` call — no new handling
  needed there, only the routing decision changes.
- **`RecommendationCriteria.isDirectedByGenreOrKeyword()` keeps its exact existing meaning** ("genres or
  keywords is non-empty") and stays in use for validation (rejecting it combined with `seriesIds`, or with
  `trending`/`topRated`) — it's just no longer the signal `RecommendationService` uses to decide routing. Not
  renamed; still accurate for what it actually checks.
- **Validation**: `sourceMode=useMySeries` combined with `genres`/`keywords` is rejected (mutually exclusive,
  same as `trending`/`topRated`'s existing rule) — but combined with `seriesIds` is explicitly **allowed** (the
  intended "narrow within Use My Series" case, `frontend_spec_042`'s merged picker).
- **Deployment note — this pair must ship together, not sequentially like most others.** Every other paired
  spec this project has shipped could land backend-first harmlessly (frontend catches up later, wire contract
  additive). This one is different: once the backend treats "no explicit signal" as Custom Search instead of
  Use My Series, an *old* frontend that never sends `sourceMode=useMySeries` would have its default "Use My
  Series" view silently start returning Custom Search's unfiltered discover results instead of pool-based
  recommendations — a real regression for anyone between the two deploys. Land both halves in the same
  branch/PR, as `series_spec_031`/`frontend_spec_046` did.

---

## Requirement 1: `sourceMode` accepts and validates `"useMySeries"`

**User story**: As a developer, I want an explicit way to say "this request is Use My Series," instead of the
backend inferring it from what's missing.

### SERIES-033-AC-01 [AUTO]
**Statement**: `RecommendationCriteriaValidator.validateSourceMode` shall accept `"useMySeries"` as a valid
`sourceMode` value, alongside the existing `"trending"`/`"topRated"`.

**References**: `RecommendationDefaults.SOURCE_MODE_TOP_RATED`, new `SOURCE_MODE_USE_MY_SERIES` constant.

**Test Case (Red)**:
```groovy
def "SERIES-033-AC-01: sourceMode=useMySeries is accepted"() {
    expect: "no exception"
        validator.validate(new RecommendationCriteria(sourceMode: "useMySeries"))
}
```
**Test Case (Green)**: add `SOURCE_MODE_USE_MY_SERIES` to `RecommendationDefaults`; extend
`validateSourceMode`'s accepted-values check.

---

### SERIES-033-AC-02 [AUTO]
**Statement**: `sourceMode=useMySeries` combined with `genres`/`keywords` shall be rejected with an
`IllegalArgumentException` (400) — mutually exclusive, same rule `trending`/`topRated` already enforce.

**Test Case (Red)**:
```groovy
def "SERIES-033-AC-02: sourceMode=useMySeries combined with genres is rejected"() {
    given: "criteria sets both sourceMode=useMySeries and genres"
        def criteria = new RecommendationCriteria(sourceMode: "useMySeries", genres: ["Drama"])

    when: "validate is called"
        validator.validate(criteria)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
}
```
**Test Case (Green)**: extend `validateMutuallyExclusiveModes` with a `useMySeries`-vs-genre/keyword check.

---

### SERIES-033-AC-03 [AUTO]
**Statement**: `sourceMode=useMySeries` combined with `seriesIds` shall be **allowed** — explicitly not
rejected, unlike the `trending`/`topRated` + `seriesIds` combination.

**References**: `frontend_spec_042`'s merged "Use My Series" picker — this is the exact combination it
produces whenever a user narrows to specific series.

**Test Case (Red)**:
```groovy
def "SERIES-033-AC-03: sourceMode=useMySeries combined with seriesIds is allowed"() {
    given: "criteria sets both sourceMode=useMySeries and seriesIds"
        def criteria = new RecommendationCriteria(sourceMode: "useMySeries", seriesIds: [UUID.randomUUID().toString()])

    expect: "no exception"
        validator.validate(criteria)
}
```
**Test Case (Green)**: `validateMutuallyExclusiveModes`'s new `useMySeries` check only looks at
`hasGenreOrKeyword`, not `hasSeriesIds` — confirmed by this AC as a regression guard against over-broadening the
rejection.

---

## Requirement 2: Routing — "Use My Series" only runs on an explicit signal

**User story**: As a user, I want Custom Search to always mean Custom Search, regardless of which of its
fields I've filled in — never silently substitute my own watch history instead.

### SERIES-033-AC-04 [AUTO]
**Statement**: A request with `sourceMode=useMySeries` (no `seriesIds`) shall route to `sourceFromPool`
(automatic pool sourcing).

**References**: `RecommendationService.doRecommend`'s branch-selection logic.

**Test Case (Red)**:
```groovy
def "SERIES-033-AC-04: sourceMode=useMySeries routes to pool-based sourcing"() {
    given: "criteria with sourceMode=useMySeries, no seriesIds"
        def criteria = new RecommendationCriteria(sourceMode: "useMySeries")

    when: "recommend is called"
        service.recommend(20, criteria)

    then: "sourceFromPool sourcing ran (not sourceByGenreOrKeyword)"
        1 * sourcingService.sourceFromPool(criteria, 20) >> []
        0 * sourcingService.sourceByGenreOrKeyword(_)
}
```
**Test Case (Green)**: add a `useMySeriesMode` boolean (`"useMySeries".equals(criteria.getSourceMode()) ||
hasSeriesIds`) to `doRecommend`'s branch selection, checked before falling through to Custom Search.

---

### SERIES-033-AC-05 [AUTO]
**Statement**: A request with `seriesIds` set (regardless of whether `sourceMode=useMySeries` was also sent)
shall route to `sourceFromPool`.

**Test Case (Red)**:
```groovy
def "SERIES-033-AC-05: seriesIds alone routes to pool-based sourcing"() {
    given: "criteria with seriesIds, no explicit sourceMode"
        def criteria = new RecommendationCriteria(seriesIds: [UUID.randomUUID().toString()])

    when: "recommend is called"
        service.recommend(20, criteria)

    then: "sourceFromPool sourcing ran"
        1 * sourcingService.sourceFromPool(criteria, 20) >> []
        0 * sourcingService.sourceByGenreOrKeyword(_)
}
```
**Test Case (Green)**: `useMySeriesMode`'s `hasSeriesIds` half of the `||` — a robustness floor independent of
the explicit `sourceMode` value.

---

### SERIES-033-AC-06 [AUTO]
**Statement**: A request with none of `sourceMode` (`useMySeries`/`trending`/`topRated`), `seriesIds`,
`genres`, or `keywords` set — a genuinely empty/ambiguous request — shall route to `sourceByGenreOrKeyword`
(Custom Search's unfiltered `discover/tv` call), **not** `sourceFromPool`. This is the core behavior this spec
changes.

**Test Case (Red)**:
```groovy
def "SERIES-033-AC-06: a fully empty request routes to Custom Search, not the automatic pool"() {
    given: "criteria with nothing set at all"
        def criteria = new RecommendationCriteria()

    when: "recommend is called"
        service.recommend(20, criteria)

    then: "sourceByGenreOrKeyword sourcing ran, not sourceFromPool"
        1 * sourcingService.sourceByGenreOrKeyword(criteria) >> []
        0 * sourcingService.sourceFromPool(_, _)
}
```
**Test Case (Green)**: `doRecommend`'s final `else` branch changes from `sourceFromPool` to
`sourceByGenreOrKeyword` — this is the actual fix.

---

### SERIES-033-AC-07 [AUTO]
**Statement**: A request with only `minTmdbRating`/`yearMin`/`yearMax` set (no `genres`/`keywords`, no
explicit `sourceMode`) shall route to `sourceByGenreOrKeyword`, and those filters shall be applied pre-fetch —
directly fixing the scenario confirmed live during `series_spec_031`'s review.

**Test Case (Red)**:
```groovy
def "SERIES-033-AC-07: minTmdbRating alone routes to Custom Search with pre-fetch filtering"() {
    given: "criteria with only minTmdbRating set"
        def criteria = new RecommendationCriteria(minTmdbRating: new BigDecimal("8.0"))

    when: "recommend is called"
        service.recommend(20, criteria)

    then: "sourceByGenreOrKeyword ran (which itself sends vote_average.gte -- series_spec_031-AC-01/05)"
        1 * sourcingService.sourceByGenreOrKeyword(criteria) >> []
        0 * sourcingService.sourceFromPool(_, _)
}
```
**Test Case (Green)**: falls out of AC-06's routing fix directly — no additional logic needed, since
`sourceByGenreOrKeyword` already reads `minTmdbRating` (`series_spec_031`) regardless of whether genres/keywords
are present.

---

### SERIES-033-AC-08 [AUTO]
**Statement**: `trending`/`topRated` routing shall be unaffected by this spec.

**Test Case (Green)**: no change to those branches — regression guard, mirrors the existing
`RecommendationServiceSpec` coverage for both modes continuing to pass unmodified.

---

## Requirement 3: Custom Search handles a genuinely empty query correctly

### SERIES-033-AC-09 [AUTO]
**Statement**: `sourceByGenreOrKeyword` called with empty `genres`/`keywords` (and no `minTmdbRating`/
`yearMin`/`yearMax`) shall call `TmdbClient.discover()` with no `with_genres`/`with_keywords`/`vote_average.gte`/
`air_date.gte`/`.lte` params — an unfiltered `discover/tv` call, sorted by the resolved `sort_by` (defaulting to
`popularity.desc`).

**References**: `TmdbClient.discover()`'s existing omit-when-empty/unset behavior for every param — this AC
confirms it, doesn't change it.

**Test Case (Red)**:
```groovy
def "SERIES-033-AC-09: an empty Custom Search request produces an unfiltered discover/tv call"() {
    given: "criteria with nothing set"
        def criteria = new RecommendationCriteria()

    when: "sourceByGenreOrKeyword runs"
        sourcingService.sourceByGenreOrKeyword(criteria)

    then: "discover was called with empty genre/keyword lists and DiscoverFilters carrying only the sourcing-time minVoteCount default"
        1 * tmdbClient.discover([], [], "popularity.desc", { DiscoverFilters f ->
            f.minTmdbRating() == null && f.yearMin() == null && f.yearMax() == null
        }) >> []
}
```
**Test Case (Green)**: no code change needed — confirms existing behavior already handles this correctly once
AC-06's routing fix is in place.

---

## Implementation Notes

- **`API.md` needs updating** (Definition of Done) — document the new `sourceMode=useMySeries` value, that
  it's mutually exclusive with `genres`/`keywords` but compatible with `seriesIds`, and that omitting
  `sourceMode`/`seriesIds`/`genres`/`keywords` entirely now routes to Custom Search's unfiltered discover query
  rather than the automatic pool (a behavior change from before this spec — worth flagging explicitly).
- **`RecommendationCriteria.sourceMode`'s javadoc** needs updating — currently says "a third directed-sourcing
  mode alongside `seriesIds`/`genres`/`keywords`, mutually exclusive with all three" — no longer accurate now
  that a fourth value (`useMySeries`) is deliberately *compatible* with `seriesIds`.
- Consider (optional, not required for this spec): renaming `sourceByGenreOrKeyword`/its related comments to
  reflect that it's now the Custom Search default path, not strictly "by genre or keyword" — a clarity
  improvement, not a correctness requirement, since the method's actual behavior needs no change beyond the
  routing decision made by its caller.

## Cross-References

| This spec | Source |
|---|---|
| Pool-based sourcing this spec stops silently defaulting to | `series_spec_007_recommendation_sourcing.md` |
| `sourceMode` field this spec adds a third value to | `series_spec_022_trending_and_top_rated_recommendations.md` |
| The exact bug confirmed live — pre-fetch filtering bypassed by the silent fallback | `series_spec_031_custom_search_prefetch_filters.md` |
| "Use My Series" merged mode / `seriesIds` narrowing this spec's `useMySeries` value represents | `frontend_spec_042_recommendation_source_mode_reorganization.md` |
| Frontend request-building change (always sending `sourceMode=useMySeries`) | `frontend_spec_049_use_my_series_explicit_mode.md` |

---

## Acceptance Criteria Summary

- [x] SERIES-033-AC-01: `sourceMode=useMySeries` is accepted
- [x] SERIES-033-AC-02: `useMySeries` combined with genres/keywords is rejected
- [x] SERIES-033-AC-03: `useMySeries` combined with `seriesIds` is allowed
- [x] SERIES-033-AC-04: `sourceMode=useMySeries` routes to pool-based sourcing
- [x] SERIES-033-AC-05: `seriesIds` alone routes to pool-based sourcing
- [x] SERIES-033-AC-06: a fully empty request routes to Custom Search, not the automatic pool
- [x] SERIES-033-AC-07: `minTmdbRating` alone routes to Custom Search with pre-fetch filtering
- [x] SERIES-033-AC-08: `trending`/`topRated` routing unaffected
- [x] SERIES-033-AC-09: an empty Custom Search request produces an unfiltered `discover/tv` call
