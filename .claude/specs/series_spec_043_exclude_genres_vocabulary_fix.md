# Series Spec 043: Fix Exclude Genres Vocabulary Mismatch in `RecommendationOutputFilterService`

**Status**: Not started
**Priority**: P2
**Depends on**: Series Spec 007 (`series_spec_007_recommendation_sourcing.md`, owns
`RecommendationOutputFilterService.matchesExcludeGenres`, the method this spec fixes) ✅ required,
Series Spec 010 (`series_spec_010_genre_dropdown.md`, owns `TmdbGenreTable`'s alias/id resolution
this spec switches the method to use) ✅ required
**Area**: Backend (`service/recommendation/RecommendationOutputFilterService.java`)

## Overview

`RecommendationOutputFilterService.matchesExcludeGenres` currently resolves a candidate's genres via
`TmdbGenreTable.joinDisplayNames(candidate.genreIds())` — TMDB's own 16 *canonical* display names
(`"Action & Adventure"`, `"Sci-Fi & Fantasy"`) — and compares them against whatever strings the
caller passed in `excludeGenres`. Every other genre-vocabulary surface in this app (the "Genres"
recommendation-sourcing field, `series_spec_042`'s new My Series exclude-genres field, this app's
stored `SeriesEntity.genres`) uses the 18-item *alias* vocabulary instead (`"Action"`, `"Sci-Fi"`,
`"Fantasy"`, ...). A user excluding `"Action"` — the exact value the "Genres" field itself would
show them — silently excludes nothing, since no candidate's canonical genre string is ever literally
`"Action"`. This is the known bug tracked in `.claude/ideas/future_ideas.md` under "'Exclude Genres'
output filter matches TMDB's canonical genre names, not the alias vocabulary the 'Genres' sourcing
field uses" (confirmed still live as of 2026-08-26).

This spec fixes `matchesExcludeGenres` to resolve each `excludeGenres` entry to a TMDB genre id via
`TmdbGenreTable.idFor(String)` — the exact same resolution `RecommendationSourcingService` already
uses for the include-`genres` field — and compare ids against `candidate.genreIds()` directly, never
touching display-name strings. This is a pure bug fix: no API shape, request param, or DTO field
changes, only the matching logic inside one private method.

## Design Decisions

- **Compare ids, not names, in either direction.** Resolving `excludeGenres` names to ids and
  comparing against `candidate.genreIds()` (already a `List<Integer>` on `TmdbCandidate`) avoids
  ever rendering the candidate's side back to text at all — strictly less work than the current
  `joinDisplayNames` + string-split + case-insensitive string comparison, and removes the vocabulary
  mismatch by construction rather than by picking a matching vocabulary and hoping both sides agree
  on it.
- **An unresolvable `excludeGenres` entry is silently skipped, not an error.** Mirrors
  `RecommendationSourcingService.resolveGenreIds`'s existing `.filter(Objects::nonNull)` pattern for
  the include side — an alias name `idFor` doesn't recognize (this app/OMDb has genre names TMDB's
  16 fixed TV genres don't cover, e.g. `Thriller`, `Horror`, per `TmdbGenreTable`'s own class-level
  doc) is simply not applied as a filter, not treated as a malformed request.
- **No change to `matchesExcludeGenres`'s null/empty-input no-op behavior.** `excludeGenres`
  null/empty still means "exclude nothing" (unchanged short-circuit), and a candidate with
  null/empty `genreIds` is still never excluded (nothing to match against) — both preserved exactly
  from the current implementation, just re-expressed over ids instead of display-name strings.
- **No change to `RecommendationOutputFilterService`'s call site or `applyOutputFilters`'s filter
  chain.** This spec touches only `matchesExcludeGenres`'s internal implementation.
- **`TmdbGenreTable.joinDisplayNames` stays.** It's still used elsewhere (`RecommendationDtoAssembler`,
  per `TmdbGenreTable`'s own doc comment, to render a candidate's genres for display) — this spec
  doesn't touch or remove it, only stops using it for exclude-matching.

## Requirements

### Requirement 1: `matchesExcludeGenres` resolves both sides to TMDB genre ids before comparing

**User Story**: As a user excluding a genre by its alias name (the same vocabulary the Genres field
itself shows), I want that exclusion to actually take effect, not silently match nothing.

#### SERIES-043-AC-01 [AUTO]: an alias-name exclude value excludes a candidate carrying its resolved id
**Statement**: When `RecommendationCriteria.excludeGenres` contains an alias genre name that
`TmdbGenreTable.idFor` resolves to a TMDB genre id present in a candidate's `genreIds()`, the
`RecommendationOutputFilterService` shall exclude that candidate from `applyOutputFilters`'s result.

**Rationale**: This is the exact bug scenario from `.claude/ideas/future_ideas.md` — the primary
regression test for this spec.

**References**:
- Class: `service/recommendation/RecommendationOutputFilterService.java`, `matchesExcludeGenres`
- Type: `service/TmdbGenreTable.java`, `idFor(String)`

**Test Case (Red)**:
```groovy
def "SERIES-043-AC-01: excludeGenres=['Action'] excludes a candidate whose genreIds include 10759 (Action & Adventure)"() {
    given: "a candidate carrying TMDB genre id 10759 (canonical display name 'Action & Adventure')"
        def candidates = [dc(candidate(10, "Action Show", 2020, new BigDecimal("8.0"), [10759]))]
        def criteria = new RecommendationCriteria(excludeGenres: ["Action"])

    when: "applyOutputFilters is called"
        def result = outputFilterService.applyOutputFilters(candidates, criteria)

    then: "the candidate is excluded, even though its canonical display name is never literally 'Action'"
        result.isEmpty()
}
```

**Test Case (Green)**: rewrite `matchesExcludeGenres` to resolve `excludeGenres` entries via
`genreTable.idFor(String)` into a `Set<Integer>`, then return `false` (excluded) when that set
intersects `candidate.genreIds()`.

#### SERIES-043-AC-02 [AUTO]: an unresolvable excludeGenres entry is skipped, not an error
**Statement**: While an `excludeGenres` entry does not resolve to a known TMDB genre id via
`TmdbGenreTable.idFor`, the `RecommendationOutputFilterService` shall not use that entry to exclude
any candidate, and shall not throw.

**Rationale**: Mirrors `RecommendationSourcingService.resolveGenreIds`'s existing tolerant handling
of unrecognized alias names on the include side — an exclude-side surprise error for the same class
of input would be an inconsistency, not a feature.

**References**:
- Class: `service/recommendation/RecommendationOutputFilterService.java`
- Related: `SERIES-043-AC-01`

**Test Case (Red)**:
```groovy
def "SERIES-043-AC-02: an unrecognized excludeGenres entry is silently ignored"() {
    given: "a candidate, and excludeGenres containing a name TMDB's fixed genre table doesn't cover"
        def candidates = [dc(candidate(10, "Show", 2020, new BigDecimal("8.0"), [18]))]
        def criteria = new RecommendationCriteria(excludeGenres: ["NotARealGenre"])

    when: "applyOutputFilters is called"
        def result = outputFilterService.applyOutputFilters(candidates, criteria)

    then: "no exception is thrown and the candidate is not excluded"
        result.size() == 1
}
```

**Test Case (Green)**: the id-resolution step already drops unresolvable entries (`idFor` returning
`null`) via a `filter(Objects::nonNull)`, same as `resolveGenreIds`.

#### SERIES-043-AC-03 [AUTO]: a candidate with no genres is never excluded
**Statement**: While a candidate's `genreIds()` is `null` or empty, the
`RecommendationOutputFilterService` shall not exclude it on the basis of `excludeGenres`.

**Rationale**: Preserves the current implementation's existing null-handling behavior exactly (there
was previously nothing to render via `joinDisplayNames`, now there's nothing to intersect against),
just re-verified under the new id-based implementation.

**References**:
- Class: `service/recommendation/RecommendationOutputFilterService.java`

**Test Case (Red)**:
```groovy
def "SERIES-043-AC-03: a candidate with no genreIds is not excluded"() {
    given: "a candidate with an empty genreIds list"
        def candidates = [dc(candidate(10, "Show", 2020, new BigDecimal("8.0"), []))]
        def criteria = new RecommendationCriteria(excludeGenres: ["Comedy"])

    when: "applyOutputFilters is called"
        def result = outputFilterService.applyOutputFilters(candidates, criteria)

    then: "the candidate survives"
        result.size() == 1
}
```

**Test Case (Green)**: an empty `candidate.genreIds()` set can never intersect a non-empty resolved
exclude-id set, so this holds without a separate explicit null guard beyond what set intersection
already implies — add one only if `genreIds()` can be `null` (not just empty) per `TmdbCandidate`'s
actual type.

#### SERIES-043-AC-04 [AUTO]: empty/absent excludeGenres remains a no-op
**Statement**: While `RecommendationCriteria.excludeGenres` is `null` or empty, the
`RecommendationOutputFilterService` shall not exclude any candidate on that basis.

**Rationale**: Unchanged existing short-circuit behavior — regression coverage for this spec's
rewrite of the method, not new behavior.

**References**:
- Class: `service/recommendation/RecommendationOutputFilterService.java`

**Test Case (Red)**:
```groovy
def "SERIES-043-AC-04: no excludeGenres means no candidate is excluded on that basis"() {
    given: "a candidate with genreIds"
        def candidates = [dc(candidate(10, "Show", 2020, new BigDecimal("8.0"), [35]))]

    when: "applyOutputFilters is called with no excludeGenres set"
        def result = outputFilterService.applyOutputFilters(candidates, new RecommendationCriteria())

    then: "the candidate survives"
        result.size() == 1
}
```

**Test Case (Green)**: keep the existing `excludeGenres == null || excludeGenres.isEmpty()` early
return, unchanged.

## Cross-References

| Concept | Location |
|---|---|
| Method being fixed | `backend/src/main/java/uk/co/stefirby/seriestracker/service/recommendation/RecommendationOutputFilterService.java`, `matchesExcludeGenres` |
| Alias -> id resolution | `service/TmdbGenreTable.java`, `idFor(String)` |
| Existing include-side precedent for this resolution | `service/recommendation/RecommendationSourcingService.java`, `resolveGenreIds` |
| Bug tracking entry (resolved by this spec) | `.claude/ideas/future_ideas.md`, "'Exclude Genres' output filter matches TMDB's canonical genre names..." |
| Related pre-TMDB exclude-genres work | `series_spec_044_custom_search_exclude_genres_prefilter.md` |

## Acceptance Criteria Summary

- [ ] SERIES-043-AC-01: an alias-name exclude value excludes a candidate carrying its resolved id
- [ ] SERIES-043-AC-02: an unresolvable excludeGenres entry is skipped, not an error
- [ ] SERIES-043-AC-03: a candidate with no genres is never excluded
- [ ] SERIES-043-AC-04: empty/absent excludeGenres remains a no-op
