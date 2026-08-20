# Spec 010: Genre Vocabulary Endpoint (Recommendation Sourcing Fix)

**Status**: ✅ Implemented — `TmdbGenreTable.allAliasNames()` added in `backend/src/main/java/uk/co/stefirby/seriestracker/service/TmdbGenreTable.java`, which is now a Spring `@Component`. New `GET /api/v1/series/genres` endpoint in `controller/SeriesController.java`, constructor-injecting `TmdbGenreTable` directly and delegating with no new service class. `RecommendationService` now constructor-injects `TmdbGenreTable` instead of `private static final TmdbGenreTable GENRE_TABLE = new TmdbGenreTable();`. Tests: addition to `service/TmdbGenreTableSpec.groovy`, new `controller/SeriesControllerGenresSpec.groovy`. Full suite green (`gradlew.bat test`) aside from pre-existing, unrelated failures in `OmdbClientSpec`/`SeriesLookupServiceSpec`/`SeriesControllerLookupSpec` belonging to in-progress Spec 011 work; see Implementation Notes below for one implementation detail that diverged from this spec's original assumptions.
**Priority**: P1 (bug fix — the "Genres" recommendation-sourcing field silently degrades to an unrelated result set with no error surfaced anywhere; see Overview)
**Depends on**: Series Spec 007 (`TmdbGenreTable`, `RecommendationService.resolveGenreIds`, `GET /api/v1/series/recommendations`)
**Backend Task**

## Overview

Fixes a silent failure in recommendation sourcing's "Genre & Keyword" mode. `RecommendationService.resolveGenreIds` matches each user-typed genre string against `TmdbGenreTable.idFor(name)`, an **exact-match-only** lookup against TMDB's fixed 16 TV genre *alias* names (`Action`, `Adventure`, `Animation`, `Comedy`, `Crime`, `Documentary`, `Drama`, `Family`, `Kids`, `Mystery`, `News`, `Reality`, `Sci-Fi`, `Fantasy`, `Soap`, `Talk-Show`, `War`, `Western`). A typed value that doesn't exactly match one of these (e.g. `"Spy"`, or even a near-miss like `"sci-fi "` with different casing/whitespace) is silently dropped by `.filter(Objects::nonNull)` — no error surfaces to the user. If every typed genre/keyword fails to resolve this way, `TmdbClient.discover(genreIds=[], keywordIds=[])` sends `GET /discover/tv` with neither `with_genres` nor `with_keywords` set, silently falling through to TMDB's generic "most popular" feed — completely unrelated to what the user typed.

This spec fixes the free-text-against-a-fixed-vocabulary mismatch at its root by exposing the fixed vocabulary itself: a new `GET /api/v1/series/genres` endpoint returns the exact list of alias names `idFor` accepts, so the frontend (Frontend Spec 014) can replace the free-text "Genres" input with a checkbox list built from this same list — the user can now only select values that are guaranteed to resolve. Backend and frontend can never drift apart on what's valid, because both read from the one list this spec adds an accessor for.

**Design decisions**:
- **Expose alias names, not TMDB's canonical display names.** `TmdbGenreTable` already has two distinct vocabularies: the *alias* names (`Action`, `Sci-Fi`, `Talk-Show`, ...) that `idFor` matches user/OMDb-style genre strings against, and the *canonical* display names (`"Action & Adventure"`, `"Sci-Fi & Fantasy"`, `"Talk"`, ...) that `displayNameFor` renders TMDB's own `genre_ids` back to for display (used by `RecommendationDto.genres` and `matchesExcludeGenres`). This spec's new endpoint must expose the alias vocabulary — that's what the broken "Genres" field actually needs to match against. Conflating the two would just move the bug rather than fix it.
- **Sorted alphabetically for a stable, predictable order.** Nothing in `TmdbGenreTable.GENRES`'s declaration order is meaningful to a user; alphabetical is the least surprising order for a checkbox list to render in.
- **No query params, always `200`.** This endpoint returns a fixed, hardcoded list — there's nothing to filter, and no input that could make it fail. Trivial as an implementation, but it's precisely the point: a single source of truth here means the frontend and backend can never drift apart on what's valid.
- **Delegates directly from `SeriesController` to `TmdbGenreTable`, no new service class.** This repo's controllers stay thin and business logic lives in `service/`, but returning a static, precomputed list with no branching, no persistence, and no external call isn't business logic to house in a dedicated service — it's pure delegation. `TmdbGenreTable` becomes a Spring-managed `@Component` so it can be constructor-injected into `SeriesController` the same way every other collaborator already is, rather than the controller doing a bare `new TmdbGenreTable()`.
- **Out of scope, flagged for later**: `RecommendationService.matchesExcludeGenres` compares the "Exclude Genres" output filter against TMDB's *canonical* display names (e.g. `"Action & Adventure"`), a different vocabulary than the alias names `idFor` expects for the "Genres" sourcing field this spec fixes — the same free-text-against-fixed-vocabulary risk exists there too (a user typing `"Action"` into Exclude Genres won't match `"Action & Adventure"`). It's out of scope here since the user only reported the Genres sourcing field, but worth a follow-up spec exposing the canonical-name list the same way, for the same reason.

---

## Requirements

### Requirement 1: `TmdbGenreTable` Alias Vocabulary Accessor

**User story**: As a developer, I want the exact set of genre strings `idFor` will successfully resolve exposed as a list, so a caller (the new endpoint, Requirement 2) doesn't have to reverse-engineer or duplicate `TmdbGenreTable`'s internal alias table.

#### Acceptance Criteria

- **SERIES-010-AC-01** [AUTO]: `TmdbGenreTable` shall gain a public accessor (e.g. `allAliasNames()`) returning the full flattened list of every alias name across all `GENRES` entries — the same strings `idFor` matches against — sorted alphabetically (case-sensitive ordinal sort is acceptable; there are no case collisions in the fixed list).
- **SERIES-010-AC-02** [AUTO]: The returned list shall contain exactly the 18 alias names currently in `GENRES` (`Action`, `Adventure`, `Animation`, `Comedy`, `Crime`, `Documentary`, `Drama`, `Family`, `Kids`, `Mystery`, `News`, `Reality`, `Sci-Fi`, `Fantasy`, `Soap`, `Talk-Show`, `War`, `Western`) — not the 16 canonical display names (`displayNameFor`'s vocabulary, e.g. `"Action & Adventure"`) — with no duplicates, since every alias in `GENRES` is already unique by construction.

---

### Requirement 2: `GET /api/v1/series/genres` Endpoint

**User story**: As a frontend developer, I want to fetch the exact set of valid genre names from the backend, so the "Genres" sourcing control can only let a user pick values that are guaranteed to resolve — no more silent drops.

#### Acceptance Criteria

- **SERIES-010-AC-03** [AUTO]: `TmdbGenreTable` shall be registered as a Spring-managed component (`@Component`), so it can be constructor-injected into `SeriesController` following the same constructor-injection pattern already used for every other collaborator there (`SeriesService`, `RecommendationService`, etc.).
- **SERIES-010-AC-04** [AUTO]: `SeriesController` shall expose `GET /api/v1/series/genres`, accepting no query parameters, delegating directly to `TmdbGenreTable.allAliasNames()` (`SERIES-010-AC-01`) — no new service class, per the Design Decisions above.
- **SERIES-010-AC-05** [AUTO]: On every call, the endpoint shall return `200 OK` with `ApiResponse<List<String>>`, using the same `{ "data": [...], "count": N }` envelope already used by `GET /api/v1/series` and every other list-returning endpoint in this app.
- **SERIES-010-AC-06** [AUTO]: The response's `data` shall exactly equal `TmdbGenreTable.allAliasNames()`'s list, in the same order, with `count` equal to its size (`18`, per `SERIES-010-AC-02`, though this AC deliberately doesn't hardcode that number so it stays correct if `GENRES` ever changes).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `TmdbGenreTable`, `GENRES`, `idFor`/`displayNameFor`, alias-vs-canonical vocabulary distinction | `series_spec_007_recommendation_sourcing.md` Requirement 2 |
| `RecommendationService.resolveGenreIds`, the "Genres" sourcing field this endpoint fixes the silent-failure behavior for | `series_spec_007_recommendation_sourcing.md` Requirement 5 (`SERIES-007-AC-12`–`AC-18`) |
| `ApiResponse<T>` `{ data, count }` envelope pattern | `series_spec_002_crud.md` |
| Frontend consumer of this endpoint (checkbox-list replacement for the free-text Genres input) | `frontend_spec_014_genre_dropdown.md` |
| Original free-text Genres/Keywords fields being replaced (Genres only — Keywords is unaffected, see that spec's Overview) | `frontend_spec_011_recommendation_controls.md` Requirement 2 |

---

## TDD Test Case Sketches

### `TmdbGenreTableSpec.groovy` (addition)

```groovy
def "SERIES-010-AC-01/02: exposes the full flattened alias vocabulary, sorted alphabetically, no duplicates"() {
    given: "the fixed TmdbGenreTable.GENRES list"
        def table = new TmdbGenreTable()

    when: "allAliasNames() is called"
        def aliases = table.allAliasNames()

    then: "it contains exactly the 18 alias names, not the 16 canonical display names"
        aliases.size() == 18
        aliases.containsAll(["Action", "Adventure", "Sci-Fi", "Fantasy", "Talk-Show", "War"])
        !aliases.contains("Action & Adventure")
        !aliases.contains("Sci-Fi & Fantasy")
        !aliases.contains("Talk")
        !aliases.contains("War & Politics")

    and: "it is sorted alphabetically with no duplicates"
        aliases == aliases.toSorted()
        aliases.toSet().size() == aliases.size()
}
```

### `SeriesControllerGenresSpec.groovy` (new file, mirroring `SeriesControllerLookupSpec.groovy`'s style)

```groovy
def "SERIES-010-AC-04/05/06: GET /api/v1/series/genres returns 200 with the full sorted alias list"() {
    when: "GET /api/v1/series/genres is requested"
        def response = client.get().uri("/api/v1/series/genres").exchange()

    then: "the response is 200 with the envelope shape"
        response.expectStatus().isOk()

    and: "data matches TmdbGenreTable.allAliasNames() exactly, and count matches its size"
        def expected = new TmdbGenreTable().allAliasNames()
        response.expectBody().jsonPath("\$.count").isEqualTo(expected.size())
        response.expectBody().jsonPath("\$.data[0]").isEqualTo(expected.first())
        response.expectBody().jsonPath("\$.data.length()").isEqualTo(expected.size())
}

def "SERIES-010-AC-04: no query parameters are required or accepted"() {
    when: "GET /api/v1/series/genres is requested with no params"
        def response = client.get().uri("/api/v1/series/genres").exchange()

    then: "the request succeeds without any param"
        response.expectStatus().isOk()
}
```

---

## Implementation Notes (Deviations From Original Assumptions)

One implementation detail diverged from what this spec's TDD sketches assumed, discovered during implementation:

1. **`SeriesControllerGenresSpec.groovy` uses `MockMvc`, not a `WebTestClient`-style `client.get().uri(...).exchange()` fluent client.** The sketch's `client.get().uri(...).exchange()` shape doesn't match this repo's actual controller-test convention — `SeriesControllerLookupSpec.groovy` (the file this spec explicitly says to mirror) uses `@AutoConfigureMockMvc` + `MockMvc`/`mockMvc.perform(get(...))` + `jsonPath(...)` matchers, consistent with every other controller spec in this codebase. The new spec follows that existing convention instead, preserving the sketch's assertions (status 200, `$.count`, `$.data[0]`, `$.data.length()`) unchanged.

Separately, making `TmdbGenreTable` constructor-injectable into `RecommendationService` (Requirement 2's "consistent constructor injection" instruction, not a numbered AC) required turning two previously `private static` helper methods (`toDto`, `joinGenres`) into instance methods, since they call `genreTable::displayNameFor` and `static` methods can't reference an instance field. No behavior change, no test change needed for those methods — same class only.

## Acceptance Criteria Summary

- [x] SERIES-010-AC-01: `TmdbGenreTable.allAliasNames()` returns the flattened alias list, sorted
- [x] SERIES-010-AC-02: list contains exactly the 18 alias names, not canonical display names, no duplicates
- [x] SERIES-010-AC-03: `TmdbGenreTable` registered as a Spring `@Component`
- [x] SERIES-010-AC-04: `GET /api/v1/series/genres` endpoint, no query params, delegates directly (no new service)
- [x] SERIES-010-AC-05: 200 + `ApiResponse<List<String>>` envelope on every call
- [x] SERIES-010-AC-06: `data`/`count` exactly mirror `allAliasNames()`
