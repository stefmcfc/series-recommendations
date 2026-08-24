# Series Spec 025: TMDB-Native Sort for Highest Rated and Genre & Keyword Modes

**Status**: Implemented (2026-08-24). Files touched: `backend/src/main/java/uk/co/stefirby/seriestracker/client/TmdbClient.java` (`discover(List, List, String)`, `discoverTopRated(int, String)` — both gained a required `sortBy` param, `discoverTopRated`'s previously-hardcoded `"vote_average.desc"` literal replaced), `backend/src/main/java/uk/co/stefirby/seriestracker/dto/RecommendationCriteria.java` (`discoverSortBy` field), `backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationService.java` (`VALID_DISCOVER_SORT_BY` enum validation in `validate()`, `resolveDiscoverSortBy()` mode-aware default resolution in `sourceTopRated()`/`sourceByGenreOrKeyword()`, `recommend()`'s ranking/diversity-cap bypass generalized from `trendingMode` alone to `trendingMode || topRatedMode || genreOrKeywordDirected`), `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesController.java` (`discoverSortBy` request param, wired straight through to `RecommendationCriteria` — not itself called out by an AC, but necessary for the new criteria field to be reachable via the API, following the same thin-controller wiring every other criteria field already uses). Existing Spock specs updated for the new `TmdbClient` signatures and the generalized bypass: `TmdbClientSpec.groovy`, `RecommendationServiceSpec.groovy` (including replacing the `SERIES-022-AC-15` "ranking applies normally to topRated" test, now superseded, with a `SERIES-025-AC-07` bypass-order test), `SeriesControllerRecommendationsSpec.groovy`.
**Deviation from the spec's literal wording**: `RecommendationService.genreBasedSupplement()` (the *pool-based* genre supplement used by automatic/explicit-seriesIds sourcing when title-based candidates are too few — a different code path from `sourceByGenreOrKeyword()`'s directed mode) also calls `TmdbClient.discover(...)`, which is not itself named in this spec's Requirement 1/3 text since it isn't a directed-sourcing call and doesn't bypass ranking. Because `discover()`'s `sortBy` param is required (not overloaded), this call site needed a value too; it passes the literal `"popularity.desc"` (`DEFAULT_GENRE_SORT_BY`) directly, unaffected by `RecommendationCriteria.discoverSortBy` — this candidate pool still flows through Requirement 7's ranking/diversity cap normally (it's re-sorted afterward regardless of TMDB's returned order), and `"popularity.desc"` is TMDB's own default, so this is exactly the same "no sort_by sent" behavior as before this spec, made explicit.
**Verification**: `gradlew.bat test` from `backend/` — full suite green (see command output referenced in the implementing session). All 8 ACs covered by new/updated Spock tests as listed above.
**No `frontend/` files are touched by this spec** — the sort-control UI is `frontend_spec_033_discover_native_sort_controls.md`, a separate follow-up task on the same branch.
**Priority**: Medium
**Depends on**: `series_spec_022_trending_and_top_rated_recommendations.md`, `series_spec_007_recommendation_sourcing.md`, `frontend_spec_031_genre_mode_sort_relabel.md`
**Area**: Backend (`TmdbClient.java`, `RecommendationCriteria.java`, `RecommendationService.java`)

## Overview

`frontend_spec_030`/`frontend_spec_031` relabeled "Most Recommended" to "Vote Average" for `topRated`
(Highest Rated) and `genre` (Genre & Keyword) modes, because `totalSourceCount` is always `0` for candidates
sourced by either mode (they're never linked to a tracked series). A live review on 2026-08-24 found that
relabel wasn't enough: **"Best Match" and "Vote Average" produce byte-identical output for both modes.**
Confirmed by reading `RecommendationService.score()`/`resolveSortComparator()` directly — for a candidate with
no source series, `rankScore` is exactly `tmdbRating`, and `recommendationCount` sort's primary key
(`totalSourceCount`) ties at `0` for every candidate, so it falls through to the same `rankScore`-descending
tiebreak "Best Match" already sorts by. The two "options" were never actually different for these two modes.

This spec replaces that fake choice with a real one: TMDB's own `GET /discover/tv` accepts a genuine `sort_by`
enum (confirmed live against TMDB's own API reference, 2026-08-24):
`first_air_date.{asc,desc}`, `name.{asc,desc}`, `original_name.{asc,desc}`, `popularity.{asc,desc}`,
`vote_average.{asc,desc}`, `vote_count.{asc,desc}` — default `popularity.desc`. Both `topRated` and `genre`
modes already source exclusively via `discover/tv` (`TmdbClient.discoverTopRated`/`discover`), so a `sort_by`
value can flow straight into the TMDB request itself, giving these two modes a real, TMDB-backed second sort
axis instead of the app's own no-op re-ranking.

## Design Decisions

- **`topRated` and `genre` modes stop going through `RecommendationService`'s ranking/diversity-cap pipeline
  entirely**, generalizing the bypass `trending` mode already uses (`series_spec_022` SERIES-022-AC-08) rather
  than adding a second, different bypass mechanism. This is a behavior-neutral change for both modes: their
  diversity cap was *already* a full no-op (`applyDiversityCap`/`score()`'s own established rule — "never caps
  a candidate with no contributing sources", `series_spec_015` SERIES-015-AC-15) since neither mode ever
  attaches a source series, and their `score()`-based re-sort was the exact no-op this spec removes. Output
  filters (`minTmdbRating`/`minVoteCount`/`yearMin`/`yearMax`/`excludeGenres`/`excludeKeywords`/`language`)
  are unaffected — they already run *before* the trending-bypass branch in `recommend()` and continue to for
  these two modes.
- **This explicitly supersedes `series_spec_022` SERIES-022-AC-11/12's stated behavior** ("`topRated` ...
  otherwise flows through ranking/diversity-cap normally") and `series_spec_007` Requirement 7 as applied to
  genre/keyword-directed sourcing — both are amended, not rewritten; this spec's `Status` note is the record of
  the change.
- **`RecommendationCriteria` gains one new field, `discoverSortBy`**, shared by both modes rather than two
  mode-specific fields — both ultimately validate against and forward the same TMDB enum, so one field matching
  `sourceByGenreOrKeyword`/`sourceTopRated`'s already-parallel structure is simpler than two.
- **Validated against TMDB's full confirmed enum** (12 values above), not just the 4 the frontend will
  initially expose (`frontend_spec_033`) — keeps backend/frontend coupling loose; a future frontend change can
  expose more of the enum without a backend spec change.
- **Ignored, not an error, under any other mode** (`automatic`/`specific`/`trending`, or `genre` mode with no
  genre/keyword actually selected — which server-side already silently behaves like `automatic`, per
  `isDirectedByGenreOrKeyword`) — matches this codebase's existing convention for a mode-specific param sent
  under the wrong mode (e.g. `trendingWindow`, `series_spec_022` SERIES-022-AC-18).
- **Defaults preserve today's exact observable behavior** when `discoverSortBy` is omitted: `topRated` resolves
  to `vote_average.desc` (unchanged), `genre`/keyword-directed sourcing resolves to `popularity.desc` (TMDB's
  own default — `TmdbClient.discover()` sends no `sort_by` today, which is functionally identical to explicitly
  sending TMDB's own default, so no client is affected by making it explicit).
- **`TmdbClient.discover`/`discoverTopRated` gain a required `sortBy` parameter** (not optional/nullable) —
  `RecommendationService` always resolves a concrete default before calling either method, so the client method
  itself doesn't need null-handling. This does change both methods' signatures; both have exactly one caller
  each (`RecommendationService`), so this is a direct signature change, not a new overload.

## Requirement 1: `TmdbClient` accepts a `sort_by` value on discover calls

**User story**: As the backend, I need to pass a TMDB-native sort choice through to `discover/tv`, so the
response itself comes back in the order the user actually asked for.

### SERIES-025-AC-01 [AUTO]
**Statement**: `TmdbClient.discover(List<Integer> genreIds, List<Integer> keywordIds, String sortBy)` shall
send `sortBy` as the `sort_by` query parameter on every call (in addition to the existing conditional
`with_genres`/`with_keywords`).

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/client/TmdbClient.java`, `discover()`
(currently `discover(List<Integer>, List<Integer>)`, no `sort_by`).

**Test Case (Red)**:
```groovy
def "SERIES-025-AC-01: discover sends sort_by"() {
    given: "a stubbed TMDB response"
        stubTmdbDiscoverResponse()

    when: "discover is called with a sortBy value"
        tmdbClient.discover([28], [], "popularity.desc")

    then: "the request includes sort_by=popularity.desc"
        1 * restClient.get() >> { /* verify URI contains sort_by=popularity.desc */ }
}
```

**Test Case (Green)**: add the `sortBy` parameter and `.queryParam("sort_by", sortBy)` to the URI builder.

### SERIES-025-AC-02 [AUTO]
**Statement**: `TmdbClient.discoverTopRated(int minVoteCount, String sortBy)` shall send `sortBy` as the
`sort_by` query parameter (replacing the currently-hardcoded `"vote_average.desc"` literal), alongside the
existing `vote_count.gte`.

**References**: same file, `discoverTopRated()`.

**Test Case (Red)**:
```groovy
def "SERIES-025-AC-02: discoverTopRated sends the given sortBy, not a hardcoded value"() {
    given: "a stubbed TMDB response"
        stubTmdbDiscoverResponse()

    when: "discoverTopRated is called with sortBy=popularity.desc"
        tmdbClient.discoverTopRated(200, "popularity.desc")

    then: "the request's sort_by is popularity.desc, not vote_average.desc"
        // verify URI
}
```

**Test Case (Green)**: change the hardcoded `.queryParam("sort_by", "vote_average.desc")` to
`.queryParam("sort_by", sortBy)`.

## Requirement 2: `RecommendationCriteria` gains and validates `discoverSortBy`

**User story**: As an API client, I want to request a specific TMDB sort order for Highest Rated / Genre &
Keyword recommendations, and get a clear error if I ask for something TMDB doesn't support.

### SERIES-025-AC-03 [AUTO]
**Statement**: `RecommendationCriteria` shall gain a `discoverSortBy` (`String`) field with a getter/setter,
following the same shape as `sourceMode`/`trendingWindow`.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/dto/RecommendationCriteria.java`.

**Test Case (Green)**: trivial field addition, covered implicitly by AC-04's test.

### SERIES-025-AC-04 [AUTO]
**Statement**: When `discoverSortBy` is non-blank, `RecommendationService.validate()` shall throw
`IllegalArgumentException` unless it is exactly one of: `first_air_date.asc`, `first_air_date.desc`,
`name.asc`, `name.desc`, `original_name.asc`, `original_name.desc`, `popularity.asc`, `popularity.desc`,
`vote_average.asc`, `vote_average.desc`, `vote_count.asc`, `vote_count.desc`.

**References**: `RecommendationService.java`, `validate(RecommendationCriteria)`.

**Test Case (Red)**:
```groovy
def "SERIES-025-AC-04: rejects an unrecognized discoverSortBy"() {
    given: "criteria with an invalid discoverSortBy"
        def criteria = new RecommendationCriteria(sourceMode: "topRated", discoverSortBy: "not-a-real-value")

    when: "recommend is called"
        recommendationService.recommend(10, criteria)

    then: "IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
}

def "SERIES-025-AC-04: accepts every documented TMDB sort_by value"() {
    given: "each valid value in turn"
        // stub discoverTopRated to return []

    expect: "no exception for any of the 12 documented values"
        ["first_air_date.asc", "first_air_date.desc", "name.asc", "name.desc",
         "original_name.asc", "original_name.desc", "popularity.asc", "popularity.desc",
         "vote_average.asc", "vote_average.desc", "vote_count.asc", "vote_count.desc"].each { value ->
            recommendationService.recommend(10, new RecommendationCriteria(sourceMode: "topRated", discoverSortBy: value))
        }
}
```

**Test Case (Green)**: add the validation branch alongside the existing `sourceMode` check.

## Requirement 3: `topRated` and `genre` modes bypass ranking and honor `discoverSortBy`

**User story**: As a user picking a TMDB-native sort for Highest Rated or Genre & Keyword, I want the response
to actually come back in that order, not silently re-sorted by the app afterward.

### SERIES-025-AC-05 [AUTO]
**Statement**: `RecommendationService.sourceTopRated()` shall resolve `discoverSortBy` to `"vote_average.desc"`
when unset, and pass it to `TmdbClient.discoverTopRated(effectiveMinVoteCount, effectiveSortBy)`.

**References**: `RecommendationService.java`, `sourceTopRated()`.

**Test Case (Red)**:
```groovy
def "SERIES-025-AC-05: topRated defaults discoverSortBy to vote_average.desc"() {
    given: "criteria with sourceMode=topRated and no discoverSortBy"
        def criteria = new RecommendationCriteria(sourceMode: "topRated")

    when: "recommend is called"
        recommendationService.recommend(10, criteria)

    then: "discoverTopRated is called with vote_average.desc"
        1 * tmdbClient.discoverTopRated(200, "vote_average.desc") >> []
}

def "SERIES-025-AC-05: topRated forwards an explicit discoverSortBy"() {
    given: "criteria requesting popularity.desc"
        def criteria = new RecommendationCriteria(sourceMode: "topRated", discoverSortBy: "popularity.desc")

    when: "recommend is called"
        recommendationService.recommend(10, criteria)

    then: "discoverTopRated is called with popularity.desc"
        1 * tmdbClient.discoverTopRated(200, "popularity.desc") >> []
}
```

**Test Case (Green)**: resolve `effectiveSortBy` at the top of `sourceTopRated()`, pass it through.

### SERIES-025-AC-06 [AUTO]
**Statement**: `RecommendationService.sourceByGenreOrKeyword()` shall resolve `discoverSortBy` to
`"popularity.desc"` when unset, and pass it to `TmdbClient.discover(genreIds, keywordIds, effectiveSortBy)`.

**References**: `RecommendationService.java`, `sourceByGenreOrKeyword()`.

**Test Case (Red)**: mirrors AC-05's pair, asserting `discover(genreIds, keywordIds, "popularity.desc")` by
default and forwarding an explicit value.

**Test Case (Green)**: resolve `effectiveSortBy` at the top of `sourceByGenreOrKeyword()`, pass it through.

### SERIES-025-AC-07 [AUTO]
**Statement**: `recommend()` shall bypass the ranking (`score()`/`resolveSortComparator()`) and diversity-cap
steps for `topRated` mode and genre/keyword-directed sourcing, identically to how it already bypasses them for
`trending` mode — output filters continue to run beforehand, unaffected.

**Rationale**: generalizes the existing `if (trendingMode)` early return (`series_spec_022` SERIES-022-AC-08)
to the two other modes whose candidates are never linked to a source series, per this spec's Design Decisions.

**References**: `RecommendationService.java`, `recommend()`.

**Test Case (Red)**:
```groovy
def "SERIES-025-AC-07: topRated candidates keep TMDB's own returned order"() {
    given: "discoverTopRated returns candidates in a specific, non-tmdbRating-sorted order"
        tmdbClient.discoverTopRated(*_) >> [candidateWithRating(6.0), candidateWithRating(9.0), candidateWithRating(7.5)]

    when: "recommend is called with sourceMode=topRated"
        def result = recommendationService.recommend(10, new RecommendationCriteria(sourceMode: "topRated"))

    then: "the result preserves TMDB's own order, not tmdbRating-descending"
        result*.tmdbRating == [6.0, 9.0, 7.5]
}

def "SERIES-025-AC-07: genre-directed candidates keep TMDB's own returned order"() {
    given: "discover returns candidates in a specific, non-tmdbRating-sorted order"
        tmdbClient.discover(*_) >> [candidateWithRating(6.0), candidateWithRating(9.0)]

    when: "recommend is called with genres set"
        def result = recommendationService.recommend(10, new RecommendationCriteria(genres: ["Action"]))

    then: "the result preserves TMDB's own order"
        result*.tmdbRating == [6.0, 9.0]
}
```

**Test Case (Green)**: extend the `if (trendingMode)` condition to
`if (trendingMode || topRatedMode || isDirectedByGenreOrKeyword(criteria))`, reusing the existing branch body.

### SERIES-025-AC-08 [AUTO]
**Statement**: Under `topRated` or genre/keyword-directed sourcing, the existing `sortBy`
(`score`/`recommendationCount`) criteria field shall have no effect — it's silently ignored, not an error,
matching this spec's Design Decisions.

**Test Case (Red)**:
```groovy
def "SERIES-025-AC-08: legacy sortBy has no effect under topRated"() {
    given: "criteria with sourceMode=topRated and sortBy=recommendationCount"
        def criteria = new RecommendationCriteria(sourceMode: "topRated", sortBy: "recommendationCount")

    expect: "no exception, same result as without sortBy set"
        recommendationService.recommend(10, criteria) == recommendationService.recommend(10,
            new RecommendationCriteria(sourceMode: "topRated"))
}
```

**Test Case (Green)**: no explicit handling needed — a consequence of AC-07's bypass never consulting
`resolveSortComparator()` for these modes; included as an explicit regression check.

## Cross-references

| Reference | Relationship |
|---|---|
| `series_spec_022_trending_and_top_rated_recommendations.md` | Establishes the `trending`-mode ranking bypass this spec generalizes; supersedes SERIES-022-AC-11/12's "flows through ranking/diversity-cap normally" |
| `series_spec_007_recommendation_sourcing.md` | Requirement 7 (ranking/diversity-cap), amended for genre/keyword-directed sourcing specifically |
| `series_spec_015_multi_source_recommendations.md` | SERIES-015-AC-15's "never caps a candidate with no contributing sources" — the existing rule confirming the diversity-cap bypass is behavior-neutral |
| `frontend_spec_030_discover_filters_and_sort_controls.md`, `frontend_spec_031_genre_mode_sort_relabel.md` | The relabels this spec makes obsolete — `frontend_spec_033` replaces their `topRated`/`genre` UI entirely |
| `frontend_spec_033_discover_native_sort_controls.md` | The frontend half of this feature |

## Acceptance Criteria Summary

- [x] SERIES-025-AC-01: `TmdbClient.discover` sends `sort_by`
- [x] SERIES-025-AC-02: `TmdbClient.discoverTopRated` sends the given `sortBy`, not a hardcoded value
- [x] SERIES-025-AC-03: `RecommendationCriteria.discoverSortBy` field added
- [x] SERIES-025-AC-04: invalid `discoverSortBy` throws; all 12 documented values accepted
- [x] SERIES-025-AC-05: `topRated` defaults to `vote_average.desc`, forwards an explicit value
- [x] SERIES-025-AC-06: genre/keyword-directed sourcing defaults to `popularity.desc`, forwards an explicit value
- [x] SERIES-025-AC-07: ranking/diversity-cap bypassed for `topRated` and genre-directed sourcing
- [x] SERIES-025-AC-08: legacy `sortBy` has no effect under these two modes
