# Spec 059: Incremental Dedup/Output-Filtering for the Backfill Loop

**Status**: Not started
**Priority**: P3 (performance/efficiency fix, no user-visible correctness issue on its own —
distinct from `series_spec_054`'s Requirement 5 correction, which *was* a correctness bug)
**Depends on**: `series_spec_054_recommendation_discover_backfill_pagination.md` (owns
`sourceWithBackfill`, the backfill loop this spec restructures, and the Design Decision this spec
explicitly revises), `series_spec_007_recommendation_sourcing.md` (`RawCandidate`, the four
sourcing strategies), `series_spec_006_recommendations.md` (`RecommendationDeduplicationService`,
`RecommendationOutputFilterService`, the pipeline this spec's accumulator replaces repeated calls
into)
**Backend Task**

## Overview

`series_spec_054` added backfill pagination to three of `RecommendationSourcingService`'s four
sourcing modes, but its own Design Decisions explicitly accepted a known inefficiency as
"a deliberate simplicity-over-efficiency trade-off... revisit only if this proves to actually
matter in practice." It has: while investigating why raising `app.tmdb.max-discover-pages` didn't
proportionally increase recommendation counts (a real bug, already fixed as `series_spec_054`'s own
Requirement 5 correction), a live trace confirmed `sourceWithBackfill`'s stopping check
(`countAfterDedupAndFilter`) re-runs `RecommendationDeduplicationService.dedupeAndExclude` and
`RecommendationOutputFilterService.applyOutputFilters` over the **entire accumulated raw pool** on
every single page fetched — not just the newly-fetched page — purely to get a `.size()` for the
"have I found enough yet?" check, then discards the result. `dedupeAndExclude` calls
`TmdbClient.externalIds` once per raw candidate, so an early page's candidates get re-resolved on
every subsequent page's check. `RecommendationService.doRecommend` then runs dedup/filtering a
*further*, final time over whatever raw list the loop returns. Net effect for a 6-page backfill:
roughly 7 total dedup/filter passes over overlapping data for one request, several of them wholly
redundant.

This spec restructures the loop to dedupe/filter each page's candidates exactly once, accumulating
an already-processed result across pages, and eliminates `doRecommend`'s now-redundant third pass
for the three modes this applies to. `sourceFromPool` ("Use My Series") is explicitly untouched —
see Design Decisions.

## Design Decisions

- **This spec revises, not overrides, `series_spec_054`'s own trade-off.** That spec's reasoning
  ("added complexity for a personal, single-user app where the added TMDB call volume is small and
  bounded... revisit only if this proves to actually matter in practice") wasn't wrong when made —
  single-page sourcing, no backfill, so there was nothing to accumulate across. It just didn't
  anticipate its own later change (backfill across up to `max-discover-pages` pages) making the
  re-derivation cost scale with page count. This spec is the "revisit" that Design Decision itself
  called for.
- **`sourceWithBackfill` maintains a running `List<DedupedCandidate>` accumulator, not a
  `List<RawCandidate>` pool re-processed from scratch each iteration.** Each newly-fetched page's
  raw candidates are deduped/filtered once and merged into the accumulator; the stopping check
  reads the accumulator's own current size directly, with no re-derivation.
- **Cross-page duplicates merge into their existing entry.** The same `tmdbId` can legitimately
  appear on two different fetched pages (TMDB's own discover ordering can shift between page
  requests). When that happens, the new page's occurrence merges its `sourceSeries` into the
  existing `DedupedCandidate` rather than creating a second entry or re-resolving `externalIds` for
  a `tmdbId` already resolved on an earlier page.
- **`sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword` return `List<DedupedCandidate>`
  directly** (a signature change from `List<RawCandidate>`), since the accumulator they build is
  already the fully deduped/filtered result. `RecommendationService.doRecommend` skips its own
  separate `dedupeAndExclude`/`applyOutputFilters` calls for these three modes, using the returned
  list as-is — eliminating the confirmed fully-redundant third pass.
- **`sourceFromPool` ("Use My Series") is explicitly out of scope**, exactly as it was for
  `series_spec_054`'s own backfill mechanism. It doesn't go through `sourceWithBackfill` at all
  today and isn't gaining an accumulator here; `doRecommend` continues running
  `dedupeAndExclude`/`applyOutputFilters` on its result exactly as before this spec. Whoever later
  addresses `.claude/SPEC_CANDIDATES.md`'s open item #10 (pagination for `sourceFromPool`) should
  treat this spec's accumulator shape as available precedent, not assume it already applies there.
- **Per-request `externalIds` memoization, independent of the accumulator redesign.** Even with an
  incremental accumulator, a `tmdbId` could in principle be re-resolved if it's encountered more
  than once within the same page-merge step; a small map keyed by `tmdbId`, scoped to the lifetime
  of a single sourcing call (not cross-request — `RecommendationPoolCache`/`PoolCacheKey`'s
  cross-request cache is a different, larger mechanism and not being adopted here), ensures
  `TmdbClient.externalIds` is called at most once per distinct `tmdbId` per request regardless.

## Requirements

### Requirement 1: Incremental accumulator replaces whole-pool re-dedup/re-filter per page

**User Story**: As the app's operator, I want a multi-page backfill to cost proportionally more
work as pages grow, not to redundantly reprocess every earlier page's candidates on every new page.

#### SERIES-059-AC-01 [AUTO]: only newly-fetched candidates are dedup/filter-processed per page
**Statement**: On each page fetched by `sourceWithBackfill`, only that page's newly-fetched raw
candidates shall be passed through `dedupeAndExclude`/`applyOutputFilters` — not the entire
accumulated pool from every prior page.

**Rationale**: This is the core fix — turns the loop's own cost from ~O(pages²) to O(pages).

**References**: `service/recommendation/RecommendationSourcingService.java` (`sourceWithBackfill`,
`countAfterDedupAndFilter`)

**Test Case (Red)**:
```groovy
def "SERIES-059-AC-01: dedupeAndExclude is called once per page's own candidates, not the whole pool"() {
    given: "a 3-page backfill, 20 raw candidates per page"
        def criteria = new RecommendationCriteria()

    when: "sourceTrending is called with a limit requiring all 3 pages"
        sourcingService.sourceTrending(criteria, 100)

    then: "dedupeAndExclude receives 20 candidates each call, never the growing accumulated total"
        3 * deduplicationService.dedupeAndExclude({ it.size() == 20 }) >> shortDeduped()
}
```
**Test Case (Green)**: restructure `sourceWithBackfill`'s loop body to call
`dedupeAndExclude(newPageCandidates)`/`applyOutputFilters(deduped, criteria)` on just the new page,
then merge into the accumulator.

---

#### SERIES-059-AC-02 [AUTO]: a duplicate `tmdbId` across pages merges rather than duplicates
**Statement**: When a candidate's `tmdbId` appears in more than one fetched page, the accumulator
shall merge the new occurrence's `sourceSeries` into the existing `DedupedCandidate` entry, rather
than creating a second entry or re-invoking `TmdbClient.externalIds` for that `tmdbId`.

**Rationale**: Prevents both incorrect double-counting toward the stopping check and wasted TMDB
calls for an already-resolved candidate.

**Test Case (Red)**:
```groovy
def "SERIES-059-AC-02: a candidate reappearing on page 2 merges into its existing entry"() {
    given: "page 1 and page 2 both include the same tmdbId=42"
        def criteria = new RecommendationCriteria()

    when: "sourceTrending backfills through page 2"
        def result = sourcingService.sourceTrending(criteria, 100)

    then: "tmdbId 42 appears exactly once in the final accumulator, externalIds resolved once"
        result.count { it.candidate().tmdbId() == 42 } == 1
        1 * tmdbClient.externalIds(42)
}
```
**Test Case (Green)**: merge step keyed by `tmdbId`, combining `sourceSeries` lists on a repeat.

---

#### SERIES-059-AC-03 [AUTO]: the stopping check reads the accumulator's own size directly
**Statement**: `sourceWithBackfill`'s "have I found enough yet?" check shall use the running
accumulator's current size directly, with no separate re-derivation call.

**Rationale**: Removes the last piece of redundant work `countAfterDedupAndFilter` performed.

**Test Case (Green)**: covered by `SERIES-059-AC-01`'s test — no call count beyond one
dedupe/filter pass per page implies the stopping check no longer re-derives anything.

---

### Requirement 2: Eliminate the redundant third dedup/filter pass in `doRecommend`

**User Story**: As the app's operator, I don't want a candidate pool already fully deduped and
filtered during sourcing to be silently re-processed a third time before the response is built.

#### SERIES-059-AC-04 [AUTO]: backfill-enabled sourcing methods return the deduped/filtered list directly
**Statement**: `sourceTrending`, `sourceTopRated`, and `sourceByGenreOrKeyword` shall return
`List<DedupedCandidate>` (their own already-accumulated, already deduped/filtered result) instead
of `List<RawCandidate>`.

**Rationale**: Makes the now-redundant downstream pass structurally unnecessary, not just
practically skippable.

**Test Case (Red)**:
```groovy
def "SERIES-059-AC-04: sourceTrending returns DedupedCandidate, not RawCandidate"() {
    when: "sourceTrending is called"
        def result = sourcingService.sourceTrending(new RecommendationCriteria(), 20)

    then: "the returned list's element type is DedupedCandidate"
        result.every { it instanceof DedupedCandidate }
}
```
**Test Case (Green)**: change the three methods' return type; update their internal accumulator to
be the return value directly.

---

#### SERIES-059-AC-05 [AUTO]: `doRecommend` skips its own dedup/filter calls for these three modes
**Statement**: For `sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword` results,
`RecommendationService.doRecommend` shall use the returned `List<DedupedCandidate>` directly,
without calling `dedupeAndExclude`/`applyOutputFilters` again.

**Rationale**: This is the elimination of the confirmed third redundant pass.

**Test Case (Red)**:
```groovy
def "SERIES-059-AC-05: doRecommend does not re-dedup/re-filter trending results"() {
    given: "sourcingService.sourceTrending already returns a deduped/filtered list"
        def deduped = [dedupedCandidate(1), dedupedCandidate(2)]
        sourcingService.sourceTrending(_, _) >> deduped

    when: "recommend is called with trending mode"
        service.recommend(20, trendingCriteria())

    then: "deduplicationService/outputFilterService are never called again for this path"
        0 * deduplicationService.dedupeAndExclude(_)
        0 * outputFilterService.applyOutputFilters(_, _)
}
```
**Test Case (Green)**: remove `doRecommend`'s dedup/filter calls on the branch handling these three
modes, using the sourcing method's return value as-is.

---

#### SERIES-059-AC-06 [AUTO]: `sourceFromPool` is unaffected
**Statement**: When `sourceMode` selects "Use My Series" (`sourceFromPool`), this spec's changes
shall not apply — `sourceFromPool` continues to return its existing type, and `doRecommend`
continues to run `dedupeAndExclude`/`applyOutputFilters` on its result exactly as before this spec.

**Rationale**: Regression guard mirroring `series_spec_054`'s own `SERIES-054-AC-15` — this spec's
scope is strictly the three backfill-enabled modes.

**Test Case (Red)**:
```groovy
def "SERIES-059-AC-06: sourceFromPool still goes through doRecommend's own dedup/filter"() {
    given: "sourceMode selects Use My Series"
        def criteria = useMySeriesCriteria()

    when: "recommend is called"
        service.recommend(20, criteria)

    then: "doRecommend still calls dedup/filter once for this path, unchanged"
        1 * deduplicationService.dedupeAndExclude(_) >> []
        1 * outputFilterService.applyOutputFilters(_, _) >> []
}
```
**Test Case (Green)**: confirmed by leaving `sourceFromPool`'s call path in `doRecommend`
untouched.

---

### Requirement 3: Per-request `externalIds` memoization

**User Story**: As the app's operator, I don't want the same TMDB id resolved more than once within
a single recommendations request.

#### SERIES-059-AC-07 [AUTO]: `externalIds` is called at most once per distinct `tmdbId` per request
**Statement**: Within a single sourcing request, `TmdbClient.externalIds` shall be invoked at most
once per distinct `tmdbId`, memoized for the duration of that request.

**Rationale**: A defensive guarantee independent of the accumulator's own merge logic
(`SERIES-059-AC-02`), covering any path that might otherwise re-resolve an id.

**Test Case (Red)**:
```groovy
def "SERIES-059-AC-07: externalIds is memoized per request"() {
    given: "the same tmdbId appears via two different code paths within one sourcing call"
        def criteria = new RecommendationCriteria()

    when: "sourceTrending runs a multi-page backfill involving tmdbId=99 twice"
        sourcingService.sourceTrending(criteria, 100)

    then: "externalIds(99) is called exactly once"
        1 * tmdbClient.externalIds(99)
}
```
**Test Case (Green)**: a request-scoped `Map<Integer, ExternalIds>` populated on first resolution,
consulted before every subsequent `externalIds` call within the same sourcing invocation.

## Cross-References

| This spec | Source |
|---|---|
| The backfill loop and Design Decision this spec revises | `series_spec_054_recommendation_discover_backfill_pagination.md` |
| `RawCandidate`, the four sourcing strategies | `series_spec_007_recommendation_sourcing.md` |
| `RecommendationDeduplicationService`, `RecommendationOutputFilterService`, `DedupedCandidate` | `series_spec_006_recommendations.md` |
| Precedent shape for a request/call-scoped cache (different scope/lifetime — cross-request) | `series_spec_035_use_my_series_pool_cache.md` (`RecommendationPoolCache`/`PoolCacheKey`) |
| Origin of this candidate | `.claude/SPEC_CANDIDATES.md`, "Incremental dedup/output-filtering for `RecommendationSourcingService`'s backfill loop" |

## Acceptance Criteria Summary

- [ ] SERIES-059-AC-01: only newly-fetched candidates are dedup/filter-processed per page
- [ ] SERIES-059-AC-02: a duplicate `tmdbId` across pages merges rather than duplicates
- [ ] SERIES-059-AC-03: the stopping check reads the accumulator's own size directly
- [ ] SERIES-059-AC-04: backfill-enabled sourcing methods return the deduped/filtered list directly
- [ ] SERIES-059-AC-05: `doRecommend` skips its own dedup/filter calls for these three modes
- [ ] SERIES-059-AC-06: `sourceFromPool` is unaffected
- [ ] SERIES-059-AC-07: `externalIds` is called at most once per distinct `tmdbId` per request
