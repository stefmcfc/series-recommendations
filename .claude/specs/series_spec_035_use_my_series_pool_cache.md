# Series Spec 035: Cache the "Use My Series" Sourced Candidate Pool

**Status**: Implemented -- `backend/src/main/java/uk/co/stefirby/seriestracker/service/recommendation/PoolCacheKey.java` (new),
`backend/src/main/java/uk/co/stefirby/seriestracker/service/recommendation/RecommendationPoolCache.java` (new),
`backend/src/main/java/uk/co/stefirby/seriestracker/service/recommendation/RecommendationSourcingService.java` (wired),
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/recommendation/RecommendationPoolCacheSpec.groovy` (new),
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/recommendation/RecommendationSourcingServiceSpec.groovy` (constructor
update + new AC-06/07/08 tests), `backend/src/test/groovy/uk/co/stefirby/seriestracker/service/recommendation/RecommendationServiceSpec.groovy`
(constructor update, 3 call sites), `RUNBOOK.md` (2 new config rows)
**Priority**: P2 (real, confirmed waste — every sort-only re-request today re-runs every TMDB call
for the source pool, up to `app.tmdb.max-source-series` (default 20) `findTvIdByImdbId` +
`recommendations`/`similar` calls, plus a possible `discover` supplement, purely to re-order data
already fetched)
**Depends on**: Series Spec 007 (`series_spec_007_recommendation_sourcing.md`, owns
`RecommendationSourcingService.sourceFromPool`/`resolveSourcePool`) ✅, Series Spec 015
(`series_spec_015_multi_source_recommendations.md`, owns `RawCandidate`/ranking) ✅, Series Spec 033
(`series_spec_033_use_my_series_explicit_mode.md`, owns the `useMySeriesMode` routing this spec's
caching sits behind) ✅
**Area**: Backend (`service/RecommendationSourcingService.java`, new
`service/RecommendationPoolCache.java`). No frontend change — this is entirely transparent to the
existing `GET /api/v1/series/recommendations` request/response contract.

## Overview

Confirmed (2026-08-29): for "Use My Series" mode, sort (`sortBy` — "Best Match"/`score` vs. "Most
Recommended"/`recommendationCount`) is resolved entirely in-memory, after sourcing
(`RecommendationRankingService.resolveSortComparator`, applied in `RecommendationService.doRecommend`).
It is never pushed down into the TMDB request the way Discover modes' `discoverSortBy` is. Despite
that, today's frontend (`frontend_spec_040`'s "Apply Filters" gate) sends a completely fresh
`GET /api/v1/series/recommendations` request on every Sort By change, and the backend has no
caching anywhere in the recommendation path — `sourceFromPool` unconditionally re-resolves the
source pool and re-hits TMDB (`findTvIdByImdbId`, `recommendations`/`similar`, and the genre-based
`discover()` supplement) every single time, even when the only thing that changed is how the
already-fetched candidates get ordered.

Reading `RecommendationService.doRecommend`'s pipeline confirms the fix's scope precisely:
`sourceFromPool` (Step 1) is the *only* expensive step — everything after it (dedup, output
filtering, ranking/scoring, sort, diversity cap) is cheap, in-memory work over whatever
`sourceFromPool` already returned. So caching `sourceFromPool`'s raw output, keyed on exactly what
determines *which series get queried* (not how results get filtered, scored, or ordered
afterward), transparently speeds up far more than just a sort change — an `excludeGenres`,
`excludeKeywords`, or output-side `minTmdbRating` change (all applied post-hoc, after sourcing —
confirmed via `RecommendationOutputFilterService`/`genreBasedSupplement`'s deliberate
`DiscoverFilters.NONE` for pool-based sourcing) also becomes a cache hit, not just `sortBy`.

**Decided in discussion (2026-08-29)**: implement this as a backend, server-side cache rather than
having the frontend hold and re-sort results client-side. The scoring formula
(`RecommendationRankingService.score`) already has a confirmed future — `SPEC_CANDIDATES.md`'s
"Customizable recommendation algorithm" candidate (adjustable blend weights, additional scoring
terms, confidence weighting, per-user rating normalization) — and every one of those additions
would need its own raw data shipped to a frontend re-sort implementation, plus a hand-maintained
TypeScript mirror of whatever Java scoring formula exists at the time, permanently at risk of
drifting out of sync. A backend cache keeps scoring as a single, server-side source of truth
indefinitely: every future weighting/sorting option becomes "another cheap in-memory recompute
against the same cached pool," with zero `RecommendationDto` growth and zero frontend scoring logic
ever required.

## Design Decisions

- **Cache boundary is `sourceFromPool`'s full return value** (`List<RawCandidate>`) — not a
  narrower slice, and not `resolveSourcePool`'s DB-only portion (which is already cheap and isn't
  the bottleneck). The entire method, including both the title-based per-source TMDB calls and the
  genre-based supplement, is wrapped.
- **Cache key** (`PoolCacheKey`) is built from exactly what feeds into `sourceFromPool`'s TMDB
  calls: `seriesIds` (sorted, distinct — empty list represents the automatic pool),
  `minSourceRating`, and the `limit` parameter (`sourceFromPool` itself uses `limit` to decide
  whether to run the genre-based supplement, so it's part of what defines the cached result, not
  just a display concern). **Deliberately excludes** `sortBy`, `excludeGenres`, `excludeKeywords`,
  `minTmdbRating` (as an output filter), `maxSourcesShown`, `maxPerSource` — all applied strictly
  after sourcing, per `doRecommend`'s pipeline order, so none of them affect what should be cached.
- **New standalone `RecommendationPoolCache` component**, not a general-purpose Spring Cache
  (`@Cacheable`) or a new dependency (Caffeine, etc.) — this project has no existing caching
  library dependency, and a plain `ConcurrentHashMap`-backed TTL cache with a handful of entries
  (single-user app, naturally small distinct-query variety per session) doesn't need one. Exposes
  one method, `getOrCompute(PoolCacheKey key, Supplier<List<RawCandidate>> loader)`, so
  `RecommendationSourcingService` doesn't need its own hit/miss branching logic.
- **`Clock`-injected, per this project's established convention** (`config/ClockConfig.java`) —
  `RecommendationPoolCache` takes a constructor-injected `Clock` rather than calling
  `Instant.now()` directly, so TTL expiry is testable with `Clock.fixed(...)` without a real wait.
- **TTL-only expiry — no active invalidation when a pool-member series is edited.** A user editing
  a series that's part of a currently-cached pool (rating change, status change, exclude flag,
  `imdbId` change) won't be reflected until the cache entry naturally expires. This is a deliberate
  simplicity call: active invalidation would mean threading cache-eviction hooks through every
  `SeriesService` mutation path for a low-probability, low-impact edge case (single-user app,
  the affected window is bounded tightly by a short TTL, and the user can always force a fresh
  fetch by changing something that *does* vary the cache key, e.g. `minSourceRating`). Revisit if
  staleness turns out to matter more in practice than expected.
- **TTL default 10 minutes, capacity default 50 entries — both configurable, neither load-bearing.**
  `app.recommendations.pool-cache-ttl-minutes` / `app.recommendations.pool-cache-max-entries`,
  following this project's established `@Value("${...:default}")` pattern (mirrors
  `app.tmdb.max-source-series` etc.) so both are retunable without a code change.
- **Eviction on overflow**: expired entries are swept first; if still over capacity, the single
  oldest remaining entry (by `cachedAt`) is evicted. Not a strict LRU — unnecessary complexity for
  a cache this small, and a straightforward oldest-first rule is simple to implement and test.
- **Scope is limited to `sourceFromPool`.** `sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword`
  stay uncached — their sort is already pushed into the TMDB request itself (`discoverSortBy`), so a
  sort change for those modes is already a genuinely different TMDB query, not a wasted repeat of
  an identical one.
- **Existing `RecommendationSourcingServiceSpec.groovy` tests need only a one-line constructor
  change**, not individual rewrites: giving the test fixture a fresh, real (not mocked)
  `RecommendationPoolCache` instance (Spock instantiates a new spec instance per feature method, so
  the cache starts empty every test) means every existing test's calls remain guaranteed cache
  misses — the real sourcing logic still runs, and every existing `tmdbClient` interaction
  assertion continues to pass unmodified.

---

## Requirement 1: `RecommendationPoolCache` — a TTL-bounded, size-bounded key/value cache

**User story**: As a developer, I want a small, dependency-free cache component I can wrap around
an expensive computation, so repeated calls with the same effective inputs skip the expensive work.

### SERIES-035-AC-01 [AUTO]
**Statement**: `RecommendationPoolCache.getOrCompute(key, loader)` shall call `loader.get()` and
store its result when no entry exists for `key`, returning the loader's result.

**Test Case (Red)**:
```groovy
def "SERIES-035-AC-01: a cache miss calls the loader and returns its result"() {
    given: "an empty cache"
        def cache = new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50)
        def key = new PoolCacheKey([], null, 20)
        def loader = Mock(Supplier)

    when: "getOrCompute is called"
        def result = cache.getOrCompute(key, loader)

    then: "the loader is called once, and its result is returned"
        1 * loader.get() >> [someCandidate]
        result == [someCandidate]
}
```
**Test Case (Green)**: `RecommendationPoolCache` backed by a `ConcurrentHashMap<PoolCacheKey,
CacheEntry>`; `getOrCompute` checks for a live (non-expired) entry, calling `loader.get()` and
storing a new `CacheEntry(value, clock.instant())` on a miss.

---

### SERIES-035-AC-02 [AUTO]
**Statement**: A subsequent `getOrCompute` call with an equal `key` (by value) within the TTL
window shall return the cached value without calling `loader.get()` again.

**Test Case (Red)**:
```groovy
def "SERIES-035-AC-02: a repeat call with an equal key within TTL is a cache hit"() {
    given: "a cache with one entry already populated"
        def cache = new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50)
        def key = new PoolCacheKey([UUID.fromString("11111111-1111-1111-1111-111111111111")], null, 20)
        cache.getOrCompute(key, Mock(Supplier) { 1 * get() >> [someCandidate] })

    when: "getOrCompute is called again with an equal key"
        def result = cache.getOrCompute(key, Mock(Supplier) { 0 * get() })

    then: "the cached value is returned without invoking the loader"
        result == [someCandidate]
}
```
**Test Case (Green)**: falls out of AC-01's implementation directly — the live-entry check finds
the just-stored entry.

---

### SERIES-035-AC-03 [AUTO]
**Statement**: A `getOrCompute` call with an equal `key` after `app.recommendations.pool-cache-ttl-minutes`
minutes have elapsed (per the injected `Clock`) shall call `loader.get()` again and replace the
cached entry.

**Test Case (Red)**:
```groovy
def "SERIES-035-AC-03: an expired entry is a cache miss"() {
    given: "a cache with a 10-minute TTL, and a fixed starting clock"
        def start = Instant.parse("2026-08-29T10:00:00Z")
        def clock = Clock.fixed(start, ZoneOffset.UTC)
        def cache = new RecommendationPoolCache(clock, 10, 50)
        def key = new PoolCacheKey([], null, 20)
        cache.getOrCompute(key, Mock(Supplier) { 1 * get() >> [oldCandidate] })

    when: "getOrCompute is called again 11 minutes later"
        clock = Clock.fixed(start.plus(Duration.ofMinutes(11)), ZoneOffset.UTC)
        // (reconstruct cache with the advanced clock, or use a settable test Clock wrapper)
        def result = cache.getOrCompute(key, Mock(Supplier) { 1 * get() >> [freshCandidate] })

    then: "the loader is called again and the fresh value is returned"
        result == [freshCandidate]
}
```
**Test Case (Green)**: `getOrCompute`'s live-entry check compares `clock.instant()` against the
stored entry's `cachedAt + ttl`; an expired entry is treated identically to a missing one.

---

### SERIES-035-AC-04 [AUTO]
**Statement**: `PoolCacheKey` equality and hashing shall be based on normalized field values —
`seriesIds` sorted and deduplicated before comparison — so two keys built from the same id set in a
different input order are equal.

**Test Case (Red)**:
```groovy
def "SERIES-035-AC-04: PoolCacheKey normalizes seriesIds order for equality"() {
    given: "two ids"
        def a = UUID.fromString("11111111-1111-1111-1111-111111111111")
        def b = UUID.fromString("22222222-2222-2222-2222-222222222222")

    expect: "keys built from the same ids in different orders are equal"
        new PoolCacheKey([a, b], null, 20) == new PoolCacheKey([b, a], null, 20)
}
```
**Test Case (Green)**: `PoolCacheKey` (a record) normalizes its `seriesIds` constructor argument
(`.stream().sorted().distinct().toList()`) in a compact canonical constructor, so the stored field
is always canonical regardless of input order — records derive `equals`/`hashCode` from their
canonical field state, so no separate override is needed.

---

### SERIES-035-AC-05 [AUTO]
**Statement**: When inserting a new entry would exceed `app.recommendations.pool-cache-max-entries`
(default 50), the cache shall first evict any already-expired entries; if still at capacity, it
shall evict the single entry with the oldest `cachedAt` before inserting the new one.

**Test Case (Red)**:
```groovy
def "SERIES-035-AC-05: inserting past capacity evicts the oldest entry"() {
    given: "a cache with capacity 2, holding two live (non-expired) entries"
        def clock = Clock.fixed(Instant.parse("2026-08-29T10:00:00Z"), ZoneOffset.UTC)
        def cache = new RecommendationPoolCache(clock, 10, 2)
        def oldest = new PoolCacheKey([], null, 1)
        def newer = new PoolCacheKey([], null, 2)
        cache.getOrCompute(oldest, Mock(Supplier) { 1 * get() >> [] })
        cache.getOrCompute(newer, Mock(Supplier) { 1 * get() >> [] })

    when: "a third distinct key is inserted"
        def third = new PoolCacheKey([], null, 3)
        cache.getOrCompute(third, Mock(Supplier) { 1 * get() >> [] })

    and: "the oldest key is requested again"
        def result = cache.getOrCompute(oldest, Mock(Supplier) { 1 * get() >> [freshOldest] })

    then: "the oldest entry was evicted, so this is a fresh miss"
        result == [freshOldest]
}
```
**Test Case (Green)**: `getOrCompute`'s insert path checks `map.size() >= maxEntries` (after
sweeping expired entries), evicting the entry with the minimum `cachedAt` among the remaining ones
before adding the new one.

---

## Requirement 2: `sourceFromPool` uses the pool cache

**User story**: As a user, changing Sort By (or an output-only filter) on "Use My Series" should
feel fast, not re-run every TMDB lookup for my whole watched pool again.

### SERIES-035-AC-06 [AUTO]
**Statement**: `RecommendationSourcingService.sourceFromPool` shall build a `PoolCacheKey` from
`criteria.getSeriesIds()` (sorted/distinct, empty for the automatic pool),
`criteria.getMinSourceRating()`, and the `limit` parameter, and resolve its result via
`RecommendationPoolCache.getOrCompute`, with the existing pool-resolution and TMDB-sourcing logic
(`resolveSourcePool` + `sourceTitleBased` + `genreBasedSupplement`) as the loader.

**References**: `RecommendationSourcingService.sourceFromPool`. Reuses `RecommendationPoolCache`
(`SERIES-035-AC-01`).

**Test Case (Red)**:
```groovy
def "SERIES-035-AC-06: sourceFromPool resolves its result through the pool cache"() {
    given: "a real pool cache and one eligible COMPLETED series"
        def poolCache = new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50)
        def sourcing = new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20, 200, poolCache)
        def source = completedSeries("Breaking Bad", "tt0903747", LocalDateTime.now())
        seriesRepository.findAll() >> [source]
        tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
        tmdbClient.recommendations(1396) >> [candidate(2316)]

    when: "sourceFromPool is called twice with an identical criteria/limit"
        sourcing.sourceFromPool(new RecommendationCriteria(), 20)
        sourcing.sourceFromPool(new RecommendationCriteria(), 20)

    then: "TMDB is only consulted once -- the second call was a cache hit"
        1 * tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
}
```
**Test Case (Green)**: `sourceFromPool` builds the key up front and wraps its existing body (the
`resolveSourcePool`/`sourceTitleBased`-loop/`genreBasedSupplement` logic, unchanged) in a lambda
passed to `poolCache.getOrCompute`.

---

### SERIES-035-AC-07 [AUTO]
**Statement**: Two `sourceFromPool` calls with equal `seriesIds`/`minSourceRating`/`limit` but a
different `sortBy` shall be a cache hit (zero `TmdbClient` calls on the second) — confirming this
spec's actual motivating scenario end-to-end.

**Test Case (Red)**:
```groovy
def "SERIES-035-AC-07: a sortBy-only change is a cache hit, not a re-fetch"() {
    given: "a real pool cache and one eligible COMPLETED series"
        def poolCache = new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50)
        def sourcing = new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20, 200, poolCache)
        def source = completedSeries("Breaking Bad", "tt0903747", LocalDateTime.now())
        seriesRepository.findAll() >> [source]
        tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
        tmdbClient.recommendations(1396) >> [candidate(2316)]

    when: "sourceFromPool is called with sortBy=score, then again with sortBy=recommendationCount"
        sourcing.sourceFromPool(new RecommendationCriteria(sortBy: "score"), 20)
        sourcing.sourceFromPool(new RecommendationCriteria(sortBy: "recommendationCount"), 20)

    then: "TMDB is only consulted on the first call"
        1 * tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
}
```
**Test Case (Green)**: falls out of AC-06 directly — `sortBy` is never part of `PoolCacheKey`.

---

### SERIES-035-AC-08 [AUTO] (regression guard)
**Statement**: `sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword` shall remain uncached —
unaffected by this spec.

**Test Case (Green)**: no code change to those three methods; existing
`RecommendationSourcingServiceSpec.groovy` tests covering them (unchanged) continue to hit
`tmdbClient` on every call, confirming no caching leaked into those paths.

---

## Implementation Notes

- **`RecommendationSourcingService`'s constructor gains a 6th parameter**, `RecommendationPoolCache
  poolCache`. The existing `RecommendationSourcingServiceSpec.groovy` fixture (the class-level
  `sourcingService` field) needs a matching one-line update — see Design Decisions for why no other
  existing test in that file needs to change.
- **New Spring bean**: `RecommendationPoolCache` as a `@Service` (or plain `@Component`), taking
  `Clock`, `@Value("${app.recommendations.pool-cache-ttl-minutes:10}") int ttlMinutes`, and
  `@Value("${app.recommendations.pool-cache-max-entries:50}") int maxEntries`.
- **`RUNBOOK.md`'s configuration table** gains two rows for the new properties, matching the
  existing `app.tmdb.*` rows' format (property, default, description, `Overridable via
  APP_RECOMMENDATIONS_POOL_CACHE_TTL_MINUTES`/`APP_RECOMMENDATIONS_POOL_CACHE_MAX_ENTRIES`, spec
  cross-reference).
- **No `API.md` change** — this spec doesn't touch the request or response contract of `GET
  /api/v1/series/recommendations` at all, purely an internal performance change.
- **No frontend change** — confirmed out of scope; `frontend_spec_040`'s existing "Apply Filters"
  request-sending behavior is untouched, it just gets a faster response for the cases this spec
  covers.

## Cross-References

| This spec | Source |
|---|---|
| `sourceFromPool`, `resolveSourcePool`, `RawCandidate` | `series_spec_007_recommendation_sourcing.md` |
| `RecommendationRankingService.resolveSortComparator`, `score` (the in-memory-only step this cache makes cheap to repeat) | `series_spec_015_multi_source_recommendations.md` |
| `useMySeriesMode` routing this cache sits behind | `series_spec_033_use_my_series_explicit_mode.md` |
| `Clock` injection convention | `config/ClockConfig.java` |
| Future scoring/weighting work this design keeps server-side-only for | `.claude/SPEC_CANDIDATES.md` ("Customizable recommendation 'algorithm'...") |

---

## Acceptance Criteria Summary

- [x] SERIES-035-AC-01: a cache miss calls the loader and returns its result
- [x] SERIES-035-AC-02: a repeat call with an equal key within TTL is a cache hit
- [x] SERIES-035-AC-03: an expired entry is a cache miss
- [x] SERIES-035-AC-04: `PoolCacheKey` normalizes `seriesIds` order for equality
- [x] SERIES-035-AC-05: inserting past capacity evicts the oldest entry
- [x] SERIES-035-AC-06: `sourceFromPool` resolves its result through the pool cache
- [x] SERIES-035-AC-07: a `sortBy`-only change is a cache hit, not a re-fetch
- [x] SERIES-035-AC-08: `trending`/`topRated`/Custom Search sourcing remain uncached
