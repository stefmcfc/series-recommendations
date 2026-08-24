# Spec 018: Series Data Refresh (Single & Bulk)

**Status**: Implemented (Requirements 1–6). **Amendment (2026-08-23, Requirements 4–6)**: adds a "new episodes/series available" flag set when a refresh detects `totalSeasons`/`totalEpisodes` increased (Requirement 4 — `SeriesEntity`/`SeriesDto.newContentDetectedAt`, `V006__add_new_content_detected_at_to_series.sql`, `SeriesRefreshService.applyNewContentDetection`/`acknowledgeNewContent`, `POST /series/{id}/acknowledge-new-content`); a configurable threshold below which bulk refresh skips a recently-refreshed series, while single-series refresh continues to always force (Requirement 5 — `app.tmdb.refresh-skip-threshold-minutes`, `BulkRefreshService.shouldSkip`, `RefreshJobStatus.skippedCount`); and an automatic `COMPLETED → BACKLOG` status change (with `dateCompleted` cleared) when new content is detected on a `COMPLETED` series, per the user's explicit choice (Requirement 6 — folded into the same `applyNewContentDetection`). No frontend files are touched by this amendment either — the corresponding UI is `frontend_spec_023_series_refresh.md`'s own amendment.
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

### Requirement 4: New-Content Detection

**User story**: As a user, I want to be told when a refresh finds more seasons or episodes than I last knew about, so I notice a show I'm tracking has new content without having to remember to check it myself.

**Design decisions (persistence — the user asked for options to be laid out and a call made rather than left open):**

| Option | Shape | Tradeoff |
|---|---|---|
| (a) Persisted flag/timestamp on the entity, cleared on acknowledgment | Nullable `newContentDetectedAt` column; non-null = flagged; a dedicated action clears it | Survives restarts and multiple refreshes; needs one new column + one new small endpoint to clear it; simple to query for a list-wide "which series have new content" view later |
| (b) Fully transient — computed only inside a single refresh's response, never stored | No schema change; `RefreshResult` gains a `newContentAvailable: boolean` for that one call only | Cheapest to build, but the signal vanishes the instant the response is read — a bulk refresh's finding is invisible unless the user was staring at that exact moment; can't answer "does this series have unseen new content?" on a later page load |
| (c) Store a full previous season/episode snapshot to diff against, separate from the live `totalSeasons`/`totalEpisodes` fields | Two extra columns duplicating what's already tracked | Solves nothing (a) doesn't already solve — the live fields are already the "previous" value at the start of a refresh, since refresh overwrites them — while adding redundant state to keep in sync |

**Decision: option (a).** A refresh is not always observed synchronously (bulk refresh in particular runs in the background per Requirement 3), so the signal needs to survive until the user actually looks — ruling out (b). Option (c) duplicates data Requirement 1 already provides for free (the entity's current `totalSeasons`/`totalEpisodes`, read *before* this refresh's fetch overwrites them, already are the "previous" values needed for the comparison), so it adds a maintenance burden with no corresponding benefit over (a). Acknowledgment is a small, explicit action (a new endpoint, mirroring `POST /series/{id}/refresh`'s own action-endpoint shape) rather than an implicit side effect of `GET /series/{id}` — a `GET` silently mutating state on read would be a surprising side effect for any future consumer of that endpoint (see `tooling_spec_001_code_quality_security.md`'s general correctness posture), and an explicit "I've seen this" action is also simply clearer UX than "viewing it clears it," which could clear the flag before the user has actually registered it.

#### Acceptance Criteria

- **SERIES-018-AC-23** [AUTO]: `SeriesEntity` shall gain a nullable `newContentDetectedAt` column (`LocalDateTime`), added via a new Flyway migration `V006__add_new_content_detected_at_to_series.sql`. `SeriesDto` shall gain a matching `newContentDetectedAt` field, output-only (neither `SeriesService.create` nor `SeriesService.update` reads it from an incoming DTO — same convention as `lastRefreshedAt`, `SERIES-018-AC-11`).
- **SERIES-018-AC-24** [AUTO]: During a single-series refresh (Requirement 1), `SeriesRefreshService` shall compare the entity's `totalSeasons`/`totalEpisodes` values *as they stood before this refresh's TMDB fetch* against the freshly-fetched values. If either freshly-fetched value is greater than its pre-refresh value, `newContentDetectedAt` shall be set to the current time and persisted alongside the refreshed fields.
- **SERIES-018-AC-25** [AUTO]: If neither `totalSeasons` nor `totalEpisodes` increased (unchanged, decreased, or the TMDB fetch itself failed per `SERIES-018-AC-05`), `newContentDetectedAt` shall be left exactly as it was — a refresh that doesn't find new content never clears an existing flag on its own (only explicit acknowledgment, `SERIES-018-AC-27`, does that), and never sets a new one.
- **SERIES-018-AC-26** [AUTO]: A pre-refresh `null` `totalSeasons`/`totalEpisodes` (e.g. a manually-added series with no prior TMDB data) shall not itself count as "increased" when the fresh value is non-null — there is no prior value to have grown from, so this is treated as newly-populated data, not new content on top of existing data. (Contrast with `SERIES-018-AC-24`: both prior and fresh values must be known, and fresh strictly greater, for the flag to be set.)
- **SERIES-018-AC-27** [AUTO]: `SeriesController` shall expose `POST /api/v1/series/{id}/acknowledge-new-content`, delegating to `SeriesRefreshService.acknowledgeNewContent(UUID id)`, which sets `newContentDetectedAt` to `null` and persists the entity. It shall respond `200 OK` with `ApiResponse<SeriesDto>` reflecting the cleared state, or `404 Not Found` if `id` does not match an existing `SeriesEntity` (same pattern as `SERIES-018-AC-01`).
- **SERIES-018-AC-28** [AUTO]: Bulk refresh (Requirement 3) applies `SERIES-018-AC-24`–`AC-26` identically for each series it processes — the per-item detection logic is the same `SeriesRefreshService.refresh` call in both cases (`SERIES-018-AC-15`), not a separate implementation.

---

### Requirement 5: Bulk Refresh Skip Threshold

**User story**: As a user running a bulk refresh, I want series I've refreshed very recently to be skipped, so a repeat "Refresh All" click doesn't burn TMDB rate-limit budget and wall-clock time re-fetching data that's already current.

#### Acceptance Criteria

- **SERIES-018-AC-29** [AUTO]: `application.yml` shall gain `app.tmdb.refresh-skip-threshold-minutes` (constructor-injected `@Value`, default `60`), following the same `app.tmdb.*`/`APP_TMDB_*` override-via-env-var pattern as `refresh-delay-ms`/`max-source-series`/`max-candidates`.
- **SERIES-018-AC-30** [AUTO]: During a bulk refresh (Requirement 3), `BulkRefreshService` shall skip any series whose `lastRefreshedAt` is non-null and within `app.tmdb.refresh-skip-threshold-minutes` of the current time — that series is not refreshed, but is still counted toward `completedCount` (it has been "processed," just via a no-op) so the job's progress accounting (`SERIES-018-AC-20`) remains accurate.
- **SERIES-018-AC-31** [AUTO]: A series with a `null` `lastRefreshedAt` is never skipped by the threshold (there is no "recently" to compare against) — this cannot actually occur in practice today since `SERIES-018-AC-12` sets `lastRefreshedAt` at creation time, but the check handles it defensively rather than throwing on a null comparison.
- **SERIES-018-AC-32** [AUTO]: `RefreshJobStatus` shall gain a `skippedCount` field (`int`, default `0`), incremented once per series skipped under `SERIES-018-AC-30`, visible via `GET /series/refresh-all/status` alongside the existing `totalCount`/`completedCount`.
- **SERIES-018-AC-33** [AUTO]: Single-series refresh (`POST /series/{id}/refresh`, Requirement 1) shall never apply the skip threshold — it always performs a real refresh regardless of how recently `lastRefreshedAt` was set, per the user's explicit requirement that an individual refresh remains a way to force one.
- **SERIES-018-AC-34** [AUTO]: Setting `app.tmdb.refresh-skip-threshold-minutes` to `0` shall disable skipping entirely (every series is refreshed on every bulk run, matching pre-amendment behavior) — the same "0 disables the filter" convention already established for `minVoteCount` (`SERIES-007-AC-25`).

---

### Requirement 6: Status Reactivation on New Content

**User story**: As a user, I marked a series `COMPLETED` — its "Current Season"/"Current Episode" fields are hidden on the detail view (`frontend_spec_005_series_detail.md`, `FRONTEND-005-AC-31`) because there was nothing left to track. If a later refresh finds the show has grown a new season or episodes, I want the series to stop claiming I've finished it, so I notice it needs attention again.

**Design decision — target status**: `SeriesStatus` has four values: `WATCHING`, `COMPLETED`, `DROPPED`, `BACKLOG`. The user was directly asked to choose between `WATCHING` and `BACKLOG` and **explicitly confirmed `COMPLETED → BACKLOG`**. Noting for the record, since it's a slight stretch of `BACKLOG`'s use elsewhere in this app (`SearchFilter`'s `startedNotFinished` criterion, `frontend_spec_012_series_lifecycle_controls.md` treating `COMPLETED` as the only "actually watched" signal, both of which otherwise treat `BACKLOG` as "not yet started"): here it's being used as "back in the to-watch pile," not literally "never started," which is a reasonable, deliberate choice given the user made it directly rather than by default. `DROPPED` is excluded from this reactivation (`SERIES-018-AC-37`) — a series the user actively dropped is presumed not wanted back just because new episodes exist.

#### Acceptance Criteria

- **SERIES-018-AC-35** [AUTO]: When a refresh (single, `SERIES-018-AC-24`, or as part of a bulk run, `SERIES-018-AC-28`) sets `newContentDetectedAt` because `totalSeasons` or `totalEpisodes` increased, and the entity's `status` at the start of that refresh was `COMPLETED`, `SeriesRefreshService` shall also change `status` to `BACKLOG` (see Design Decision) and persist it alongside the other refreshed fields, in the same save.
- **SERIES-018-AC-36** [AUTO]: When `SERIES-018-AC-35` changes `status` away from `COMPLETED`, `dateCompleted` shall be cleared to `null` in the same update — leaving it set on a non-`COMPLETED` series would reintroduce the same invalid combination this app's own create/update validation otherwise rejects (`dateCompleted` set while `status != COMPLETED`).
- **SERIES-018-AC-37** [AUTO]: `SERIES-018-AC-35` applies only when the pre-refresh status is `COMPLETED` — a series already `WATCHING`, `BACKLOG`, or `DROPPED` that gains new content is unaffected by this requirement (its status is left exactly as `SERIES-018-AC-24`–`AC-26` already leave every other field untouched). In particular, a `DROPPED` series is deliberately left `DROPPED` even if new content appears — the user consciously dropped it, and this spec does not second-guess that choice.
- **SERIES-018-AC-38** [AUTO]: `SERIES-018-AC-35` is unconditional on detection alone — it does not wait for or depend on the new-content flag being acknowledged (`SERIES-018-AC-27`). Acknowledging the flag only clears `newContentDetectedAt`; it never reverses a status change already made by this requirement.
- **SERIES-018-AC-39** [AUTO]: If a refresh detects new content but the pre-refresh `totalSeasons`/`totalEpisodes` were `null` (`SERIES-018-AC-26`'s "not treated as an increase" case), `SERIES-018-AC-35` does not fire either — no detection, no reactivation, consistent with `AC-26`'s own scope.

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
| `minVoteCount=0` disables-the-filter convention mirrored by `SERIES-018-AC-34` | `series_spec_007_recommendation_sourcing.md` (`SERIES-007-AC-25`) |
| Never-a-silent-mutating-GET correctness posture informing the dedicated acknowledge endpoint (`SERIES-018-AC-27`) rather than a `GET`-triggered side effect | `tooling_spec_001_code_quality_security.md` |
| Future frontend consumer: "new content" badge/acknowledgment action, bulk-refresh skipped-count display | `frontend_spec_023_series_refresh.md` (amendment) |
| `FRONTEND-005-AC-31` (hides Current Season/Current Episode for `COMPLETED`), which `SERIES-018-AC-35`'s status change naturally reverses with no separate frontend change needed | `frontend_spec_005_series_detail.md` Requirement 13 |
| `dateCompleted` set while `status != COMPLETED` being an invalid combination on ordinary create/update, mirrored by `SERIES-018-AC-36`'s clearing behavior | `series_spec_002_crud.md` validation, `.claude/skills/verify/SKILL.md` "Worth probing" |
| `BACKLOG` otherwise meaning "not started" elsewhere in this app, noted as a deliberate stretch in Requirement 6's Design Decision | `frontend_spec_012_series_lifecycle_controls.md` |

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

### `SeriesRefreshServiceSpec.groovy` (Requirement 4, addition)

```groovy
def "SERIES-018-AC-24: an increased totalSeasons sets newContentDetectedAt"() {
    given: "an existing series with totalSeasons 5, TMDB now reports 6"
        // ...

    when: "POST /api/v1/series/{id}/refresh is requested"
        def response = client.post().uri("/api/v1/series/${existing.id}/refresh").exchange()

    then: "newContentDetectedAt is set"
        response.expectBody().jsonPath("\$.data.series.newContentDetectedAt").exists()
}

def "SERIES-018-AC-25: an unchanged season/episode count leaves an existing flag untouched"() {
    given: "a series already flagged (newContentDetectedAt set), TMDB now reports the same totalSeasons/totalEpisodes"
        // ...

    when: "POST /api/v1/series/{id}/refresh is requested"
        def response = client.post().uri("/api/v1/series/${existing.id}/refresh").exchange()

    then: "newContentDetectedAt is unchanged, not cleared"
        response.expectBody().jsonPath("\$.data.series.newContentDetectedAt").isEqualTo(existing.newContentDetectedAt.toString())
}

def "SERIES-018-AC-26: a null-to-populated totalSeasons is not treated as an increase"() {
    given: "a manually-added series with totalSeasons null, TMDB now reports 3"
        // ...

    when: "POST /api/v1/series/{id}/refresh is requested"
        def response = client.post().uri("/api/v1/series/${existing.id}/refresh").exchange()

    then: "newContentDetectedAt remains null"
        response.expectBody().jsonPath("\$.data.series.newContentDetectedAt").doesNotExist()
}

def "SERIES-018-AC-27: acknowledging clears the flag"() {
    given: "a series with newContentDetectedAt set"
        // ...

    when: "POST /api/v1/series/{id}/acknowledge-new-content is requested"
        def response = client.post().uri("/api/v1/series/${existing.id}/acknowledge-new-content").exchange()

    then: "the response is 200 with newContentDetectedAt null"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.data.newContentDetectedAt").doesNotExist()
}
```

### `BulkRefreshServiceSpec.groovy` (Requirement 5, addition)

```groovy
def "SERIES-018-AC-30/32: a recently-refreshed series is skipped and counted in skippedCount"() {
    given: "three series: two lastRefreshedAt 5 minutes ago, one lastRefreshedAt 2 hours ago; threshold 60 minutes"
        // ...

    when: "the bulk job runs to completion"
        // ... await job status COMPLETED

    then: "only the 2-hours-old series was actually refreshed, skippedCount is 2, completedCount is 3"
        jobStatus.skippedCount == 2
        jobStatus.completedCount == 3
}

def "SERIES-018-AC-33: single-series refresh always forces, ignoring the threshold"() {
    given: "a series refreshed 1 minute ago, threshold 60 minutes"
        // ...

    when: "POST /api/v1/series/{id}/refresh is requested directly"
        def response = client.post().uri("/api/v1/series/${existing.id}/refresh").exchange()

    then: "a real refresh occurs (TMDB/OMDb are called), not skipped"
        response.expectStatus().isOk()
}

def "SERIES-018-AC-34: a zero threshold disables skipping entirely"() {
    given: "app.tmdb.refresh-skip-threshold-minutes=0, a series refreshed 1 second ago"
        // ...

    when: "the bulk job runs to completion"
        // ...

    then: "the series is refreshed, not skipped"
        jobStatus.skippedCount == 0
}
```

### `SeriesRefreshServiceSpec.groovy` (Requirement 6, addition)

```groovy
def "SERIES-018-AC-35/36: new content on a COMPLETED series flips it to BACKLOG and clears dateCompleted"() {
    given: "a COMPLETED series with totalSeasons 5, dateCompleted set, TMDB now reports 6"
        // ...

    when: "POST /api/v1/series/{id}/refresh is requested"
        def response = client.post().uri("/api/v1/series/${existing.id}/refresh").exchange()

    then: "status is now BACKLOG and dateCompleted is null"
        response.expectBody().jsonPath("\$.data.series.status").isEqualTo("BACKLOG")
        response.expectBody().jsonPath("\$.data.series.dateCompleted").doesNotExist()
}

def "SERIES-018-AC-37: a WATCHING series gaining new content is left WATCHING"() {
    given: "a WATCHING series with totalSeasons 5, TMDB now reports 6"
        // ...

    when: "POST /api/v1/series/{id}/refresh is requested"
        def response = client.post().uri("/api/v1/series/${existing.id}/refresh").exchange()

    then: "status is unchanged"
        response.expectBody().jsonPath("\$.data.series.status").isEqualTo("WATCHING")
}

def "SERIES-018-AC-37: a DROPPED series gaining new content stays DROPPED"() {
    given: "a DROPPED series with totalSeasons 5, TMDB now reports 6"
        // ...

    when: "POST /api/v1/series/{id}/refresh is requested"
        def response = client.post().uri("/api/v1/series/${existing.id}/refresh").exchange()

    then: "status is unchanged"
        response.expectBody().jsonPath("\$.data.series.status").isEqualTo("DROPPED")
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
- [x] SERIES-018-AC-23: `newContentDetectedAt` column + output-only `SeriesDto` field via `V006` migration
- [x] SERIES-018-AC-24: increased `totalSeasons`/`totalEpisodes` sets `newContentDetectedAt`
- [x] SERIES-018-AC-25: no increase leaves an existing flag untouched, never auto-clears
- [x] SERIES-018-AC-26: null-to-populated is not treated as an increase
- [x] SERIES-018-AC-27: `POST /series/{id}/acknowledge-new-content` clears the flag
- [x] SERIES-018-AC-28: bulk refresh applies the same detection logic per item
- [x] SERIES-018-AC-29: `app.tmdb.refresh-skip-threshold-minutes` config (default 60)
- [x] SERIES-018-AC-30: bulk refresh skips a recently-refreshed series, still counted toward `completedCount`
- [x] SERIES-018-AC-31: a null `lastRefreshedAt` is never skipped
- [x] SERIES-018-AC-32: `RefreshJobStatus.skippedCount`
- [x] SERIES-018-AC-33: single-series refresh always forces, ignores the threshold
- [x] SERIES-018-AC-34: a `0` threshold disables skipping entirely
- [x] SERIES-018-AC-35: new content on a `COMPLETED` series flips it to `BACKLOG`
- [x] SERIES-018-AC-36: `dateCompleted` cleared when status changes away from `COMPLETED`
- [x] SERIES-018-AC-37: only a pre-refresh `COMPLETED` status triggers the change; `DROPPED` stays `DROPPED`
- [x] SERIES-018-AC-38: reactivation doesn't depend on/wait for flag acknowledgment
- [x] SERIES-018-AC-39: no reactivation when `AC-26`'s null-to-populated case applies (no detection fired)
