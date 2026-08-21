# Spec 018: Series Data Refresh (Single & Bulk)

**Status**: Implemented
**No `frontend/` files are touched by this spec** — the Refresh button, progress display, and "last refreshed" timestamps are `frontend_spec_023_series_refresh.md`, a separate follow-up task.
**Priority**: P2 (quality-of-life improvement — not core CRUD)
**Depends on**: Spec 001 (entity/migration conventions), Spec 005 (`OmdbClient` conventions, being narrowed by Spec 017), Spec 006 (`IgnoreOutcome` outcome-record precedent), Spec 008 (`ProductionStatus` enum, Requirement 2 — unaffected by this spec), Spec 017 (`series_spec_017_tmdb_primary_lookup.md` — TMDB as primary source, narrowed OMDb ratings-only call, `tmdbRating`/`tmdbVoteCount` fields)
**Backend Task**
**Supersedes**: `series_spec_008_series_lifecycle_data.md` Requirement 3 (Refresh Information) in full — see that spec's own note. This spec is the current source of truth for refreshing a tracked series' data.

## Overview

Adds the ability to re-fetch a tracked series' external data on demand, once (`POST /api/v1/series/{id}/refresh`) or across the whole list (`POST /api/v1/series/refresh-all`), so data that's gone stale since a series was added — episode counts for a still-airing show, TMDB's rating/vote count as more people rate it, production status — can be brought current without deleting and re-adding.

Two shapes, not one, because they have different failure/UX profiles:
- **Single refresh** is synchronous — one series, a handful of upstream calls, a normal request/response.
- **Bulk refresh** is asynchronous — refreshing every tracked series sequentially against upstream APIs that have real rate limits (TMDB's free tier is ~40 requests per 10 seconds) takes long enough, and involves enough independent failure points, that it can't be a single blocking HTTP call. It runs as a background job the frontend polls.

**Design decisions**:
- **Bulk refresh is a single in-process, in-memory job — no new database table.** This is a single-instance personal app (see `CLAUDE.md`, no production multi-instance deployment target), so there's no need for job state to survive a process restart or be visible across instances. A plain singleton service holding one `RefreshJob` record (guarded by a lock so only one job runs at a time) is sufficient; a persisted job queue would be solving a scaling problem this app doesn't have.
- **Only one bulk job at a time.** A second `POST /series/refresh-all` while one is already running returns `409 Conflict` rather than queuing or running two batches concurrently against the same rate-limited upstream APIs.
- **The job status endpoint keeps showing the most recently finished run's result until a new job starts** — it does not reset to a blank/idle state the instant a job completes. This is deliberate: it's what lets the frontend answer "when did I last refresh everything?" from the same endpoint, without a separate "last completed job" record.
- **A per-item upstream failure during a bulk run is not a job failure.** One series' OMDb/TMDB call failing is expected, ordinary, non-fatal — the same posture Spec 008's original design took for single refresh, carried forward here. The job's `FAILED` status is reserved for something unexpected aborting the run entirely (e.g. an uncaught exception in the batch loop itself), which should be rare.
- **Throttling is a fixed sleep between items, not a rate-limiter library.** `app.tmdb.refresh-delay-ms` (default `250`) is a deliberately simple mechanism sized to stay well under TMDB's ~40-req/10s free-tier limit for a personal collection's realistic size — a token-bucket/leaky-bucket dependency would be solving a problem this app's scale doesn't have.
- **`lastRefreshedAt` is set at creation time too, not only on refresh.** A freshly added series' data is, by definition, as fresh as it'll ever be without a refresh — leaving the field `null` until the first explicit refresh would misrepresent a just-added series as stale.
- **Single refresh's field/outcome contract is carried forward unchanged from Spec 008's original design**, just re-scoped to the current (Spec 017) source split: TMDB supplies `totalSeasons`/`totalEpisodes`/`tmdbRating`/`tmdbVoteCount`/`productionStatus`; the narrowed OMDb call supplies `imdbRating`/`rottenTomatoesRating`. `title`, `genres`, `posterUrl`, `personalRating`, `personalNotes`, `status`, `currentSeason`, `currentEpisode`, `imdbId`, `dateAdded`, `dateCompleted` remain untouched by any refresh, same as before.

---

## Requirements

### Requirement 1: Single-Series Refresh

**User story**: As a user, I want to refresh one tracked series' episode counts, ratings, and production status on demand, so data that's gone stale since I added it can be brought up to date without deleting and re-adding.

#### Acceptance Criteria

- **SERIES-018-AC-01** [AUTO]: `SeriesController` shall expose `POST /api/v1/series/{id}/refresh`, delegating to `SeriesRefreshService.refresh(UUID id)`. If `id` does not match an existing `SeriesEntity`, it shall respond `404 Not Found` (`EntityNotFoundException`, same pattern as `getById`/`update`/`delete`).
- **SERIES-018-AC-02** [AUTO]: The refresh action shall re-fetch TMDB detail (via the resolved `tmdbId`, re-derived from `imdbId` when not already cached — see `series_spec_017_tmdb_primary_lookup.md`) and update `totalSeasons`, `totalEpisodes`, `tmdbRating`, `tmdbVoteCount`, and `productionStatus` on the entity from the fresh result.
- **SERIES-018-AC-03** [AUTO]: The refresh action shall also re-run the narrowed OMDb ratings-only lookup (`series_spec_017_tmdb_primary_lookup.md`) and update `imdbRating`/`rottenTomatoesRating` from its result.
- **SERIES-018-AC-04** [AUTO]: `title`, `genres`, `posterUrl`, `personalRating`, `personalNotes`, `status`, `currentSeason`, `currentEpisode`, `imdbId`, `dateAdded`, and `dateCompleted` shall remain untouched by a refresh — user- and system-owned fields a refresh does not overwrite.
- **SERIES-018-AC-05** [AUTO]: If the TMDB re-fetch fails (network failure, unresolvable id, `app.tmdb.api-key` unset), the fields listed in `SERIES-018-AC-02` shall be left unchanged, and this alone shall not fail the overall refresh request.
- **SERIES-018-AC-06** [AUTO]: If the narrowed OMDb call fails, the fields listed in `SERIES-018-AC-03` shall be left unchanged, and this alone shall not fail the overall refresh request.
- **SERIES-018-AC-07** [AUTO]: On completion, the endpoint shall respond `200 OK` with `ApiResponse<RefreshResult>`, a new record `RefreshResult(SeriesDto series, boolean omdbRefreshed, boolean tmdbRefreshed)` — mirroring `IgnoreOutcome`'s established pattern (`series_spec_006_recommendations.md` Implementation Notes) of pairing the DTO with outcome metadata the controller can't otherwise derive without duplicating the service's own checks.
- **SERIES-018-AC-08** [AUTO]: The entity shall be persisted via `repository.save(...)` reflecting whichever of OMDb/TMDB refresh succeeded — a partial success (one source updated, the other not) is a normal outcome, not an error, and is not rolled back.
- **SERIES-018-AC-09** [AUTO]: On any successful refresh (`omdbRefreshed || tmdbRefreshed`), `lastRefreshedAt` shall be set to the current time and persisted. If both sources fail, `lastRefreshedAt` shall remain unchanged.

---

### Requirement 2: `lastRefreshedAt` Tracking

**User story**: As a user, I want to know how recently a series' data was last refreshed, so I know whether to trust what I'm looking at.

#### Acceptance Criteria

- **SERIES-018-AC-10** [AUTO]: `SeriesEntity` shall gain a nullable `lastRefreshedAt` column (`LocalDateTime`) — per `series_spec_017_tmdb_primary_lookup.md`'s migration-squash decision (`SERIES-017-AC-16`), this column ships as part of that spec's rewritten `V001__create_series_table.sql` baseline, not a migration of its own. This AC is satisfied once that baseline exists; no separate migration file belongs to this spec.
- **SERIES-018-AC-11** [AUTO]: `SeriesDto` shall gain a matching `lastRefreshedAt` field (`LocalDateTime`), output-only — neither `SeriesService.create` nor `SeriesService.update` shall read `dto.getLastRefreshedAt()` when building/updating an entity (same convention as `dateAdded`/`dateCompleted`).
- **SERIES-018-AC-12** [AUTO]: `SeriesService.create` shall set `lastRefreshedAt` to the current time when persisting a new entity (see Design Decisions — a just-added series is as fresh as it will ever be without an explicit refresh).

---

### Requirement 3: Bulk Refresh Job

**User story**: As a user, I want to refresh my entire tracked list in one action, so I don't have to refresh each series individually.

#### Acceptance Criteria

- **SERIES-018-AC-13** [AUTO]: `SeriesController` shall expose `POST /api/v1/series/refresh-all`, delegating to a new `BulkRefreshService.start()`. It shall respond `202 Accepted` with `ApiResponse<RefreshJobStatus>` reflecting the job's initial (`IN_PROGRESS`) state.
- **SERIES-018-AC-14** [AUTO]: If a bulk job is already `IN_PROGRESS` when `POST /series/refresh-all` is requested, it shall respond `409 Conflict` and not start a second job.
- **SERIES-018-AC-15** [AUTO]: `BulkRefreshService` shall process every `SeriesEntity` sequentially, calling the same `SeriesRefreshService.refresh(UUID id)` logic as Requirement 1 for each, with a fixed delay (`app.tmdb.refresh-delay-ms`, default `250`) between items to stay within TMDB's free-tier rate limit (see Design Decisions).
- **SERIES-018-AC-16** [AUTO]: The batch shall run asynchronously (e.g. Spring `@Async` or a dedicated background `ExecutorService`) — the `POST /series/refresh-all` request shall not block until the batch completes.
- **SERIES-018-AC-17** [AUTO]: One series' refresh failing within the batch (per `SERIES-018-AC-05`/`AC-06`'s per-source posture) shall not stop the batch — the job continues to the next series and that series is still counted toward `completedCount`.
- **SERIES-018-AC-18** [AUTO]: `SeriesController` shall expose `GET /api/v1/series/refresh-all/status`, returning `ApiResponse<RefreshJobStatus>` — a new record `RefreshJobStatus(String status, int totalCount, int completedCount, LocalDateTime startedAt, LocalDateTime finishedAt)`, where `status` is one of `IDLE`/`IN_PROGRESS`/`COMPLETED`/`FAILED`.
- **SERIES-018-AC-19** [AUTO]: Before any bulk job has ever run, `GET /series/refresh-all/status` shall respond `200 OK` with `status: "IDLE"`, `totalCount: 0`, `completedCount: 0`, `startedAt: null`, `finishedAt: null`.
- **SERIES-018-AC-20** [AUTO]: While a job is `IN_PROGRESS`, `completedCount` shall reflect the number of series processed so far (successfully or with a non-fatal per-item failure), and `finishedAt` shall be `null`.
- **SERIES-018-AC-21** [AUTO]: After a job completes normally, its final `status` (`COMPLETED`), `totalCount`, `completedCount`, `startedAt`, and `finishedAt` shall remain visible via `GET /series/refresh-all/status` until a new job is started — the endpoint shall not revert to `IDLE` on its own (see Design Decisions).
- **SERIES-018-AC-22** [AUTO]: If the batch loop itself throws an unexpected exception (not a per-item upstream failure — see `SERIES-018-AC-17`), the job's `status` shall be set to `FAILED`, `finishedAt` set to the current time, and the exception shall not propagate to any caller (there is no caller waiting on this async task).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `IgnoreOutcome` outcome-record pattern, never-fail-the-request-on-a-graceful-degradation policy | `series_spec_006_recommendations.md` |
| TMDB as primary lookup source, narrowed OMDb ratings-only call, `tmdbRating`/`tmdbVoteCount` fields | `series_spec_017_tmdb_primary_lookup.md` |
| `ProductionStatus` enum, `TmdbClient.showStatus` | `series_spec_008_series_lifecycle_data.md` Requirement 2 (unaffected by this spec) |
| TMDB free-tier rate limit (~40 requests/10s) informing the fixed refresh delay | TMDB API documentation |
| `SeriesEntity`/Flyway migration conventions | `series_spec_001_entity.md` |
| Superseded design (single-refresh-only, no `lastRefreshedAt`, no bulk job) | `series_spec_008_series_lifecycle_data.md` Requirement 3 (see that file's superseded note) |
| Future frontend consumer: Refresh button, "Refresh All" button, progress/polling, "last refreshed"/"last full refresh" timestamps | `frontend_spec_023_series_refresh.md` (not yet written) |

---

## TDD Test Case Sketches

### `SeriesServiceSpec.groovy` (`lastRefreshedAt`, shipped via Spec 017's squashed `V001`)

```groovy
def "SERIES-018-AC-12: create sets lastRefreshedAt to now"() {
    when: "a new series is created"
        def created = seriesService.create(new SeriesDto(title: "Show"))

    then: "lastRefreshedAt is set"
        created.lastRefreshedAt != null
}
```

### `SeriesRefreshServiceSpec.groovy` (Requirement 1)

```groovy
def "SERIES-018-AC-01: refreshing an unknown id returns 404"() {
    when: "POST /api/v1/series/{random UUID}/refresh is requested"
        def response = client.post().uri("/api/v1/series/" + UUID.randomUUID() + "/refresh").exchange()

    then: "the response is 404"
        response.expectStatus().isNotFound()
}

def "SERIES-018-AC-02/07/09: successful TMDB refresh updates fields, sets lastRefreshedAt, reports tmdbRefreshed=true"() {
    given: "an existing series, TMDB now reports totalSeasons=6 (was 5), tmdbRating=8.9, voteCount=1200"
        // ...

    when: "POST /api/v1/series/{id}/refresh is requested"
        def response = client.post().uri("/api/v1/series/${existing.id}/refresh").exchange()

    then: "the response is 200 with updated fields, tmdbRefreshed true, and a fresh lastRefreshedAt"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.data.series.totalSeasons").isEqualTo(6)
        response.expectBody().jsonPath("\$.data.tmdbRefreshed").isEqualTo(true)
        response.expectBody().jsonPath("\$.data.series.lastRefreshedAt").exists()
}

def "SERIES-018-AC-05/09: TMDB failure leaves fields and lastRefreshedAt unchanged when OMDb also fails"() {
    given: "an existing series with a known lastRefreshedAt, both TMDB and OMDb calls throw"
        // ...

    when: "POST /api/v1/series/{id}/refresh is requested"
        def response = client.post().uri("/api/v1/series/${existing.id}/refresh").exchange()

    then: "the response is still 200, both outcome flags false, lastRefreshedAt untouched"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.data.tmdbRefreshed").isEqualTo(false)
        response.expectBody().jsonPath("\$.data.omdbRefreshed").isEqualTo(false)
}
```

### `BulkRefreshServiceSpec.groovy` (Requirement 3)

```groovy
def "SERIES-018-AC-13/14: starting a second job while one is in progress returns 409"() {
    given: "a bulk job already IN_PROGRESS"
        bulkRefreshService.start() // first call, kicks off async work

    when: "POST /series/refresh-all is requested again immediately"
        def response = client.post().uri("/api/v1/series/refresh-all").exchange()

    then: "the response is 409"
        response.expectStatus().isEqualTo(409)
}

def "SERIES-018-AC-17: one series' failure does not stop the batch"() {
    given: "three series, the second's refresh throws"
        // ...

    when: "the bulk job runs to completion"
        // ... await job status COMPLETED

    then: "completedCount is 3, not 1"
        jobStatus.completedCount == 3
}

def "SERIES-018-AC-19/21: status endpoint reflects IDLE before any run, then holds COMPLETED after"() {
    expect: "IDLE with zeroed counts before any job has run"
        def before = client.get().uri("/api/v1/series/refresh-all/status").exchange()
        before.expectBody().jsonPath("\$.data.status").isEqualTo("IDLE")

    when: "a job runs to completion"
        bulkRefreshService.start()
        // ... await completion

    then: "status stays COMPLETED with the finished job's data, not reset to IDLE"
        def after = client.get().uri("/api/v1/series/refresh-all/status").exchange()
        after.expectBody().jsonPath("\$.data.status").isEqualTo("COMPLETED")
        after.expectBody().jsonPath("\$.data.finishedAt").exists()
}
```

---

## Acceptance Criteria Summary

- [x] SERIES-018-AC-01: `POST /series/{id}/refresh`, 404 on unknown id
- [x] SERIES-018-AC-02: TMDB re-fetch updates seasons/episodes/tmdbRating/voteCount/productionStatus — **deviation**: `ProductionStatus`/`productionStatus` did not yet exist (`series_spec_008_series_lifecycle_data.md` Requirement 2 was itself `Not started`, despite this spec's header describing it as "unaffected"). A minimal prerequisite subset (the `ProductionStatus` enum, `SeriesEntity.productionStatus`/`SeriesDto.productionStatus`, a new `V003` migration) was added here, with TMDB's `status` string folded into the existing `TmdbClient.details()` call/`TmdbSeriesDetail` record rather than spec 008's originally-designed separate `showStatus(int)` method — avoids doubling TMDB traffic per refreshed series during a rate-limited bulk run. `excludeFromRecommendations`/`flaggedForRewatch` and create-time `productionStatus` resolution (spec 008 Requirements 1/2's remaining scope) are still not implemented.
- [x] SERIES-018-AC-03: narrowed OMDb re-fetch updates imdbRating/rottenTomatoesRating
- [x] SERIES-018-AC-04: user/system-owned fields untouched
- [x] SERIES-018-AC-05: TMDB failure non-fatal, fields unchanged
- [x] SERIES-018-AC-06: OMDb failure non-fatal, fields unchanged
- [x] SERIES-018-AC-07: `200` + `ApiResponse<RefreshResult>`
- [x] SERIES-018-AC-08: partial success persisted, not rolled back
- [x] SERIES-018-AC-09: `lastRefreshedAt` set on any successful refresh, unchanged if both fail
- [x] SERIES-018-AC-10: `lastRefreshedAt` column (ships via Spec 017's squashed `V001` baseline, no migration of its own)
- [x] SERIES-018-AC-11: `SeriesDto.lastRefreshedAt`, output-only
- [x] SERIES-018-AC-12: `create` sets `lastRefreshedAt` to now
- [x] SERIES-018-AC-13: `POST /series/refresh-all`, `202` + initial status
- [x] SERIES-018-AC-14: second concurrent start → `409`
- [x] SERIES-018-AC-15: sequential processing with fixed inter-item delay
- [x] SERIES-018-AC-16: batch runs asynchronously, request doesn't block
- [x] SERIES-018-AC-17: per-item failure doesn't stop the batch
- [x] SERIES-018-AC-18: `GET /series/refresh-all/status` returns `RefreshJobStatus`
- [x] SERIES-018-AC-19: `IDLE` default before any job has run
- [x] SERIES-018-AC-20: `completedCount`/`finishedAt` reflect in-progress state correctly
- [x] SERIES-018-AC-21: completed job's status persists until a new job starts
- [x] SERIES-018-AC-22: unexpected batch-loop failure → `FAILED`, non-propagating
