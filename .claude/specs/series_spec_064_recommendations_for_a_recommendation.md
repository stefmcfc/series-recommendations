# Series Spec 064: Recommendations for a Recommendation

**Status**: Not started
**Priority**: P3 (extends an already-shipped discovery feature to one more entry point; not core CRUD, no data-correctness risk)
**Depends on**: `series_spec_006_recommendations.md` / `series_spec_007_recommendation_sourcing.md` (the sourcing/dedup/output-filter pipeline this spec plugs a fourth source mode into), `series_spec_033_use_my_series_explicit_mode.md` (established the explicit `sourceMode` discriminator pattern this spec's `"candidate"` value follows), `series_spec_059_incremental_backfill_dedup.md` (the `dedupeAndExclude`/`applyOutputFilters` pipeline this spec's new sourcing method reuses)
**Area**: Backend (`dto/RecommendationCriteria.java`, `service/recommendation/RecommendationDefaults.java`, `service/recommendation/RecommendationCriteriaValidator.java`, `service/recommendation/RecommendationSourcingService.java`, `service/recommendation/RecommendationService.java`, `controller/SeriesRecommendationController.java`)

## Overview

`GET /api/v1/series/recommendations` already sources candidates four ways: `trending`, `topRated`, genre/keyword-directed ("Custom Search"), and `useMySeries` (the automatic/explicit watched pool). All four source from either TMDB's own charts or the user's *tracked* series. This spec adds a fifth, `sourceMode="candidate"`: TMDB "recommendations"/"similar" sourcing seeded by a single **untracked** TMDB show — a recommendation candidate the user is currently looking at, identified only by its `tmdbId` (it has no `SeriesEntity`/UUID, since it was never added). This lets a user drill from "here's a show you might like" into "show me shows like *that* show" without first adding it to their list.

## Design Decisions

- **A new `sourceTmdbId` field, not a reuse of `seriesIds`.** `seriesIds` is `List<String>` of UUIDs resolved against `SeriesRepository` (`RecommendationSourcingService.explicitPool`) — an untracked candidate has no UUID to put there. `sourceTmdbId` is a single `Integer` TMDB id, read directly by the new sourcing method with no repository lookup at all.
- **One-shot sourcing, not backfill-paginated.** `sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword` all go through `sourceWithBackfill`, which pages a `discover/tv`-shaped `IntFunction<List<TmdbCandidate>>` until `limit`/`maxDiscoverPages`/an empty page is hit. `TmdbClient.recommendations(int tmdbId)`/`similar(int tmdbId)` take no page parameter (TMDB's own `/tv/{id}/recommendations` and `/tv/{id}/similar` endpoints return one unpaginated-by-us list each), so `sourceWithBackfill`'s paginated shape doesn't apply here. `sourceFromCandidate` instead mirrors `sourceTitleBased`'s existing pattern — one `recommendations(tmdbId)` call, falling back to `similar(tmdbId)` only if that comes back empty — run once through `dedupeAndExclude`/`applyOutputFilters` exactly as `mergePage` already does for a single page, without a surrounding loop.
- **Explicit self-exclusion is required here, unlike `sourceTitleBased`'s implicit protection.** In `sourceTitleBased` (pool-based "Use My Series" sourcing), the source series is itself in `SeriesRepository`, so `dedupeAndExclude`'s existing `seriesRepository.existsByImdbId(imdbId)` check silently drops a self-recommendation if TMDB ever returned the source show as its own "similar" result. This new candidate is, by definition, untracked — it has no row in `SeriesRepository` for that check to match against — so nothing already in the pipeline stops it from recommending itself back. `sourceFromCandidate` therefore adds one explicit filter, dropping any result whose `tmdbId` equals the requested `sourceTmdbId`, before the result is returned.
- **`"candidate"` needs no new mutual-exclusivity rule.** `RecommendationCriteriaValidator.validateMutuallyExclusiveModes`'s existing `hasSourceMode && (hasSeriesIds || hasGenreOrKeyword)` check (unchanged by this spec) already rejects `sourceMode="candidate"` combined with `seriesIds`/`genres`/`keywords`, because setting `sourceMode` to any non-blank value — `"candidate"` included — makes `hasSourceMode` true. This is confirmed by reading the method, not assumed; a red/green test is still added (SERIES-064-AC-02) asserting the combination is rejected, even though no new *production* code backs it, so the behavior stays covered rather than relying on an untested inference.
- **`candidate` mode requires `sourceTmdbId`, and vice versa — enforced as a new, explicit validator rule** (`validateSourceTmdbId`), since `"candidate"` is the one mode whose entire sourcing behavior depends on a single required id with no other fallback (unlike `trendingWindow`/`discoverSortBy`, which are optional mode-scoped overrides with sensible defaults). A `sourceTmdbId` set without `sourceMode="candidate"` is equally rejected — it would otherwise be silently ignored by every other mode, which is more likely a client mistake than an intentional no-op.
- **`candidate` mode joins the "no ranking/diversity cap, keep TMDB's own order" branch** in `RecommendationService.doRecommend`, alongside `trending`/`topRated`/Custom Search. That branch's existing rationale (see the code comment at the branch) is "none of these three ever link a candidate to a source series, so the ranking/diversity-cap step is a full no-op for them" — the same is true here: a candidate-mode result has no `sourceSeries` (no `SeriesEntity` was ever the origin), so `rankScore` would always equal `tmdbRating` and the diversity cap would never fire. Running the no-op path would be dead work with no behavioral difference from skipping it, so `candidate` mode is dispatched into the same `!useMySeriesMode` branch as the other three directed modes.

---

## Requirement 1: A recommendation candidate can be used as its own recommendation source

**User story**: As a user looking at a recommendation candidate I haven't added to my list, I want to ask for shows similar to *that* candidate, so I can keep exploring without first adding it.

### SERIES-064-AC-01 [AUTO]
**Statement**: `RecommendationDefaults` shall gain a `SOURCE_MODE_CANDIDATE = "candidate"` constant, matching the existing `SOURCE_MODE_TOP_RATED`/`SOURCE_MODE_USE_MY_SERIES` constants' visibility and placement; `RecommendationCriteria` shall gain a nullable `Integer sourceTmdbId` field with public getter/setter; `RecommendationCriteriaValidator.validateSourceMode` shall accept `"candidate"` as a valid `sourceMode` value alongside `"trending"`/`"topRated"`/`"useMySeries"`.

**Rationale**: A named constant (not a string literal) keeps the sourcing-time and validation-time checks for this mode from drifting apart, matching this class's own stated purpose ("centralized so ... call sites ... can't drift apart"). `sourceTmdbId` is the one new piece of request data this whole feature turns on.

**References**:
- `service/recommendation/RecommendationDefaults.java` lines 13-24 (`SOURCE_MODE_TOP_RATED`/`SOURCE_MODE_USE_MY_SERIES`, the constants being mirrored)
- `dto/RecommendationCriteria.java` lines 38-41 (`sourceMode`/`trendingWindow`/`discoverSortBy`/`region` fields — `sourceTmdbId` is inserted alongside these), lines 117-118 (`sourceMode` getter/setter, the accessor shape to mirror)
- `service/recommendation/RecommendationCriteriaValidator.java` lines 45-52 (`validateSourceMode`)

**Test Case (Green)**: add the constant to `RecommendationDefaults`; add the field/accessors to `RecommendationCriteria`; add `&& !RecommendationDefaults.SOURCE_MODE_CANDIDATE.equals(c.getSourceMode())` to `validateSourceMode`'s rejection condition, and widen its exception message to `"sourceMode must be one of: trending, topRated, useMySeries, candidate"`. No dedicated test for the constant/field alone — covered end-to-end by AC-02/AC-03/AC-04 below, consistent with how this DTO's existing fields have no standalone unit test file.

---

### SERIES-064-AC-02 [AUTO]
**Statement**: `RecommendationCriteriaValidator.validate` shall require `sourceMode == "candidate"` if and only if `sourceTmdbId` is set — rejecting `sourceTmdbId` set without `sourceMode="candidate"`, and rejecting `sourceMode="candidate"` without `sourceTmdbId` — via a new `validateSourceTmdbId` check called alongside the existing checks in `validate`. Separately, `sourceMode="candidate"` combined with `seriesIds`/`genres`/`keywords` shall continue to be rejected by the existing, unmodified `validateMutuallyExclusiveModes` (its current `hasSourceMode && (hasSeriesIds || hasGenreOrKeyword)` rule already covers this, since setting `sourceMode="candidate"` makes `hasSourceMode` true).

**Rationale**: `"candidate"` is the one mode whose sourcing has no fallback without its one required parameter — unlike `trendingWindow`/`discoverSortBy`, which are optional overrides with sensible defaults. A `sourceTmdbId` sent without the matching mode is far more likely a client bug than an intentional no-op, so it's rejected rather than silently ignored.

**References**:
- `service/recommendation/RecommendationCriteriaValidator.java` line 31-43 (`validate`, where `validateSourceTmdbId(c)` is added to the call sequence), lines 61-78 (`validateMutuallyExclusiveModes`, confirmed to need no change), line 45-52 (`validateSourceMode`, from AC-01)

**Test Case (Red)**:
```groovy
def "SERIES-064-AC-02: sourceMode=candidate without sourceTmdbId is rejected"() {
  given: "criteria sets sourceMode=candidate but no sourceTmdbId"
      def criteria = new RecommendationCriteria(sourceMode: "candidate")

  when: "validate is called"
      validator.validate(criteria)

  then: "an IllegalArgumentException is thrown"
      thrown(IllegalArgumentException)
}

def "SERIES-064-AC-02b: sourceTmdbId without sourceMode=candidate is rejected"() {
  given: "criteria sets sourceTmdbId but leaves sourceMode unset"
      def criteria = new RecommendationCriteria(sourceTmdbId: 1396)

  when: "validate is called"
      validator.validate(criteria)

  then: "an IllegalArgumentException is thrown"
      thrown(IllegalArgumentException)
}

def "SERIES-064-AC-02c: sourceMode=candidate with sourceTmdbId set is accepted"() {
  expect: "no exception"
      validator.validate(new RecommendationCriteria(sourceMode: "candidate", sourceTmdbId: 1396))
}

def "SERIES-064-AC-02d: sourceMode=candidate combined with seriesIds is rejected by the existing mutual-exclusion rule"() {
  given: "criteria sets sourceMode=candidate, sourceTmdbId, and seriesIds together"
      def criteria = new RecommendationCriteria(
          sourceMode: "candidate", sourceTmdbId: 1396, seriesIds: [UUID.randomUUID().toString()])

  when: "validate is called"
      validator.validate(criteria)

  then: "an IllegalArgumentException is thrown"
      thrown(IllegalArgumentException)
}

def "SERIES-064-AC-02e: sourceMode=candidate combined with genres is rejected by the existing mutual-exclusion rule"() {
  given: "criteria sets sourceMode=candidate, sourceTmdbId, and genres together"
      def criteria = new RecommendationCriteria(sourceMode: "candidate", sourceTmdbId: 1396, genres: ["Drama"])

  when: "validate is called"
      validator.validate(criteria)

  then: "an IllegalArgumentException is thrown"
      thrown(IllegalArgumentException)
}
```
**Test Case (Green)**: add a `validateSourceTmdbId(RecommendationCriteria c)` private method:
```java
private void validateSourceTmdbId(RecommendationCriteria c) {
    boolean isCandidateMode = RecommendationDefaults.SOURCE_MODE_CANDIDATE.equals(c.getSourceMode());
    boolean hasSourceTmdbId = c.getSourceTmdbId() != null;
    if (isCandidateMode != hasSourceTmdbId) {
        throw new IllegalArgumentException("sourceMode=candidate requires sourceTmdbId, and vice versa");
    }
}
```
called from `validate` alongside the existing checks. AC-02d/AC-02e need no new production code — they exercise `validateMutuallyExclusiveModes`'s existing rule with the new mode value, confirming the "free" coverage claimed in this spec's Design Decisions.

---

### SERIES-064-AC-03 [AUTO]
**Statement**: `RecommendationSourcingService` shall gain a package-private `List<DedupedCandidate> sourceFromCandidate(RecommendationCriteria c, int tmdbId, int limit)` method: it calls `tmdbClient.recommendations(tmdbId)`, falling back to `tmdbClient.similar(tmdbId)` only if that result is empty (mirroring `sourceTitleBased`'s exact fallback shape); wraps the result as `RawCandidate`s with a `null` source series; runs them once through `deduplicationService.dedupeAndExclude`/`outputFilterService.applyOutputFilters` (the same two calls `mergePage` already makes for a single page); explicitly excludes any resulting candidate whose `candidate().tmdbId()` equals the requested `tmdbId`; and truncates to `limit`.

**Rationale**: Reuses the existing dedup/output-filter/already-added/already-ignored pipeline exactly, so a candidate-sourced result gets the same quality/exclusion guarantees every other mode already has — the only genuinely new behavior is the explicit self-exclusion this mode uniquely needs (see Design Decisions).

**References**:
- `service/recommendation/RecommendationSourcingService.java` lines 356-377 (`sourceTitleBased`, the `recommendations`→`similar` fallback pattern being mirrored), lines 199-211 (`mergePage`, the `dedupeAndExclude`/`applyOutputFilters` call pair being mirrored for a single, unpaginated batch), lines 95-137 (`sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword`, the three existing sibling sourcing methods this new one joins)
- `client/tmdb/TmdbClient.java` lines 103, 112 (`recommendations(int tmdbId)`, `similar(int tmdbId)` — confirm current signatures before implementing)
- `service/recommendation/RawCandidate.java`, `service/recommendation/DedupedCandidate.java` (record shapes reused unchanged)

**Test Case (Red)**:
```groovy
def "SERIES-064-AC-03: sources from TMDB recommendations(tmdbId), excluding the candidate from its own results"() {
  given: "TMDB recommendations for tmdbId=100 include the candidate itself and two others"
      def self = candidate(100)
      def other1 = candidate(101)
      def other2 = candidate(102)
      tmdbClient.recommendations(100) >> [self, other1, other2]
      deduplicationService.dedupeAndExclude(_) >> { List raw ->
          raw.collect { new DedupedCandidate(it.candidate(), [], "tt${it.candidate().tmdbId()}") }
      }
      outputFilterService.applyOutputFilters(_, _) >> { List deduped, criteria -> deduped }

  when: "sourceFromCandidate is called for tmdbId=100"
      def result = sourcingService.sourceFromCandidate(new RecommendationCriteria(sourceTmdbId: 100), 100, 20)

  then: "the candidate itself is excluded, the other two are returned"
      result*.candidate()*.tmdbId() as Set == [101, 102] as Set
}

def "SERIES-064-AC-03b: falls back to similar(tmdbId) when recommendations(tmdbId) is empty"() {
  given: "TMDB has no direct recommendations, but does have similar shows"
      tmdbClient.recommendations(100) >> []
      tmdbClient.similar(100) >> [candidate(200)]
      deduplicationService.dedupeAndExclude(_) >> { List raw ->
          raw.collect { new DedupedCandidate(it.candidate(), [], "tt${it.candidate().tmdbId()}") }
      }
      outputFilterService.applyOutputFilters(_, _) >> { List deduped, criteria -> deduped }

  when: "sourceFromCandidate is called for tmdbId=100"
      def result = sourcingService.sourceFromCandidate(new RecommendationCriteria(sourceTmdbId: 100), 100, 20)

  then: "the similar-based candidate is returned, and similar was actually called"
      result*.candidate()*.tmdbId() == [200]
      1 * tmdbClient.similar(100)
}

def "SERIES-064-AC-03c: truncates to the requested limit"() {
  given: "TMDB recommendations return more candidates than the requested limit"
      tmdbClient.recommendations(100) >> [candidate(101), candidate(102), candidate(103)]
      deduplicationService.dedupeAndExclude(_) >> { List raw ->
          raw.collect { new DedupedCandidate(it.candidate(), [], "tt${it.candidate().tmdbId()}") }
      }
      outputFilterService.applyOutputFilters(_, _) >> { List deduped, criteria -> deduped }

  when: "sourceFromCandidate is called with limit=2"
      def result = sourcingService.sourceFromCandidate(new RecommendationCriteria(sourceTmdbId: 100), 100, 2)

  then: "only 2 candidates are returned"
      result.size() == 2
}
```
**Test Case (Green)**:
```java
List<DedupedCandidate> sourceFromCandidate(RecommendationCriteria c, int tmdbId, int limit) {
    List<TmdbCandidate> candidates = tmdbClient.recommendations(tmdbId);
    if (candidates.isEmpty()) {
        candidates = tmdbClient.similar(tmdbId);
    }
    List<RawCandidate> raw = candidates.stream().map(candidate -> new RawCandidate(candidate, null)).toList();
    List<DedupedCandidate> deduped = deduplicationService.dedupeAndExclude(raw);
    List<DedupedCandidate> filtered = outputFilterService.applyOutputFilters(deduped, c);
    List<DedupedCandidate> selfExcluded = filtered.stream()
        .filter(dc -> dc.candidate().tmdbId() != tmdbId)
        .toList();
    return selfExcluded.size() > limit ? selfExcluded.subList(0, limit) : selfExcluded;
}
```

---

### SERIES-064-AC-04 [AUTO]
**Statement**: `RecommendationService.doRecommend` shall dispatch `sourceMode="candidate"` requests to `sourcingService.sourceFromCandidate(criteria, criteria.getSourceTmdbId(), limit)` via a new `candidateMode` branch, computed alongside the existing `trendingMode`/`topRatedMode`/`useMySeriesMode` booleans and inserted between the existing `topRatedMode` branch and the Custom Search default/fallback branch; `candidate` mode results shall flow through the same `!useMySeriesMode` "keep TMDB's own order, no ranking/diversity cap" path the other three directed modes already use.

**Rationale**: A `candidate`-sourced result has no `sourceSeries` link (no tracked `SeriesEntity` originated it), so ranking/diversity-cap would be a no-op exactly as it already is for `trending`/`topRated`/Custom Search — see this spec's Design Decisions for why that makes reusing the existing branch correct, not just convenient.

**References**: `service/recommendation/RecommendationService.java` lines 124-154 (`doRecommend`'s mode dispatch — `trendingMode`/`topRatedMode`/`useMySeriesMode` booleans at 124-126, the `if (trendingMode) ... else if (topRatedMode) ... else { sourceByGenreOrKeyword }` chain at 135-147, where the new `else if (candidateMode)` branch is inserted between the `topRatedMode` branch and the `else`), lines 156-178 (the `!useMySeriesMode` DTO-assembly path `candidate` mode joins unchanged)

**Test Case (Red)**:
```groovy
def "SERIES-064-AC-04: sourceMode=candidate dispatches to sourceFromCandidate with the request's limit and sourceTmdbId"() {
  given: "criteria selects candidate mode for tmdbId=1396"
      def criteria = new RecommendationCriteria(sourceMode: "candidate", sourceTmdbId: 1396)

  when: "recommend is called with limit=12"
      recommendationService.recommend(12, criteria)

  then: "sourcingService.sourceFromCandidate receives criteria, tmdbId=1396, and limit=12"
      1 * sourcingService.sourceFromCandidate(criteria, 1396, 12) >> []
}

def "SERIES-064-AC-04b: candidate-mode results keep TMDB's own order with no ranking/diversity cap"() {
  given: "sourceFromCandidate returns two deduped candidates with no source series"
      def dc1 = new DedupedCandidate(candidate(101), [], "tt101")
      def dc2 = new DedupedCandidate(candidate(102), [], "tt102")
      def criteria = new RecommendationCriteria(sourceMode: "candidate", sourceTmdbId: 100)

  when: "recommend is called"
      def result = recommendationService.recommend(20, criteria)

  then: "results are returned in TMDB's own order, not re-ranked"
      1 * sourcingService.sourceFromCandidate(criteria, 100, 20) >> [dc1, dc2]
      result*.title == [dc1.candidate().title(), dc2.candidate().title()]
}
```
**Test Case (Green)**: add `boolean candidateMode = RecommendationDefaults.SOURCE_MODE_CANDIDATE.equals(criteria.getSourceMode());` alongside the existing mode booleans; insert `} else if (candidateMode) { sourced = sourcingService.sourceFromCandidate(criteria, criteria.getSourceTmdbId(), limit); }` between the existing `topRatedMode` branch and the `else { sourced = sourcingService.sourceByGenreOrKeyword(...); }` fallback.

---

### SERIES-064-AC-05 [AUTO]
**Statement**: `GET /api/v1/series/recommendations` shall accept an optional `sourceTmdbId` `Integer` query parameter and thread it into the `RecommendationCriteria` passed to `RecommendationService.recommend`.

**Rationale**: Completes the request-shape → DTO wiring so the frontend can actually reach `candidate` mode.

**References**: `controller/SeriesRecommendationController.java` lines 30-49 (`recommendations`'s `@RequestParam` list, where `@RequestParam(required = false) Integer sourceTmdbId` is added alongside `region`), lines 52-70 (criteria assembly, where `criteria.setSourceTmdbId(sourceTmdbId);` is added alongside `criteria.setRegion(region);`)

**Test Case (Red)**:
```groovy
def "SERIES-064-AC-05: sourceTmdbId query param is bound and passed through to RecommendationCriteria"() {
  given: "RecommendationService resolves an empty list for any criteria"
      when(recommendationService.recommend(eq(20), any(RecommendationCriteria))).thenReturn([])

  when: "GET /api/v1/series/recommendations?sourceMode=candidate&sourceTmdbId=1396 is requested"
      def result = mockMvc.perform(get("/api/v1/series/recommendations")
          .param("sourceMode", "candidate")
          .param("sourceTmdbId", "1396"))

  then: "the response is 200 and RecommendationService received sourceTmdbId=1396"
      result.andExpect(status().isOk())
      def unused = verify(recommendationService).recommend(eq(20), argThat({ RecommendationCriteria c ->
          c.sourceTmdbId == 1396 && c.sourceMode == "candidate"
      }))
}
```
**Test Case (Green)**: add the `@RequestParam(required = false) Integer sourceTmdbId` parameter and `criteria.setSourceTmdbId(sourceTmdbId);` call.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `sourceMode` discriminator pattern (`"trending"`/`"topRated"`/`"useMySeries"`) this spec's `"candidate"` value extends | `series_spec_022_directed_recommendation_sourcing.md`, `series_spec_033_use_my_series_explicit_mode.md` |
| `sourceTitleBased`'s `recommendations()`→`similar()` fallback pattern, mirrored by `sourceFromCandidate` | `series_spec_007_recommendation_sourcing.md` |
| `dedupeAndExclude`/`applyOutputFilters` pipeline reused unchanged | `series_spec_059_incremental_backfill_dedup.md` |
| "Keep TMDB's own order, no ranking/diversity cap" branch `candidate` mode joins | `series_spec_022_directed_recommendation_sourcing.md`, `series_spec_025_discover_native_sort.md` |
| Frontend consumer of `sourceMode="candidate"`/`sourceTmdbId` | `frontend_spec_127_candidate_recommendations_modal.md` (companion spec) |

---

## Acceptance Criteria Summary

- [ ] SERIES-064-AC-01: `SOURCE_MODE_CANDIDATE` constant, `sourceTmdbId` field, validator accepts `"candidate"`
- [ ] SERIES-064-AC-02: validator requires `sourceMode="candidate"` ⟺ `sourceTmdbId` set; existing mutual-exclusion rule covers combination with `seriesIds`/`genres`/`keywords`
- [ ] SERIES-064-AC-03: `sourceFromCandidate` sources via `recommendations()`→`similar()` fallback, dedupes/filters, explicitly self-excludes, truncates to limit
- [ ] SERIES-064-AC-04: `doRecommend` dispatches `candidate` mode to `sourceFromCandidate`, joining the no-ranking/no-diversity-cap path
- [ ] SERIES-064-AC-05: `GET /api/v1/series/recommendations` accepts and threads through `sourceTmdbId`
