# Spec 029: Configurable Default Min Vote Count & Genre-Directed Sourcing Vote-Count Floor

**Status**: Implemented (2026-08-27) — `RecommendationOutputFilterService.java`, `RecommendationSourcingService.java`,
`RecommendationDefaults.java`, `TmdbClient.java`, `application.yml`, plus test updates across
`RecommendationOutputFilterServiceSpec.groovy`, `RecommendationSourcingServiceSpec.groovy`,
`RecommendationServiceSpec.groovy`, `TmdbClientSpec.groovy`
**Priority**: P2 (fixes a live, user-confirmed bug — "Genre & Keyword" mode's "Vote Average"/"Newest" sorts return
identical or empty results for a genre-only query)
**Depends on**: Series Spec 007 (`RecommendationCriteria.minVoteCount`, `applyOutputFilters`'s `matchesMinVoteCount`,
`DEFAULT_MIN_VOTE_COUNT = 20`) ✅, Series Spec 022 (`sourceTopRated`, `TmdbClient.discoverTopRated`'s existing
`vote_count.gte` precedent) ✅, Series Spec 024 (`DEFAULT_MIN_VOTE_COUNT_TOP_RATED = 200`, the mode-aware default
pattern this spec extends) ✅, Series Spec 025 (`sourceByGenreOrKeyword`, `TmdbClient.discover(genreIds, keywordIds,
sortBy)`) ✅
**Backend Task** — no frontend change needed. The "Vote Average"/"Newest" sort controls already exist
(`frontend_spec_033_discover_native_sort_controls.md`); this spec only changes backend sourcing/filtering behavior
underneath them.

## Overview

A live bug report against "Genre & Keyword" mode: selecting a single genre (e.g. "Crime", no keyword) and sorting by
"Vote Average" or "Newest" produces **zero** recommendations, while "Most Popular"/"Most Voted" work normally.
Confirmed directly against the running backend and real TMDB API before writing this spec:

| Query | Result count |
|---|---|
| `genres=Crime`, `discoverSortBy=vote_average.desc` | **0** |
| `genres=Crime`, `discoverSortBy=first_air_date.desc` | **0** |
| `genres=Crime`, `discoverSortBy=vote_count.desc` | 10 |
| `genres=Crime`, `discoverSortBy=popularity.desc` (default) | 10 |
| `genres=Crime&keywords=spy`, `vote_average.desc` | 6 |
| `genres=Crime&keywords=spy`, `first_air_date.desc` | 5 (same first result as `vote_average.desc`) |
| `genres=Drama&keywords=spy`, `vote_average.desc` vs `first_air_date.desc` | different result sets (working as expected) |

**Root cause**: `TmdbClient.discover(genreIds, keywordIds, sortBy)` (`sourceByGenreOrKeyword`'s sourcing call) never
sends a `vote_count.gte` floor to TMDB — unlike `discoverTopRated`, which always has (`series_spec_022`/`024`). TMDB's
own `discover/tv` results for `sort_by=vote_average.desc` or `first_air_date.desc`, with no vote-count floor, surface
obscure/brand-new shows with single-digit vote counts first. `applyOutputFilters`'s post-hoc `matchesMinVoteCount`
filter (default 20) then discards nearly everything TMDB returned on page 1 — for a broad single-genre query, that's
often *all* of it, leaving zero. Adding a keyword narrows TMDB's pool enough that a few well-established survivors
remain, but they're frequently the *same* small overlapping set regardless of sort — which is why "Crime + Spy"
looked identical across both sorts too, while "Drama + Spy" (a pool with more variety) genuinely differed.

This spec closes the gap two ways: (1) genre/keyword-directed sourcing gains the same sourcing-time `vote_count.gte`
floor `topRated` already has, so TMDB itself only returns candidates worth considering; (2) the floor's *default*
value stops being a hardcoded constant and becomes configurable via `application.yml`/an env var, following this
project's existing `app.tmdb.*` convention, and is set to `200` — the same value `topRated` already uses.

## Design Decisions

- **`DEFAULT_MIN_VOTE_COUNT` becomes a Spring-injected `@Value`, not a `RecommendationDefaults` constant** — mirroring
  the existing `app.tmdb.max-source-series`/`max-candidates`/`max-per-source`/`refresh-delay-ms` convention (each
  injected directly into the constructor of whichever service reads it, with the fallback embedded in the `@Value`
  annotation itself, no centralized constant). `RecommendationDefaults.DEFAULT_MIN_VOTE_COUNT` is removed entirely,
  not left alongside the new property, to avoid two sources of truth for the same default.
- **The new config key is `app.tmdb.default-min-vote-count`** (env var `APP_TMDB_DEFAULT_MIN_VOTE_COUNT`), grouped
  under the existing `app.tmdb.*` block alongside `max-source-series`/`max-candidates`/`max-per-source` — it's the
  same class of "sourcing/filtering knob," not a new top-level config area.
  `DEFAULT_MIN_VOTE_COUNT_TOP_RATED` (`series_spec_024`) is **not** touched or merged into this — it stays its own
  independently hardcoded `200` constant on `topRated`'s own path. The two now happen to share the same *value*, but
  remain separate knobs; a future change to one doesn't imply the other should move too.
- **Bumping the general default from 20 to 200 is a deliberate, explicit global change** — it raises the output-filter
  bar for Automatic and Specific Series modes too, not just Genre & Keyword (all three currently share
  `DEFAULT_MIN_VOTE_COUNT`). This supersedes `series_spec_024`'s Design Decision that "a global bump would
  over-filter Automatic/Specific/Genre recommendations" — that reasoning didn't anticipate genre-directed sourcing
  needing a *sourcing-time* floor to avoid the zero-result failure mode above, and 200 is being adopted as a starting
  value across the board rather than carving out yet another mode-specific constant. If Automatic/Specific
  recommendations turn out to feel over-filtered at 200 in practice, that's a config change (`APP_TMDB_DEFAULT_MIN_VOTE_COUNT`),
  not a code change.
- **The new sourcing-time floor applies only to `sourceByGenreOrKeyword` (Requirement 5's directed genre/keyword
  mode), not `genreBasedSupplement`** (the pool-based genre-frequency fallback Automatic/Specific-Series mode uses
  when title-based candidates are too few, `series_spec_007`). That call site already sorts by `popularity.desc`
  only — not user-selectable, and not prone to the obscure/brand-new-show problem the way `vote_average.desc`/
  `first_air_date.desc` are — and its output still flows through Requirement 7's ranking/diversity cap normally
  (unlike the directed path, which bypasses ranking entirely and returns TMDB's order as-is). Narrowing it with a
  200-vote sourcing-time floor would shrink an already-supplementary pool for a problem it doesn't actually have.
  It keeps passing `0` (no floor sent) to `TmdbClient.discover(...)`, preserving today's behavior exactly.
- **`TmdbClient.discover(...)`'s new `minVoteCount` parameter is conditionally sent**, mirroring the method's
  existing `genreIds`/`keywordIds` conditional-inclusion pattern: `vote_count.gte` is only added to the request when
  `minVoteCount > 0`, so `genreBasedSupplement`'s `0` produces a request byte-identical to today's (no `vote_count.gte`
  param at all), not a new-but-harmless `vote_count.gte=0`.
- **`sourceByGenreOrKeyword` resolves its own effective `minVoteCount` independently**, exactly like `sourceTopRated`
  and `applyOutputFilters` already each independently resolve their own effective value from the same
  `RecommendationCriteria` (no new shared/passed-through state) — an explicit `minVoteCount` request parameter
  (including `0`, to disable the floor entirely) overrides the configured default at every call site, identical to
  `series_spec_024`'s existing override semantics for `topRated`.

---

## Requirement 1: Configurable Default Minimum Vote-Count Floor

**User story**: As a developer/operator, I want the default vote-count floor to be configurable via
`application.yml`/an environment variable rather than hardcoded, so it can be retuned without a code change —
matching every other `app.tmdb.*` sourcing/output-filter knob already in this project.

### SERIES-029-AC-01 [AUTO]
**Statement**: `RecommendationOutputFilterService` shall accept a constructor-injected
`@Value("${app.tmdb.default-min-vote-count:200}") int defaultMinVoteCount`, used in place of
`RecommendationDefaults.DEFAULT_MIN_VOTE_COUNT` in `applyOutputFilters`'s mode-aware default resolution.

**References**: `RecommendationOutputFilterService.java` (constructor, `applyOutputFilters`'s
`defaultMinVoteCount` local).

### SERIES-029-AC-02 [AUTO]
**Statement**: `RecommendationSourcingService` shall accept the same constructor-injected
`@Value("${app.tmdb.default-min-vote-count:200}") int defaultMinVoteCount`.

**References**: `RecommendationSourcingService.java` (constructor).

### SERIES-029-AC-03 [AUTO]
**Statement**: `RecommendationDefaults.DEFAULT_MIN_VOTE_COUNT` shall be removed. `DEFAULT_MIN_VOTE_COUNT_TOP_RATED`
remains, unchanged, as its own hardcoded constant.

**References**: `RecommendationDefaults.java`.

### SERIES-029-AC-04 [AUTO]
**Statement**: `application.yml` shall gain `app.tmdb.default-min-vote-count: 200`, grouped under the existing
`app.tmdb:` block, documented with the same comment style as its `max-source-series`/`max-candidates`/`max-per-source`
neighbors (purpose, which env var overrides it, cross-reference to this spec).

**References**: `backend/src/main/resources/application.yml`.

**Test Case (Green)**: no dedicated test — verified by `SERIES-029-AC-05`/`AC-07`'s tests, which rely on the `200`
default taking effect when the property is unset (the norm in the test environment).

### SERIES-029-AC-05 [AUTO]
**Statement**: `applyOutputFilters`'s effective `minVoteCount` for every `sourceMode` other than `"topRated"`
(`null`/absent, `"trending"`, or genre/keyword-directed) shall default to the injected `defaultMinVoteCount` (200)
when the `minVoteCount` request parameter is not supplied — an explicit global bump from the previous hardcoded 20,
superseding `SERIES-024-AC-12`'s stated value (`20`) for this case while leaving that AC's mode-aware branching
*structure* (topRated vs. everything else) intact.

**References**: `RecommendationOutputFilterService.applyOutputFilters`.

**Test Case (Red)**:
```groovy
def "SERIES-029-AC-05: non-topRated output filter defaults minVoteCount to the configured value (200), not the old 20"() {
    given: "a candidate with voteCount 50 -- passes the old default (20) but not the new one (200)"
    def outputFilterService = new RecommendationOutputFilterService(tmdbClient, new TmdbGenreTable(), 200)
    def candidate = dc(candidate(1, "Show", 2020, new BigDecimal("8.0"), [18], 50))

    when: "applyOutputFilters runs with no sourceMode/minVoteCount supplied"
    def results = outputFilterService.applyOutputFilters([candidate], new RecommendationCriteria())

    then: "the candidate is filtered out under the new 200 default"
    results.isEmpty()
}
```
**Test Case (Green)**: constructor-inject `defaultMinVoteCount`, use it as the non-`topRated` branch's default.

---

## Requirement 2: Genre-Directed Sourcing Sends a Vote-Count Floor to TMDB

**User story**: As a user browsing "Genre & Keyword" recommendations sorted by Vote Average or Newest, I want TMDB
itself to only return candidates meeting a meaningful vote-count bar, so the sort isn't dominated by obscure/
brand-new shows our own output filter then discards — sometimes leaving zero results, as confirmed live for a
single-genre query (see Overview).

### SERIES-029-AC-06 [AUTO]
**Statement**: `TmdbClient.discover(genreIds, keywordIds, sortBy, minVoteCount)` shall gain a fourth parameter,
added as `vote_count.gte` to the `discover/tv` request only when `minVoteCount > 0` (omitted entirely, not sent as
`0`, when `minVoteCount` is `0`) — mirroring `discoverTopRated`'s existing `vote_count.gte` usage and this method's
own existing conditional-inclusion pattern for `genreIds`/`keywordIds`.

**References**: `TmdbClient.java`'s `discover(List<Integer>, List<Integer>, String)`.

**Test Case (Red)**:
```groovy
def "SERIES-029-AC-06: discover sends vote_count.gte only when minVoteCount is positive"() {
    given: "a mocked TMDB response"
    mockServer.expect(requestTo(containsString("vote_count.gte=200")))
        .andRespond(withSuccess('{"results":[]}', MediaType.APPLICATION_JSON))

    when: "discover is called with minVoteCount=200"
    tmdbClient.discover([18], [], "vote_average.desc", 200)

    then: "no exception -- the mock's URL assertion passed"
    noExceptionThrown()
}

def "SERIES-029-AC-06: discover omits vote_count.gte entirely when minVoteCount is 0"() {
    given: "a mocked TMDB response asserting the param is absent"
    mockServer.expect(requestTo(not(containsString("vote_count.gte"))))
        .andRespond(withSuccess('{"results":[]}', MediaType.APPLICATION_JSON))

    when: "discover is called with minVoteCount=0"
    tmdbClient.discover([18], [], "popularity.desc", 0)

    then: "no exception -- the mock's URL assertion passed"
    noExceptionThrown()
}
```
**Test Case (Green)**: add the parameter and its conditional `queryParam("vote_count.gte", minVoteCount)` call.

---

### SERIES-029-AC-07 [AUTO]
**Statement**: `sourceByGenreOrKeyword` shall resolve its own effective `minVoteCount`
(`criteria.getMinVoteCount() != null ? criteria.getMinVoteCount() : defaultMinVoteCount`) and pass it to
`TmdbClient.discover(...)`, mirroring `sourceTopRated`'s existing effective-minVoteCount-at-sourcing-time pattern.

**References**: `RecommendationSourcingService.sourceByGenreOrKeyword`.

**Test Case (Red)**:
```groovy
def "SERIES-029-AC-07: sourceByGenreOrKeyword sources via discover with the configured 200 default when minVoteCount is unset"() {
    given: "a sourcing service with defaultMinVoteCount=200"
    def svc = new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20, 200)

    when: "sourceByGenreOrKeyword is called with genres=['Crime'], no minVoteCount"
    svc.sourceByGenreOrKeyword(criteriaWith(genres: ["Crime"]))

    then: "discover is called with minVoteCount=200"
    1 * tmdbClient.discover(_, _, _, 200) >> []
}

def "SERIES-029-AC-07/SERIES-029-AC-09: an explicit minVoteCount overrides the 200 default"() {
    given: "a sourcing service with defaultMinVoteCount=200"
    def svc = new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20, 200)

    when: "sourceByGenreOrKeyword is called with genres=['Crime'], minVoteCount=5"
    svc.sourceByGenreOrKeyword(criteriaWith(genres: ["Crime"], minVoteCount: 5))

    then: "discover is called with the explicit value, not the 200 default"
    1 * tmdbClient.discover(_, _, _, 5) >> []
}
```
**Test Case (Green)**: resolve `effectiveMinVoteCount` the same way `sourceTopRated` already does; pass it as
`discover(...)`'s new fourth argument.

---

### SERIES-029-AC-08 [AUTO]
**Statement**: `genreBasedSupplement` shall continue passing `0` (no floor) to `TmdbClient.discover(...)`, preserving
its existing request shape and candidate pool exactly — this spec's sourcing-time floor applies to directed
genre/keyword sourcing only.

**References**: `RecommendationSourcingService.genreBasedSupplement` (the pool-based genre-frequency fallback).

**Test Case (Red)**:
```groovy
def "SERIES-029-AC-08: genreBasedSupplement still calls discover with minVoteCount=0"() {
    given: "a sourcing service and a completed series whose title-based sourcing yields nothing"
    seriesRepository.findAll() >> [completedSeries("Show", "tt0000001", LocalDateTime.now(), "Crime")]
    tmdbClient.findTvIdByImdbId(_) >> Optional.empty()

    when: "sourceFromPool falls back to the genre-frequency supplement"
    sourcingService.sourceFromPool(criteriaWith(), 20)

    then: "discover is called with minVoteCount=0, unchanged from before this spec"
    1 * tmdbClient.discover(_, [], RecommendationDefaults.DEFAULT_GENRE_SORT_BY, 0) >> []
}
```
**Test Case (Green)**: update the `genreBasedSupplement` call site to pass `0` explicitly as the new fourth argument.

---

### SERIES-029-AC-09 [AUTO]
**Statement**: An explicit `minVoteCount` request parameter (including `0`, to disable the floor) shall override the
configured default at the genre-directed sourcing call site, identical to `SERIES-024-AC-13`'s existing override
semantics for `topRated`.

**References**: covered by `SERIES-029-AC-07`'s second test case above.

---

### SERIES-029-AC-10 [AUTO]
**Statement**: Regression check, verified live against the real TMDB API (not just mocked) as part of this fix:
`genres=Crime` (no keyword) sorted by `vote_average.desc` or `first_air_date.desc` shall return a non-empty
candidate list.

**References**: manual verification against the running backend, documented in this spec's implementation notes once
complete — the exact reproduction steps are the table in this spec's Overview.

**Test Case (Green)**: re-run the three `curl`/fetch checks from the Overview table against the implemented backend;
record the new result counts in this spec's Status line once verified.

**Verified (2026-08-27)**, against the running backend (`gradlew.bat bootRun`) and the real TMDB API:

| Query | Before this fix | After this fix |
|---|---|---|
| `genres=Crime`, `discoverSortBy=vote_average.desc` | 0 | **18** |
| `genres=Crime`, `discoverSortBy=first_air_date.desc` | 0 | **19** |
| `genres=Crime`, `discoverSortBy=popularity.desc` (control, unaffected by this fix) | 10 | **17** (still non-zero and working; the exact count naturally drifts over time as TMDB's own catalog/vote counts change) |

---

## Cross-References

| This spec | Source |
|---|---|
| `RecommendationCriteria.minVoteCount`, `applyOutputFilters`'s `matchesMinVoteCount`, the original `DEFAULT_MIN_VOTE_COUNT = 20` | `series_spec_007_recommendation_sourcing.md` |
| `sourceTopRated`, `TmdbClient.discoverTopRated(minVoteCount, sortBy)`'s existing `vote_count.gte` precedent this spec mirrors for `discover(...)` | `series_spec_022_trending_and_top_rated_recommendations.md` |
| `DEFAULT_MIN_VOTE_COUNT_TOP_RATED = 200`, the mode-aware default pattern (`SERIES-024-AC-09..13`) this spec extends but does not modify | `series_spec_024_discover_filters_and_vote_threshold.md` |
| `sourceByGenreOrKeyword`, `TmdbClient.discover(genreIds, keywordIds, sortBy)`'s current 3-arg signature being extended to 4 | `series_spec_025_discover_native_sort.md` |
| `app.tmdb.max-source-series`/`max-candidates`/`max-per-source` — the `@Value`-injection-without-a-centralized-constant convention this spec follows for `default-min-vote-count` | `series_spec_007_recommendation_sourcing.md` (constructor pattern), `application.yml` |

---

## Acceptance Criteria Summary

- [x] SERIES-029-AC-01: `RecommendationOutputFilterService` gains injected `defaultMinVoteCount` (`@Value`, default 200)
- [x] SERIES-029-AC-02: `RecommendationSourcingService` gains the same injected `defaultMinVoteCount`
- [x] SERIES-029-AC-03: `RecommendationDefaults.DEFAULT_MIN_VOTE_COUNT` removed; `DEFAULT_MIN_VOTE_COUNT_TOP_RATED` untouched
- [x] SERIES-029-AC-04: `application.yml` gains `app.tmdb.default-min-vote-count: 200`
- [x] SERIES-029-AC-05: non-`topRated` output filter defaults to 200, not 20
- [x] SERIES-029-AC-06: `TmdbClient.discover(...)` gains `minVoteCount`, sent as `vote_count.gte` only when > 0
- [x] SERIES-029-AC-07: `sourceByGenreOrKeyword` passes its effective `minVoteCount` to `discover(...)`
- [x] SERIES-029-AC-08: `genreBasedSupplement` still passes `0` (unchanged behavior)
- [x] SERIES-029-AC-09: an explicit `minVoteCount` request param overrides the default at the genre-directed call site
- [x] SERIES-029-AC-10: live regression check — `genres=Crime` + Vote Average/Newest returns non-empty results
