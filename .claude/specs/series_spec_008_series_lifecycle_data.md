# Spec 008: Series Lifecycle Data — Exclude Flag, Production Status & Refresh

**Status**: Not started
**No `frontend/` files are touched by this spec** — the exclude checkbox and production-status badge are `frontend_spec_012_series_lifecycle_controls.md`, a separate follow-up task.
**Priority**: P2 (quality-of-life improvement — not core CRUD)
**Depends on**: Spec 001 (entity/migration conventions, `SeriesStatus` enum precedent), Spec 003 (`SeriesSearchCriteria`/`SeriesSearchService`, extended by this spec's rewatch filter), Spec 005 (`OmdbClient.lookup`, episode-count aggregation precedent — largely superseded by Spec 017), Spec 006 (`TmdbClient`, `IgnoreOutcome` outcome-record precedent), Spec 007 (adds a filter predicate into the automatic watched-pool sourcing that spec builds)
**Backend Task**
**Note**: Requirement 3 (Refresh Information) below is **superseded in full by `series_spec_018_series_refresh.md`** — see that requirement's heading for details. Requirements 1, 2, and 4 are unaffected and remain current.

## Overview

Adds two new pieces of data to `SeriesEntity` and one new action, all raised as gaps during the recommendation-sourcing discussion but scoped separately since none of them touch `RecommendationService`'s core sourcing/ranking/filtering logic (Spec 007) directly:

1. **`excludeFromRecommendations`** — a persistent per-series flag so a series that's rated fine but isn't representative of taste (a kids' show watched with family, a guilty pleasure) can be kept out of automatic recommendation sourcing without lowering its rating or deleting it.
2. **`productionStatus`** — a TMDB-sourced, informational field answering "is this show still going?" (`Returning Series`, `Ended`, `Canceled`, `In Production`, `Planned`, `Pilot`), resolved automatically when a series is added. This is deliberately *not* a new value on the existing `SeriesStatus` enum — that enum means "where am I with watching this" (a personal-progress concept), while this is "has the show itself finished being made" (a production-fact concept); conflating them would make `SeriesStatus.COMPLETED` ambiguous between "I've watched everything released" and "the show itself has ended," which `RecommendationService`'s existing `COMPLETED`-as-taste-signal logic (`SERIES-006-AC-14`) depends on staying unambiguous.
3. ~~**Refresh information**~~ — **superseded, see Requirement 3 below.** Now specified in `series_spec_018_series_refresh.md`, which also adds a bulk "refresh everything" job and `lastRefreshedAt` tracking that this spec never covered.
4. **`flaggedForRewatch`** — a persistent per-series flag so a user can mark a completed series as a rewatch candidate while browsing their list, then filter down to just those later.

**Design decisions**:
- **The rewatch flag is deliberately simple: a plain boolean field exposed through the existing search filter, not a new recommendation-sourcing mode.** It reuses `SeriesSearchCriteria`/`SeriesSearchService` (gaining `flaggedForRewatch`, the same nullable-boolean-filter shape as the existing `startedNotFinished`) rather than adding a dedicated endpoint or any `RecommendationService` involvement — combined with the existing `status`/`genres` filters, this already produces a filterable "rewatch list" for free. If a more elaborate rewatch *recommendation* feature (e.g. TMDB-sourced "people who rewatched X also rewatched Y") is wanted later, that's a separate, much larger feature — not this.
- **`excludeFromRecommendations` only suppresses *automatic* watched-pool sourcing — it does not block an explicit `seriesIds` selection** (`SERIES-007-AC-08`). The flag means "don't use me as an automatic taste signal"; naming a series explicitly in a single request is a much stronger, one-off statement of intent that should win over a standing preference. This mirrors the reasoning in Spec 007's own Design Decisions for why explicit selection isn't restricted to `COMPLETED` status.
- **`productionStatus` is modeled as a proper enum, not a passthrough string.** Unlike `genres` (deliberately free text, because OMDb's vocabulary is open-ended), TMDB's `status` field is a small, fixed, documented set of literal values — the same reasoning that makes `SeriesStatus` an enum applies here.
- **TMDB resolution is always best-effort, both at create time and on refresh.** Every other external call in this app degrades gracefully (missing key, network failure, unresolvable id → the field stays null / unchanged, nothing else fails) — `productionStatus` resolution follows the same posture, not a new one.
- **Refresh is `POST /api/v1/series/{id}/refresh`, not part of `PATCH`.** It doesn't accept a body describing desired changes — it's an action that triggers a server-side re-fetch, the same shape as `POST /api/v1/series/ignored` (Spec 006) rather than a client-supplied partial update.
- **All three new columns ship in one migration (`V005`)** since they're additive changes delivered by the same spec/PR — unlike `V002`/`V003`, which were separate specs.

---

## Requirements

### Requirement 1: Exclude-From-Recommendations Flag

**User story**: As a user, I want to mark a series as "don't use this for recommendations," so a show I rated fine but that isn't representative of my taste doesn't skew automatic sourcing.

#### Acceptance Criteria

- **SERIES-008-AC-01** [AUTO]: `SeriesEntity` shall gain an `excludeFromRecommendations` column (`BOOLEAN NOT NULL DEFAULT FALSE`), added via a new Flyway migration `V005__add_lifecycle_fields_to_series.sql`.
- **SERIES-008-AC-02** [AUTO]: `SeriesDto` shall gain an `excludeFromRecommendations` field typed as boxed `Boolean` (not primitive `boolean`) — unlike the entity, the DTO must be able to represent "omitted from the request" (`null`) distinctly from "explicitly set to `false`," matching every other partial-update-capable field on this class.
- **SERIES-008-AC-03** [AUTO]: `SeriesService.create` shall set the entity's `excludeFromRecommendations` from the DTO, defaulting to `false` when the DTO value is `null`. `SeriesService.update` shall set it only when the DTO value is non-`null`, leaving the existing value unchanged otherwise — the same partial-update semantics as every other `PATCH`-able field.
- **SERIES-008-AC-04** [AUTO]: `RecommendationService`'s automatic watched-pool sourcing (`SERIES-006-AC-14`, as extended by `SERIES-007-AC-19`/`AC-20`) shall additionally exclude any series with `excludeFromRecommendations == true` — this applies to both the title-based pool and the genre frequency count derived from that same pool (`SERIES-006-AC-18`).
- **SERIES-008-AC-05** [AUTO]: An explicit `seriesIds` source selection (`SERIES-007-AC-08`) shall **not** be filtered by `excludeFromRecommendations` — see Design Decisions.

---

### Requirement 2: TMDB Production Status

**User story**: As a user, I want to see whether a show I'm tracking is still airing or has ended, so I know whether "I've watched everything released" actually means "I'm done" or "I'm caught up, more is coming."

#### Acceptance Criteria

- **SERIES-008-AC-06** [AUTO]: A new `ProductionStatus` enum (`model` package) shall be added with values `RETURNING_SERIES`, `PLANNED`, `IN_PRODUCTION`, `ENDED`, `CANCELED`, `PILOT`, mirroring TMDB's documented TV `status` field values.
- **SERIES-008-AC-07** [AUTO]: `SeriesEntity` shall gain a nullable `productionStatus` column (`@Enumerated(EnumType.STRING)`, same pattern as the existing `status` field), added via the same `V005` migration as `SERIES-008-AC-01`.
- **SERIES-008-AC-08** [AUTO]: `TmdbClient` shall gain `showStatus(int tmdbId)`, calling `GET /tv/{tmdbId}` and mapping the response's `status` string to `ProductionStatus` (`Optional<ProductionStatus>`). An absent field or a value with no matching enum constant shall result in `Optional.empty()`, not an error — same posture as `SERIES-006-AC-18`'s unmapped-genre handling.
- **SERIES-008-AC-09** [AUTO]: `SeriesDto` shall gain a `productionStatus` field (`String`, `.name()` of the enum). It is output-only: neither `SeriesService.create` nor `SeriesService.update` shall read `dto.getProductionStatus()` when building/updating an entity — same convention already established for `dateAdded`/`dateCompleted`.
- **SERIES-008-AC-10** [AUTO]: When `SeriesService.create` persists a new entity with a non-blank `imdbId`, it shall attempt to resolve `productionStatus` via `TmdbClient.findTvIdByImdbId` followed by `showStatus` before saving. Any failure along this path (`app.tmdb.api-key` unset, network failure, unresolvable id) shall be caught and logged, not propagated — the field is left `null` and series creation proceeds normally.
- **SERIES-008-AC-11** [AUTO]: `SeriesService.update` shall **not** automatically re-resolve `productionStatus`, even when `imdbId` changes in the same request — only the explicit refresh action (Requirement 3) re-resolves it.

---

### Requirement 3: Refresh Information — SUPERSEDED

**Superseded by `series_spec_018_series_refresh.md` in full.** That spec carries forward the same single-series refresh contract (re-scoped to Spec 017's TMDB-primary/narrowed-OMDb source split) and additionally specifies a bulk "refresh everything" job and `lastRefreshedAt` tracking that were never in scope here. The ACs below are frozen for traceability only — do not implement against them.

**User story**: As a user, I want to refresh a tracked series' episode counts, ratings, and production status on demand, so data that's gone stale since I added it can be brought up to date without deleting and re-adding.

#### Acceptance Criteria

- ~~**SERIES-008-AC-12** [AUTO]~~ — superseded by `SERIES-018-AC-01`: `SeriesController` shall expose `POST /api/v1/series/{id}/refresh`, delegating to a new `SeriesRefreshService.refresh(UUID id)`. If `id` does not match an existing `SeriesEntity`, it shall respond `404 Not Found` (`EntityNotFoundException`, same pattern as `getById`/`update`/`delete`).
- ~~**SERIES-008-AC-13** [AUTO]~~ — superseded by `SERIES-018-AC-02`/`AC-03` (OMDb-derived fields split differently under the TMDB-primary source order): The refresh action shall re-run `OmdbClient.lookup(entity.getTitle())`. On success, it shall update `totalSeasons`, `totalEpisodes`, `imdbRating`, `metacriticRating`, and `rottenTomatoesRating` on the entity from the fresh lookup result. `title`, `genres`, `posterUrl`, `personalRating`, `personalNotes`, `status`, `currentSeason`, `currentEpisode`, `imdbId`, `dateAdded`, and `dateCompleted` shall remain untouched — user- and system-owned fields that a refresh does not overwrite.
- ~~**SERIES-008-AC-14** [AUTO]~~ — superseded by `SERIES-018-AC-06`: If the OMDb lookup fails (`EntityNotFoundException` or `ExternalServiceException` thrown by `OmdbClient`), the fields listed in `SERIES-008-AC-13` shall be left unchanged, and this alone shall not fail the overall refresh request.
- ~~**SERIES-008-AC-15** [AUTO]~~ — superseded by `SERIES-018-AC-02`/`AC-05`: If the entity's `imdbId` is non-blank, the refresh action shall re-resolve `productionStatus` the same way as `SERIES-008-AC-10`. Failure leaves the existing value unchanged and does not fail the overall request.
- ~~**SERIES-008-AC-16** [AUTO]~~ — superseded by `SERIES-018-AC-07`: On completion, the endpoint shall respond `200 OK` with `ApiResponse<RefreshResult>`, a new record `RefreshResult(SeriesDto series, boolean omdbRefreshed, boolean tmdbRefreshed)` — mirroring `IgnoreOutcome`'s established pattern (`series_spec_006_recommendations.md` Implementation Notes) of pairing the DTO with outcome metadata the controller can't otherwise derive without duplicating the service's own checks.
- ~~**SERIES-008-AC-17** [AUTO]~~ — superseded by `SERIES-018-AC-08`: The entity shall be persisted via `repository.save(...)` reflecting whichever of OMDb/TMDB refresh succeeded — a partial success (one source updated, the other not) is a normal outcome, not an error, and is not rolled back.

---

### Requirement 4: Rewatch Flag

**User story**: As a user, I want to flag a completed series as a rewatch candidate while browsing my list, so I can filter down to just those later instead of trying to remember which ones I meant to revisit.

#### Acceptance Criteria

- **SERIES-008-AC-18** [AUTO]: `SeriesEntity` shall gain a `flaggedForRewatch` column (`BOOLEAN NOT NULL DEFAULT FALSE`), added via the same `V005` migration as `SERIES-008-AC-01`/`AC-07`.
- **SERIES-008-AC-19** [AUTO]: `SeriesDto` shall gain a `flaggedForRewatch` field typed as boxed `Boolean`, with the same create/update partial-update semantics as `excludeFromRecommendations` (`SERIES-008-AC-02`/`AC-03`): `create` defaults to `false` when the DTO value is `null`; `update` sets it only when the DTO value is non-`null`.
- **SERIES-008-AC-20** [AUTO]: `SeriesSearchCriteria` shall gain a `flaggedForRewatch` field (nullable `Boolean`). `SeriesSearchService.search` shall, when it is non-`null` and `true`, additionally filter results to only series with `flaggedForRewatch == true` — the same nullable-boolean-filter shape already used by `startedNotFinished` (`series_spec_003_search.md`).
- **SERIES-008-AC-21** [AUTO]: The backend shall not restrict `flaggedForRewatch` based on `status` — a series can be flagged/unflagged and filtered on regardless of its current `status`. (The frontend companion spec chooses to only *expose* the toggle for `COMPLETED` series in the UI — that's a presentation choice, not a data constraint, and this API stays usable without it.)

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `IgnoreOutcome` outcome-record pattern, `TmdbClient`/`OmdbClient` `RestClient` conventions, `ExternalServiceException`, never-fail-the-request-on-a-graceful-degradation policy | `series_spec_006_recommendations.md` |
| `OmdbClient.lookup(String title)`, `OMDB_MAX_SEASONS_FOR_EPISODE_COUNT`/episode-count aggregation (superseded reference — Requirement 3 itself is superseded, see above) | `series_spec_005_omdb_lookup.md` |
| Current refresh design (single + bulk), `lastRefreshedAt` | `series_spec_018_series_refresh.md` |
| `SeriesEntity`/Flyway migration conventions, `SeriesStatus` enum as the precedent for a new fixed-vocabulary enum, `genres` free-text-vs-enum rationale | `series_spec_001_entity.md` |
| Automatic watched-pool sourcing (`SERIES-006-AC-14`) that `SERIES-008-AC-04` adds a filter predicate into; explicit `seriesIds` override that `SERIES-008-AC-05` deliberately does not filter | `series_spec_007_recommendation_sourcing.md` Requirements 4/6 |
| Never-leak-internals policy for upstream failures | `tooling_spec_001_code_quality_security.md` Requirement 1 |
| `SeriesSearchCriteria`'s existing nullable-boolean-filter shape (`startedNotFinished`) that `flaggedForRewatch` (Requirement 4) follows | `series_spec_003_search.md` |
| Future frontend consumer: exclude checkbox (`Add`/`EditSeriesForm`), refresh button, production-status badge (`SeriesDetail`), rewatch toggle (`SeriesList` `COMPLETED` rows + `SeriesDetail`), rewatch filter checkbox (`SearchFilter`) | `frontend_spec_012_series_lifecycle_controls.md` (not yet written) |

---

## TDD Test Case Sketches

### `V005__add_lifecycle_fields_to_series.sql` / `SeriesEntitySpec.groovy`

```groovy
def "SERIES-008-AC-01: excludeFromRecommendations defaults to false"() {
    given: "a new SeriesEntity with no explicit excludeFromRecommendations value"
        def entity = new SeriesEntity(title: "Some Show")

    expect: "it defaults to false"
        !entity.excludeFromRecommendations
}
```

### `SeriesServiceSpec.groovy` (Requirement 1)

```groovy
def "SERIES-008-AC-03: update only overwrites excludeFromRecommendations when explicitly provided"() {
    given: "an existing series with excludeFromRecommendations = true"
        def existing = repository.save(new SeriesEntity(title: "Show", excludeFromRecommendations: true))

    when: "update is called with a DTO that omits excludeFromRecommendations (null)"
        def dto = new SeriesDto(title: "Show (renamed)")
        seriesService.update(existing.id, dto)

    then: "the flag is unchanged"
        repository.findById(existing.id).get().excludeFromRecommendations

    when: "update is called with excludeFromRecommendations explicitly set to false"
        dto.excludeFromRecommendations = false
        seriesService.update(existing.id, dto)

    then: "the flag is cleared"
        !repository.findById(existing.id).get().excludeFromRecommendations
}
```

### `RecommendationServiceSpec.groovy` (Requirement 1)

```groovy
def "SERIES-008-AC-04/05: excludeFromRecommendations blocks automatic sourcing but not explicit seriesIds"() {
    given: "a COMPLETED series with excludeFromRecommendations = true"
        def excluded = repository.save(new SeriesEntity(title: "Excluded Show", status: SeriesStatus.COMPLETED,
            imdbId: "tt0000001", excludeFromRecommendations: true))

    when: "recommend(20) is called with no source override"
        recommendationService.recommend(20, [:])

    then: "the excluded series is not consulted as a source"
        0 * tmdbClient.recommendations(_) // for excluded's tmdbId

    when: "recommend(20, seriesIds: [excluded.id]) is called"
        recommendationService.recommend(20, [seriesIds: [excluded.id]])

    then: "the excluded series IS consulted, since it was explicitly selected"
        1 * tmdbClient.findTvIdByImdbId("tt0000001") >> Optional.of(123)
}
```

### `TmdbClientSpec.groovy` (Requirement 2)

```groovy
def "SERIES-008-AC-08: maps TMDB's status field to ProductionStatus"() {
    given: "TMDB /tv/1396 returns status: 'Ended'"
        // ...

    when: "TmdbClient.showStatus(1396) is called"
        def result = tmdbClient.showStatus(1396)

    then: "ProductionStatus.ENDED is returned"
        result.get() == ProductionStatus.ENDED
}

def "SERIES-008-AC-08: an unrecognized status value returns empty, not an error"() {
    given: "TMDB /tv/1396 returns status: 'SomeNewValueTmdbAddedLater'"
        // ...

    when: "TmdbClient.showStatus(1396) is called"
        def result = tmdbClient.showStatus(1396)

    then: "no exception is thrown, and the result is empty"
        result.isEmpty()
}
```

### `SeriesServiceSpec.groovy` (Requirement 2)

```groovy
def "SERIES-008-AC-10: resolves productionStatus at create time, failure is non-fatal"() {
    given: "a DTO with imdbId set, TMDB resolution will fail"
        def dto = new SeriesDto(title: "Show", imdbId: "tt0903747")
        tmdbClient.findTvIdByImdbId(_) >> { throw new ExternalServiceException("TMDB down") }

    when: "the series is created"
        def created = seriesService.create(dto)

    then: "creation succeeds, productionStatus is null"
        created.id != null
        created.productionStatus == null
}
```

### `SeriesRefreshServiceSpec.groovy` (Requirement 3)

```groovy
def "SERIES-008-AC-12: refreshing an unknown id returns 404"() {
    when: "POST /api/v1/series/{random UUID}/refresh is requested"
        def response = client.post().uri("/api/v1/series/" + UUID.randomUUID() + "/refresh").exchange()

    then: "the response is 404"
        response.expectStatus().isNotFound()
}

def "SERIES-008-AC-13/16: successful refresh updates OMDb-derived fields and reports omdbRefreshed=true"() {
    given: "an existing series, OMDb now reports totalSeasons=6 (was 5), imdbRating=8.9"
        // ...

    when: "POST /api/v1/series/{id}/refresh is requested"
        def response = client.post().uri("/api/v1/series/${existing.id}/refresh").exchange()

    then: "the response is 200 with the updated fields and omdbRefreshed true"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.data.series.totalSeasons").isEqualTo(6)
        response.expectBody().jsonPath("\$.data.omdbRefreshed").isEqualTo(true)
}

def "SERIES-008-AC-14: OMDb lookup failure leaves fields unchanged and does not fail the request"() {
    given: "an existing series, OMDb lookup now throws EntityNotFoundException (title no longer matches)"
        // ...

    when: "POST /api/v1/series/{id}/refresh is requested"
        def response = client.post().uri("/api/v1/series/${existing.id}/refresh").exchange()

    then: "the response is still 200, omdbRefreshed is false, and prior values are untouched"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.data.omdbRefreshed").isEqualTo(false)
}
```

### `SeriesSearchServiceSpec.groovy` (Requirement 4)

```groovy
def "SERIES-008-AC-20: flaggedForRewatch=true filters to only flagged series"() {
    given: "one flagged series, one unflagged series"
        repository.save(new SeriesEntity(title: "Rewatch Me", flaggedForRewatch: true))
        repository.save(new SeriesEntity(title: "Not Flagged", flaggedForRewatch: false))

    when: "search is called with flaggedForRewatch: true"
        def results = searchService.search(new SeriesSearchCriteria(flaggedForRewatch: true))

    then: "only the flagged series is returned"
        results*.title == ["Rewatch Me"]
}

def "SERIES-008-AC-20: flaggedForRewatch unset returns everything, same as today"() {
    given: "one flagged series, one unflagged series"
        // ...

    when: "search is called with no flaggedForRewatch criteria"
        def results = searchService.search(new SeriesSearchCriteria())

    then: "both series are returned"
        results.size() == 2
}
```

---

## Acceptance Criteria Summary

- [ ] SERIES-008-AC-01: `excludeFromRecommendations` column (`V005` migration)
- [ ] SERIES-008-AC-02: `SeriesDto.excludeFromRecommendations` (boxed `Boolean`)
- [ ] SERIES-008-AC-03: create/update partial-update semantics for the flag
- [ ] SERIES-008-AC-04: automatic watched-pool sourcing excludes flagged series
- [ ] SERIES-008-AC-05: explicit `seriesIds` selection is not filtered by the flag
- [ ] SERIES-008-AC-06: `ProductionStatus` enum
- [ ] SERIES-008-AC-07: `productionStatus` column (`V005` migration)
- [ ] SERIES-008-AC-08: `TmdbClient.showStatus`, unrecognized value → empty
- [ ] SERIES-008-AC-09: `SeriesDto.productionStatus`, output-only
- [ ] SERIES-008-AC-10: resolved at create time, non-fatal on failure
- [ ] SERIES-008-AC-11: not auto-re-resolved on update/PATCH
- [ ] ~~SERIES-008-AC-12~~: superseded, not implementable — see SERIES-018-AC-01
- [ ] ~~SERIES-008-AC-13~~: superseded, not implementable — see SERIES-018-AC-02/AC-03
- [ ] ~~SERIES-008-AC-14~~: superseded, not implementable — see SERIES-018-AC-06
- [ ] ~~SERIES-008-AC-15~~: superseded, not implementable — see SERIES-018-AC-02/AC-05
- [ ] ~~SERIES-008-AC-16~~: superseded, not implementable — see SERIES-018-AC-07
- [ ] ~~SERIES-008-AC-17~~: superseded, not implementable — see SERIES-018-AC-08
- [ ] SERIES-008-AC-18: `flaggedForRewatch` column (`V005` migration)
- [ ] SERIES-008-AC-19: `SeriesDto.flaggedForRewatch` (boxed `Boolean`), same partial-update semantics as `excludeFromRecommendations`
- [ ] SERIES-008-AC-20: `SeriesSearchCriteria.flaggedForRewatch` filter
- [ ] SERIES-008-AC-21: no server-side status restriction on flagging/filtering
