# Series Spec 042: Exclude Genre(s) Filter on `GET /series/search`

**Status**: Not started
**Priority**: P3
**Depends on**: Series Spec 037 (`series_spec_037_search_filter_overhaul.md`, owns
`SeriesSearchCriteria`/`SeriesSearchService.search` and the existing include-`genres`
substring-match pattern this spec mirrors) ✅ required, Series Spec 010
(`series_spec_010_genre_dropdown.md`, owns `GET /api/v1/series/genres` / `TmdbGenreTable`, the
vocabulary both the include and this new exclude field draw their checkbox options from) ✅
**Area**: Backend (`dto/SeriesSearchCriteria.java`, `service/SeriesSearchService.java`,
`controller/SeriesController.java`) — paired with Frontend Spec 063
(`frontend_spec_063_exclude_genres_search_filter.md`)

**Note (2026-09-01, exclude-genres consolidation)**: this spec's backend scope and every AC below
are unchanged. `frontend_spec_063` was revised the same day to wire `SearchFilter` through a new
shared `GenreIncludeExcludePicker` component (`frontend_spec_067`) instead of a second inline
checkbox fieldset, and that component makes selecting the same genre in both Include and Exclude
structurally impossible client-side. SERIES-042-AC-05 below (an excluded genre wins when both are
somehow set) stays in place regardless — it's still correct, still tested, defensive behavior for
any direct API caller that isn't going through that UI.

## Overview

Recommendations' `RecommendationFiltersBox` already has an "Exclude Genres" filter
(`excludeGenresText`, `series_spec_007`/`series_spec_024`), but the My Series list
(`SearchFilter`/`GET /series/search`) has no equivalent — only the existing include-`genres`
checkbox fieldset (`series_spec_037`). This spec adds an `excludeGenres` criterion to
`SeriesSearchCriteria`, `SeriesSearchService.search`, and `GET /series/search`'s query params,
mirroring the existing `matchesGenres` substring-match implementation exactly (same vocabulary,
same case-insensitive containment check) rather than introducing a second matching strategy.

Unlike Recommendations' `RecommendationOutputFilterService.matchesExcludeGenres` (which has a
known, separately-tracked vocabulary mismatch bug — see `.claude/ideas/future_ideas.md` — because
it compares against TMDB's canonical genre names while the include field uses TMDB's alias names),
`SeriesEntity.genres` and its include filter (`matchesGenres`) already use one single vocabulary:
whatever comma-separated string was stored on the entity. This spec's exclude filter reuses that
exact same field and matching logic, so no equivalent vocabulary-mismatch risk exists here — noted
explicitly so a future reader doesn't assume this spec inherited that bug.

## Design Decisions

- **Substring, case-insensitive match, same as `matchesGenres`** — not an exact-match/normalized
  comparison. `SeriesEntity.genres` is a free-ish comma-separated string (not a normalized set), so
  matching it any other way than the include filter already does would create two different
  matching semantics for the same underlying field. A series excluding "Comedy" is excluded if its
  stored genres string contains "comedy" anywhere, mirroring `matchesGenres`' own containment
  check.
- **OR semantics across multiple excluded genres** — if a series matches *any* of the requested
  exclude-genre values, it is excluded. This mirrors `matchesGenres`' own any-match semantics for
  include (a series matching any requested genre is included) applied to the negated case, and is
  the same "OR list" shape every other multi-value criterion in this DTO already uses
  (`genres`, `keywords`).
- **A series with no genres at all is never excluded** — same null-handling shape as `matchesGenres`
  (`s.getGenres() == null` there returns `false`/no-match for include; for exclude, "nothing to
  exclude on" means it survives the filter). This keeps a genre-less series visible under both the
  include and exclude filters by default, rather than one field silently including/excluding it
  when genre data happens to be missing.
- **A series matching both an included and an excluded genre is excluded** — exclude is applied as
  an independent filter stage alongside `matchesGenres`, not a modifier on it. If a caller passes
  overlapping/contradictory `genres`/`excludeGenres` values, the result is an empty match for that
  series, which is correct (an explicit exclude should win over an inclusion) and requires no
  special-case handling since both filters already compose via `Stream.filter`.
- **Query param name `excludeGenre` (singular, repeatable)** — matches the existing `genre`
  (singular, repeatable, `List<String>`) query param convention on `GET /series/search`
  (`SeriesController.search`), not a plural `excludeGenres` param name, for consistency with how
  `genre`/`keyword` are already named there.

## Requirements

### Requirement 1: `SeriesSearchCriteria` carries an `excludeGenres` list

**User Story**: As the search API, I need to accept a list of genres to exclude, alongside the
existing include-genres list, so the service layer can filter on both.

#### SERIES-042-AC-01 [AUTO]: `SeriesSearchCriteria` exposes `excludeGenres`
**Statement**: The `SeriesSearchCriteria` DTO shall expose a `List<String> excludeGenres` field
with a getter and setter, following the same shape as its existing `genres` field.

**Rationale**: Mirrors the existing `genres` field's shape exactly so `SeriesSearchService` can
apply the same kind of list-based matching to both.

**References**:
- Type: `dto/SeriesSearchCriteria.java` (existing `genres: List<String>` field, line 8)

**Test Case (Red)**:
```groovy
def "SERIES-042-AC-01: SeriesSearchCriteria exposes excludeGenres getter/setter"() {
    given: "a new SeriesSearchCriteria"
        def criteria = new SeriesSearchCriteria()

    when: "excludeGenres is set"
        criteria.setExcludeGenres(["Comedy", "Horror"])

    then: "the getter returns the same list"
        criteria.getExcludeGenres() == ["Comedy", "Horror"]
}
```

**Test Case (Green)**: add the `excludeGenres` field + getter/setter to `SeriesSearchCriteria`.

### Requirement 2: `SeriesSearchService` filters out series matching any excluded genre

**User Story**: As a user of the My Series list, I want to exclude series in genres I'm not
interested in, so my search results skip them even if they'd otherwise match.

#### SERIES-042-AC-02 [AUTO]: excludes a series matching any requested excluded genre
**Statement**: When `SeriesSearchCriteria.excludeGenres` is non-empty, the `SeriesSearchService`
shall exclude from the result any `SeriesEntity` whose `genres` string contains (case-insensitive)
any of the requested excluded genre values.

**Rationale**: Core behavior — lets a user filter out unwanted genres from My Series, mirroring
Recommendations' existing Exclude Genres filter but for the tracked-series list.

**References**:
- Class: `service/SeriesSearchService.java` (existing `matchesGenres`, line 69, the pattern this
  mirrors)
- Related: `SERIES-042-AC-01`

**Test Case (Red)**:
```groovy
def "SERIES-042-AC-02: excludes a series whose genres contain an excluded value"() {
    given: "a Comedy series and a Drama series"
        repository.save(new SeriesEntity(title: "Funny Show", genres: "Comedy"))
        repository.save(new SeriesEntity(title: "Serious Show", genres: "Drama"))

    when: "searching with excludeGenres=[Comedy]"
        def criteria = new SeriesSearchCriteria()
        criteria.setExcludeGenres(["Comedy"])
        def results = service.search(criteria)

    then: "only the Drama series is returned"
        results*.title == ["Serious Show"]
}
```

**Test Case (Green)**: add `matchesExcludeGenres` (negated `matchesGenres` any-match) and chain it
into the existing `.filter(...)` pipeline in `search`.

#### SERIES-042-AC-03 [AUTO]: a genre-less series is never excluded
**Statement**: While a `SeriesEntity`'s `genres` field is `null` or blank, the `SeriesSearchService`
shall not exclude it from the result regardless of `excludeGenres`.

**Rationale**: Matches `matchesGenres`' own null-handling convention for the include side —
genre-less series aren't silently dropped by a filter they have no data to satisfy or violate.

**References**:
- Class: `service/SeriesSearchService.java` (`matchesGenres`'s `s.getGenres() == null` branch, line
  71)

**Test Case (Red)**:
```groovy
def "SERIES-042-AC-03: a series with no genres is not excluded"() {
    given: "a series with no genres set"
        repository.save(new SeriesEntity(title: "No Genre Show", genres: null))

    when: "searching with excludeGenres=[Comedy]"
        def criteria = new SeriesSearchCriteria()
        criteria.setExcludeGenres(["Comedy"])
        def results = service.search(criteria)

    then: "the genre-less series is still returned"
        results*.title == ["No Genre Show"]
}
```

**Test Case (Green)**: `matchesExcludeGenres` returns `true` (not excluded) when
`s.getGenres()` is null/blank, before checking the excluded list.

#### SERIES-042-AC-04 [AUTO]: an empty/absent `excludeGenres` is a no-op
**Statement**: While `SeriesSearchCriteria.excludeGenres` is `null` or empty, the
`SeriesSearchService` shall not exclude any series on that basis.

**Rationale**: Existing behavior for every optional criterion in this service — an unset filter
must not change the result set.

**References**:
- Class: `service/SeriesSearchService.java`

**Test Case (Red)**:
```groovy
def "SERIES-042-AC-04: no excludeGenres means no series is excluded on that basis"() {
    given: "a Comedy series"
        repository.save(new SeriesEntity(title: "Funny Show", genres: "Comedy"))

    when: "searching with no excludeGenres set"
        def results = service.search(new SeriesSearchCriteria())

    then: "the Comedy series is still returned"
        results*.title == ["Funny Show"]
}
```

**Test Case (Green)**: `matchesExcludeGenres` returns `true` immediately when the list is
null/empty, matching every other optional-criterion method in this class.

#### SERIES-042-AC-05 [AUTO]: include and exclude compose — an excluded genre wins
**Statement**: When a `SeriesEntity` matches both `SeriesSearchCriteria.genres` (include) and
`SeriesSearchCriteria.excludeGenres`, the `SeriesSearchService` shall exclude it from the result.

**Rationale**: Documents the deliberate precedence decision (Design Decisions above) so it's
covered by a test rather than left as an accidental side effect of filter-chaining order.

**References**:
- Class: `service/SeriesSearchService.java`
- Related: `SERIES-042-AC-02`

**Test Case (Red)**:
```groovy
def "SERIES-042-AC-05: a series matching both genres and excludeGenres is excluded"() {
    given: "a series tagged with both Comedy and Drama"
        repository.save(new SeriesEntity(title: "Dramedy", genres: "Comedy, Drama"))

    when: "searching with genres=[Comedy] and excludeGenres=[Drama]"
        def criteria = new SeriesSearchCriteria()
        criteria.setGenres(["Comedy"])
        criteria.setExcludeGenres(["Drama"])
        def results = service.search(criteria)

    then: "no series is returned"
        results.isEmpty()
}
```

**Test Case (Green)**: no new code needed beyond `SERIES-042-AC-02`'s filter — this AC verifies
the two filters already compose correctly via the existing `Stream.filter` chain.

### Requirement 3: `GET /series/search` accepts an `excludeGenre` query parameter

**User Story**: As the `SearchFilter` frontend, I need a query parameter to send excluded genres
to the backend, matching the existing `genre` parameter's shape.

#### SERIES-042-AC-06 [AUTO]: `excludeGenre` query param maps to `excludeGenres` criteria
**Statement**: When `GET /api/v1/series/search` is requested with one or more `excludeGenre` query
parameters, the `SeriesController` shall populate `SeriesSearchCriteria.excludeGenres` with those
values before delegating to `SeriesSearchService.search`.

**Rationale**: Wires the new criterion into the existing endpoint, following the same
`@RequestParam(required = false) List<String> genre` convention the include-genre param already
uses.

**References**:
- Class: `controller/SeriesController.java` (existing `search` method, `genre` param, line 88)
- Related: `SERIES-042-AC-01`

**Test Case (Red)**:
```groovy
def "SERIES-042-AC-06: GET /series/search?excludeGenre=Comedy excludes Comedy series"() {
    given: "a Comedy series and a Drama series exist"
        // seed via repository, as in SeriesControllerSpec's existing search tests

    when: "GET /api/v1/series/search?excludeGenre=Comedy is requested"
        def response = client.get().uri("/api/v1/series/search?excludeGenre=Comedy").exchange()

    then: "the response is 200 and excludes the Comedy series"
        response.expectStatus().isOk()
        response.expectBody().jsonPath('$.data[*].title').value(not(hasItem("Funny Show")))
}
```

**Test Case (Green)**: add the `excludeGenre` `@RequestParam` and wire it to
`criteria.setExcludeGenres(...)` in `SeriesController.search`.

## Cross-References

| Concept | Location |
|---|---|
| `SeriesSearchCriteria` | `backend/src/main/java/uk/co/stefirby/seriestracker/dto/SeriesSearchCriteria.java` |
| `SeriesSearchService.search`/`matchesGenres` | `backend/src/main/java/uk/co/stefirby/seriestracker/service/SeriesSearchService.java` |
| `GET /series/search` | `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesController.java` |
| Existing include-genre pattern this mirrors | `series_spec_037_search_filter_overhaul.md` |
| Genre vocabulary (`GET /series/genres`) | `series_spec_010_genre_dropdown.md`, `service/TmdbGenreTable.java` |
| Frontend UI for this filter | `frontend_spec_063_exclude_genres_search_filter.md` |
| Shared include/exclude toggle component `SearchFilter` now uses | `frontend_spec_067_genre_include_exclude_picker.md` |
| Known, unrelated vocabulary-mismatch bug on the Recs side (not inherited here) | `.claude/ideas/future_ideas.md`, "'Exclude Genres' output filter matches TMDB's canonical genre names..." |

## Acceptance Criteria Summary

- [ ] SERIES-042-AC-01: `SeriesSearchCriteria` exposes `excludeGenres`
- [ ] SERIES-042-AC-02: excludes a series matching any requested excluded genre
- [ ] SERIES-042-AC-03: a genre-less series is never excluded
- [ ] SERIES-042-AC-04: an empty/absent `excludeGenres` is a no-op
- [ ] SERIES-042-AC-05: include and exclude compose — an excluded genre wins
- [ ] SERIES-042-AC-06: `excludeGenre` query param maps to `excludeGenres` criteria
