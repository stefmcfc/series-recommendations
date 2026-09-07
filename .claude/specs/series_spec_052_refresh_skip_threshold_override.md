# Spec 052: Refresh Skip-Threshold Override & Visibility

**Status**: Backend implemented (all ACs met, `gradlew.bat test` green); frontend consumer (`frontend_spec_097_refresh_skip_threshold_override_ui.md`) not yet built
**Priority**: P3 (settings/quality-of-life enhancement to an existing feature, not core CRUD)
**Depends on**: `series_spec_018_series_refresh.md` (the original bulk-refresh job, `BulkRefreshService`/`RefreshJobStatus`/`SeriesRefreshController` this extends)
**Backend Task**

## Overview

`BulkRefreshService.shouldSkip` skips a series' refresh during a "Refresh All" run when its
`lastRefreshedAt` is within `app.tmdb.refresh-skip-threshold-minutes` (default 60, a plain
`@Value`-injected constructor field — no `@ConfigurationProperties` class exists anywhere in this
backend, confirmed) of now. Today this value is invisible and fixed: a user who clicks "Refresh
All" a second time shortly after the first gets every series silently skipped, with no way to see
*why* (what threshold produced that) or to override it for just that one run.

This spec adds a per-request override — `POST /api/v1/series/refresh-all` accepts an optional body
overriding the threshold for that one run only — and reports back which threshold actually governed
a given run via a new `RefreshJobStatus` field. It deliberately does **not** add any persisted
settings/config entity: the injected `@Value` default remains the sole persistent source of truth,
unchanged by this spec; an override affects only the run it's passed on.

## Design Decisions

- **Per-request override, not a persisted setting.** This app has zero settings/preference
  persistence anywhere (no `@Entity`, no Flyway migration, no `@ConfigurationProperties` class,
  confirmed by reading `model/` and `db/migration/`) — inventing one just to make a single scalar
  adjustable would be disproportionate infrastructure for what the original idea itself already
  suggested as sufficient: "override it for one run." A future settings foundation (if one is ever
  built for other reasons — see `.claude/ideas/future_ideas.md`'s "No settings menu" entry) could
  layer a *persisted default* on top of this later without any change to the override mechanism
  itself; this spec doesn't need to anticipate that.
- **The effective threshold is resolved once, at job start, not re-read per series.** `start()`
  computes `override != null ? override : refreshSkipThresholdMinutes` a single time and threads
  that resolved `int` through the whole run (`runJob`/`shouldSkip`) — a run's skip behavior stays
  internally consistent even if this were ever made concurrently-adjustable later (it isn't, today).
- **`RefreshJobStatus` gains `skipThresholdMinutesUsed`, not just the override mechanism alone.**
  The original idea's other half — "even know why the second click did nothing" — isn't satisfied
  by override capability by itself: without reporting which threshold actually governed a completed
  run, a user who didn't override still can't see what produced a given `skippedCount`. This is a
  cheap addition (one more `int` on an already-existing, already-polled record) that closes that gap
  directly, populated from the same resolved value `shouldSkip` uses.
- **No new validation beyond what `shouldSkip` already does.** `shouldSkip` already treats any
  `refreshSkipThresholdMinutes <= 0` as "disable skipping entirely" (SERIES-018-AC-34, the existing
  "0 disables the filter" convention shared with `minVoteCount`). An override of `0` or a negative
  value is handled identically, with no separate validation needed — a negative override isn't a
  meaningfully different "disable" signal than `0`, so rejecting it would just be extra surface area
  for no behavioral benefit.
- **Omitting the request body (or the field within it) is fully backward compatible.** `POST
  /api/v1/series/refresh-all` with no body, or `{}`, behaves identically to today — `override` is
  `null`, so the injected `@Value` default governs, exactly as before this spec.

## Requirements

### Requirement 1: Request shape

**User story**: As a developer, I want the refresh-all endpoint to accept an optional per-run
threshold override the same way this app's other optional-filter endpoints already do.

#### Acceptance Criteria

- **SERIES-052-AC-01** [AUTO]: A new `RefreshAllOptions` record (`dto/RefreshAllOptions.java`)
  shall carry one nullable field, `Integer skipThresholdMinutesOverride`.
- **SERIES-052-AC-02** [AUTO]: `SeriesRefreshController.refreshAll` shall accept an optional
  `@RequestBody(required = false) RefreshAllOptions options` parameter and pass
  `options != null ? options.skipThresholdMinutesOverride() : null` to `BulkRefreshService.start`.
- **SERIES-052-AC-03** [AUTO]: `POST /api/v1/series/refresh-all` with no request body, or an empty
  JSON object (`{}`), shall behave identically to today — the injected
  `refreshSkipThresholdMinutes` default governs the run.

---

### Requirement 2: Per-run override resolution

**User story**: As a user, I want to override the skip threshold for just one "Refresh All" click,
without changing the app's default behavior for every future run.

#### Acceptance Criteria

- **SERIES-052-AC-04** [AUTO]: `BulkRefreshService.start` shall accept an `Integer
  skipThresholdOverride` parameter and resolve the effective threshold once, at job start, as
  `skipThresholdOverride != null ? skipThresholdOverride : refreshSkipThresholdMinutes`.
- **SERIES-052-AC-05** [AUTO]: `shouldSkip`/`runJob` shall use the resolved effective threshold for
  the entire run, not the constructor-injected `refreshSkipThresholdMinutes` field directly.
- **SERIES-052-AC-06** [AUTO]: A run started with an override does not change
  `refreshSkipThresholdMinutes`'s value for any subsequent run that doesn't itself pass an
  override — the injected default is read fresh (unmodified) on every `start()` call.
- **SERIES-052-AC-07** [AUTO]: An override of `0` (or negative) disables skipping entirely for that
  run, identically to `shouldSkip`'s existing behavior for a non-positive injected default
  (SERIES-018-AC-34).

---

### Requirement 3: Visibility into which threshold governed a run

**User story**: As a user whose "Refresh All" click skipped every series, I want to see what
threshold caused that, so a second click's silence is explained rather than opaque.

#### Acceptance Criteria

- **SERIES-052-AC-08** [AUTO]: `RefreshJobStatus` shall gain a 7th field,
  `int skipThresholdMinutesUsed`, alongside the existing `status, totalCount, completedCount,
  skippedCount, startedAt, finishedAt`.
- **SERIES-052-AC-09** [AUTO]: Before any job has ever run, `GET /api/v1/series/refresh-all/status`
  shall report `skipThresholdMinutesUsed` as the injected `refreshSkipThresholdMinutes` default
  (mirrors today's `IDLE`-with-zeroed-counts initial state, SERIES-018-AC-19).
- **SERIES-052-AC-10** [AUTO]: While a job is `IN_PROGRESS`, and once it reaches `COMPLETED` or
  `FAILED`, every `RefreshJobStatus` snapshot for that run shall report the *resolved* effective
  threshold used for that run (the override if one was passed, otherwise the injected default) —
  not the raw override value and not always the injected default.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Original bulk-refresh job, `BulkRefreshService`/`RefreshJobStatus`/`SeriesRefreshController`/`shouldSkip`'s existing "0 disables skipping" convention this spec extends | `series_spec_018_series_refresh.md` |
| Shared job-service plumbing (`start()`-guard, `AtomicReference<T> currentJob`, `status()`) this spec's `start` signature change builds on | `backend/src/main/java/uk/co/stefirby/seriestracker/service/AbstractPollingJobService.java` |
| The "0 disables the filter" precedent this spec's override reuses rather than inventing new validation | `series_spec_007_recommendation_sourcing.md` (SERIES-007-AC-25, `minVoteCount`) |
| Frontend consumer of this spec's new request/response shape | `frontend_spec_097_refresh_skip_threshold_override_ui.md` |
| Confirms no settings/preference persistence exists anywhere in this backend today (why this spec deliberately doesn't add one) | `backend/src/main/java/uk/co/stefirby/seriestracker/model/` (only `SeriesEntity`/`IgnoredSeriesEntity`/`KeywordEntity`), `backend/src/main/resources/db/migration/` |

---

## TDD Test Case Sketches

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/service/refresh/BulkRefreshServiceSpec.groovy` (additions)

```groovy
def "SERIES-052-AC-04/05: an override resolves the effective threshold for the whole run"() {
    given: "a series refreshed 30 minutes ago, and the injected default threshold is 60"
        def entity = seriesRepository.save(new SeriesEntity(title: "Show A", lastRefreshedAt: LocalDateTime.now(clock).minusMinutes(30)))

    when: "a run is started with an override of 10 minutes"
        service.start(10)
        awaitJobCompletion()

    then: "the series is NOT skipped -- 30 minutes is outside the 10-minute override"
        def status = service.status()
        status.skippedCount() == 0
        status.skipThresholdMinutesUsed() == 10
}

def "SERIES-052-AC-06: an override on one run does not change the injected default for the next"() {
    given: "a run started with an override of 5"
        service.start(5)
        awaitJobCompletion()

    when: "a second run is started with no override"
        service.start(null)
        awaitJobCompletion()

    then: "the second run's skipThresholdMinutesUsed reflects the injected default (60), not the prior override"
        service.status().skipThresholdMinutesUsed() == 60
}

def "SERIES-052-AC-07: an override of 0 disables skipping entirely for that run"() {
    given: "a series refreshed 1 minute ago"
        seriesRepository.save(new SeriesEntity(title: "Show A", lastRefreshedAt: LocalDateTime.now(clock).minusMinutes(1)))

    when: "a run is started with an override of 0"
        service.start(0)
        awaitJobCompletion()

    then: "the series is refreshed, not skipped"
        service.status().skippedCount() == 0
}

def "SERIES-052-AC-09: before any job has run, status reports the injected default as skipThresholdMinutesUsed"() {
    expect:
        service.status().skipThresholdMinutesUsed() == 60
}
```

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/controller/SeriesControllerRefreshSpec.groovy` (additions)

```groovy
def "SERIES-052-AC-02/03: refresh-all with no body behaves identically to today"() {
    when: "POST /refresh-all is requested with no body"
        def response = client.post().uri("/api/v1/series/refresh-all").exchange()

    then: "the response is 202 Accepted"
        response.expectStatus().isEqualTo(202)

    and: "bulkRefreshService.start was called with a null override"
        1 * bulkRefreshService.start(null) >> new RefreshJobStatus("IN_PROGRESS", 0, 0, 0, null, null, 60)
}

def "SERIES-052-AC-02: refresh-all with a body forwards the override"() {
    when: "POST /refresh-all is requested with {\"skipThresholdMinutesOverride\": 10}"
        def response = client.post().uri("/api/v1/series/refresh-all")
            .bodyValue('{"skipThresholdMinutesOverride": 10}')
            .exchange()

    then: "bulkRefreshService.start was called with 10"
        1 * bulkRefreshService.start(10) >> new RefreshJobStatus("IN_PROGRESS", 0, 0, 0, null, null, 10)
}
```

**Test Case (Green)**: implement `RefreshAllOptions`, the `start(Integer)` signature change, and
`RefreshJobStatus`'s new field until the specs above pass.

---

## Acceptance Criteria Summary

- [x] SERIES-052-AC-01: `RefreshAllOptions` record with nullable `skipThresholdMinutesOverride`
- [x] SERIES-052-AC-02: controller forwards the override to `BulkRefreshService.start`
- [x] SERIES-052-AC-03: no body / empty body is fully backward compatible
- [x] SERIES-052-AC-04: `start` resolves the effective threshold once, at job start
- [x] SERIES-052-AC-05: the resolved threshold (not the injected field) governs the whole run
- [x] SERIES-052-AC-06: an override doesn't persist past its own run
- [x] SERIES-052-AC-07: an override of 0 (or negative) disables skipping for that run
- [x] SERIES-052-AC-08: `RefreshJobStatus` gains `skipThresholdMinutesUsed`
- [x] SERIES-052-AC-09: pre-job state reports the injected default
- [x] SERIES-052-AC-10: in-progress/completed/failed states report the resolved value actually used
