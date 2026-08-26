# Tooling Spec 003: Recommendation Service Decomposition

**Status**: Not started
**Priority**: P2 (repo hygiene — doesn't block product feature work)
**Depends on**: `tooling_spec_002` (established the decomposition process this spec repeats)
**Area**: Tooling (backend-only)

---

## Overview

`RecommendationService` is 898 lines doing several distinct jobs behind one `@Service`:
criteria validation, four candidate-sourcing strategies, dedup/exclusion, output filtering,
ranking + diversity-cap, DTO assembly, and a scope leak — per-series streaming-provider lookup
that `SeriesWatchProviderController` calls directly for a non-recommendation endpoint. This
spec splits it into one `@Service` per responsibility, following the same process as
`tooling_spec_002`'s `SeriesController` decomposition.

Unlike `tooling_spec_002`, this is **not** a zero-test-diff refactor. Extracted collaborators
become real Spring `@Service` beans (idiomatic DI, matching every other service in this
codebase, independently mockable) rather than plain internal helper objects — so
`RecommendationService`'s constructor signature changes. `RecommendationServiceSpec.groovy`
(1937 lines, a plain Spock unit spec that directly constructs
`new RecommendationService(seriesRepository, ignoredSeriesRepository, tmdbClient, new
TmdbGenreTable(), 20, 50, "best-source", 8, "GB")` in one field — not a `@SpringBootTest`)
splits into one spec per new class, matching this project's "one `*Spec.groovy` per class
under test" convention. Every requirement below can be picked up independently except
Requirement 9, which must land last (it wires the collaborators Requirements 1–8 create).

Pure refactor: no behavior or response-shape change to `GET /api/v1/series/recommendations`,
`GET /api/v1/series/recommendations/{tmdbId}/keywords`, or
`GET /api/v1/series/{id}/watch-providers`.

---

## Requirements

### Requirement 1: Shared Candidate Records & Constants

**User story**: As a developer, I want the candidate-pipeline record types and the constants
several collaborators need defined once, so extracting classes around them doesn't create
duplicate definitions that can drift apart.

`RawCandidate`, `DedupedCandidate`, and `ScoredCandidate` are currently private records nested
in `RecommendationService`; once sourcing/dedup/filtering/ranking become separate classes, these
types need to cross class boundaries. Likewise `SOURCE_MODE_TOP_RATED`,
`DEFAULT_MIN_VOTE_COUNT`(`_TOP_RATED`), `DEFAULT_TOP_RATED_SORT_BY`, `DEFAULT_GENRE_SORT_BY`,
and `VALID_DISCOVER_SORT_BY` are each read by two or more of the new classes, and
`SOURCE_ORDER_COMPARATOR` orders both the sourcing pool and dedup's per-candidate source list
(SERIES-015-AC-05/06 requires these two orderings to never disagree).

#### Acceptance Criteria

- **TOOLING-003-AC-01** `[AUTO]`: `RawCandidate`, `DedupedCandidate`, and `ScoredCandidate`
  shall be promoted to standalone package-private records (one file each, matching the existing
  small-record precedent — `IgnoreOutcome.java`, `RefreshResult.java`), functionally identical
  in fields and semantics to today's private nested records.
- **TOOLING-003-AC-02** `[AUTO]`: `RecommendationDefaults` shall define `SOURCE_MODE_TOP_RATED`,
  `DEFAULT_MIN_VOTE_COUNT`, `DEFAULT_MIN_VOTE_COUNT_TOP_RATED`, `DEFAULT_TOP_RATED_SORT_BY`,
  `DEFAULT_GENRE_SORT_BY`, and `VALID_DISCOVER_SORT_BY` as the single source every consumer
  references, with identical values to today's constants.
- **TOOLING-003-AC-03** `[AUTO]`: `SourceOrderComparator` shall define the
  `personalRating`-descending/`dateCompleted`-descending ordering as the single source shared by
  sourcing's pool ordering and dedup's per-candidate source ordering, preserving
  SERIES-015-AC-05/06's "must never disagree" guarantee.

---

### Requirement 2: `RecommendationCriteriaValidator`

**User story**: As a developer, I want request-criteria validation isolated from sourcing/
ranking logic, so validation rules can be read and tested without the rest of the pipeline.

#### Acceptance Criteria

- **TOOLING-003-AC-04** `[AUTO]`: `RecommendationCriteriaValidator.validate(RecommendationCriteria)`
  shall reject the same invalid inputs `RecommendationService.validate()` currently rejects —
  an unrecognized `sourceMode`, mutually-exclusive mode combinations, an out-of-range
  `minSourceRating`, an invalid `trendingWindow`, and an invalid `discoverSortBy` — with
  identical exception messages.
- **TOOLING-003-AC-05** `[AUTO]`: `RecommendationCriteria` shall gain an
  `isDirectedByGenreOrKeyword()` method returning `true` iff `genres` or `keywords` is
  non-null/non-empty, as the single definition both the validator and
  `RecommendationService`'s orchestration read (replacing two copies of the same check).
- **TOOLING-003-AC-06** `[AUTO]`: `RecommendationCriteriaValidator` shall inject no
  collaborators (pure/stateless).

**Test Case (Red)**:
```groovy
def "TOOLING-003-AC-04: rejects sourceMode combined with seriesIds"() {
    given: "a validator with no collaborators"
        def validator = new RecommendationCriteriaValidator()

    and: "criteria combining sourceMode with seriesIds"
        def criteria = new RecommendationCriteria(sourceMode: "trending", seriesIds: ["id-1"])

    when: "validate is called"
        validator.validate(criteria)

    then: "an IllegalArgumentException is thrown with the existing message"
        def ex = thrown(IllegalArgumentException)
        ex.message.contains("sourceMode cannot be combined with seriesIds/genres/keywords")
}
```

---

### Requirement 3: `WatchProviderService`

**User story**: As a developer, I want per-series and per-candidate streaming-provider lookup
in its own service, since it's reused by a non-recommendation endpoint and isn't itself
recommendation logic.

#### Acceptance Criteria

- **TOOLING-003-AC-07** `[AUTO]`: `WatchProviderService.streamingProviders(int tmdbId)` shall
  resolve and map a candidate's flatrate streaming providers in the configured `watchRegion`
  identically to `RecommendationService`'s current private `streamingProviders(int)`, including
  failing open to an empty list on an `ExternalServiceException` or a `null` response.
- **TOOLING-003-AC-08** `[AUTO]`: `WatchProviderService.getStreamingProvidersForSeries(UUID id)`
  shall behave identically to `RecommendationService`'s current method: 404
  (`EntityNotFoundException`) on an unknown id, an empty list for a missing/unresolvable
  `imdbId`, and an empty list on a `watchProviders` failure.
- **TOOLING-003-AC-09** `[AUTO]`: `SeriesWatchProviderController` shall inject
  `WatchProviderService` instead of `RecommendationService`, with
  `GET /api/v1/series/{id}/watch-providers`'s contract unchanged.
- **TOOLING-003-AC-10** `[AUTO]`: `WatchProviderService` shall inject only `SeriesRepository`,
  `TmdbClient`, and the configured `watchRegion`.

**Test Case (Red)**:
```groovy
def "TOOLING-003-AC-08: getStreamingProvidersForSeries returns empty list when imdbId is blank"() {
    given: "a service with mocked collaborators"
        def seriesRepository = Mock(SeriesRepository)
        def tmdbClient = Mock(TmdbClient)
        def service = new WatchProviderService(seriesRepository, tmdbClient, "GB")

    and: "a tracked series with no imdbId"
        def id = UUID.randomUUID()
        seriesRepository.findById(id) >> Optional.of(new SeriesEntity(id: id, title: "No Link"))

    when: "getStreamingProvidersForSeries is called"
        def result = service.getStreamingProvidersForSeries(id)

    then: "an empty list is returned, no TmdbClient call made"
        result == []
        0 * tmdbClient.findTvIdByImdbId(_)
}
```

---

### Requirement 4: `RecommendationDtoAssembler`

**User story**: As a developer, I want the TMDB-candidate-to-`RecommendationDto` mapping
isolated from sourcing/filtering/ranking, so DTO shape changes touch one small class.

#### Acceptance Criteria

- **TOOLING-003-AC-11** `[AUTO]`: `RecommendationDtoAssembler`'s `toDto(...)` shall build a
  `RecommendationDto` identical in every field to `RecommendationService`'s current `toDto`,
  delegating streaming-provider resolution to `WatchProviderService.streamingProviders(int)`.
- **TOOLING-003-AC-12** `[AUTO]`: `RecommendationDtoAssembler` shall inject only
  `TmdbGenreTable` and `WatchProviderService`.

---

### Requirement 5: `RecommendationDeduplicationService`

**User story**: As a developer, I want dedup/already-added/already-ignored exclusion isolated
from sourcing and filtering, so the accumulation logic can be read and tested on its own.

#### Acceptance Criteria

- **TOOLING-003-AC-13** `[AUTO]`: `RecommendationDeduplicationService.dedupeAndExclude(...)`
  shall dedupe and exclude candidates identically to `RecommendationService`'s current
  implementation — already-added, already-ignored, `imdb_id`-based dedup, and source
  accumulation ordered by `SourceOrderComparator`.
- **TOOLING-003-AC-14** `[AUTO]`: `RecommendationDeduplicationService` shall inject only
  `SeriesRepository`, `IgnoredSeriesRepository`, and `TmdbClient`.

---

### Requirement 6: `RecommendationOutputFilterService`

**User story**: As a developer, I want the post-sourcing output filters isolated, so a new
filter (or a change to an existing one) doesn't require reading sourcing/ranking code.

#### Acceptance Criteria

- **TOOLING-003-AC-15** `[AUTO]`: `RecommendationOutputFilterService.applyOutputFilters(...)`
  shall apply every filter — `minTmdbRating`, `minVoteCount` (including `topRated`'s mode-aware
  default), year range, `excludeGenres`, `language`, `excludeKeywords` — identically to
  `RecommendationService`'s current implementation, including `excludeKeywords` running last and
  failing open on a TMDB lookup failure.
- **TOOLING-003-AC-16** `[AUTO]`: `RecommendationOutputFilterService` shall inject only
  `TmdbClient`.

---

### Requirement 7: `RecommendationSourcingService`

**User story**: As a developer, I want all four candidate-sourcing strategies isolated in one
class, so "how do we get raw candidates" is answerable without reading dedup/filter/ranking
code.

#### Acceptance Criteria

- **TOOLING-003-AC-17** `[AUTO]`: `RecommendationSourcingService` shall source candidates
  identically to `RecommendationService`'s current four strategies (trending, `topRated`,
  genre/keyword-directed, pool-based title+genre-supplement) for every criteria combination.
- **TOOLING-003-AC-18** `[AUTO]`: `RecommendationSourcingService` shall inject only
  `SeriesRepository`, `TmdbClient`, `TmdbGenreTable`, and the configured `maxSourceSeries`.

---

### Requirement 8: `RecommendationRankingService`

**User story**: As a developer, I want scoring, sorting, and the diversity cap isolated from
sourcing/filtering, so ranking-only changes (e.g. a new `sortBy` value) touch one class.

#### Acceptance Criteria

- **TOOLING-003-AC-19** `[AUTO]`: `RecommendationRankingService` shall score, sort, and
  diversity-cap candidates identically to `RecommendationService`'s current implementation —
  the `rankScore` formula, `sortBy` branching, and `best-source`/`all-sources` diversity-cap
  modes.
- **TOOLING-003-AC-20** `[AUTO]`: `RecommendationRankingService` shall inject
  `RecommendationDtoAssembler` and the configured `diversityCapMode`/`maxPerSource`.

---

### Requirement 9: Trimmed `RecommendationService` Orchestrator

**User story**: As a developer, I want the original service reduced to pipeline orchestration
once every other responsibility has its own class.

Must land last: it wires every collaborator Requirements 1–8 create.

#### Acceptance Criteria

- **TOOLING-003-AC-21** `[AUTO]`: `RecommendationService.recommend(int)` /
  `recommend(int, RecommendationCriteria)` shall produce results identical to today's
  implementation for every source mode, by orchestrating
  `RecommendationCriteriaValidator` → `RecommendationSourcingService` → (inline
  `maxCandidates` capping) → `RecommendationDeduplicationService` →
  `RecommendationOutputFilterService` → `RecommendationRankingService`/`RecommendationDtoAssembler`
  in the same order as today's `doRecommend`.
- **TOOLING-003-AC-22** `[AUTO]`: `RecommendationService`'s constructor shall inject only the
  six collaborator services above, `TmdbClient` (for `getKeywordsForCandidate`), and the
  configured `maxCandidates`.
- **TOOLING-003-AC-23** `[AUTO]`: `RecommendationService.getKeywordsForCandidate(int tmdbId)`
  shall remain unchanged, delegating directly to `TmdbClient`.

**Test Case (Red)**:
```groovy
def "TOOLING-003-AC-21: recommend(20) with an automatic pool still ranks and diversity-caps as before"() {
    given: "RecommendationService wired with real collaborator instances over mocked leaf dependencies"
        // construct RecommendationCriteriaValidator, RecommendationSourcingService,
        // RecommendationDeduplicationService, RecommendationOutputFilterService,
        // RecommendationDtoAssembler, RecommendationRankingService directly (mocking
        // SeriesRepository/IgnoredSeriesRepository/TmdbClient/TmdbGenreTable as today), then
        // new RecommendationService(validator, sourcing, dedup, filter, ranking, dtoAssembler, tmdbClient, 50)

    when: "recommend(20) is called with a completed, rated source series"
        def results = recommendationService.recommend(20)

    then: "results match the pre-decomposition ranked/diversity-capped output exactly"
        // same assertions as the pre-existing SERIES-007-AC-21/AC-22 cases
}
```

---

### Requirement 10: Test Suite Coverage Preserved

**User story**: As a developer, I want every acceptance criterion `RecommendationServiceSpec.groovy`
verified before this decomposition still verified afterward, just redistributed by class, so
the refactor can't silently drop coverage.

#### Acceptance Criteria

- **TOOLING-003-AC-24** `[AUTO]`: Every acceptance criterion `RecommendationServiceSpec.groovy`
  verified before this decomposition shall still be verified afterward, redistributed across
  `RecommendationServiceSpec.groovy` (orchestration/cross-cutting cases only) and seven new
  specs — `RecommendationCriteriaValidatorSpec`, `RecommendationSourcingServiceSpec`,
  `RecommendationDeduplicationServiceSpec`, `RecommendationOutputFilterServiceSpec`,
  `WatchProviderServiceSpec`, `RecommendationDtoAssemblerSpec`, `RecommendationRankingServiceSpec`
  — with no acceptance criterion dropped, only relocated.
- **TOOLING-003-AC-25** `[AUTO]`: `SeriesControllerWatchProvidersSpec.groovy` and
  `SeriesControllerRecommendationsSpec.groovy` (controller-level, MockMvc-based) shall pass
  unmodified, since they exercise HTTP paths and mock only leaf dependencies
  (`TmdbClient`/`SeriesRepository`), never `RecommendationService`/`WatchProviderService`
  directly.

**Test Case (Red → Green)**:
```groovy
// No new assertions here beyond Requirements 1-9's own test cases. This AC is verified by
// diffing RecommendationServiceSpec.groovy's pre-decomposition acceptance-criteria-ID list
// against the union of IDs across all eight post-decomposition spec files -- every ID present
// before must be present after. SeriesControllerWatchProvidersSpec.groovy and
// SeriesControllerRecommendationsSpec.groovy need zero diff; gradlew.bat test passing with
// both files untouched is the verification for TOOLING-003-AC-25.
```

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationService.java` (pre-refactor) | `backend/src/main/java/uk/co/stefirby/seriestracker/service/` |
| `RecommendationServiceSpec.groovy` (pre-refactor, 1937 lines) | `backend/src/test/groovy/uk/co/stefirby/seriestracker/service/` |
| `SeriesWatchProviderController.java` | `backend/src/main/java/uk/co/stefirby/seriestracker/controller/` (`tooling_spec_002`, Requirement 5) |
| `RecommendationCriteria.java` | `backend/src/main/java/uk/co/stefirby/seriestracker/dto/` |
| Multi-source attribution / diversity cap ordering | `series_spec_015_multi_source_recommendations.md` (SERIES-015-AC-05/06) |
| Directed sourcing (trending/topRated) | `series_spec_022_trending_and_top_rated_recommendations.md` |
| Discover filters & vote threshold | `series_spec_024_discover_filters_and_vote_threshold.md` |
| Native discover sort | `series_spec_025_discover_native_sort.md` |
| Watch providers (candidate-level) | `series_spec_020_watch_providers.md` |
| Watch providers (per-series) | `series_spec_026_series_watch_providers.md` |
| Decomposition process precedent | `tooling_spec_002_series_controller_decomposition.md` |

---

## Acceptance Criteria Summary

- [ ] TOOLING-003-AC-01: `RawCandidate`/`DedupedCandidate`/`ScoredCandidate` promoted to standalone records
- [ ] TOOLING-003-AC-02: `RecommendationDefaults` defines the shared sourcing/filtering constants
- [ ] TOOLING-003-AC-03: `SourceOrderComparator` defines the shared source ordering
- [ ] TOOLING-003-AC-04: `RecommendationCriteriaValidator` rejects invalid criteria identically
- [ ] TOOLING-003-AC-05: `RecommendationCriteria.isDirectedByGenreOrKeyword()` added, single definition
- [ ] TOOLING-003-AC-06: `RecommendationCriteriaValidator` injects no collaborators
- [ ] TOOLING-003-AC-07: `WatchProviderService.streamingProviders` behaves identically
- [ ] TOOLING-003-AC-08: `WatchProviderService.getStreamingProvidersForSeries` behaves identically
- [ ] TOOLING-003-AC-09: `SeriesWatchProviderController` injects `WatchProviderService`
- [ ] TOOLING-003-AC-10: `WatchProviderService` injects only `SeriesRepository`/`TmdbClient`/`watchRegion`
- [ ] TOOLING-003-AC-11: `RecommendationDtoAssembler.toDto` behaves identically
- [ ] TOOLING-003-AC-12: `RecommendationDtoAssembler` injects only `TmdbGenreTable`/`WatchProviderService`
- [ ] TOOLING-003-AC-13: `RecommendationDeduplicationService.dedupeAndExclude` behaves identically
- [ ] TOOLING-003-AC-14: `RecommendationDeduplicationService` injects only its three named dependencies
- [ ] TOOLING-003-AC-15: `RecommendationOutputFilterService.applyOutputFilters` behaves identically
- [ ] TOOLING-003-AC-16: `RecommendationOutputFilterService` injects only `TmdbClient`
- [ ] TOOLING-003-AC-17: `RecommendationSourcingService` sources candidates identically across all four strategies
- [ ] TOOLING-003-AC-18: `RecommendationSourcingService` injects only its four named dependencies
- [ ] TOOLING-003-AC-19: `RecommendationRankingService` scores/sorts/diversity-caps identically
- [ ] TOOLING-003-AC-20: `RecommendationRankingService` injects only its two named dependencies
- [ ] TOOLING-003-AC-21: `RecommendationService.recommend(...)` produces identical results via orchestration
- [ ] TOOLING-003-AC-22: `RecommendationService`'s constructor reduced to the six collaborators + `TmdbClient` + `maxCandidates`
- [ ] TOOLING-003-AC-23: `RecommendationService.getKeywordsForCandidate` unchanged
- [ ] TOOLING-003-AC-24: Every pre-decomposition acceptance criterion still verified, redistributed across eight spec files
- [ ] TOOLING-003-AC-25: `SeriesControllerWatchProvidersSpec`/`SeriesControllerRecommendationsSpec` pass unmodified
