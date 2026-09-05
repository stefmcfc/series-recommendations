# Series Spec 038: Import (Reverse of Export)

**Status**: Implemented (backend) — `service/BulkImportService.java`,
`dto/ImportJobStatus.java`, `dto/ImportRowError.java`, `controller/SeriesController.java`
(`POST /api/v1/series/import`, `GET /api/v1/series/import/status`); tests in
`service/BulkImportServiceSpec.groovy` and `controller/SeriesControllerImportSpec.groovy`.
Frontend (`frontend_spec_057_import_ui.md`) not yet built.
**Priority**: P3 (`series_spec_004_export.md`'s own "Future Enhancements" list, now picked up)
**Depends on**: Series Spec 004 (`series_spec_004_export.md`, owns the JSON export shape this spec
reads back) ✅, Series Spec 002 (`series_spec_002_crud.md`, owns `POST /api/v1/series` this spec
reuses per row) ✅, Series Spec 028 (`series_spec_028_prevent_duplicate_series.md`, owns the
duplicate-`imdbId` 409 this spec relies on to skip already-tracked series) ✅, Series Spec 018
(`series_spec_018_series_refresh.md`, owns `BulkRefreshService`'s async-job/delay-between-items
shape this spec mirrors exactly) ✅
**Area**: Backend (`service/BulkImportService.java` (new), `controller/SeriesController.java`,
`dto/ImportJobStatus.java` (new)) — paired with Frontend Spec 057
(`frontend_spec_057_import_ui.md`)

## Overview

Confirmed (2026-08-29): `series_spec_004`'s own "Future Enhancements" listed import as the natural
reverse operation, never picked up. `SeriesExportService.exportAsJson` already guarantees valid,
parseable JSON (`{ exportDate, series: [...], count }`, `series` a list of full `SeriesDto`
objects) — this spec reads that same shape back in, creating a series per entry via the existing
`POST /api/v1/series` path (reusing its validation and `series_spec_028`'s duplicate-`imdbId`
rejection for free, rather than a bespoke bulk-insert bypass).

## Design Decisions

- **JSON only in this pass — CSV import is explicitly out of scope.** JSON round-trips trivially
  (it's already valid, parseable JSON by the export spec's own guarantee); CSV does not — correctly
  handling quoted/escaped fields on the *read* side is materially riskier to hand-roll than the
  *write* side `SeriesExportService.exportAsCsv` already does (no CSV parsing library is a backend
  dependency today), and getting it subtly wrong would corrupt data on import in a way a JSON parse
  failure simply can't. Deferred as its own follow-up if genuinely wanted later, not silently
  dropped — noted in `.claude/ideas/future_ideas.md`.
- **Reuses `SeriesService.create` per row, not a separate bulk-insert path.** Every existing
  guarantee (field validation, duplicate-`imdbId` rejection, best-effort TMDB/OMDb enrichment when
  `imdbId` is present) applies to each imported row automatically, with zero new validation logic to
  write or keep in sync.
- **Async job, mirroring `BulkRefreshService` exactly** — `POST /api/v1/series/import` starts a
  background job and returns immediately (`202 Accepted`); `GET /api/v1/series/import/status` polls
  it. A synchronous request/response would mean a large import blocking on N sequential TMDB/OMDb
  calls within a single HTTP request — the same reason `series_spec_018` moved bulk refresh to this
  shape in the first place.
- **Reuses `app.tmdb.refresh-delay-ms` for the between-item delay — no new config property.** Same
  purpose (rate-limiting external API calls across a bulk operation) as `BulkRefreshService` already
  solves; a second, near-duplicate `import-delay-ms` knob would be needless duplication.
- **A duplicate `imdbId` (`409` from `create`) is caught and counted as `skippedCount`, not a job
  failure** — mirrors `BulkRefreshService`'s existing "an individual item's failure doesn't fail the
  whole job" posture exactly. Any other per-row failure (validation error, malformed entry) is
  caught and counted toward a new `errorCount`, with a capped list of per-row error messages
  (`errors: List<ImportRowError>`, capped at e.g. 20 entries to avoid an unbounded response body for
  a badly-malformed large file) — distinct from `skippedCount` so a user can tell "already tracked"
  apart from "something was wrong with this row."
- **A structurally invalid file (not parseable JSON, or missing the `series` array) is rejected
  outright at upload time with a `400`**, before the job even starts — distinct from a per-row
  problem discovered mid-job.

---

## Requirement 1: `POST /api/v1/series/import` starts an async import job

**User story**: As a user, I want to re-import a previously exported JSON file, without a huge file
timing out the request or one bad row blocking the rest.

### SERIES-038-AC-01 [AUTO]
**Statement**: `POST /api/v1/series/import` (multipart file upload, JSON only) shall validate the
uploaded file is parseable JSON matching `{ series: SeriesDto[] }` (ignoring `exportDate`/`count`
if present — so a re-uploaded export file works unmodified), starting a background `ImportJobStatus`
job and returning `202 Accepted` with the initial status.

**Test Case (Red)**:
```groovy
def "SERIES-038-AC-01: a valid export file starts an import job"() {
    given: "a valid export-shaped JSON file"
        def file = new MockMultipartFile("file", "export.json", "application/json",
            '{"exportDate":"2026-08-29T10:00:00","series":[{"title":"Show","imdbId":"tt1234567"}],"count":1}'.bytes)

    when: "POST /api/v1/series/import is called"
        def response = client.post().uri("/api/v1/series/import").multipart(file).exchange()

    then: "202 Accepted with an IN_PROGRESS status"
        response.expectStatus().isEqualTo(202)
        response.expectBody().jsonPath("\$.data.status").isEqualTo("IN_PROGRESS")
}
```
**Test Case (Green)**: new controller method reading the multipart file, parsing/validating its
`series` array, calling `importService.start(entries)`.

---

### SERIES-038-AC-02 [AUTO]
**Statement**: A structurally invalid upload (not parseable JSON, or missing the `series` array)
shall be rejected with `400` before any job starts.

**Test Case (Red)**:
```groovy
def "SERIES-038-AC-02: a malformed file is rejected before starting a job"() {
    given: "not valid JSON"
        def file = new MockMultipartFile("file", "bad.json", "application/json", "not json".bytes)

    when: "POST /api/v1/series/import is called"
        def response = client.post().uri("/api/v1/series/import").multipart(file).exchange()

    then: "400, no job started"
        response.expectStatus().isBadRequest()
}
```
**Test Case (Green)**: parse/shape validation runs before `importService.start` is ever called.

---

## Requirement 2: Per-row processing — reuse `create`, skip duplicates, track errors

### SERIES-038-AC-03 [AUTO]
**Statement**: For each entry, `BulkImportService` shall call `seriesService.create(dto)`, waiting
`app.tmdb.refresh-delay-ms` between items. A duplicate-`imdbId` rejection (`409`,
`series_spec_028`) shall increment `skippedCount`, not fail the job. Any other per-row failure shall
increment `errorCount` and append a capped `ImportRowError(rowIndex, message)` to `errors`
(max ~20 entries).

**Test Case (Red)**:
```groovy
def "SERIES-038-AC-03: duplicates are skipped, other failures are tracked as errors, both non-fatal"() {
    given: "three entries: one new, one duplicate imdbId, one missing a required title"
        def entries = [
            new SeriesDto(title: "New Show", imdbId: "tt1111111"),
            new SeriesDto(title: "Existing Show", imdbId: "tt2222222"), // already tracked
            new SeriesDto(title: null, imdbId: "tt3333333"),
        ]
        seriesRepository.existsByImdbId("tt2222222") >> true

    when: "the import job runs"
        importService.start(entries)
        importService.awaitCompletionForTest()

    then: "one imported, one skipped, one errored -- job still completes"
        def status = importService.status()
        status.status() == COMPLETED
        status.importedCount() == 1
        status.skippedCount() == 1
        status.errorCount() == 1
        status.errors().size() == 1
}
```
**Test Case (Green)**: `runJob` loop calls `create`, catches the duplicate `409`
(`IllegalStateException`/whatever `series_spec_028` throws) into `skippedCount`, catches any other
exception into `errorCount`/`errors`, `Thread.sleep(refreshDelayMs)` between items — same shape as
`BulkRefreshService.runJob`.

---

### SERIES-038-AC-04 [AUTO]
**Statement**: `GET /api/v1/series/import/status` shall return the current/last job's
`ImportJobStatus` (`status`, `totalCount`, `importedCount`, `skippedCount`, `errorCount`, `errors`,
`startedAt`, `completedAt`) — same polling shape as `GET /api/v1/series/refresh-all` status.

**Test Case (Green)**: mirrors `BulkRefreshService.status()`'s existing `AtomicReference`-backed
implementation and its controller endpoint exactly.

---

## Implementation Notes

- **`API.md`** gains `POST /api/v1/series/import` and `GET /api/v1/series/import/status` entries,
  documenting the JSON-only scope and the `ImportJobStatus` shape.
- **`RUNBOOK.md`** — no new config property (reuses `app.tmdb.refresh-delay-ms`, already
  documented).

## Cross-References

| This spec | Source |
|---|---|
| The JSON export shape this spec reads back | `series_spec_004_export.md` |
| `POST /api/v1/series`, reused per row | `series_spec_002_crud.md` |
| Duplicate-`imdbId` rejection this spec relies on for skip semantics | `series_spec_028_prevent_duplicate_series.md` |
| Async job/delay/status-polling shape this spec mirrors | `series_spec_018_series_refresh.md` (`BulkRefreshService`) |
| Frontend consumer | `frontend_spec_057_import_ui.md` |
| CSV import, explicitly deferred | `.claude/ideas/future_ideas.md` |

---

## Acceptance Criteria Summary

- [x] SERIES-038-AC-01: a valid export file starts an import job, `202 Accepted`
- [x] SERIES-038-AC-02: a malformed file is rejected with `400` before any job starts
- [x] SERIES-038-AC-03: duplicates are skipped, other failures tracked as errors, both non-fatal
- [x] SERIES-038-AC-04: `GET .../import/status` returns the job's current status
