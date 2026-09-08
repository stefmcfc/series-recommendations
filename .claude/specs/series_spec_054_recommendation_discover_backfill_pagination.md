# Spec 054: Recommendation Discover-Mode Backfill Pagination

**Status**: Not started
**Priority**: P2 (correctness fix to core recommendation output quality — today's single-page
sourcing can silently return far fewer results than requested, not a new user-facing feature)
**Depends on**: `series_spec_007_recommendation_sourcing.md` (`RecommendationSourcingService`,
`RawCandidate`, the four sourcing-strategy shape this spec extends three of), `series_spec_006_recommendations.md`
(the dedup → output-filter → limit pipeline this spec's stopping condition evaluates against),
`series_spec_018_series_refresh.md` (TMDB free-tier rate-limit precedent, referenced for this
spec's own rate-limit consideration)
**Backend Task**

## Overview

`RecommendationService.doRecommend` sources raw candidates from exactly one TMDB call for three
of its four sourcing modes — trending, topRated, and Custom Search (genre/keyword-directed,
`sourceByGenreOrKeyword`) — none of which ever requests a `page` beyond TMDB's own implicit first
page (~20 results). After that single page runs through deduplication (which drops anything
already in the library, already ignored, or whose `imdb_id` fails to resolve) and the output
filters, the final `.limit(limit)`'d result can come up materially short of the requested count —
even though TMDB likely has more matching results on page 2+ that this app has never asked for.
This spec adds a bounded, automatic backfill: when a page's results still leave a mode short of
its requested `limit` after dedup/filtering, fetch additional TMDB pages (up to a new safety cap)
and merge them into the same candidate pool before the response is built, instead of returning
whatever a single ~20-result TMDB page happened to survive down to.

"Use My Series" mode (`sourceFromPool`) is explicitly untouched by this spec — see Design
Decisions.

## Design Decisions

- **Only the three direct-TMDB-discover modes gain pagination; "Use My Series" does not.**
  `sourceFromPool` already fans out across many source series' own `/recommendations`+`/similar`
  calls (many single-page calls across many sources), a materially different shape from "one
  paginated call against one TMDB discover/trending endpoint." It's also less likely to come up
  short the same way, since a shortfall from one source is diluted across all the others. Any fix
  there would look different (e.g. per-source page requests, or expanding `maxSourceSeries`) and
  is deliberately deferred — see `.claude/SPEC_CANDIDATES.md`'s "Weight recommendation scoring..."
  candidate, open question #10, which already flags this as a distinct, unresolved question for
  that separate (and much larger) candidate. Nobody should read this spec as having quietly solved
  that too.
- **The pagination loop lives inside `RecommendationSourcingService`, not
  `RecommendationService.doRecommend`.** `sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword`
  each gain a `limit` parameter (mirroring `sourceFromPool`'s existing `(criteria, limit)` shape —
  the one sourcing method that already needs to know how many results the caller wants) and, when
  the first page's results plus every following page's results still leave the running post-dedup/
  post-output-filter candidate count short of `limit`, request the next page and merge its raw
  candidates into the accumulated set before checking again. `RecommendationService.doRecommend`'s
  own call sites for these three methods change only to pass `limit` through — its own subsequent
  `deduplicationService.dedupeAndExclude(capped)` / `outputFilterService.applyOutputFilters(...)`
  calls are otherwise unchanged code (Requirement 5).
- **To know whether a page's results are "enough," the sourcing loop evaluates the real post-dedup/
  post-output-filter count, not a raw-candidate-count proxy.** A raw-count check (e.g. "stop once
  >= `limit` raw candidates have been seen") would not fix the actual problem this spec exists to
  fix: TMDB's own first page already very often returns >= `limit` raw results (the default
  `limit` is 20, close to TMDB's own page size), yet dedup/filtering is exactly what shrinks that
  down below `limit` today. So `RecommendationSourcingService` gains two new constructor-injected
  dependencies — `RecommendationDeduplicationService` and `RecommendationOutputFilterService`
  (both already Spring-managed `@Service` beans in this same package) — used *only* internally by
  the pagination loop to evaluate "would this already be enough?" after each fetched page.
- **This means a candidate is dedup-resolved (its `imdb_id` looked up via `TmdbClient.externalIds`)
  more than once: once per loop iteration's stopping check inside `RecommendationSourcingService`,
  and again in `RecommendationService.doRecommend`'s own final, unchanged
  `deduplicationService.dedupeAndExclude(capped)` call over whatever multi-page raw list the
  sourcing method returns.** This is a deliberate simplicity-over-efficiency trade-off, not an
  oversight: introducing a stateful incremental-dedup cache purely to avoid re-resolving the same
  handful of candidates a second or third time would add real complexity for a personal,
  single-user app where the added TMDB call volume is small and bounded (see the rate-limit
  consideration below). Revisit only if this proves to actually matter in practice.
- **`app.tmdb.max-discover-pages` defaults to `3`.** TMDB's own page size (~20) × 3 pages ≈ 60 raw
  candidates before `app.tmdb.max-candidates` (default `50`) already caps further growth — so 3
  pages is already close to saturating today's existing candidate cap in the worst case. Going
  higher mostly costs extra TMDB calls (both the page fetch itself and the `externalIds` resolution
  for a larger raw pool) for diminishing benefit once the existing 50-candidate cap is the binding
  constraint anyway.
- **Rate-limit awareness.** This app already has a documented TMDB rate-limit concern
  (`series_spec_018_series_refresh.md`'s fixed-delay-between-items mechanism, sized against TMDB's
  free tier's ~40 requests/10s) for its one genuinely bulk operation (`POST /series/refresh-all`).
  A single `GET /series/recommendations` request now potentially issuing up to `max-discover-pages`
  TMDB page-fetch calls per direct-discover mode (plus, per the trade-off above, more
  `externalIds` resolution calls than before) is a real increase, but a small, bounded one — a
  personal single-user app fielding one interactive request at a time, not a bulk job iterating
  over an entire collection. No new throttling mechanism is introduced for this endpoint; this is
  noted explicitly rather than silently ignored, and is easy to revisit (e.g. lowering
  `max-discover-pages`) if it ever proves to matter in practice.
- **TMDB's `page` query param is omitted entirely for page 1, not sent as `page=1` explicitly.**
  Every existing call site and Spock spec already asserts the exact request shape TMDB receives
  today (no `page` param at all) — omitting it keeps that byte-identical, so none of those existing
  assertions need to change. The new page-aware behavior only ever sends `page` when requesting
  page 2 or later.
- **New `TmdbClient` overloads, not signature changes to the existing methods.** `trending`,
  `discoverTopRated`, and `discover` each gain a new overload accepting a trailing `int page`,
  rather than adding a required `page` parameter to the existing methods. The existing three
  methods have roughly three dozen combined call sites across `TmdbClientSpec`,
  `RecommendationSourcingServiceSpec`, and `RecommendationServiceSpec` (including
  `genreBasedSupplement`'s own `discover(...)` call, part of the explicitly-untouched "Use My
  Series" path) — changing their signature would force every one of those to be touched for a
  parameter none of them need. A new overload, called only by the three sourcing methods' internal
  page-2+ fetches, means zero of those existing call sites change.

## Requirements

### Requirement 1: `TmdbClient` supports fetching a specific TMDB result page

**User story**: As the recommendation sourcing layer, I need to ask TMDB for page 2, 3, ... of a
trending/top-rated/discover query, not just its implicit first page.

#### Acceptance Criteria

- **SERIES-054-AC-01** [AUTO]: `TmdbClient` shall gain an overload
  `trending(String timeWindow, int page)`, sending TMDB's own `page` query param on
  `GET /trending/tv/{timeWindow}` only when `page > 1`; the existing `trending(String timeWindow)`
  is unchanged and continues to send no `page` param at all (page-1 semantics).
- **SERIES-054-AC-02** [AUTO]: `TmdbClient` shall gain an overload
  `discoverTopRated(int minVoteCount, String sortBy, int page)`, sending TMDB's own `page` query
  param on `GET /discover/tv` only when `page > 1`; the existing
  `discoverTopRated(int minVoteCount, String sortBy)` is unchanged.
- **SERIES-054-AC-03** [AUTO]: `TmdbClient` shall gain an overload
  `discover(List<Integer> genreIds, List<Integer> keywordIds, String sortBy, DiscoverFilters
  filters, int page)`, sending TMDB's own `page` query param on `GET /discover/tv` only when
  `page > 1`; the existing `discover(List, List, String, DiscoverFilters)` is unchanged.
- **SERIES-054-AC-04** [AUTO]: Every existing call site of `trending(String)`,
  `discoverTopRated(int, String)`, and `discover(List, List, String, DiscoverFilters)` (including
  `RecommendationSourcingService.genreBasedSupplement`, part of the untouched "Use My Series"
  path) shall continue to send an identical request to today — no `page` query param at all.

---

### Requirement 2: `RecommendationSourcingService` backfills additional pages when short

**User story**: As a user browsing trending/top-rated/Custom Search recommendations, I want a full
page of results even when a chunk of TMDB's first page gets filtered out by deduplication or my
own criteria, so I'm not shown fewer results than I asked for just because TMDB's own page
happened to be thin after filtering.

#### Acceptance Criteria

- **SERIES-054-AC-05** [AUTO]: `RecommendationSourcingService.sourceTrending` shall gain an `int
  limit` parameter (matching `sourceFromPool`'s existing `(RecommendationCriteria, int)` shape).
- **SERIES-054-AC-06** [AUTO]: `RecommendationSourcingService.sourceTopRated` shall gain an `int
  limit` parameter.
- **SERIES-054-AC-07** [AUTO]: `RecommendationSourcingService.sourceByGenreOrKeyword` shall gain an
  `int limit` parameter.
- **SERIES-054-AC-08** [AUTO]: `RecommendationService.doRecommend` shall pass its own `limit`
  parameter through to whichever of `sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword` it
  calls.
- **SERIES-054-AC-09** [AUTO]: After fetching a page's raw candidates, `sourceTrending`/
  `sourceTopRated`/`sourceByGenreOrKeyword` shall evaluate the accumulated raw candidates (across
  every page fetched so far, for that call) through `RecommendationDeduplicationService
  .dedupeAndExclude` and `RecommendationOutputFilterService.applyOutputFilters` (using the same
  `RecommendationCriteria` the call was made with); if the resulting count is still short of
  `limit`, the next TMDB page shall be requested and its raw candidates merged into the same
  accumulated set before re-evaluating.

---

### Requirement 3: Configurable safety cap on how many pages are fetched

**User story**: As the app's operator, I want a bounded, overridable limit on how many extra TMDB
pages a single recommendations request can trigger, so a request can never spiral into an
unbounded number of upstream calls.

#### Acceptance Criteria

- **SERIES-054-AC-10** [AUTO]: `application.yml` shall gain `app.tmdb.max-discover-pages`
  (constructor-injected `@Value("${app.tmdb.max-discover-pages:3}")` on
  `RecommendationSourcingService`, matching the existing `max-source-series`/`max-per-source`
  injection convention there), overridable via `APP_TMDB_MAX_DISCOVER_PAGES` without a code
  change, documented with a comment matching the style of the adjacent `max-candidates`/
  `max-source-series` entries.

---

### Requirement 4: Stopping conditions

**User story**: As a user, I want the backfill to stop as soon as it's found enough, stop cleanly
if TMDB genuinely has no more matching results, and never error out just because fewer results
exist than I asked for.

#### Acceptance Criteria

- **SERIES-054-AC-11** [AUTO]: If the post-dedup/post-output-filter candidate count evaluated per
  `SERIES-054-AC-09` has reached `limit`, then `sourceTrending`/`sourceTopRated`/
  `sourceByGenreOrKeyword` shall stop fetching further pages, even if `app.tmdb.max-discover-pages`
  has not yet been reached.
- **SERIES-054-AC-12** [AUTO]: If `app.tmdb.max-discover-pages` pages have already been fetched and
  the post-dedup/post-output-filter count is still short of `limit`, then `sourceTrending`/
  `sourceTopRated`/`sourceByGenreOrKeyword` shall stop and return whatever raw candidates were
  accumulated — this shall never raise an error or exception; a shortfall is a valid, expected
  outcome when TMDB genuinely has fewer matching results than requested.
- **SERIES-054-AC-13** [AUTO]: If a fetched page's `results[]` is empty (TMDB's own end-of-results
  signal), then `sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword` shall stop immediately
  and not request any further page, even if `app.tmdb.max-discover-pages` has not yet been reached.

---

### Requirement 5: Downstream pipeline and response shape are unaffected

**User story**: As a maintainer, I want this spec's change scoped strictly to *sourcing* more raw
candidates — not to touch how those candidates are subsequently deduplicated, filtered, ranked, or
shaped into the response.

#### Acceptance Criteria

- **SERIES-054-AC-14** [AUTO]: `RecommendationService.doRecommend`'s existing capping
  (`maxCandidates`), deduplication, output-filtering, ranking/diversity-cap (where applicable), and
  final `.limit(limit)` logic shall be otherwise unchanged — the (possibly multi-page-sourced) raw
  candidate list Requirement 2 returns flows through the exact same downstream code as before this
  spec.
- **SERIES-054-AC-15** [AUTO]: When `sourceMode` selects "Use My Series" (`sourceFromPool`), this
  spec's pagination mechanism shall not apply — `sourceFromPool`'s existing per-source, single-page
  behavior is unchanged (see Design Decisions).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationSourcingService`'s four sourcing strategies, `RawCandidate`, `maxSourceSeries`/`defaultMinVoteCount` injection convention this spec's `max-discover-pages` follows | `series_spec_007_recommendation_sourcing.md` |
| Dedup → output-filter → limit pipeline (`RecommendationDeduplicationService`, `RecommendationOutputFilterService`) this spec's stopping check (SERIES-054-AC-09) evaluates against, unchanged per Requirement 5 | `series_spec_006_recommendations.md` |
| TMDB free-tier rate limit (~40 requests/10s) informing this spec's rate-limit consideration | `series_spec_018_series_refresh.md` |
| "Use My Series" pagination — explicitly deferred, not covered by this spec | `.claude/SPEC_CANDIDATES.md`, "Weight recommendation scoring and/or output filters..." candidate, open question #10 |
| `sourceFromPool`'s existing `(RecommendationCriteria, int limit)` shape, mirrored by this spec's other three sourcing methods | `backend/src/main/java/uk/co/stefirby/seriestracker/service/recommendation/RecommendationSourcingService.java` |

---

## TDD Test Case Sketches

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/client/tmdb/TmdbClientSpec.groovy` (additions)

```groovy
def "SERIES-054-AC-01: trending(timeWindow, page) sends the page param when page > 1"() {
    given: "a mocked TMDB server expecting GET /trending/tv/week?page=2"
        mockServer.expect(requestTo(Matchers.containsString("trending/tv/week")))
            .andExpect(method(HttpMethod.GET))
            .andExpect(queryParam("page", "2"))
            .andRespond(withSuccess('{"results":[]}', MediaType.APPLICATION_JSON))

    when: "TmdbClient.trending('week', 2) is called"
        client().trending("week", 2)

    then: "no exception -- the mocked request above matched"
        noExceptionThrown()
}

def "SERIES-054-AC-04: trending(timeWindow, 1) sends no page param at all"() {
    given: "a mocked TMDB server expecting no page query param"
        mockServer.expect(requestTo(Matchers.containsString("trending/tv/week")))
            .andExpect(MockRestRequestMatchers.queryParam("page").doesNotExist())
            .andRespond(withSuccess('{"results":[]}', MediaType.APPLICATION_JSON))

    when: "TmdbClient.trending('week', 1) is called"
        client().trending("week", 1)

    then: "no exception -- the mocked request above matched"
        noExceptionThrown()
}
```

*(Analogous pairs for `discoverTopRated(minVoteCount, sortBy, page)` and `discover(genreIds,
keywordIds, sortBy, filters, page)`.)*

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/service/recommendation/RecommendationSourcingServiceSpec.groovy` (additions)

```groovy
def "SERIES-054-AC-09/11: sourceTrending stops paging once dedup/filter yields enough"() {
    given: "page 1 returns 20 raw candidates, but dedup/filter would only keep 15 of them"
        def criteria = new RecommendationCriteria()

    when: "sourceTrending is called with limit=15"
        sourcingService.sourceTrending(criteria, 15)

    then: "only page 1 is fetched -- the running post-dedup/filter count already reached 15"
        1 * tmdbClient.trending("week") >> twentyRawCandidates()
        0 * tmdbClient.trending("week", 2)
        1 * deduplicationService.dedupeAndExclude(_) >> fifteenDeduped()
        1 * outputFilterService.applyOutputFilters(_, criteria) >> fifteenDeduped()
}

def "SERIES-054-AC-09: sourceTrending fetches page 2 when page 1's post-dedup/filter count is short"() {
    given: "page 1's 20 raw candidates dedup/filter down to only 5, short of limit=20"
        def criteria = new RecommendationCriteria()

    when: "sourceTrending is called with limit=20"
        sourcingService.sourceTrending(criteria, 20)

    then: "page 2 is fetched and merged"
        1 * tmdbClient.trending("week") >> twentyRawCandidates()
        1 * deduplicationService.dedupeAndExclude(_) >> fiveDeduped() >> stillShortAfterMerge()
        1 * outputFilterService.applyOutputFilters(_, criteria) >> fiveDeduped() >> stillShortAfterMerge()
        1 * tmdbClient.trending("week", 2) >> moreRawCandidates()
}

def "SERIES-054-AC-12: sourceTrending stops at max-discover-pages even if still short"() {
    given: "a sourcingService configured with maxDiscoverPages=3, every page still short after dedup"
        def criteria = new RecommendationCriteria()

    when: "sourceTrending is called with limit=100"
        sourcingService.sourceTrending(criteria, 100)

    then: "exactly 3 pages are fetched total, no error is thrown"
        1 * tmdbClient.trending("week") >> twentyRawCandidates()
        1 * tmdbClient.trending("week", 2) >> twentyRawCandidates()
        1 * tmdbClient.trending("week", 3) >> twentyRawCandidates()
        0 * tmdbClient.trending("week", 4)
        notThrown(Exception)
}

def "SERIES-054-AC-13: sourceTrending stops immediately on an empty page, before max-discover-pages"() {
    given: "page 2 returns an empty results array"
        def criteria = new RecommendationCriteria()

    when: "sourceTrending is called with limit=100"
        sourcingService.sourceTrending(criteria, 100)

    then: "no page 3 is ever requested"
        1 * tmdbClient.trending("week") >> twentyRawCandidates()
        1 * tmdbClient.trending("week", 2) >> []
        0 * tmdbClient.trending("week", 3)
}
```

*(Analogous cases for `sourceTopRated`/`sourceByGenreOrKeyword`, mirroring the same four
stopping-condition scenarios against `discoverTopRated`/`discover`.)*

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/service/recommendation/RecommendationServiceSpec.groovy` (additions)

```groovy
def "SERIES-054-AC-08: doRecommend passes its own limit through to sourceTrending"() {
    when: "recommend(15, criteria-with-trending-mode) is called"
        service.recommend(15, trendingCriteria())

    then: "sourcingService.sourceTrending receives limit=15"
        1 * sourcingService.sourceTrending(_, 15) >> []
}

def "SERIES-054-AC-14: the final response is built by the same unchanged downstream pipeline"() {
    given: "sourceTrending returns a multi-page-merged raw candidate list"
        // ...

    when: "recommend is called"
        def result = service.recommend(20, trendingCriteria())

    then: "deduplicationService/outputFilterService are invoked exactly as before this spec, once each"
        1 * deduplicationService.dedupeAndExclude(_) >> []
        1 * outputFilterService.applyOutputFilters(_, _) >> []
}
```

**Test Case (Green)**: implement the new `TmdbClient` overloads, the `limit`-parameterized
sourcing methods' internal page-fetch loop, and the new `application.yml` property until the
specs above pass.

---

## Acceptance Criteria Summary

- [ ] SERIES-054-AC-01: `TmdbClient.trending(timeWindow, page)` sends `page` only when `page > 1`
- [ ] SERIES-054-AC-02: `TmdbClient.discoverTopRated(minVoteCount, sortBy, page)` sends `page` only when `page > 1`
- [ ] SERIES-054-AC-03: `TmdbClient.discover(genreIds, keywordIds, sortBy, filters, page)` sends `page` only when `page > 1`
- [ ] SERIES-054-AC-04: every existing call site of the three no-page overloads is unaffected
- [ ] SERIES-054-AC-05: `sourceTrending` gains an `int limit` parameter
- [ ] SERIES-054-AC-06: `sourceTopRated` gains an `int limit` parameter
- [ ] SERIES-054-AC-07: `sourceByGenreOrKeyword` gains an `int limit` parameter
- [ ] SERIES-054-AC-08: `doRecommend` passes `limit` through to whichever sourcing method it calls
- [ ] SERIES-054-AC-09: a short post-dedup/post-filter count triggers fetching and merging the next page
- [ ] SERIES-054-AC-10: `application.yml` gains `app.tmdb.max-discover-pages` (default `3`)
- [ ] SERIES-054-AC-11: paging stops once the post-dedup/post-filter count reaches `limit`
- [ ] SERIES-054-AC-12: paging stops at `max-discover-pages` without erroring, even if still short
- [ ] SERIES-054-AC-13: paging stops immediately on an empty page's `results[]`
- [ ] SERIES-054-AC-14: the existing downstream cap/dedup/filter/ranking/limit pipeline is unchanged
- [ ] SERIES-054-AC-15: "Use My Series" (`sourceFromPool`) is unaffected by this spec
