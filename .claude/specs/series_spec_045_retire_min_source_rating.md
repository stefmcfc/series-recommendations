# Series Spec 045: Retire `minSourceRating`

**Status**: Implemented — `dto/RecommendationCriteria.java`, `service/recommendation/RecommendationSourcingService.java`, `controller/SeriesRecommendationController.java`, `service/recommendation/PoolCacheKey.java`, `service/recommendation/RecommendationCriteriaValidator.java`; tests updated/added in `service/recommendation/RecommendationSourcingServiceSpec.groovy`, `service/recommendation/RecommendationCriteriaValidatorSpec.groovy`, `service/recommendation/RecommendationPoolCacheSpec.groovy`, `controller/SeriesControllerRecommendationsSpec.groovy`
**Priority**: P2 (unblocks the "Use My Series" page restructure — see `frontend_spec_081`)
**Depends on**: none
**Backend Task**

## Overview

`minSourceRating` is the one field in today's recommendation pipeline that genuinely enforces server-side against the source pool (`SERIES-007-AC-19`/`AC-20`) — it can silently exclude even an explicitly hand-picked series (via `seriesIds`) if that series' `personalRating` doesn't meet the threshold. This spec retires the field entirely: the source pool goes back to exactly its pre-`SERIES-007-AC-20` shape (automatic pool = `COMPLETED` series with an `imdbId`; explicit pool = whatever `seriesIds` names), filtered only by `excludeFromRecommendations`, ordered by `SourceOrderComparator`, capped at `maxSourceSeries` — no rating threshold anywhere. This is the first of two spec pairs restructuring "Use My Series" (see the plan discussed with the user 2026-09-03): a personal-rating threshold on the *user's own tracked series* becomes a purely client-side picker-narrowing concern instead (frontend-only, no backend field — see `frontend_spec_080`), so an explicit pick is never silently dropped server-side again.

## Design Decisions

- **Straight removal, no deprecation shim.** This is a personal single-maintainer app with no external API consumers (confirmed: `minSourceRating` isn't documented in `API.md` at all — an existing gap, not something this spec needs to un-document). Matches this codebase's existing precedent of renaming/removing fields outright rather than carrying back-compat aliases.
- **`SERIES-007-AC-20` is retired, not deleted from `series_spec_007`** — per this project's "reference IDs are immutable" rule (`.claude/steering/ears_format.md`), the ID stays in that file's history, annotated as superseded by this spec. `SERIES-007-AC-19` (pool ordering by `personalRating`/`dateCompleted`) is unaffected and stays exactly as-is — only the hard rating *cutoff* goes, not the ordering.
- **`PoolCacheKey` shrinks** from `(seriesIds, minSourceRating, limit)` to `(seriesIds, limit)` — a cache hit/miss decision no longer depends on a field that no longer exists.
- **Scope is backend + the query-param binding on the controller only.** The frontend's "Min Source Rating" UI control removal is a separate, paired frontend spec (`frontend_spec_080`) shipped alongside this one — this spec doesn't touch `RecommendationFiltersBox.tsx`.

## Requirements

### Requirement 1: `minSourceRating` removed from the request contract and source-pool filtering

**User Story**: As a user, I want a series I've explicitly picked to always be used as a recommendation source, never silently dropped because of a rating threshold I set elsewhere.

#### SERIES-045-AC-01 [AUTO]: `RecommendationCriteria` no longer has a `minSourceRating` field
**Statement**: `RecommendationCriteria` shall not expose a `minSourceRating` property (getter/setter removed).

**Rationale**: The field is retired entirely, not just unused.

**References**:
- Type: `backend/src/main/java/uk/co/stefirby/seriestracker/dto/RecommendationCriteria.java` (field + accessors at lines 27, 56-57)

**Test Case (Red)**: compile-time — any remaining reference to `RecommendationCriteria.getMinSourceRating()`/`setMinSourceRating()` anywhere in `src/main` or `src/test` fails the build once the accessors are deleted, which is the intended forcing function for Requirement 2/3's own removals.

**Test Case (Green)**: delete the field and both accessor methods.

#### SERIES-045-AC-02 [AUTO]: automatic pool and explicit pool are no longer filtered by personal rating
**Statement**: `RecommendationSourcingService.resolveSourcePool` shall no longer exclude any series (automatic or explicit `seriesIds`) on the basis of `personalRating` — its filter chain reduces to `excludeFromRecommendations` only, followed by `SourceOrderComparator` ordering and the `maxSourceSeries` cap.

**Rationale**: Core behavior change — this is what stops an explicit pick from being silently dropped, and reverts automatic mode to its pre-threshold shape.

**References**:
- Service: `RecommendationSourcingService.resolveSourcePool` (lines 193-205, loses the `.filter(e -> c.getMinSourceRating() == null || ...)` line at 200-201)
- Supersedes: `SERIES-007-AC-20` (`series_spec_007_recommendation_sourcing.md`)

**Test Case (Red)**:
```groovy
def "SERIES-045-AC-02: a low-rated series is no longer excluded from the automatic pool"() {
    given: "a COMPLETED series with a low personalRating and an imdbId"
        def series = seriesRepository.save(new SeriesEntity(
            title: "Low Rated Show", status: SeriesStatus.COMPLETED,
            imdbId: "tt0000001", personalRating: 1))

    when: "recommendations are sourced with no seriesIds (automatic mode)"
        def criteria = new RecommendationCriteria()
        def pool = sourcingService.resolveSourcePoolForTest(criteria) // or equivalent test seam

    then: "the low-rated series is still part of the pool"
        pool*.id.contains(series.id)
}

def "SERIES-045-AC-02: an explicitly-selected low-rated series is never dropped"() {
    given: "a low-rated series explicitly named in seriesIds"
        def series = seriesRepository.save(new SeriesEntity(
            title: "Low Rated Show", personalRating: 1, imdbId: "tt0000002"))
        def criteria = new RecommendationCriteria(seriesIds: [series.id.toString()])

    when: "the source pool is resolved"
        def pool = sourcingService.resolveSourcePoolForTest(criteria)

    then: "the series is present regardless of its rating"
        pool*.id == [series.id]
}
```

**Test Case (Green)**: remove the `minSourceRating` filter predicate from `resolveSourcePool`.

#### SERIES-045-AC-03 [AUTO]: `minSourceRating` accepted (and ignored) on the wire, not rejected
**Statement**: If a `minSourceRating` query parameter is present on `GET /api/v1/series/recommendations`, then `SeriesRecommendationController` shall ignore it (no `@RequestParam` binding exists for it) rather than rejecting the request.

**Rationale**: Regression guard — an old bookmarked URL or stale frontend build sending the now-unknown param must not start 400ing; Spring's default behavior for an undeclared query param is to silently ignore it, which this AC pins down explicitly.

**References**:
- Controller: `SeriesRecommendationController.recommendations` (parameter list, line 35; assignment, line 56 — both removed)

**Test Case (Red)**:
```groovy
def "SERIES-045-AC-03: minSourceRating on the query string is silently ignored, not rejected"() {
    when: "a request includes an unrecognized minSourceRating param"
        def response = client.get().uri("/api/v1/series/recommendations?minSourceRating=3").exchange()

    then: "the request still succeeds (200), not 400"
        response.expectStatus().isOk()
}
```

**Test Case (Green)**: remove the `minSourceRating` `@RequestParam` and its assignment into `criteria`.

#### SERIES-045-AC-04 [AUTO]: `PoolCacheKey` drops `minSourceRating`
**Statement**: `PoolCacheKey` shall be constructed from `(seriesIds, limit)` only.

**Rationale**: A cache key referencing a retired field would be dead weight and could mask a stale-cache bug if ever re-added carelessly.

**References**:
- Type: `backend/src/main/java/uk/co/stefirby/seriestracker/service/recommendation/PoolCacheKey.java` (record declaration, line 20)
- Call site: `RecommendationSourcingService` (line 171, `new PoolCacheKey(seriesIds, c.getMinSourceRating(), limit)`)

**Test Case (Red)**:
```groovy
def "SERIES-045-AC-04: PoolCacheKey has no minSourceRating component"() {
    expect: "the record's canonical constructor takes exactly seriesIds and limit"
        PoolCacheKey.class.getRecordComponents()*.name as Set == ["seriesIds", "limit"] as Set
}
```

**Test Case (Green)**: change `PoolCacheKey` to `record PoolCacheKey(List<UUID> seriesIds, int limit)`, update the one call site.

#### SERIES-045-AC-05 [AUTO]: no range validation remains for `minSourceRating`
**Statement**: `RecommendationCriteriaValidator` shall no longer validate a `minSourceRating` range (the `validateMinSourceRating` method and its call are removed).

**Rationale**: Dead validation code for a field that no longer exists.

**References**:
- Validator: `RecommendationCriteriaValidator.validate` (call at line 39), `validateMinSourceRating` (lines 81-85)

**Test Case (Red)**: compile-time — removing `RecommendationCriteria.getMinSourceRating()` (AC-01) makes `validateMinSourceRating`'s body fail to compile unless it's deleted; no separate runtime test needed beyond AC-03's "not rejected" coverage.

**Test Case (Green)**: delete `validateMinSourceRating` and its call site.

## Cross-References

| Concept | Location |
|---|---|
| Original `minSourceRating` behavior (now superseded) | `series_spec_007_recommendation_sourcing.md`, `SERIES-007-AC-19`/`AC-20` |
| Pool ordering, unaffected by this spec | `SourceOrderComparator.java`, `SERIES-007-AC-19` |
| `excludeFromRecommendations`, unaffected by this spec | `series_spec_034_exclude_from_recommendations_enforcement.md` |
| Paired frontend removal | `frontend_spec_080_remove_min_source_rating_ui.md` |
| Follow-on page restructure this unblocks | `frontend_spec_081_use_my_series_page_restructure.md` (not yet written) |

## Acceptance Criteria Summary

- [x] SERIES-045-AC-01: `RecommendationCriteria` no longer has a `minSourceRating` field
- [x] SERIES-045-AC-02: automatic pool and explicit pool are no longer filtered by personal rating
- [x] SERIES-045-AC-03: `minSourceRating` accepted (and ignored) on the wire, not rejected
- [x] SERIES-045-AC-04: `PoolCacheKey` drops `minSourceRating`
- [x] SERIES-045-AC-05: no range validation remains for `minSourceRating`
