# Series Spec 031: Custom Search Pre-Fetch Filters — Min TMDB Rating & Year Range

**Status**: Implemented (2026-08-28) -- `backend/src/main/java/uk/co/stefirby/seriestracker/client/DiscoverFilters.java` (new),
`backend/src/main/java/uk/co/stefirby/seriestracker/client/TmdbClient.java`,
`backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationSourcingService.java`,
`backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationOutputFilterService.java`,
`backend/src/test/groovy/uk/co/stefirby/seriestracker/client/TmdbClientSpec.groovy`,
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/RecommendationSourcingServiceSpec.groovy`,
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/RecommendationServiceSpec.groovy`,
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/RecommendationOutputFilterServiceSpec.groovy`,
`backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationCriteriaValidator.java` (Requirement
4, out-of-range `minTmdbRating`/`yearMin`/`yearMax` rejection, added after the initial implementation),
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/RecommendationCriteriaValidatorSpec.groovy`,
`frontend/src/components/RecommendationControls.tsx`/`.test.tsx` (`min`/`max`/`step` HTML attributes mirroring
Requirement 4's bounds)
**Priority**: P3 (correctness/completeness fix — extends `series_spec_029`'s "filter before TMDB, not just
after" fix from `minVoteCount` to two more fields, for the same root-cause reason)
**Depends on**: Series Spec 029 (`series_spec_029_configurable_min_vote_count_and_genre_floor.md`, owns the
sourcing-time `minVoteCount` floor and `DiscoverFilters`-shaped precedent this spec extends) ✅, Series Spec 024
(`series_spec_024_discover_filters_and_vote_threshold.md`, owns the existing post-fetch `minTmdbRating`/
`yearMin`/`yearMax` filters this spec partially relocates) ✅
**Area**: Backend (`client/TmdbClient.java`, `service/RecommendationSourcingService.java`,
`service/RecommendationOutputFilterService.java`) — paired with Frontend Spec 046
(`frontend_spec_046_custom_search_prefetch_filters_ui.md`) for the UI relocation.

## Overview

Confirmed via reading the code: `minTmdbRating`, `yearMin`, and `yearMax` are currently **post-fetch-only**
filters, applied identically across every recommendation mode by `RecommendationOutputFilterService`, after
TMDB's response (a single, unpaginated page — no page 2 is ever requested anywhere in this app) already came
back. `TmdbClient.discover()` — the endpoint backing "Custom Search" (formerly "Genre & Keyword",
`frontend_spec_042`) — sends only `with_genres`/`with_keywords`/`sort_by`/`vote_count.gte`. `minVoteCount` is the
one field already fixed: `series_spec_029` moved it server-side specifically because a restrictive post-fetch-
only filter against one ~20-result page can return zero results even when TMDB has real matches on pages this
app never asked for. `minTmdbRating`/`yearMin`/`yearMax` are exposed to that exact same failure mode today.

This spec sends `minTmdbRating` and the year range to TMDB itself as real `discover/tv` params — **for Custom
Search only** (`sourceByGenreOrKeyword`), confirmed in discussion as the deliberate scope: "Popular Right Now"
sources from `/trending/tv` directly, which accepts no `discover/tv`-style filter params at all (pre-fetch
filtering is structurally impossible there); "Highest Rated" and "Use My Series" keep their existing post-fetch-
only behavior by choice, to keep the two "curated TMDB list" tabs simple and because "Use My Series" has no
single discover-style call to attach params to in the first place.

**Year filtering changes semantics, not just timing — confirmed and decided in discussion.** Today's post-fetch
`matchesYearRange` compares only against a candidate's *first* air year. TMDB's `discover/tv` exposes two
different date-range param families (per TMDB's documented API): `first_air_date.gte`/`.lte` (would preserve
today's exact "first aired in this range" meaning) and `air_date.gte`/`.lte` (documented as filtering by
*episode* air date). **Decided: use `air_date.gte`/`.lte`** — a still-running show like The Simpsons (airing
continuously since 1989) should match a search for e.g. 2020–2024, not be excluded because its first episode
predates the range. This is a genuine behavior improvement over today's filter, not a neutral relocation.

## Design Decisions

- **`TmdbClient.discover()` gains a `DiscoverFilters` parameter object, not more positional parameters.**
  Today's signature (`genreIds, keywordIds, sortBy, minVoteCount`) would grow to 7 parameters by adding
  `minTmdbRating`/`yearMin`/`yearMax` individually — a new small record instead:
  ```java
  public record DiscoverFilters(int minVoteCount, BigDecimal minTmdbRating, Integer yearMin, Integer yearMax) {
      public static final DiscoverFilters NONE = new DiscoverFilters(0, null, null, null);
  }
  ```
  `discover()`'s signature becomes `discover(List<Integer> genreIds, List<Integer> keywordIds, String sortBy,
  DiscoverFilters filters)`. Each field is sent as its own query param only when actually set (mirroring
  `vote_count.gte`'s existing "0 means omit the param entirely" pattern): `vote_average.gte` for
  `minTmdbRating`, `air_date.gte` for `yearMin` (formatted `{yearMin}-01-01`), `air_date.lte` for `yearMax`
  (formatted `{yearMax}-12-31`).
- **Only `sourceByGenreOrKeyword` passes real filter values.** `RecommendationSourcingService.
  genreBasedSupplement` (the "Use My Series" genre-based top-up, an unrelated caller of the same `discover()`
  method) continues passing `DiscoverFilters.NONE` — byte-identical to its current `minVoteCount=0` behavior,
  confirmed unaffected by this spec. `sourceTopRated`/`discoverTopRated` are a completely separate `TmdbClient`
  method, untouched.
- **The post-fetch `minTmdbRating` check keeps running unconditionally, for every mode — same precedent as
  `minVoteCount`'s existing redundant-but-harmless double-check.** Same field, same comparison, same data
  available post-fetch as pre-fetch — re-checking it costs nothing and catches nothing new, but also breaks
  nothing. No code change needed in `RecommendationOutputFilterService` for this field.
- **The post-fetch year-range check must be *skipped* for Custom Search specifically — it cannot be left
  running unconditionally like `minTmdbRating`/`minVoteCount`.** This is the one real risk in this spec, found
  during design: TMDB's `discover/tv` response carries only `first_air_date` per result, never episode-level
  air dates — so there is no data available post-fetch to correctly re-verify an `air_date.gte/.lte` match. If
  `matchesYearRange` kept running unconditionally (using only `TmdbCandidate.year()`, itself sourced from
  `first_air_date`), it would silently undo the entire point of this spec for older still-running shows: The
  Simpsons would pass TMDB's own `air_date` pre-filter, then get wrongly stripped back out by a post-fetch check
  that only knows about 1989. **Resolution**: `RecommendationOutputFilterService.applyOutputFilters` skips the
  year-range check when `criteria.isDirectedByGenreOrKeyword()` is `true` — that flag already exists and
  precisely identifies "this request is Custom Search," no new criteria field needed. Every other mode (where
  that flag is `false`, including "Use My Series" requests that happen to include genre-based-top-up candidates)
  keeps the post-fetch year check exactly as it runs today, unaffected.
- **No new `RecommendationCriteria` fields.** `minTmdbRating`/`yearMin`/`yearMax` already exist on the DTO,
  shared across every mode since `series_spec_024`. This spec only changes *how* `sourceByGenreOrKeyword` uses
  them, not the request shape.

---

## Requirement 1: `TmdbClient.discover()` sends the new filters as real `discover/tv` params

**User story**: As a user running a Custom Search, I want TMDB itself to narrow results by rating and year,
so a restrictive combination doesn't silently return few/zero results from a single ~20-result page when TMDB
has real matches it was never asked for.

### SERIES-031-AC-01 [AUTO]
**Statement**: When `DiscoverFilters.minTmdbRating` is non-null, `TmdbClient.discover()` shall send
`vote_average.gte` set to that value; when it is null, the parameter shall be omitted entirely.

**References**: `TmdbClient.discover(List<Integer>, List<Integer>, String, int)`'s existing `vote_count.gte`
omit-when-unset pattern, mirrored here.

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-01: sends vote_average.gte when minTmdbRating is set"() {
    given: "a mocked TMDB response"
        mockServer.expect(requestTo(containsString("vote_average.gte=7.5")))
            .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

    when: "discover is called with minTmdbRating=7.5"
        client.discover([35], [], "popularity.desc",
            new DiscoverFilters(0, new BigDecimal("7.5"), null, null))

    then: "the request included vote_average.gte=7.5"
        mockServer.verify()
}

def "SERIES-031-AC-01: omits vote_average.gte when minTmdbRating is null"() {
    given: "a mocked TMDB response"
        mockServer.expect(requestTo(not(containsString("vote_average.gte"))))
            .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

    when: "discover is called with no minTmdbRating"
        client.discover([35], [], "popularity.desc", DiscoverFilters.NONE)

    then: "no vote_average.gte param was sent"
        mockServer.verify()
}
```
**Test Case (Green)**: add `DiscoverFilters` record; `discover()` conditionally appends `vote_average.gte`.

---

### SERIES-031-AC-02 [AUTO]
**Statement**: When `DiscoverFilters.yearMin` is non-null, `TmdbClient.discover()` shall send `air_date.gte`
formatted as `{yearMin}-01-01`; when null, the parameter shall be omitted.

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-02: sends air_date.gte formatted as yearMin-01-01"() {
    given: "a mocked TMDB response"
        mockServer.expect(requestTo(containsString("air_date.gte=2020-01-01")))
            .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

    when: "discover is called with yearMin=2020"
        client.discover([35], [], "popularity.desc", new DiscoverFilters(0, null, 2020, null))

    then: "the request included air_date.gte=2020-01-01"
        mockServer.verify()
}
```
**Test Case (Green)**: `discover()` appends `air_date.gte` as `yearMin + "-01-01"` when `yearMin != null`.

---

### SERIES-031-AC-03 [AUTO]
**Statement**: When `DiscoverFilters.yearMax` is non-null, `TmdbClient.discover()` shall send `air_date.lte`
formatted as `{yearMax}-12-31`; when null, the parameter shall be omitted.

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-03: sends air_date.lte formatted as yearMax-12-31"() {
    given: "a mocked TMDB response"
        mockServer.expect(requestTo(containsString("air_date.lte=2024-12-31")))
            .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

    when: "discover is called with yearMax=2024"
        client.discover([35], [], "popularity.desc", new DiscoverFilters(0, null, null, 2024))

    then: "the request included air_date.lte=2024-12-31"
        mockServer.verify()
}
```
**Test Case (Green)**: `discover()` appends `air_date.lte` as `yearMax + "-12-31"` when `yearMax != null`.

---

### SERIES-031-AC-04 [AUTO]
**Statement**: `DiscoverFilters.minVoteCount`'s existing `vote_count.gte` behavior (send only when `> 0`) shall
be unchanged by this spec — a regression guard confirming the parameter-object refactor didn't alter it.

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-04: vote_count.gte behavior is unchanged"() {
    given: "a mocked TMDB response"
        mockServer.expect(requestTo(containsString("vote_count.gte=200")))
            .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

    when: "discover is called with minVoteCount=200"
        client.discover([35], [], "popularity.desc", new DiscoverFilters(200, null, null, null))

    then: "the request included vote_count.gte=200, unchanged from before this spec"
        mockServer.verify()
}
```
**Test Case (Green)**: no behavior change — confirms the refactor from positional `int minVoteCount` to
`DiscoverFilters.minVoteCount()` preserved the exact existing logic.

---

## Requirement 2: `sourceByGenreOrKeyword` (Custom Search) passes real filter values; nothing else does

**User story**: As a user, I want these new pre-fetch filters to apply only to Custom Search, not silently
change behavior for Popular Right Now, Highest Rated, or Use My Series.

### SERIES-031-AC-05 [AUTO]
**Statement**: `RecommendationSourcingService.sourceByGenreOrKeyword` shall pass the request's
`minTmdbRating`/`yearMin`/`yearMax` (from `RecommendationCriteria`) into `TmdbClient.discover()`'s
`DiscoverFilters`, alongside the existing `minVoteCount` resolution.

**References**: `RecommendationSourcingService.sourceByGenreOrKeyword`'s existing `effectiveMinVoteCount`
resolution, extended with the two new fields read straight from `criteria` (no new defaulting logic needed —
both are already `null`-means-unset on `RecommendationCriteria`).

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-05: Custom Search sourcing passes minTmdbRating/year to discover"() {
    given: "criteria directed by genre with minTmdbRating and a year range set"
        def criteria = new RecommendationCriteria(genres: ["Comedy"], minTmdbRating: new BigDecimal("7.0"),
            yearMin: 2020, yearMax: 2024)

    when: "sourceByGenreOrKeyword runs"
        sourcingService.sourceByGenreOrKeyword(criteria)

    then: "TmdbClient.discover was called with a DiscoverFilters carrying the same values"
        1 * tmdbClient.discover(_, _, _, { DiscoverFilters f ->
            f.minTmdbRating() == new BigDecimal("7.0") && f.yearMin() == 2020 && f.yearMax() == 2024
        }) >> []
}
```
**Test Case (Green)**: `sourceByGenreOrKeyword` builds a `DiscoverFilters` from `criteria.getMinTmdbRating()`/
`getYearMin()`/`getYearMax()` alongside the existing `effectiveMinVoteCount`.

---

### SERIES-031-AC-06 [AUTO]
**Statement**: `genreBasedSupplement` (the "Use My Series" genre-based top-up) shall continue passing
`DiscoverFilters.NONE` regardless of the request's `minTmdbRating`/`yearMin`/`yearMax` — unaffected by this
spec.

**References**: `RecommendationSourcingService.genreBasedSupplement`, called from `sourceFromPool` ("Use My
Series" mode only).

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-06: the genre-based top-up is unaffected by this spec"() {
    given: "a Use My Series request with minTmdbRating/year set (should never reach the top-up call)"
        def criteria = new RecommendationCriteria(minTmdbRating: new BigDecimal("8.0"), yearMin: 2020)
        def pool = [seriesWithGenre("Comedy")]

    when: "the genre-based top-up fires (title-based sourcing came up short)"
        sourcingService.sourceFromPool(criteria, 20)

    then: "discover was called with DiscoverFilters.NONE, exactly as before this spec"
        1 * tmdbClient.discover(_, [], "popularity.desc", DiscoverFilters.NONE) >> []
}
```
**Test Case (Green)**: no change to `genreBasedSupplement`'s call site — confirms it doesn't accidentally start
reading `criteria`'s rating/year fields.

---

### SERIES-031-AC-07 [AUTO]
**Statement**: `sourceTrending` and `sourceTopRated` shall remain completely unaffected by this spec — neither
reads or sends `minTmdbRating`/`yearMin`/`yearMax` to TMDB.

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-07: Popular Right Now and Highest Rated are unaffected"() {
    given: "criteria for topRated mode with minTmdbRating/year set"
        def criteria = new RecommendationCriteria(sourceMode: "topRated",
            minTmdbRating: new BigDecimal("8.0"), yearMin: 2020)

    when: "sourceTopRated runs"
        sourcingService.sourceTopRated(criteria)

    then: "discoverTopRated was called with its existing two-arg signature, unchanged"
        1 * tmdbClient.discoverTopRated(_, _) >> []
}
```
**Test Case (Green)**: no change to `sourceTrending`/`sourceTopRated`/`discoverTopRated` — regression guard
confirming the scope boundary holds.

---

## Requirement 3: Post-fetch filters stay consistent with what TMDB already applied

**User story**: As a user, I don't want a candidate TMDB already correctly matched (e.g. a still-running old
show, for the year range) to get silently re-excluded by a redundant post-fetch check using narrower data.

### SERIES-031-AC-08 [AUTO]
**Statement**: The post-fetch `minTmdbRating` check shall continue running unconditionally for every mode,
including Custom Search — unchanged from today, a harmless redundant re-check (same field, same data available
post-fetch as pre-fetch).

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-08: post-fetch minTmdbRating check is unaffected"() {
    given: "a candidate below the minTmdbRating threshold, and directed-by-genre criteria"
        def criteria = new RecommendationCriteria(genres: ["Comedy"], minTmdbRating: new BigDecimal("8.0"))
        def candidate = candidateWithRating(new BigDecimal("6.0"))

    when: "output filters run"
        def result = outputFilterService.applyOutputFilters([candidate], criteria)

    then: "the candidate is still excluded, exactly as before this spec"
        result.isEmpty()
}
```
**Test Case (Green)**: no code change — confirms `matchesMinTmdbRating` keeps running unconditionally.

---

### SERIES-031-AC-09 [AUTO]
**Statement**: When `criteria.isDirectedByGenreOrKeyword()` is `true` (Custom Search), the post-fetch year-range
check shall be skipped entirely — a candidate shall not be excluded on year grounds after already surviving
TMDB's own `air_date.gte`/`.lte` pre-filter.

**References**: `RecommendationOutputFilterService.applyOutputFilters`'s filter chain, `matchesYearRange`.

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-09: post-fetch year check is skipped for Custom Search"() {
    given: "a candidate whose first air year predates yearMin, but is a genre/keyword-directed request"
        def criteria = new RecommendationCriteria(genres: ["Comedy"], yearMin: 2020, yearMax: 2024)
        def candidate = candidateWithYear(1989) // e.g. The Simpsons -- still airing, TMDB's air_date
                                                  // pre-filter already confirmed a match

    when: "output filters run"
        def result = outputFilterService.applyOutputFilters([candidate], criteria)

    then: "the candidate survives -- the year check trusted TMDB's own pre-filter instead of re-checking"
        result.size() == 1
}
```
**Test Case (Green)**: `applyOutputFilters`'s year-range filter predicate short-circuits to `true` when
`criteria.isDirectedByGenreOrKeyword()`.

---

### SERIES-031-AC-10 [AUTO]
**Statement**: For every mode other than Custom Search (including "Use My Series" requests whose candidates
include genre-based-top-up results), the post-fetch year-range check shall continue running exactly as today —
unaffected by AC-09's skip condition.

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-10: post-fetch year check still runs for every other mode"() {
    given: "a candidate outside the year range, and criteria NOT directed by genre/keyword"
        def criteria = new RecommendationCriteria(yearMin: 2020, yearMax: 2024) // "Use My Series"
        def candidate = candidateWithYear(1989)

    when: "output filters run"
        def result = outputFilterService.applyOutputFilters([candidate], criteria)

    then: "the candidate is excluded, exactly as before this spec"
        result.isEmpty()
}
```
**Test Case (Green)**: no change needed beyond AC-09's conditional — confirms the skip is scoped correctly, not
a blanket removal of the check.

---

## Requirement 4: Reject out-of-range `minTmdbRating`/`yearMin`/`yearMax`

**Added 2026-08-28, found live during implementation review**: neither field had ever been validated —
`RecommendationCriteriaValidator` already rejected an out-of-range `minSourceRating` (1–5), but `minTmdbRating`/
`yearMin`/`yearMax` passed straight through, both from the frontend's plain number inputs (whose spin arrows and
typed input had no bounds either) and from any direct API caller. Before this spec, an out-of-range value just
meant "the post-fetch check matches nothing" — harmless, if confusing. **After Requirement 1–3 above, it's worse**:
a negative or nonsensical year now produces a malformed `air_date.gte`/`.lte` date string (e.g.
`air_date.gte=-5-01-01`) sent directly to TMDB, since nothing validates it first. Fixed in the same spec/PR
rather than filed separately, since this PR is what raised the stakes on the pre-existing gap.

**User story**: As a user, I want an invalid rating or year value rejected with a clear reason, not silently
accepted and either matching nothing or sent to TMDB malformed.

### SERIES-031-AC-11 [AUTO]
**Statement**: When `minTmdbRating` is set outside TMDB's own 0–10 scale, `RecommendationCriteriaValidator`
shall reject the request with an `IllegalArgumentException` (400).

**References**: `RecommendationCriteriaValidator.validateMinSourceRating`'s existing 1–5 bounds-check pattern,
mirrored here for 0–10.

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-11: a minTmdbRating above 10 is rejected"() {
    given: "a minTmdbRating above TMDB's own 0-10 scale"
        def criteria = new RecommendationCriteria(minTmdbRating: 10.1)

    when: "validate is called"
        validator.validate(criteria)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
}
```
**Test Case (Green)**: add `validateMinTmdbRating`, called from `validate()`.

---

### SERIES-031-AC-12 [AUTO]
**Statement**: When `yearMin`/`yearMax` is set below 1900 or above the current year + 1, or when `yearMin`
exceeds `yearMax`, `RecommendationCriteriaValidator` shall reject the request with an `IllegalArgumentException`
(400). The upper bound is resolved at request time (`Year.now()`), not hardcoded.

**Test Case (Red)**:
```groovy
def "SERIES-031-AC-12: a negative year is rejected"() {
    given: "a negative yearMin"
        def criteria = new RecommendationCriteria(yearMin: -5)

    when: "validate is called"
        validator.validate(criteria)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
}
```
**Test Case (Green)**: add `validateYearRange`, called from `validate()`.

---

## Implementation Notes

- **`API.md` needs updating** (Definition of Done) — document that `GET /api/v1/series/recommendations`'s
  `minTmdbRating`/`yearMin`/`yearMax` params now additionally drive TMDB-side filtering when the request is
  genre/keyword-directed (Custom Search), including the year field's episode-air-date semantics there
  specifically (vs. first-air-date for every other mode) — this asymmetry is worth documenting explicitly so
  it isn't mistaken for a bug later. Also document Requirement 4's new bounds (`minTmdbRating` 0–10, year
  1900–current+1) and that both now return 400 when violated.
- `DiscoverFilters` lives alongside `TmdbClient` (same package) as a small package-private or public record —
  not in `dto/`, since it's an internal shape for one client method's parameters, not an API-facing DTO.
- Frontend mirrors these same bounds as `min`/`max`/`step` HTML attributes on the number inputs (both the
  Filters-box and Custom Search panel copies) — a UX nicety, not the actual enforcement; the backend is the
  authoritative check regardless of what the frontend allows through.

## Cross-References

| This spec | Source |
|---|---|
| `minVoteCount`'s existing sourcing-time floor, the direct precedent this spec extends to two more fields | `series_spec_029_configurable_min_vote_count_and_genre_floor.md` |
| The post-fetch `minTmdbRating`/`yearMin`/`yearMax` filters this spec partially relocates | `series_spec_024_discover_filters_and_vote_threshold.md` |
| `criteria.isDirectedByGenreOrKeyword()`, reused as the Custom-Search-detection flag for AC-09's skip | `RecommendationCriteria.java` (`TOOLING-003-AC-05`) |
| Frontend UI relocating these fields into Custom Search's own panel | `frontend_spec_046_custom_search_prefetch_filters_ui.md` |
| Confirmed dead-code findings (Max Per Source/Max Sources Shown, TMDB response shape) that fed this spec's design | `.claude/SPEC_CANDIDATES.md`, "Push Discover-mode output filters upward..." |

---

## Acceptance Criteria Summary

- [x] SERIES-031-AC-01: `vote_average.gte` sent when `minTmdbRating` set, omitted otherwise
- [x] SERIES-031-AC-02: `air_date.gte` sent as `yearMin-01-01` when set
- [x] SERIES-031-AC-03: `air_date.lte` sent as `yearMax-12-31` when set
- [x] SERIES-031-AC-04: `vote_count.gte` behavior unchanged (regression guard)
- [x] SERIES-031-AC-05: Custom Search sourcing passes real filter values
- [x] SERIES-031-AC-06: genre-based top-up (Use My Series) unaffected
- [x] SERIES-031-AC-07: Popular Right Now / Highest Rated unaffected
- [x] SERIES-031-AC-08: post-fetch `minTmdbRating` check unaffected (still runs)
- [x] SERIES-031-AC-09: post-fetch year check skipped for Custom Search
- [x] SERIES-031-AC-10: post-fetch year check still runs for every other mode
- [x] SERIES-031-AC-11: out-of-range `minTmdbRating` is rejected (400)
- [x] SERIES-031-AC-12: out-of-range/inverted `yearMin`/`yearMax` is rejected (400)
