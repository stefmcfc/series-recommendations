# Series Spec 044: `without_genres` Pre-TMDB Filter for Genre/Keyword-Directed Sourcing (Custom Search)

**Status**: Not started
**Priority**: P3
**Depends on**: Tooling Spec 007 (`tooling_spec_007_tmdb_client_discover_filters_extraction.md`, owns
the `DiscoverFilters` record this spec extends) ✅ required, Series Spec 031
(`series_spec_031_custom_search_prefetch_filters.md`, established the "narrow at TMDB itself, not
just post-fetch" pattern this spec follows for one more field) ✅ required, Series Spec 043
(`series_spec_043_exclude_genres_vocabulary_fix.md`, independent but shares this spec's underlying
motivation — both make exclude-genres behave correctly for genre/keyword-directed sourcing) —
unordered, no direct code dependency
**Area**: Backend (`client/tmdb/DiscoverFilters.java`, `client/tmdb/TmdbClient.java`,
`service/recommendation/RecommendationSourcingService.java`)

## Overview

TMDB's `GET /discover/tv` accepts a `without_genres` parameter (comma-separated genre ids) that
excludes matching shows from its own results, the same shape `with_genres` already uses for include.
Today, `excludeGenres` is applied only as a post-fetch output filter
(`RecommendationOutputFilterService.matchesExcludeGenres`, `series_spec_043`) — for
genre/keyword-directed sourcing (Custom Search, and any other request with `genres`/`keywords` set,
per `RecommendationCriteria.isDirectedByGenreOrKeyword()`), every other narrowing field
(`minVoteCount`, `minTmdbRating`, `yearMin`/`yearMax`, `language`, `countries`) is already sent to
TMDB itself as a `DiscoverFilters` field (`series_spec_029`/`031`/`032`) *in addition to* its
post-fetch check, so TMDB only ever returns candidates worth considering in the first place rather
than relying solely on a post-hoc filter over one page of results. `excludeGenres` is the one
narrowing field from that set that was never given the same treatment.

This spec closes that gap: `RecommendationSourcingService.sourceByGenreOrKeyword` (the method behind
both Custom Search and any other genre/keyword-directed request) resolves `excludeGenres` to TMDB
genre ids and sends them as `without_genres` on the `discover/tv` call, alongside the existing
`with_genres`/`with_keywords`. The post-fetch check from `series_spec_043` stays in place unchanged
as a second layer, exactly mirroring how `minVoteCount`/`minTmdbRating`/etc. already double-filter.

## Design Decisions

- **Extends `DiscoverFilters`, not a new positional parameter on `discover()`.** `DiscoverFilters`
  exists specifically "instead of growing `discover()`'s positional parameter list further" (its own
  class doc) — `excludeGenreIds` is exactly the kind of optional narrowing param it was built to
  hold, alongside `countries`. Adding it as a 7th record field, not a 4th `discover()` argument,
  keeps that reasoning intact.
- **Reuses `RecommendationSourcingService.resolveGenreIds` for exclude, not a second resolution
  helper.** The method already resolves alias genre names to TMDB ids (currently only for the
  include side); applying it to `criteria.getExcludeGenres()` too is a one-line reuse, not new logic
  — and guarantees the pre-filter and `series_spec_043`'s post-filter fix resolve names identically,
  since both ultimately go through `TmdbGenreTable.idFor`.
- **`genreBasedSupplement` (pool-based sourcing's genre-frequency fallback) is deliberately excluded
  from this change.** That method already passes `DiscoverFilters.NONE` on purpose (per its own
  existing comment, SERIES-029-AC-08/SERIES-031-AC-06) to keep its request byte-identical to before
  those specs — this spec doesn't reopen that decision. `excludeGenres` reaching that path is out of
  scope; `RecommendationOutputFilterService`'s existing post-fetch filter (`series_spec_043`) still
  applies to whatever it returns, same as today.
- **Existing `DiscoverFilters` call sites need updating for the new field, including `NONE`.** This
  is implementation mechanics, not a new requirement of its own — every current positional
  `new DiscoverFilters(...)` construction (production and test) gains a 7th `excludeGenreIds`
  argument (`List.of()` where not applicable), and `DiscoverFilters.NONE` gains `List.of()` as its
  7th value, consistent with its existing "every field at its omit-the-param value" contract.
- **`without_genres` is comma-joined, mirroring `with_genres`/`with_keywords`** (not pipe-joined like
  `with_origin_country` — that asymmetry, per `series_spec_032`'s own correction, is specific to
  `with_origin_country`'s AND-vs-OR comma semantics, not a general TMDB convention). The user's own
  research (TMDB `discover/tv` reference) confirms `without_genres` accepts the same comma-separated
  shape as `with_genres`.

## Requirements

### Requirement 1: `DiscoverFilters` carries `excludeGenreIds`

**User Story**: As the TMDB client layer, I need to accept a list of genre ids to exclude, alongside
every other optional `discover/tv` narrowing param.

#### SERIES-044-AC-01 [AUTO]: `DiscoverFilters` exposes `excludeGenreIds`
**Statement**: The `DiscoverFilters` record shall expose a `List<Integer> excludeGenreIds` field as
its 7th component, and `DiscoverFilters.NONE` shall set it to `List.of()`.

**Rationale**: Extends the existing optional-narrowing-params record with one more field, following
its own established shape.

**References**:
- Type: `client/tmdb/DiscoverFilters.java` (existing `countries: List<String>` field, the closest
  shape precedent)

**Test Case (Red)**:
```groovy
def "SERIES-044-AC-01: DiscoverFilters exposes excludeGenreIds, NONE defaults it to empty"() {
    expect: "a constructed DiscoverFilters carries the given excludeGenreIds"
        new DiscoverFilters(0, null, null, null, null, [], [18, 35]).excludeGenreIds() == [18, 35]

    and: "DiscoverFilters.NONE has an empty excludeGenreIds"
        DiscoverFilters.NONE.excludeGenreIds() == []
}
```

**Test Case (Green)**: add `List<Integer> excludeGenreIds` as `DiscoverFilters`'s 7th record
component; update `NONE`'s construction to pass `List.of()` for it.

### Requirement 2: `TmdbClient.discover` sends `without_genres` when set

**User Story**: As the TMDB client, I need to translate `excludeGenreIds` into TMDB's own
`without_genres` query param.

#### SERIES-044-AC-02 [AUTO]: sends `without_genres` (comma-joined) when `excludeGenreIds` is non-empty
**Statement**: When `TmdbClient.discover` is called with a `DiscoverFilters.excludeGenreIds`
containing one or more ids, the `TmdbClient` shall include a `without_genres` query parameter on the
`GET /discover/tv` request, comma-joining those ids.

**Rationale**: Core wiring — the actual TMDB API contract this spec exists to use.

**References**:
- Class: `client/tmdb/TmdbClient.java`, `applyDiscoverFilters` (existing `with_origin_country`
  branch, the pattern this mirrors minus the pipe-join asymmetry)

**Test Case (Red)**:
```groovy
def "SERIES-044-AC-02: discover() sends without_genres comma-joined when excludeGenreIds is set"() {
    given: "a mocked TMDB server expecting without_genres=35,27"
        def body = '{"results":[{"id":200,"name":"Drama Show"}]}'
        mockServer.expect(requestTo(Matchers.containsString("discover/tv")))
            .andExpect(method(HttpMethod.GET))
            .andExpect(queryParam("without_genres", "35,27"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

    when: "discover is called with excludeGenreIds=[35, 27]"
        def result = client().discover([18], [], "popularity.desc",
            new DiscoverFilters(0, null, null, null, null, [], [35, 27]))

    then: "the request included without_genres, and the result is mapped"
        result.size() == 1
}
```

**Test Case (Green)**: add a branch to `applyDiscoverFilters`:
`if (filters.excludeGenreIds() != null && !filters.excludeGenreIds().isEmpty()) { b = b.queryParam("without_genres", joinIds(filters.excludeGenreIds())); }`,
reusing the existing private `joinIds` helper.

#### SERIES-044-AC-03 [AUTO]: omits `without_genres` when `excludeGenreIds` is null/empty
**Statement**: While `DiscoverFilters.excludeGenreIds` is `null` or empty, the `TmdbClient` shall not
include a `without_genres` query parameter on the `discover/tv` request.

**Rationale**: Matches every other `DiscoverFilters` field's existing "omit when unset" convention —
regression coverage so this spec doesn't send a stray empty param on every other request.

**References**:
- Class: `client/tmdb/TmdbClient.java`, `applyDiscoverFilters`

**Test Case (Red)**:
```groovy
def "SERIES-044-AC-03: discover() omits without_genres when excludeGenreIds is empty"() {
    given: "a mocked TMDB server with no without_genres expectation"
        def body = '{"results":[{"id":201,"name":"Any Show"}]}'
        mockServer.expect(requestTo(Matchers.containsString("discover/tv")))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

    when: "discover is called with DiscoverFilters.NONE"
        def result = client().discover([18], [], "popularity.desc", DiscoverFilters.NONE)

    then: "no without_genres param was required, and the result is mapped"
        result.size() == 1
}
```

**Test Case (Green)**: the `SERIES-044-AC-02` branch's own emptiness guard already covers this; this
AC is regression coverage confirming it.

### Requirement 3: `RecommendationSourcingService` resolves and forwards `excludeGenres` for genre/keyword-directed sourcing

**User Story**: As a Custom Search user, I want my excluded genres to actually narrow what TMDB
returns, not just filter an already-fetched page after the fact.

#### SERIES-044-AC-04 [AUTO]: `sourceByGenreOrKeyword` resolves `excludeGenres` alias names to TMDB ids
**Statement**: When `RecommendationSourcingService.sourceByGenreOrKeyword` is called with
`RecommendationCriteria.excludeGenres` set, the service shall resolve each entry to a TMDB genre id
via the same resolution `resolveGenreIds` already applies to the include-`genres` field, and pass
the resolved ids as `DiscoverFilters.excludeGenreIds` on its `TmdbClient.discover` call.

**Rationale**: Core wiring — connects the criteria field to the new TMDB pre-filter.

**References**:
- Class: `service/recommendation/RecommendationSourcingService.java`, `sourceByGenreOrKeyword`,
  `resolveGenreIds`
- Related: `SERIES-044-AC-01`, `SERIES-044-AC-02`

**Test Case (Red)**:
```groovy
def "SERIES-044-AC-04: sourceByGenreOrKeyword resolves excludeGenres and passes them to discover"() {
    given: "criteria with genres=[Drama] and excludeGenres=[Comedy]"
        def criteria = new RecommendationCriteria(genres: ["Drama"], excludeGenres: ["Comedy"])

    when: "sourceByGenreOrKeyword is called"
        service.sourceByGenreOrKeyword(criteria)

    then: "discover is called with with_genres resolving Drama (18) and without_genres resolving Comedy (35)"
        1 * tmdbClient.discover([18], [], _, { DiscoverFilters f -> f.excludeGenreIds() == [35] }) >> []
}
```

**Test Case (Green)**: in `sourceByGenreOrKeyword`, add
`List<Integer> excludeGenreIds = resolveGenreIds(c.getExcludeGenres());` and thread it into the
`DiscoverFilters` constructor call's new 7th argument.

#### SERIES-044-AC-05 [AUTO]: an unresolvable excludeGenres entry is silently skipped
**Statement**: While an `excludeGenres` entry does not resolve to a known TMDB genre id, the
`RecommendationSourcingService` shall omit it from `DiscoverFilters.excludeGenreIds` without error.

**Rationale**: `resolveGenreIds`'s existing `.filter(Objects::nonNull)` behavior already provides
this for free by reuse (Design Decisions) — this AC is regression coverage confirming the exclude
side inherits it, mirroring `SERIES-043-AC-02`'s equivalent guarantee for the post-fetch filter.

**References**:
- Class: `service/recommendation/RecommendationSourcingService.java`, `resolveGenreIds`

**Test Case (Red)**:
```groovy
def "SERIES-044-AC-05: an unrecognized excludeGenres entry doesn't reach DiscoverFilters"() {
    given: "criteria with an excludeGenres entry TMDB's fixed genre table doesn't cover"
        def criteria = new RecommendationCriteria(excludeGenres: ["NotARealGenre"])

    when: "sourceByGenreOrKeyword is called"
        service.sourceByGenreOrKeyword(criteria)

    then: "discover is called with an empty excludeGenreIds, not an error"
        1 * tmdbClient.discover(_, _, _, { DiscoverFilters f -> f.excludeGenreIds().isEmpty() }) >> []
}
```

**Test Case (Green)**: no new code beyond `SERIES-044-AC-04`'s reuse of `resolveGenreIds` — this AC
verifies the existing filter behavior carries over.

#### SERIES-044-AC-06 [AUTO]: empty/absent excludeGenres sends no without_genres param
**Statement**: While `RecommendationCriteria.excludeGenres` is `null` or empty,
`RecommendationSourcingService.sourceByGenreOrKeyword` shall call `TmdbClient.discover` with an
empty `DiscoverFilters.excludeGenreIds`.

**Rationale**: Regression coverage — an unset field must not change the request for every existing
Custom Search caller that doesn't use this new option.

**References**:
- Class: `service/recommendation/RecommendationSourcingService.java`, `sourceByGenreOrKeyword`

**Test Case (Red)**:
```groovy
def "SERIES-044-AC-06: no excludeGenres means an empty excludeGenreIds is sent"() {
    given: "criteria with genres set but no excludeGenres"
        def criteria = new RecommendationCriteria(genres: ["Drama"])

    when: "sourceByGenreOrKeyword is called"
        service.sourceByGenreOrKeyword(criteria)

    then: "discover is called with an empty excludeGenreIds"
        1 * tmdbClient.discover(_, _, _, { DiscoverFilters f -> f.excludeGenreIds().isEmpty() }) >> []
}
```

**Test Case (Green)**: `resolveGenreIds(null)`/`resolveGenreIds([])` already return `List.of()`
(existing behavior), so no new guard is needed beyond `SERIES-044-AC-04`'s reuse.

## Cross-References

| Concept | Location |
|---|---|
| `DiscoverFilters` | `backend/src/main/java/uk/co/stefirby/seriestracker/client/tmdb/DiscoverFilters.java` |
| `TmdbClient.discover`/`applyDiscoverFilters` | `backend/src/main/java/uk/co/stefirby/seriestracker/client/tmdb/TmdbClient.java` |
| `RecommendationSourcingService.sourceByGenreOrKeyword`/`resolveGenreIds` | `backend/src/main/java/uk/co/stefirby/seriestracker/service/recommendation/RecommendationSourcingService.java` |
| Existing include-genres pre-filter pattern this mirrors | `series_spec_007_recommendation_sourcing.md` |
| Existing pre-filter + post-filter double-narrowing pattern | `series_spec_031_custom_search_prefetch_filters.md`, `series_spec_032_custom_search_language_country_filters.md` |
| Post-fetch exclude-genres vocabulary fix (independent, complementary) | `series_spec_043_exclude_genres_vocabulary_fix.md` |
| Frontend UI sending `excludeGenres` for Custom Search | `frontend_spec_068_recommendations_exclude_genres_picker.md` |

## Acceptance Criteria Summary

- [ ] SERIES-044-AC-01: `DiscoverFilters` exposes `excludeGenreIds`
- [ ] SERIES-044-AC-02: sends `without_genres` (comma-joined) when `excludeGenreIds` is non-empty
- [ ] SERIES-044-AC-03: omits `without_genres` when `excludeGenreIds` is null/empty
- [ ] SERIES-044-AC-04: `sourceByGenreOrKeyword` resolves `excludeGenres` alias names to TMDB ids
- [ ] SERIES-044-AC-05: an unresolvable excludeGenres entry is silently skipped
- [ ] SERIES-044-AC-06: empty/absent excludeGenres sends no without_genres param
