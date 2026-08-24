# Spec 024: Discover Filters (Keyword Exclusion) & Mode-Aware Vote-Count Threshold

**Status**: Implemented (2026-08-24). Files touched: `backend/src/main/java/uk/co/stefirby/seriestracker/dto/RecommendationCriteria.java`
(`excludeKeywords`), `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesController.java` (`excludeKeywords` request
param), `backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationService.java` (`DEFAULT_MIN_VOTE_COUNT_TOP_RATED`
constant, mode-aware `minVoteCount` default at both `sourceTopRated` and `applyOutputFilters` call sites, `matchesExcludeKeywords`
wired last in the `applyOutputFilters` chain with a `try`/`catch (ExternalServiceException)` fail-open around
`TmdbClient.showKeywords`), plus extended Spock specs `RecommendationServiceSpec.groovy` (new AC-03..08/10/11 cases, and the existing
`SERIES-022-AC-11/12/13/14/15/18` topRated fixtures updated to the new 200 sourcing-time default and bumped `voteCount` fixtures so
they still clear the raised post-hoc floor) and `SeriesControllerRecommendationsSpec.groovy` (new `excludeKeywords` param-binding
case, `excludeKeywords` added to the existing full-param-list case). No `frontend/` files touched — that's
`frontend_spec_030_discover_filters_and_sort_controls.md`, a separate follow-up on the same branch.
**Verification**: `gradlew.bat test` from `backend/` — full suite green (`BUILD SUCCESSFUL`).
**Priority**: P3 (discovery feature refinement, same tier as `series_spec_022`)
**Depends on**: Series Spec 007 (`RecommendationCriteria`, `matchesExcludeGenres`/output-filter chain, `minVoteCount`
default) ✅, Series Spec 022 (`sourceMode=topRated`, `discoverTopRated`, trending's output-filters-still-run precedent)
✅, Series Spec 019 (`TmdbClient.showKeywords`, `TmdbKeyword`, `KeywordSyncService`'s degrade-gracefully pattern) ✅
**Backend Task**

## Overview

Extends `RecommendationService`'s output-filter pipeline with a keyword-exclusion filter mirroring the existing
`excludeGenres` filter, and raises the effective `minVoteCount` floor for `sourceMode=topRated` ("Highest Rated")
specifically, without changing the shared default every other sourcing mode relies on. Also formally records, as a
considered-and-rejected item, why no month/year "trending window" approximation is being built. Together these close out
scratch items 3 and 4 from `SCRATCH_NEW_IDEAS_2026-08-24.md`.

**Design decisions**:

- **`excludeKeywords` cannot mirror `excludeGenres`'s implementation exactly, because the underlying TMDB data isn't
  free the same way.** `TmdbCandidate.genreIds` comes populated on every `recommendations`/`similar`/`discover`/
  `trending` result at no extra cost (`genre_ids` is on the base list-endpoint payload), which is what makes
  `matchesExcludeGenres` a pure in-memory check. TMDB does **not** include keyword data on any list-endpoint response —
  the only way to get a show's keywords is the per-show `GET /tv/{id}/keywords` call (`TmdbClient.showKeywords`, already
  built for `series_spec_019`'s keyword tracking). So `matchesExcludeKeywords` genuinely needs one extra `TmdbClient`
  call per candidate it's applied to, unlike its genre counterpart. Two choices bound that cost to something acceptable
  rather than a blanket per-request tax:
  - It's applied **last** in the `applyOutputFilters` chain (after `minTmdbRating`/`minVoteCount`/`yearMin`/`yearMax`/
    `excludeGenres`/`language`), so the extra call only ever runs against candidates that already survived every free
    filter — the smallest possible remaining pool, not the raw/deduped one.
  - It's a **true no-op with zero extra calls when `excludeKeywords` is unset** (the overwhelming majority of requests,
    since it's opt-in) — same "absent means default behavior" convention every other `RecommendationCriteria` field
    already follows.
  - This is also not a categorically new cost pattern for this pipeline: `dedupeAndExclude` already makes one
    `TmdbClient.externalIds(...)` call per **raw** candidate (up to `maxCandidates`, default 50) on *every*
    recommendation request regardless of any filter — an unconditional cost already accepted. One more call per
    **already-narrowed, already-deduped** candidate, and only when the caller opts in, is a strictly smaller addition to
    an already-established pattern, not a new category of risk.
- **A per-candidate `showKeywords` failure fails that one candidate open, not the whole request.** Reuses
  `KeywordSyncService.syncKeywords`'s existing
  `try { tmdbClient.showKeywords(tmdbId) } catch (ExternalServiceException e) { log...; return; }` pattern — a single
  candidate's keyword lookup being unavailable shouldn't take down an otherwise-successful `/recommendations` response,
  the same "graceful skip, not a hard failure" posture `sourceTitleBased` already applies when a single source series'
  TMDB lookup fails (`SERIES-006-AC-17`).
- **Still a post-hoc output filter, not a native `without_keywords` `discover/tv` param** — consistent with the existing
  `excludeGenres` choice (`series_spec_007`'s Requirement 8), and for the same underlying reason it already applies to
  `excludeGenres`: this filter also needs to run against candidates sourced from `recommendations`/`similar`/`trending`,
  not just `discover/tv`, so a query-time param on one specific TMDB call couldn't cover every sourcing path anyway.
- **`minVoteCount`'s bumped default is mode-aware (200 for `topRated` only), not a global change to
  `DEFAULT_MIN_VOTE_COUNT`.** Resolves the open question `series_spec_022`/the scratch file left explicit: a global bump
  to 200 would over-filter Automatic/Specific/Genre recommendations, which don't need as high a confidence bar as "show
  me TMDB's objectively highest-rated shows" does. `topRated` gets its own `DEFAULT_MIN_VOTE_COUNT_TOP_RATED = 200`;
  every other mode (including `trending`, which doesn't use `minVoteCount` for sourcing at all but still runs the
  post-hoc filter) keeps the existing `DEFAULT_MIN_VOTE_COUNT = 20`.
- **Non-goal (scratch item 3): no month/year "trending window" approximation via `discover/tv`.** TMDB's real
  `GET /trending/tv/{time_window}` only accepts `day`/`week` — there is no native month/year trending concept to extend.
  A month/year "trending" would have to be built as a *different* mechanism entirely
  (`discover/tv?sort_by=popularity.desc&first_air_date.gte=...`), which is a distinct discover-based feature, not an
  extension of `series_spec_022`'s trending mode. Deliberately not built here — `day`/`week` is the honest scope of
  "trending" going forward. If a longer-window "what's been popular lately" feature is wanted later, it should be spec'd
  as its own sourcing concept (e.g. alongside `topRated`), not folded into `trendingWindow`.

---

## Requirements

### Requirement 1: Keyword Exclusion Output Filter

**User story**: As a user directing recommendations (by any sourcing mode), I want to exclude candidates matching
keywords I'm not interested in, so recommendation lists stay relevant without me having to manually skip past them.

#### Acceptance Criteria

- **SERIES-024-AC-01** [AUTO]: `RecommendationCriteria` shall gain `excludeKeywords` (`List<String>`), following the
  exact nullability/no-op-when-absent convention `excludeGenres` already uses (`SERIES-007-AC-27`).
- **SERIES-024-AC-02** [AUTO]: `GET /api/v1/series/recommendations` shall accept an optional `excludeKeywords` parameter
  (comma-separated names), bound by `SeriesController` identically to the existing `excludeGenres` parameter, and
  threaded into `RecommendationCriteria`.
- **SERIES-024-AC-03** [AUTO]: `RecommendationService` shall gain a `matchesExcludeKeywords` output filter. When
  `excludeKeywords` is null or empty, every candidate shall pass (a true no-op), matching `matchesExcludeGenres`'s exact
  no-op behavior for `excludeGenres`.
- **SERIES-024-AC-04** [AUTO]: When `excludeKeywords` is non-empty, a candidate shall be excluded if any of its TMDB
  keyword names (fetched via `TmdbClient.showKeywords(candidate.tmdbId())`) case-insensitively matches an entry in
  `excludeKeywords` — the same case-insensitive comparison convention `excludeGenres`/`language` already use
  (`series_spec_007` Design Decision #4).
- **SERIES-024-AC-05** [AUTO]: `matchesExcludeKeywords` shall run as the last filter in `applyOutputFilters`'s chain —
  after `minTmdbRating`, `minVoteCount`, `yearMin`/`yearMax`, `excludeGenres`, and `language` — so its
  `TmdbClient.showKeywords` call is only made for candidates that have already survived every cheaper, no-extra-call
  filter.
- **SERIES-024-AC-06** [AUTO]: If `TmdbClient.showKeywords` throws `ExternalServiceException` for a given candidate,
  that candidate shall not be excluded by this filter (fails open, logged at `info` level) rather than propagating and
  failing the whole `/recommendations` request — mirroring `KeywordSyncService.syncKeywords`'s existing `try`/
  `catch (ExternalServiceException e)` degrade-gracefully pattern around the same `TmdbClient` method.
- **SERIES-024-AC-07** [AUTO]: `matchesExcludeKeywords` shall make zero `TmdbClient.showKeywords` calls when
  `excludeKeywords` is null or empty — a true zero-cost no-op, matching `excludeGenres`'s existing behavior when unset
  (see Design Decisions).
- **SERIES-024-AC-08** [AUTO]: The `excludeKeywords` filter shall apply uniformly across every sourcing mode, including
  `trendingMode` — Requirement 8's output filters already run for trending candidates (`SERIES-022-AC-08`), and this
  filter is no exception.

---

### Requirement 2: Mode-Aware `minVoteCount` Default for Highest Rated

**User story**: As a user browsing "Highest Rated" recommendations, I want a meaningfully high vote-count floor by
default, so a handful of 10/10 votes doesn't surface an obscure, low-signal show ahead of genuinely acclaimed ones —
without raising the bar so high it starves Automatic/Genre recommendations of results that don't need to be filtered
that hard.

#### Acceptance Criteria

- **SERIES-024-AC-09** [AUTO]: `RecommendationService` shall gain a `DEFAULT_MIN_VOTE_COUNT_TOP_RATED = 200` constant,
  alongside the existing `DEFAULT_MIN_VOTE_COUNT = 20` (`SERIES-007-AC-25`) — a mode-aware default, not a global change
  (see Design Decisions).
- **SERIES-024-AC-10** [AUTO]: `sourceTopRated`'s effective `minVoteCount` (passed to `TmdbClient.discoverTopRated` as
  the sourcing-time `vote_count.gte` floor, `SERIES-022-AC-11`) shall default to `DEFAULT_MIN_VOTE_COUNT_TOP_RATED`
  (200) when the `minVoteCount` request parameter is not supplied — superseding `SERIES-022-AC-11`'s stated "defaulting
  to 20" value specifically for `topRated` mode; the request parameter's existence and override semantics are otherwise
  unchanged.
- **SERIES-024-AC-11** [AUTO]: `applyOutputFilters`'s post-hoc `minVoteCount` filter (`SERIES-007-AC-25`) shall likewise
  default to `DEFAULT_MIN_VOTE_COUNT_TOP_RATED` (200) when `criteria.getSourceMode()` is `"topRated"` and `minVoteCount`
  is not supplied.
- **SERIES-024-AC-12** [AUTO]: `applyOutputFilters`'s post-hoc `minVoteCount` filter shall continue defaulting to
  `DEFAULT_MIN_VOTE_COUNT` (20) for every other `sourceMode` value (null/absent, `"trending"`, or Requirement 5's
  directed genre/keyword mode) when `minVoteCount` is not supplied — unchanged from `SERIES-007-AC-25`.
- **SERIES-024-AC-13** [AUTO]: Explicitly supplying `minVoteCount` (including `0`, to disable the filter) shall override
  the mode-aware default at both call sites (`SERIES-024-AC-10`/`AC-11`), identical to the existing override semantics
  of `SERIES-007-AC-25`.

---

## Cross-References

| This spec                                                                                                                                                                                                                                   | Source                                                      |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|
| `RecommendationCriteria`, `matchesExcludeGenres`'s structure/no-op convention, `minVoteCount` default (20), Requirement 8 output-filter chain and its ordering                                                                              | `series_spec_007_recommendation_sourcing.md`                |
| `sourceMode=topRated`, `TmdbClient.discoverTopRated(minVoteCount)`, trending's "output filters still run" precedent (`SERIES-022-AC-08`) — `SERIES-024-AC-10` supersedes `SERIES-022-AC-11`'s stated default value for `topRated` mode only | `series_spec_022_trending_and_top_rated_recommendations.md` |
| `TmdbClient.showKeywords(tmdbId)`, `TmdbKeyword`, `KeywordSyncService.syncKeywords`'s `try`/`catch (ExternalServiceException)` degrade-gracefully pattern this filter reuses                                                                | `series_spec_019_keyword_tracking.md`                       |
| Frontend consumer: `excludeKeywords` input, mode-aware `minVoteCount` pre-fill, Sort By relabeling for `topRated`                                                                                                                           | `frontend_spec_030_discover_filters_and_sort_controls.md`   |

---

## TDD Test Case Sketches

### `RecommendationServiceSpec.groovy` (Requirement 1)

```groovy
def "SERIES-024-AC-03/04: matchesExcludeKeywords excludes a candidate whose TMDB keywords match, case-insensitively"() {
  given: "a topRated-sourced candidate and excludeKeywords=['Zombie']"
  tmdbClient.discoverTopRated(_) >> [candidateA]
  tmdbClient.externalIds(candidateA.tmdbId()) >> Optional.of("tt001")
  tmdbClient.showKeywords(candidateA.tmdbId()) >> [new TmdbKeyword(1, "zombie")]

  when: "recommend(20, sourceMode: 'topRated', excludeKeywords: ['Zombie']) is called"
  def results = recommendationService.recommend(20, criteriaWith(sourceMode: "topRated", excludeKeywords: ["Zombie"]))

  then: "the candidate is excluded"
  results.isEmpty()
}

def "SERIES-024-AC-05: matchesExcludeKeywords only runs its extra call against candidates surviving cheaper filters"() {
  given: "two candidates, one already excluded by minTmdbRating"
  // candidateA: voteAverage below minTmdbRating; candidateB: passes every earlier filter
  tmdbClient.discoverTopRated(_) >> [candidateA, candidateB]

  when: "recommend(20, sourceMode: 'topRated', minTmdbRating: 8.0, excludeKeywords: ['Zombie']) is called"
  recommendationService.recommend(20, criteriaWith(sourceMode: "topRated", minTmdbRating: 8.0, excludeKeywords: ["Zombie"]))

  then: "showKeywords is only ever called for candidateB, not candidateA"
  0 * tmdbClient.showKeywords(candidateA.tmdbId())
  1 * tmdbClient.showKeywords(candidateB.tmdbId()) >> []
}

def "SERIES-024-AC-06: a showKeywords failure fails that candidate open, not the whole request"() {
  given: "TmdbClient.showKeywords throws ExternalServiceException for candidateA"
  tmdbClient.discoverTopRated(_) >> [candidateA]
  tmdbClient.showKeywords(candidateA.tmdbId()) >> { throw new ExternalServiceException("boom") }

  when: "recommend(20, sourceMode: 'topRated', excludeKeywords: ['Zombie']) is called"
  def results = recommendationService.recommend(20, criteriaWith(sourceMode: "topRated", excludeKeywords: ["Zombie"]))

  then: "no exception propagates and the candidate is still present"
  noExceptionThrown()
  results*.title.contains(candidateA.title())
}

def "SERIES-024-AC-07: showKeywords is never called when excludeKeywords is unset"() {
  given: "no excludeKeywords in the request"
  tmdbClient.discoverTopRated(_) >> [candidateA]

  when: "recommend(20, sourceMode: 'topRated') is called"
  recommendationService.recommend(20, criteriaWith(sourceMode: "topRated"))

  then: "no TmdbClient.showKeywords call is made"
  0 * tmdbClient.showKeywords(_)
}

def "SERIES-024-AC-08: excludeKeywords applies to trending candidates too"() {
  given: "a trending candidate matching excludeKeywords"
  tmdbClient.trending(_) >> [candidateA]
  tmdbClient.showKeywords(candidateA.tmdbId()) >> [new TmdbKeyword(1, "heist")]

  when: "recommend(20, sourceMode: 'trending', excludeKeywords: ['Heist']) is called"
  def results = recommendationService.recommend(20, criteriaWith(sourceMode: "trending", excludeKeywords: ["Heist"]))

  then: "the candidate is excluded despite trending's ranking-bypass"
  results.isEmpty()
}
```

### `SeriesControllerRecommendationsSpec.groovy` (Requirement 1)

```groovy
def "SERIES-024-AC-02: excludeKeywords query param is bound and passed through to RecommendationService"() {
  when: "GET /api/v1/series/recommendations?excludeKeywords=Zombie,Heist is requested"
  def response = client.get().uri("/api/v1/series/recommendations?excludeKeywords=Zombie,Heist").exchange()

  then: "the response is 200 and RecommendationService received excludeKeywords=['Zombie','Heist']"
  response.expectStatus().isOk()
  1 * recommendationService.recommend(_, { it.excludeKeywords == ["Zombie", "Heist"] }) >> []
}
```

### `RecommendationServiceSpec.groovy` (Requirement 2)

```groovy
def "SERIES-024-AC-10: topRated mode sources via discoverTopRated with the new 200 default when minVoteCount is unset"() {
  when: "recommend(20, sourceMode: 'topRated') is called with no minVoteCount"
  recommendationService.recommend(20, criteriaWith(sourceMode: "topRated"))

  then: "discoverTopRated is called with 200, not 20"
  1 * tmdbClient.discoverTopRated(200) >> []
}

def "SERIES-024-AC-12: automatic mode's output filter still defaults minVoteCount to 20"() {
  given: "a candidate with voteCount 50, no sourceMode/minVoteCount supplied"
  // ... pool/candidate setup

  when: "recommend(20) is called"
  def results = recommendationService.recommend(20)

  then: "the candidate (voteCount 50 >= 20) passes the output filter"
  results.size() == 1
}

def "SERIES-024-AC-13: an explicit minVoteCount overrides the topRated 200 default"() {
  when: "recommend(20, sourceMode: 'topRated', minVoteCount: 5) is called"
  recommendationService.recommend(20, criteriaWith(sourceMode: "topRated", minVoteCount: 5))

  then: "discoverTopRated is called with the explicit value, not the 200 default"
  1 * tmdbClient.discoverTopRated(5) >> []
}
```

**Test Case (Green)**: implement `RecommendationCriteria.excludeKeywords`, `SeriesController`'s new request param,
`RecommendationService.matchesExcludeKeywords` (wired last in `applyOutputFilters`, catching `ExternalServiceException`
per candidate), and the two `DEFAULT_MIN_VOTE_COUNT_TOP_RATED`-aware call sites, until the specs above pass.

---

## Acceptance Criteria Summary

- [x] SERIES-024-AC-01: `RecommendationCriteria.excludeKeywords` (`List<String>`)
- [x] SERIES-024-AC-02: `excludeKeywords` request param bound and threaded through
- [x] SERIES-024-AC-03: `matchesExcludeKeywords` no-op when unset
- [x] SERIES-024-AC-04: case-insensitive keyword-name match excludes a candidate
- [x] SERIES-024-AC-05: `matchesExcludeKeywords` runs last in the output-filter chain
- [x] SERIES-024-AC-06: a per-candidate `showKeywords` failure fails open, not the whole request
- [x] SERIES-024-AC-07: zero `showKeywords` calls when `excludeKeywords` is unset
- [x] SERIES-024-AC-08: `excludeKeywords` applies to every sourcing mode, including trending
- [x] SERIES-024-AC-09: `DEFAULT_MIN_VOTE_COUNT_TOP_RATED = 200` constant added
- [x] SERIES-024-AC-10: `sourceTopRated`'s sourcing-time default is 200 when unset
- [x] SERIES-024-AC-11: `applyOutputFilters`'s post-hoc default is 200 for `topRated` when unset
- [x] SERIES-024-AC-12: `applyOutputFilters`'s post-hoc default stays 20 for every other mode
- [x] SERIES-024-AC-13: an explicit `minVoteCount` overrides the mode-aware default at both call sites
