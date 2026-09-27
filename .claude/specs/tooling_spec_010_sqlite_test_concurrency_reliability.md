# Tooling Spec 010: SQLite Busy-Timeout and Single-Connection Pooling (Pipeline Reliability)

**Status**: Not started
**Priority**: P2 (intermittently blocks every push — the pre-push hook runs the full backend suite,
and CI's `backend` job runs the same `gradle check`)
**Depends on**: none — infra/config fix, not a refactor of existing behavior
**Area**: Backend only (`application.yml`, `src/test/resources/application.yml`) — no frontend
change in this spec (see Design Decisions for why the Vitest-side flake observed the same evening
is deliberately **not** included here)

## Overview

Raised while investigating two test-suite flakes hit back-to-back during `frontend_spec_136`'s
push/merge (2026-09-27): a frontend `SettingsPage.test.tsx` timeout (pre-existing, already mitigated
by a raised `testTimeout` — see `CHANGELOG.md`'s `3.6x` entry) and, separately, a **backend**
failure never seen before — `SeriesControllerImportSpec`/`SeriesControllerKeywordsSpec` failing with
`org.springframework.dao.CannotAcquireLockException: [SQLITE_BUSY] The database file is locked`
during a routine `gradlew.bat test` run, both locally (husky pre-push) and reproducible.

Root cause, confirmed via direct log/config inspection, not guessed:

- Every Spock spec in this project runs against **one shared, on-disk SQLite file**
  (`backend/src/test/resources/application.yml`: `jdbc:sqlite:./build/test-series.db` for the whole
  test run; production is the same pattern against `./data/series.db`).
- 35 spec files use `@SpringBootTest`; 7 of them additionally use `@MockitoBean`/`@MockBean`, which
  changes Spring's test-context cache key. Spring's default test-context cache (max size 32, well
  above what this project uses) never evicts any of them mid-run, so **all 8 distinct
  ApplicationContexts stay alive simultaneously for the entire test run** — confirmed directly in
  the `gradlew.bat test` log, where `HikariPool-1` through `HikariPool-8` all shut down together only
  at JVM exit, not incrementally as specs finished.
- Each of those 8 contexts gets its own `HikariDataSource`, defaulting to Hikari's own
  `maximum-pool-size: 10` (never overridden anywhere in this project) — all 8 pools pointed at the
  *same* physical SQLite file.
- Neither `application.yml` configures a `busy_timeout` pragma. SQLite's default `busy_timeout` is
  `0`: a second connection attempting to write while another connection holds the file lock fails
  **immediately** with `SQLITE_BUSY` rather than waiting/retrying. With up to 8 pools of up to 10
  connections each theoretically live against one file, any two connections from *different*
  contexts (e.g. one pool's Hikari keepalive/validation query landing at the same instant as
  another's active write) can collide this way — exactly the observed failure, at a cleanup-phase
  `delete`/an insert into `keyword`.

This is a well-known failure mode for SQLite behind a connection pool (SQLite is fundamentally a
single-writer database; pooling more than one connection against it — let alone 8 pools of 10 — adds
concurrency risk with no corresponding benefit) and has a standard, low-risk fix: cap the pool to a
single connection and give SQLite a real `busy_timeout` to wait/retry against instead of failing
instantly. Applying this to the **production** datasource too (not just the test profile) is a
genuine robustness improvement in its own right — `BulkRefreshService`'s per-series refresh loop
plus any concurrent request from the browser is the same single-writer contention risk, just less
frequently triggered than 8 simultaneous test contexts.

**Verification note**: the actual race (two specific connections landing on the SQLite file in the
same instant) can't be deterministically triggered in a unit test — the original failure itself was
intermittent, not reproducible on demand. Every AC below is thus verified by asserting the
*configuration* directly (the thing that's actually within this spec's control), `[AUTO]`, plus one
`[MANUAL]` AC re-running the full suite repeatedly to build empirical confidence the fix holds, mirroring
`tooling_spec_009`'s precedent for a justified `[MANUAL]` AC where the underlying mechanism isn't
meaningfully unit-testable.

## Design Decisions

- **`maximum-pool-size: 1`, not a smaller-but-still-multi-connection value.** SQLite only ever
  services one writer at a time regardless of pool size — a pool of 2+ connections against it
  provides no real concurrency benefit (a second connection can't write while the first holds the
  lock either way) and only adds the collision surface this spec is removing. Capping to exactly 1
  removes the possibility of two connections from the *same* context racing each other, and combined
  with `busy_timeout`, lets Hikari's own connection-checkout queue (not SQLite's instant failure)
  absorb contention *across* the 8 separately-cached test contexts too.
- **`busy_timeout=30000` (30s), applied via the JDBC URL** (`org.xerial:sqlite-jdbc` accepts SQLite
  pragma names as URL query parameters, e.g. `jdbc:sqlite:./data/series.db?busy_timeout=30000`) —
  30s is a wait *ceiling*, not a fixed delay; a connection that acquires the lock in 5ms still
  returns in 5ms. Generous specifically because the failure observed was contention between multiple
  cached test contexts' pools, not a single slow query — there's no scenario in this app where a
  single write legitimately holds the lock anywhere near that long, so the ceiling itself is
  effectively free.
- **Both `application.yml` (production) and `src/test/resources/application.yml` (test) get the
  identical change.** The mechanism (single-writer SQLite behind a connection pool) is identical in
  both; the only difference is how often multiple live connections actually contend for it (test:
  guaranteed, 8 cached contexts every run; production: only if `BulkRefreshService`'s async work and
  a concurrent browser request genuinely overlap) — but the fix and its cost are the same in both, so
  there's no reason to leave production on the fragile default.
- **Vitest's own worker-thread flake (`SettingsPage.test.tsx`, hit the same evening) is deliberately
  left out of this spec.** Unlike the SQLite case, there's no equivalent smoking-gun log evidence for
  its root cause — it reproduces only under full-suite parallel-worker CPU contention, never in
  isolation, and a previous mitigation (raising `testTimeout` to 10s, already shipped) reduced but
  didn't eliminate it. The candidate fix (bounding Vitest's `poolOptions.threads.maxThreads`) has a
  real speed-vs-reliability trade-off across the whole 74-file suite that deserves its own
  investigation and the user's own call, not a bundled-in guess alongside a well-evidenced, unrelated
  backend fix. Logged instead as its own entry in `.claude/SPEC_CANDIDATES.md`, to revisit if it's
  still recurring once this backend fix has shipped (worth re-checking after, since eliminating the
  backend flake also removes one source of overall pre-push friction/impatience that might otherwise
  get misattributed to the frontend side).
- **No change to `ddl-auto`/Flyway/`show-sql` or any other existing datasource property** — this
  spec touches only the URL's query string and the new `hikari.maximum-pool-size` line in each of the
  two files, nothing else in either `spring.datasource`/`spring.jpa` block.

---

## Requirement 1: SQLite datasources get a real busy-timeout and a single-connection pool

**User story**: As a developer, I want `gradlew.bat test` (and CI's equivalent `gradle check`) to
stop intermittently failing with `SQLITE_BUSY` from Spring's own test-context caching, so a push
isn't blocked by a failure that has nothing to do with the change being pushed.

### TOOLING-010-AC-01 [AUTO]
**Statement**: The test datasource (`src/test/resources/application.yml`) shall configure a
`busy_timeout` of `30000` on its SQLite JDBC URL and a Hikari `maximum-pool-size` of `1`.

**References**: `src/test/resources/application.yml` (`spring.datasource.url`,
new `spring.datasource.hikari.maximum-pool-size`).

**Test Case (Red)**:
```groovy
package uk.co.stefirby.seriestracker.config

import com.zaxxer.hikari.HikariDataSource
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import spock.lang.Specification

@SpringBootTest
@ActiveProfiles("test")
class DataSourceConfigSpec extends Specification {

  @Autowired
  HikariDataSource dataSource

  def "TOOLING-010-AC-01: test datasource has a busy_timeout and a single-connection pool"() {
    expect:
        dataSource.jdbcUrl.contains("busy_timeout=30000")
        dataSource.maximumPoolSize == 1
  }
}
```
**Test Case (Green)**: append `?busy_timeout=30000` to the test datasource's URL and add
`spring.datasource.hikari.maximum-pool-size: 1` to `src/test/resources/application.yml`.

---

### TOOLING-010-AC-02 [AUTO]
**Statement**: The production datasource (`src/main/resources/application.yml`) shall configure the
identical `busy_timeout=30000` and `maximum-pool-size: 1`.

**References**: `src/main/resources/application.yml` (`spring.datasource.url`, new
`spring.datasource.hikari.maximum-pool-size`).

**Test Case (Red)**: the same `DataSourceConfigSpec` shape as AC-01, run instead under the default
(non-`test`) profile — e.g. a second test class (or `@ActiveProfiles` variant) asserting against
`src/main/resources/application.yml`'s values without the `test` profile active.

**Test Case (Green)**: append `?busy_timeout=30000` to the production datasource's URL and add
`spring.datasource.hikari.maximum-pool-size: 1` to `src/main/resources/application.yml`.

---

### TOOLING-010-AC-03 [MANUAL]
**Statement**: Running the full backend suite (`gradlew.bat test`) 5 times consecutively shall
produce zero `SQLITE_BUSY`/`CannotAcquireLockException` failures across all 5 runs.

**References**: the original failing runs (`SeriesControllerImportSpec`,
`SeriesControllerKeywordsSpec`) this spec exists to fix.

**Test Case (Manual)**: `for i in 1 2 3 4 5; do ./gradlew.bat test --rerun; done` (or equivalent) —
all 5 runs green, no `SQLITE_BUSY` in any run's output.

---

## Cross-References

| This spec | Source |
|---|---|
| The two flakes that prompted this investigation | `frontend_spec_136`'s push/merge session, 2026-09-27 |
| Precedent for a justified `[MANUAL]` AC verified by direct re-execution rather than an automated test | `tooling_spec_009_dev_server_scripts.md`, `TOOLING-009-AC-01` |
| Frontend Vitest worker-thread flake, deliberately out of scope here | `.claude/SPEC_CANDIDATES.md`'s new "Bound Vitest's worker thread pool" candidate; `CHANGELOG.md`'s existing `testTimeout` 10s entry |
| Async work that makes production (not just test) contention a real, if rarer, possibility | `BulkRefreshService` (`series_spec_018_series_refresh.md`) |

---

## Acceptance Criteria Summary

- [ ] TOOLING-010-AC-01: test datasource gets `busy_timeout=30000` + `maximum-pool-size: 1`
- [ ] TOOLING-010-AC-02: production datasource gets the identical change
- [ ] TOOLING-010-AC-03: 5 consecutive full local test runs, zero `SQLITE_BUSY` failures
