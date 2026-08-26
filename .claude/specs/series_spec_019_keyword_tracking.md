# Spec 019: Keyword Tracking (Normalized TMDB Keywords)

**Status**: Implemented
**Priority**: P2 (quality-of-life / data-analysis feature — not core CRUD)
**Depends on**: Series Spec 001 (`SeriesEntity`, migration conventions), Series Spec 017 (`series_spec_017_tmdb_primary_lookup.md`, TMDB-primary resolve flow — this spec's population hook is called from there at series-creation time), Series Spec 018 (`series_spec_018_series_refresh.md`, refresh flow — this spec's population hook is also called from there)
**Backend Task**

## Overview

TMDB's `GET /tv/{tmdbId}/keywords` endpoint returns real per-show tags close to what IMDb displays as genre chips on a title page — e.g. Spooks (`tmdbId 4046`) returns `england`, `spy`, `mi5`; Homeland returns 16 keywords including `espionage`, `political thriller`, `war on terror`. Unlike TMDB's fixed 16-value TV genre taxonomy (`TmdbGenreTable`, `series_spec_010`), this is an **open, crowd-sourced vocabulary** with no practical fixed size — there is no equivalent to `GET /series/genres`' vendored list to build here.

This spec stores each tracked series' TMDB keywords in a **normalized relational shape** (a `keyword` table plus a `series_keyword` join table), not a comma-separated string column like `genres`/`tags`, specifically so keyword data can be aggregated: how many tracked series carry a given keyword, and what those series' average `personalRating` is (e.g. "4 series tagged `spy`, average personal rating 4.2" vs. "2 series tagged `period drama`, average 3.1"). This is intentionally a first pass — storage, population, and read-only aggregate/filter access only. Using this data to *weight* recommendations or output filters is a distinct, larger feature explicitly deferred to `.claude/ideas/future_ideas.md`, not built here.

**Design decisions**:
- **Two-table normalized schema, not a comma-string column.** `genres`/`tags` use a single delimited string column because their consumers only ever need substring/membership matching. Keyword data additionally needs `COUNT`/`AVG`-style aggregation across the collection, which a delimited string can't support without parsing every row on every query. A `keyword` row (one per distinct TMDB keyword id, shared across every series that carries it) plus a `series_keyword` join row (one per series/keyword pairing) is the standard normalized shape for that.
- **Modeled as a JPA `@ManyToMany`, not two separately-queried entities.** `SeriesEntity` gains a `Set<KeywordEntity> keywords` via `@ManyToMany` over the `series_keyword` join table. This keeps `SeriesSearchService`'s existing "in-memory stream filtering over `repository.findAll()`" convention (`series_spec_003` Service Layer) working unchanged for the new keyword filter (Requirement 5) — each already-loaded `SeriesEntity` simply carries its keyword set alongside every other field, no separate query needed, no deviation from the no-custom-`@Query` convention this project otherwise holds to.
- **Keyword rows are upserted by `tmdbKeywordId`, never duplicated.** Two series that both carry TMDB's `spy` keyword (id `470`) share the *same* `keyword` row; only their `series_keyword` join rows differ. Population logic looks up-or-creates by `tmdbKeywordId`, not by `name` (names are stable per TMDB id, but id is the actual identity).
- **A refresh reconciles the full set, including removals.** TMDB's own keyword tagging for a show can change over time (community-edited). `KeywordSyncService.syncKeywords` replaces a series' entire keyword set with whatever TMDB currently returns, rather than only ever adding — a keyword no longer present in the fresh response is unlinked from that series (its `keyword` row itself is untouched, since other series may still reference it).
- **Population is best-effort and non-fatal, matching every other TMDB-derived field.** Consistent with `TmdbClient.showStatus`'s posture (`series_spec_008` SERIES-008-AC-08) and the general "external call failure never fails the surrounding request" policy (`tooling_spec_001` Requirement 1): a failed or empty keyword fetch leaves the series' existing keyword set unchanged (on refresh) or empty (on create), never throws to the caller.
- **Recommendation/filter weighting by keyword popularity or average rating is explicitly out of scope.** This spec delivers storage, population, a read-only stats endpoint, and a search filter only. The idea of feeding this data into `RecommendationService`'s scoring (`series_spec_007`) is a natural next step but a materially larger design decision (how much weight, interaction with the existing personal-rating/TMDB-rating blend) that deserves its own spec once there's real usage data — tracked in `.claude/ideas/future_ideas.md`, not here.

---

## Requirements

### Requirement 1: Schema

**User story**: As a developer, I want each tracked series' TMDB keywords stored in a normalized, queryable shape, so aggregate stats (Requirement 4) don't require parsing a delimited string on every request.

#### Acceptance Criteria

- **SERIES-019-AC-01** [AUTO]: A new Flyway migration `V005__create_keyword_tables.sql` shall create a `keyword` table (this is `V005`, not `V003` as originally drafted — two other specs claimed `V003`/`V004` before this one was implemented: `V003__add_production_status_to_series.sql` (`series_spec_018`) and `V004__add_origin_country_to_series.sql` (`series_spec_021`), so `V005` is the next free slot by the time this spec is actually implemented) (`id` TEXT PK, `tmdb_keyword_id` INTEGER NOT NULL UNIQUE, `name` TEXT NOT NULL) and a `series_keyword` join table (`series_id` TEXT NOT NULL REFERENCES `series(id)`, `keyword_id` TEXT NOT NULL REFERENCES `keyword(id)`, composite unique constraint on `(series_id, keyword_id)`), following this project's existing UUID-as-TEXT PK convention (`SeriesEntity`/`IgnoredSeriesEntity`).
- **SERIES-019-AC-02** [AUTO]: A new `KeywordEntity` (`model` package) shall map the `keyword` table: `id` (`UUID`, `@JdbcTypeCode(SqlTypes.VARCHAR)`, generated), `tmdbKeywordId` (`Integer`, unique, not null), `name` (`String`, not null).
- **SERIES-019-AC-03** [AUTO]: `SeriesEntity` shall gain a `Set<KeywordEntity> keywords` field, mapped `@ManyToMany` over the `series_keyword` join table (`@JoinTable(name = "series_keyword", ...)`), lazily fetched.
- **SERIES-019-AC-04** [AUTO]: A new `KeywordRepository extends JpaRepository<KeywordEntity, UUID>` shall gain a single derived-query method, `Optional<KeywordEntity> findByTmdbKeywordId(Integer tmdbKeywordId)`, used to look up an existing keyword row before creating a new one (Requirement 3) — a derived query, not a custom `@Query`, consistent with this project's repository conventions.

---

### Requirement 2: `TmdbClient.showKeywords`

**User story**: As a developer, I want a single client method that fetches a show's current TMDB keywords, so the sync logic (Requirement 3) doesn't touch raw JSON.

#### Acceptance Criteria

- **SERIES-019-AC-05** [AUTO]: `TmdbClient` shall gain `List<TmdbKeyword> showKeywords(int tmdbId)`, calling `GET /tv/{tmdbId}/keywords` and mapping each entry of the response's `results[]` array (`{"id": 4046, "results": [{"id": 470, "name": "spy"}, ...]}`) into a new record `TmdbKeyword(Integer id, String name)`, mirroring `mapResults`/`mapSearchResults`'s existing per-item mapping style in the same class.
- **SERIES-019-AC-06** [AUTO]: An absent/malformed `results` field shall yield an empty list, not an error — same `listOfMaps`-backed posture already used by `TmdbClient.recommendations`/`similar`/`discover`.
- **SERIES-019-AC-07** [AUTO]: Like every other `TmdbClient` method, `showKeywords` shall throw `ExternalServiceException` only for a genuine call failure (unset API key, network/HTTP failure) — never for an empty or partially-malformed successful response, consistent with `SERIES-019-AC-06`.

---

### Requirement 3: `KeywordSyncService.syncKeywords`

**User story**: As a developer, I want one shared method that reconciles a series' stored keyword set against TMDB's current data, so both the create flow (`series_spec_017`) and the refresh flow (`series_spec_018`) call the same logic instead of each re-implementing upsert/removal handling.

#### Acceptance Criteria

- **SERIES-019-AC-08** [AUTO]: A new `KeywordSyncService` (`service` package) shall expose `void syncKeywords(SeriesEntity entity, int tmdbId)`, callable from both the TMDB-primary resolve flow (`series_spec_017_tmdb_primary_lookup.md`) at series-creation time and the refresh flow (`series_spec_018_series_refresh.md`).
- **SERIES-019-AC-09** [AUTO]: `syncKeywords` shall call `TmdbClient.showKeywords(tmdbId)`. For each returned `TmdbKeyword`, it shall look up an existing `KeywordEntity` via `KeywordRepository.findByTmdbKeywordId` and reuse it if found, or create-and-save a new one (`tmdbKeywordId`, `name`) if not found — never creating a duplicate `keyword` row for an already-known `tmdbKeywordId`.
- **SERIES-019-AC-10** [AUTO]: `syncKeywords` shall set `entity.setKeywords(...)` to exactly the resolved set of `KeywordEntity` rows from `SERIES-019-AC-09` — replacing, not appending to, the entity's prior keyword set, so a keyword no longer present in TMDB's current response is unlinked from this series (its `keyword` row is untouched, since other series may still reference it via their own `series_keyword` rows).
- **SERIES-019-AC-11** [AUTO]: If `TmdbClient.showKeywords` throws `ExternalServiceException`, `syncKeywords` shall catch and log it, leaving `entity`'s existing keyword set unchanged — matching the never-fail-the-surrounding-request posture already established for `productionStatus` resolution (`series_spec_008` SERIES-008-AC-10).
- **SERIES-019-AC-12** [AUTO]: `syncKeywords` does not itself call `seriesRepository.save(...)` — persisting the entity (with its updated `keywords` association) is the caller's responsibility, matching how `RecommendationService`/other collaborators don't own persistence for entities they merely populate fields on.

**Implementation note (call-site wiring)**: `syncKeywords` is wired into `SeriesRefreshService.refreshFromTmdb` — a `tmdbId` is already resolved there as a local variable, making the call site a one-line, minimal addition consistent with that method's existing non-fatal-on-failure posture. It is also wired into the series-creation path, per Requirement 6 below — `SeriesLookupService.resolveTmdbCandidate` already knows the `tmdbId` it resolved (it's the method's own parameter), so rather than re-deriving it later, it's round-tripped through `SeriesLookupDto` → the frontend form → `SeriesDto` → `SeriesService.create`, the same hidden-field pattern already established for `imdbId`/`originCountry`/`tmdbRating` (`frontend_spec_022`/`frontend_spec_026`).

---

### Requirement 4: `GET /api/v1/series/keywords` — Aggregate Stats

**User story**: As a user, I want to see which keywords appear most often across my tracked series and how I've rated shows carrying each one, so I can spot patterns in what I actually enjoy.

#### Acceptance Criteria

- **SERIES-019-AC-13** [AUTO]: A new `KeywordStatDto` record (`dto` package) shall carry `name: String`, `seriesCount: Integer`, `averagePersonalRating: BigDecimal` (nullable).
- **SERIES-019-AC-14** [AUTO]: `SeriesController` shall expose `GET /api/v1/series/keywords`, delegating to a new `KeywordStatsService.getStats(String sortBy)` (business logic in `service/`, per this project's thin-controller convention). It shall compute, via in-memory aggregation over `seriesRepository.findAll()` (matching `SeriesSearchService`'s own established "fine at this app's scale" precedent — `series_spec_003` Service Layer — rather than a custom repository query), one `KeywordStatDto` per distinct keyword actually present across the user's tracked series.
- **SERIES-019-AC-15** [AUTO]: `seriesCount` shall be the count of tracked series carrying that keyword. `averagePersonalRating` shall be the mean `personalRating` across only those series that both carry the keyword AND have a non-null `personalRating`; `null` when no carrying series has one set (mirrors `series_spec_009`'s "unrated ≠ zero" treatment — an unrated series is excluded from the average, not counted as `0`).
- **SERIES-019-AC-16** [AUTO]: The endpoint shall accept an optional `sortBy` param (`seriesCount` | `averagePersonalRating`, default `seriesCount`), sorting descending; a series with `averagePersonalRating == null` sorts last regardless of direction, following the same nulls-last convention as `series_spec_009` (SERIES-009-AC-04). An unrecognized `sortBy` value falls back to the default, soft-fallback style (`series_spec_015` SERIES-015-AC-18/20), not a `400`.
- **SERIES-019-AC-17** [AUTO]: On every call, the endpoint shall return `200 OK` with `ApiResponse<List<KeywordStatDto>>` (`{ data, count }` envelope, matching `GET /series/genres`), `count` equal to the number of distinct keywords returned. No tracked series with any keywords yields `data: []`, `count: 0` — not an error.

---

### Requirement 5: Search Filter Integration

**User story**: As a user, I want to filter my series list down to ones carrying a specific keyword, the same way I can already filter by genre or status.

#### Acceptance Criteria

- **SERIES-019-AC-18** [AUTO]: `SeriesSearchCriteria` shall gain a `keywords: List<String>` field, following the exact shape/OR-logic convention `genres` already uses on the same class.
- **SERIES-019-AC-19** [AUTO]: `SeriesSearchService.search` shall gain a `matchesKeywords` predicate: when `criteria.getKeywords()` is non-empty, a series matches if *any* of its `keywords` set (`entity.getKeywords()`, `SERIES-019-AC-03`) has a `name` case-insensitively equal to any requested value — **exact** match against the normalized set, not the substring match `matchesGenres` uses, since keyword names come from a real, spelling-stable TMDB vocabulary rather than free text.
- **SERIES-019-AC-20** [AUTO]: `GET /api/v1/series/search` shall accept a repeatable `keyword` query parameter, wired into `SeriesSearchCriteria.keywords` the same way `genre` is already wired (`SeriesController.search`).
- **SERIES-019-AC-21** [AUTO]: An empty or absent `keyword` parameter shall behave exactly as today (no keyword filtering applied) — this is a purely additive filter with no change to existing `search`/`export` behavior when unused.

---

### Requirement 6: Creation-Time Keyword Population

**User story**: As a user, I want a newly added series to already have its keywords the moment I add it, not just after I later hit Refresh, since TMDB's keyword data was available the whole time via the same `tmdbId` I already picked in the candidate picker.

Added after this spec's initial implementation, closing the gap Requirement 3's original "Implementation note" documented: `resolveTmdbCandidate` already has the `tmdbId` it needs in scope (it's the method's own parameter) — the only reason creation couldn't call `syncKeywords` was that nothing round-tripped that value back from the lookup response, through the add-series form, to the eventual create request. This requirement closes that round-trip using the exact hidden-field pattern already established for `imdbId`/`originCountry`/`tmdbRating`/`tmdbVoteCount` (`frontend_spec_022_tmdb_primary_lookup.md`/`frontend_spec_026_origin_country_and_tmdb_metadata_display.md`) — no new mechanism, just one more field carried the same way.

#### Acceptance Criteria

- **SERIES-019-AC-22** [AUTO]: `SeriesLookupDto` shall gain `tmdbId` (`Integer`), set by `SeriesLookupService.resolveTmdbCandidate` from its own `tmdbId` parameter — no extra TMDB call, since the value is already in scope.
- **SERIES-019-AC-23** [AUTO]: `SeriesDto` shall gain `tmdbId` (`Integer`) as an **input-only** field: read by `SeriesService.create`, never persisted on `SeriesEntity` (which has no `tmdbId` column — this app resolves it fresh via `TmdbClient.findTvIdByImdbId` when needed, e.g. on refresh) and never echoed back via `entityToDto`, mirroring the output-only convention `dateAdded`/`lastRefreshedAt` already use in the opposite direction.
- **SERIES-019-AC-24** [AUTO]: When `dto.getTmdbId()` is non-null, `SeriesService.create` shall call `KeywordSyncService.syncKeywords(entity, dto.getTmdbId())` before persisting the entity, populating its keyword set at creation time via the same reconciliation logic refresh already uses (`SERIES-019-AC-08`–`AC-11`, including the existing non-fatal-on-TMDB-failure posture — no additional error handling needed at this call site). When `dto.getTmdbId()` is `null` (e.g. a manually-added series with no TMDB lookup), no sync is attempted and the entity's keyword set remains empty, same as today.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `SeriesEntity`, UUID-as-TEXT PK convention, migration file-naming convention | `series_spec_001_entity.md` |
| `TmdbClient`'s `RestClient`/`fetch` conventions, `listOfMaps`-backed empty-on-malformed posture, per-item mapping style (`mapResults`/`mapSearchResults`) | `series_spec_006_recommendations.md`, `series_spec_007_recommendation_sourcing.md` |
| `showStatus`-style best-effort `TmdbClient` method convention, never-fail-the-request posture for TMDB-derived fields | `series_spec_008_series_lifecycle_data.md` |
| `SeriesSearchService`'s in-memory `repository.findAll()` filtering convention and its own stated performance threshold for moving to `@Query` | `series_spec_003_search.md` |
| `matchesGenres`'s OR-logic list-filter shape this spec's `matchesKeywords` mirrors (with exact- instead of substring-match) | `series_spec_003_search.md` |
| Nulls-last average/sort convention | `series_spec_009_rating_sort.md` |
| Unrecognized-soft-param falls back to default, not `400` | `series_spec_015_multi_source_recommendations.md` |
| `GET /series/genres` `{ data, count }` envelope convention this spec's `GET /series/keywords` matches | `series_spec_010_genre_dropdown.md` |
| Population call sites: refresh, and (Requirement 6) series-creation via a round-tripped `tmdbId` | `series_spec_017_tmdb_primary_lookup.md`, `series_spec_018_series_refresh.md` |
| Never-leak-internals policy for upstream failures | `tooling_spec_001_code_quality_security.md` Requirement 1 |
| `imdbId`/`originCountry`/`tmdbRating` hidden-field round-trip pattern Requirement 6's `tmdbId` field mirrors | `frontend_spec_022_tmdb_primary_lookup.md`, `frontend_spec_026_origin_country_and_tmdb_metadata_display.md` |
| Frontend consumer: `tmdbId` carry-through (Requirement 6), keyword chips on `SeriesDetail`, Keywords stats view, `SearchFilter` keyword multi-select | `frontend_spec_024_keyword_tracking.md` (in progress) |
| Deferred idea: weighting recommendations/filters by keyword popularity/average rating | `.claude/ideas/future_ideas.md` |

---

## TDD Test Case Sketches

### `KeywordSyncServiceSpec.groovy` (Requirement 3)

```groovy
def "SERIES-019-AC-09/10: syncs a series' keywords, reusing an existing keyword row by tmdbKeywordId"() {
    given: "a series, and TMDB returning two keywords, one already known"
        def series = new SeriesEntity(title: "Spooks")
        def existing = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
        tmdbClient.showKeywords(4046) >> [
            new TmdbKeyword(470, "spy"),
            new TmdbKeyword(190904, "mi5"),
        ]

    when: "syncKeywords is called"
        keywordSyncService.syncKeywords(series, 4046)

    then: "the existing 'spy' row is reused, a new 'mi5' row is created, both linked"
        series.keywords*.tmdbKeywordId.toSet() == [470, 190904] as Set
        keywordRepository.findByTmdbKeywordId(470).get().id == existing.id
}

def "SERIES-019-AC-10: a refresh unlinks a keyword no longer present, without deleting the shared keyword row"() {
    given: "a series currently linked to 'spy' and 'mi5', TMDB now returning only 'spy'"
        def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
        def mi5 = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 190904, name: "mi5"))
        def series = seriesRepository.save(new SeriesEntity(title: "Spooks", keywords: [spy, mi5] as Set))
        tmdbClient.showKeywords(4046) >> [new TmdbKeyword(470, "spy")]

    when: "syncKeywords is called"
        keywordSyncService.syncKeywords(series, 4046)

    then: "the series is now linked only to 'spy'"
        series.keywords*.tmdbKeywordId == [470]

    and: "the 'mi5' keyword row itself still exists"
        keywordRepository.findByTmdbKeywordId(190904).isPresent()
}

def "SERIES-019-AC-11: a TMDB failure leaves the existing keyword set unchanged"() {
    given: "a series already linked to 'spy', TMDB now failing"
        def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
        def series = seriesRepository.save(new SeriesEntity(title: "Spooks", keywords: [spy] as Set))
        tmdbClient.showKeywords(4046) >> { throw new ExternalServiceException("TMDB down") }

    when: "syncKeywords is called"
        keywordSyncService.syncKeywords(series, 4046)

    then: "no exception propagates, and the keyword set is untouched"
        series.keywords*.tmdbKeywordId == [470]
}
```

### `KeywordStatsServiceSpec.groovy` (Requirement 4)

```groovy
def "SERIES-019-AC-15: seriesCount and averagePersonalRating are computed correctly, excluding unrated series from the average"() {
    given: "three series carrying 'spy': rated 5, rated 3, and unrated"
        def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
        seriesRepository.save(new SeriesEntity(title: "A", personalRating: 5, keywords: [spy] as Set))
        seriesRepository.save(new SeriesEntity(title: "B", personalRating: 3, keywords: [spy] as Set))
        seriesRepository.save(new SeriesEntity(title: "C", personalRating: null, keywords: [spy] as Set))

    when: "getStats(null) is called"
        def stats = keywordStatsService.getStats(null)

    then: "spy has seriesCount 3 and averagePersonalRating 4.0 (excluding the unrated series)"
        def spyStat = stats.find { it.name() == "spy" }
        spyStat.seriesCount() == 3
        spyStat.averagePersonalRating() == 4.0G
}

def "SERIES-019-AC-15: a keyword with no rated series has a null average, not zero"() {
    given: "one series carrying 'mi5', unrated"
        def mi5 = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 190904, name: "mi5"))
        seriesRepository.save(new SeriesEntity(title: "A", personalRating: null, keywords: [mi5] as Set))

    when: "getStats(null) is called"
        def stats = keywordStatsService.getStats(null)

    then: "averagePersonalRating is null"
        stats.find { it.name() == "mi5" }.averagePersonalRating() == null
}

def "SERIES-019-AC-16: sortBy=averagePersonalRating sorts descending with null-averages last"() {
    given: "'spy' averaging 4.0, 'drama' with no rated series"
        // ...

    when: "getStats('averagePersonalRating') is called"
        def stats = keywordStatsService.getStats("averagePersonalRating")

    then: "'spy' is first, 'drama' (null average) is last"
        stats*.name() == ["spy", "drama"]
}
```

### `SeriesSearchServiceSpec.groovy` (Requirement 5)

```groovy
def "SERIES-019-AC-19: keyword filter matches exactly (case-insensitive), not by substring"() {
    given: "a series carrying 'spy', another carrying 'espionage'"
        def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
        def espionage = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 5265, name: "espionage"))
        seriesRepository.save(new SeriesEntity(title: "Spooks", keywords: [spy] as Set))
        seriesRepository.save(new SeriesEntity(title: "Homeland", keywords: [espionage] as Set))

    when: "search is called with keywords: ['spy']"
        def results = searchService.search(new SeriesSearchCriteria(keywords: ["spy"]))

    then: "only the exact match is returned -- 'espionage' does not match 'spy'"
        results*.title() == ["Spooks"]
}

def "SERIES-019-AC-21: an empty keywords list applies no filtering"() {
    given: "two series, neither carrying any keyword filter criteria"
        // ...

    when: "search is called with no keywords criteria"
        def results = searchService.search(new SeriesSearchCriteria())

    then: "both series are returned"
        results.size() == 2
}
```

### `SeriesControllerKeywordsSpec.groovy` (Requirement 4 — endpoint)

```groovy
def "SERIES-019-AC-17: GET /api/v1/series/keywords returns 200 with the envelope shape, empty when nothing tracked has keywords"() {
    when: "GET /api/v1/series/keywords is requested with no tracked series"
        def response = mockMvc.perform(get("/api/v1/series/keywords"))

    then: "the response is 200 with an empty list"
        response.andExpect(status().isOk())
        response.andExpect(jsonPath('$.data').isArray())
        response.andExpect(jsonPath('$.count').value(0))
}
```

### `SeriesServiceSpec.groovy` (Requirement 6)

```groovy
def "SERIES-019-AC-24: create syncs keywords when the incoming dto carries a tmdbId"() {
    given: "a SeriesDto with tmdbId set"
        def dto = new SeriesDto(title: "Spooks", tmdbId: 4046)

    when: "create(dto) is called"
        seriesService.create(dto)

    then: "syncKeywords is called with the resolved entity and tmdbId"
        1 * keywordSyncService.syncKeywords(_ as SeriesEntity, 4046)
}

def "SERIES-019-AC-24: create does not attempt a sync when tmdbId is absent"() {
    given: "a SeriesDto with no tmdbId (a manually-added series)"
        def dto = new SeriesDto(title: "Homemade Show")

    when: "create(dto) is called"
        seriesService.create(dto)

    then: "syncKeywords is never called"
        0 * keywordSyncService.syncKeywords(_, _)
}
```

### `SeriesLookupServiceSpec.groovy` (Requirement 6)

```groovy
def "SERIES-019-AC-22: resolve carries tmdbId through onto the lookup result"() {
    given: "TmdbClient.details resolves a full detail"
        tmdbClient.details(4046) >> new TmdbSeriesDetail(
            "Spooks", 2002, [80], "/poster.jpg", 10, 81,
            new BigDecimal("7.8"), 245, ProductionStatus.ENDED, "GB")
        tmdbClient.externalIds(4046) >> Optional.empty()

    when: "resolveTmdbCandidate(4046) is called"
        def result = lookupService.resolveTmdbCandidate(4046)

    then: "the result carries the same tmdbId"
        result.tmdbId == 4046
}
```

---

## Acceptance Criteria Summary

- [x] SERIES-019-AC-01: `V005__create_keyword_tables.sql` — `keyword` + `series_keyword` tables
- [x] SERIES-019-AC-02: `KeywordEntity` (`id`, `tmdbKeywordId` unique, `name`)
- [x] SERIES-019-AC-03: `SeriesEntity.keywords` `@ManyToMany`
- [x] SERIES-019-AC-04: `KeywordRepository.findByTmdbKeywordId`
- [x] SERIES-019-AC-05: `TmdbClient.showKeywords(tmdbId)` + `TmdbKeyword` record
- [x] SERIES-019-AC-06: malformed/absent `results` → empty list, not an error
- [x] SERIES-019-AC-07: throws `ExternalServiceException` only on genuine call failure
- [x] SERIES-019-AC-08: `KeywordSyncService.syncKeywords(entity, tmdbId)`
- [x] SERIES-019-AC-09: upserts `KeywordEntity` rows by `tmdbKeywordId`, no duplicates
- [x] SERIES-019-AC-10: replaces (not appends) the entity's keyword set; unlink ≠ delete shared row
- [x] SERIES-019-AC-11: TMDB failure leaves existing keyword set unchanged, non-fatal
- [x] SERIES-019-AC-12: `syncKeywords` does not persist the entity itself
- [x] SERIES-019-AC-13: `KeywordStatDto` (`name`, `seriesCount`, `averagePersonalRating`)
- [x] SERIES-019-AC-14: `GET /api/v1/series/keywords` via `KeywordStatsService`, in-memory aggregation
- [x] SERIES-019-AC-15: correct `seriesCount`/`averagePersonalRating` (unrated excluded, not zeroed)
- [x] SERIES-019-AC-16: `sortBy` param, nulls-last, soft-fallback on unrecognized value
- [x] SERIES-019-AC-17: `200` + `{ data, count }` envelope, empty list is not an error
- [x] SERIES-019-AC-18: `SeriesSearchCriteria.keywords: List<String>`
- [x] SERIES-019-AC-19: `matchesKeywords` — exact, case-insensitive, OR logic
- [x] SERIES-019-AC-20: repeatable `keyword` query param wired into `/search`
- [x] SERIES-019-AC-21: unused filter is fully backward-compatible
- [x] SERIES-019-AC-22: `SeriesLookupDto.tmdbId`, set by `resolveTmdbCandidate`
- [x] SERIES-019-AC-23: `SeriesDto.tmdbId`, input-only
- [x] SERIES-019-AC-24: `SeriesService.create` syncs keywords when `tmdbId` present
