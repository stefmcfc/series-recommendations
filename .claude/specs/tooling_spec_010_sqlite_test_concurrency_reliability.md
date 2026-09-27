# Tooling Spec 010: SQLite Busy-Timeout, Single-Connection Pooling, and Per-Context Test Database Isolation (Pipeline Reliability)

**Status**: Done (2026-09-28). Implemented as written. `TOOLING-010-AC-02`'s verification approach
was chosen (not fully pinned in the original AC) as a plain, no-Spring-context Groovy spec parsing
`src/main/resources/application.yml` directly via SnakeYaml — deliberately avoiding booting a real
context under the default profile, which would point a live `HikariDataSource` (and Flyway) at this
developer's actual `./data/series.db`. Verification: `gradlew.bat test` run 5 consecutive times,
all green, zero `SQLITE_BUSY`/`CannotAcquireLockException` in any run; confirmed all 5 isolated
`build/test-dbs/<ClassName>.db` files are created as expected.
**Priority**: P2 (intermittently blocks every push — the pre-push hook runs the full backend suite,
and CI's `backend` job runs the same `gradle check`)
**Depends on**: none — infra/config fix, not a refactor of existing behavior
**Area**: Backend only (`application.yml`, `src/test/resources/application.yml`, 5 existing
`@MockitoBean`-bearing Spock specs, one new small test-only utility class) — no frontend change in
this spec (see Design Decisions for why the Vitest-side flake observed the same evening is
deliberately **not** included here)

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
- 35 spec files use `@SpringBootTest`. Their exact combination of `@AutoConfigureMockMvc` (20 of the
  35) and `@MockitoBean`/`@MockBean` (5 of the 35, all also `@AutoConfigureMockMvc`:
  `SeriesControllerLookupSpec`, `SeriesControllerRecommendationsSpec`, `SeriesControllerRefreshSpec`,
  `SeriesControllerWatchProvidersSpec`, `GlobalExceptionHandlerSpec`) each change Spring's test-context
  cache key, producing several distinct groups: the 15 plain `@AutoConfigureMockMvc`-only specs share
  one context; the 15 `@SpringBootTest`-only (no `@AutoConfigureMockMvc`) service/model specs share a
  second; and each of the 5 `@MockitoBean`-bearing specs gets its own effectively-unique context
  (distinct mocked collaborator(s) per class). Spring's default test-context cache (max size 32, well
  above what this project uses) never evicts any of them mid-run, so **all of these distinct
  ApplicationContexts stay alive simultaneously for the entire test run** — confirmed directly in the
  `gradlew.bat test` log, where 8 separate `HikariPool-N` instances all shut down together only at JVM
  exit, not incrementally as specs finished.
- Each of those contexts gets its own `HikariDataSource`, defaulting to Hikari's own
  `maximum-pool-size: 10` (never overridden anywhere in this project) — every one of them pointed at
  the *same* physical SQLite file.
- Neither `application.yml` configures a `busy_timeout` pragma. SQLite's default `busy_timeout` is
  `0`: a second connection attempting to write (or even read, during another connection's write
  transaction, under SQLite's default rollback-journal locking) fails **immediately** with
  `SQLITE_BUSY` rather than waiting/retrying. With up to 8 pools of up to 10 connections each
  theoretically live against one file, any two connections — even from the *same* context's own
  oversized pool (Hikari's background housekeeper thread validates idle connections independently of
  the foreground test thread) — can collide this way. This alone is enough to explain the observed
  failures, at a cleanup-phase `delete`/an insert into `keyword`; the *cross-context* sharing
  (multiple genuinely distinct contexts all pointed at one file with no reason to share data at all)
  is a second, independent, compounding source of the same collision, and unlike the pool-size
  question, isn't inherent to using SQLite at all — it's an artifact of this project's tests
  incidentally sharing infrastructure they have no reason to share.

Both mechanisms have standard, low-risk fixes, and they're complementary rather than alternatives:

1. **Cap the pool and give SQLite a real `busy_timeout`** (Requirement 1) — converts any remaining
   collision, wherever it comes from, into a bounded wait instead of an instant failure. Applying
   this to the **production** datasource too (not just the test profile) is a genuine robustness
   improvement in its own right — `BulkRefreshService`'s per-series refresh loop plus any concurrent
   request from the browser is the same single-writer contention risk, just far less frequently
   triggered than 8 simultaneous test contexts.
2. **Give the already-separately-cached `@MockitoBean` contexts their own isolated database files**
   (Requirement 2) — removes the cross-context sharing case entirely for the 5 contexts where it's
   cheap to do so (see Design Decisions for why this is deliberately *not* extended to the two larger
   shared "vanilla" groups).

**Verification note**: the actual race (two specific connections landing on the SQLite file in the
same instant) can't be deterministically triggered in a unit test — the original failure itself was
intermittent, not reproducible on demand. Every AC below is thus verified by asserting the
*configuration* directly (the thing that's actually within this spec's control), `[AUTO]`, plus one
`[MANUAL]` AC re-running the full suite repeatedly to build empirical confidence the fix holds,
mirroring `tooling_spec_009`'s precedent for a justified `[MANUAL]` AC where the underlying mechanism
isn't meaningfully unit-testable.

## Design Decisions

- **`maximum-pool-size: 1`, not a smaller-but-still-multi-connection value.** SQLite only ever
  services one writer at a time regardless of pool size — a pool of 2+ connections against it
  provides no real concurrency benefit (a second connection can't write while the first holds the
  lock either way) and only adds the collision surface this spec is removing. Capping to exactly 1
  removes the possibility of two connections from the *same* context racing each other via Hikari's
  own housekeeping thread, and combined with `busy_timeout`, lets Hikari's own connection-checkout
  queue (not SQLite's instant failure) absorb any remaining cross-context contention too.
- **`busy_timeout=30000` (30s), applied via the JDBC URL** (`org.xerial:sqlite-jdbc` accepts SQLite
  pragma names as URL query parameters, e.g. `jdbc:sqlite:./data/series.db?busy_timeout=30000`) —
  30s is a wait *ceiling*, not a fixed delay; a connection that acquires the lock in 5ms still
  returns in 5ms. Generous specifically because the failure observed was contention between multiple
  cached test contexts' pools, not a single slow query — there's no scenario in this app where a
  single write legitimately holds the lock anywhere near that long, so the ceiling itself is
  effectively free.
- **Both `application.yml` (production) and `src/test/resources/application.yml` (test) get the
  identical `busy_timeout`/pool-size change** — the mechanism (single-writer SQLite behind a
  connection pool) is identical in both; only the frequency of real contention differs.
- **Per-context database isolation (Requirement 2) is applied only to the 5 already-uniquely-cached
  `@MockitoBean`-bearing specs, not to the two larger shared "vanilla" groups (15 +
  15 specs).** Those 5 already get their own dedicated `ApplicationContext` each today (their mocked
  collaborator(s) differ, so Spring can't share a cached context between them regardless of what this
  spec does) — giving each its own database file costs **zero** extra context startups, since the
  isolation already exists at the context level; only the shared-file part of the picture changes.
  Doing the same for the 15+15 "vanilla" specs would require either (a) accepting up to 30 separate
  context startups instead of 2 (a real, measurable suite-runtime cost, since each `@SpringBootTest`
  context boot is not free) to get per-*class* isolation, or (b) a materially more complex mechanism
  to give context-*group* isolation without also fragmenting Spring's own cache groupings — neither
  is justified once Requirement 1's `busy_timeout`/pool-size fix already covers the residual risk for
  those two groups (each remains a single pool of 1 connection against its own already-fine
  shared file, exactly as it is today, just protected by a real busy_timeout now).
- **Isolated filenames are deterministic (derived from the test class's own simple name), not
  random.** A `@DynamicPropertySource` value that changed per test run (e.g. a fresh UUID) would risk
  interacting unpredictably with Spring's own context-cache key computation. Deriving the filename
  from something already fixed and already part of why that class gets its own context (its own
  identity) avoids that risk entirely and keeps the mechanism simple to reason about: the same class
  always resolves to the same file, every run.
- **A plain static helper (`IsolatedTestDatabase.urlFor(Class<?>)`), not a shared trait/base-class
  `@DynamicPropertySource` method.** `@DynamicPropertySource` methods are static and receive no
  reference to the test class being configured, so a single inherited method has no way to
  differentiate which of several subclasses is invoking it. Each of the 5 specs instead declares its
  own one-line `@DynamicPropertySource` method calling the shared helper with its own class literal
  explicitly — a few lines duplicated across 5 files, but explicit and impossible to misapply, versus
  a cleverer shared mechanism that would need reflection/stack-inspection to work at all.
- **New isolated files live under `backend/build/test-dbs/`** — already covered by
  `backend/.gitignore`'s existing `build/` rule (confirmed directly; no new `.gitignore` entry
  needed), and cleaned automatically by `gradle clean` along with everything else under `build/`. The
  helper creates this directory on demand (`mkdirs()`) if absent, since `org.xerial:sqlite-jdbc` does
  not create missing parent directories itself.
- **Vitest's own worker-thread flake (`SettingsPage.test.tsx`, hit the same evening) is deliberately
  left out of this spec.** Unlike the SQLite case, there's no equivalent smoking-gun log evidence for
  its root cause — it reproduces only under full-suite parallel-worker CPU contention, never in
  isolation, and a previous mitigation (raising `testTimeout` to 10s, already shipped) reduced but
  didn't eliminate it. The candidate fix (bounding Vitest's `poolOptions.threads.maxThreads`) has a
  real speed-vs-reliability trade-off across the whole 74-file suite that deserves its own
  investigation and the user's own call, not a bundled-in guess alongside a well-evidenced, unrelated
  backend fix. Logged instead as its own entry in `.claude/SPEC_CANDIDATES.md`, to revisit if it's
  still recurring once this backend fix has shipped.
- **No change to `ddl-auto`/Flyway/`show-sql` or any other existing datasource property** beyond the
  URL query string and the new `hikari.maximum-pool-size` line — `create-drop` on each of the 5 newly
  isolated files means each gets a fresh schema on every context startup, same as the shared file does
  today.

---

## Requirement 1: SQLite datasources get a real busy-timeout and a single-connection pool

**User story**: As a developer, I want `gradlew.bat test` (and CI's equivalent `gradle check`) to
stop intermittently failing with `SQLITE_BUSY`, so a push isn't blocked by a failure that has nothing
to do with the change being pushed.

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

## Requirement 2: isolated database files for already-uniquely-cached test contexts

**User story**: As a developer, I want the 5 spec classes that already get their own dedicated Spring
context (because they mock a unique collaborator) to stop sharing a database file with everything
else, at zero extra context-startup cost, so the busiest/most distinct part of the suite has no
cross-context collision surface left at all.

### TOOLING-010-AC-03 [AUTO]
**Statement**: A new test-only helper, `IsolatedTestDatabase.urlFor(Class<?> testClass)`, shall
return a SQLite JDBC URL unique to that class
(`jdbc:sqlite:./build/test-dbs/<testClass.simpleName>.db?busy_timeout=30000`), creating
`build/test-dbs/` first if it does not already exist.

**References**: new `src/test/groovy/uk/co/stefirby/seriestracker/config/IsolatedTestDatabase.groovy`.

**Test Case (Red)**:
```groovy
package uk.co.stefirby.seriestracker.config

import spock.lang.Specification

class IsolatedTestDatabaseSpec extends Specification {

  def "TOOLING-010-AC-03: url is derived from the class's simple name and creates the parent dir"() {
    given:
        new File("build/test-dbs").deleteDir()

    when:
        def url = IsolatedTestDatabase.urlFor(IsolatedTestDatabaseSpec)

    then:
        url == "jdbc:sqlite:./build/test-dbs/IsolatedTestDatabaseSpec.db?busy_timeout=30000"
        new File("build/test-dbs").exists()
  }
}
```
**Test Case (Green)**: implement `IsolatedTestDatabase.urlFor` as described.

---

### TOOLING-010-AC-04 [AUTO]
**Statement**: Each of the 5 `@MockitoBean`-bearing specs (`SeriesControllerLookupSpec`,
`SeriesControllerRecommendationsSpec`, `SeriesControllerRefreshSpec`,
`SeriesControllerWatchProvidersSpec`, `GlobalExceptionHandlerSpec`) shall declare a local
`@DynamicPropertySource` method that sets `spring.datasource.url` to
`IsolatedTestDatabase.urlFor(<ThatClass>)`, so each runs against its own file instead of the shared
`./build/test-series.db`.

**References**: the 5 spec files listed above; `IsolatedTestDatabase.urlFor` (AC-03).

**Test Case (Red)**: for one representative class (`SeriesControllerLookupSpec`), assert its
`HikariDataSource.jdbcUrl` (autowired within that spec) ends with
`test-dbs/SeriesControllerLookupSpec.db?busy_timeout=30000`, not `test-series.db`.

**Test Case (Green)**: add to each of the 5 classes:
```groovy
@DynamicPropertySource
static void isolatedDatabase(DynamicPropertyRegistry registry) {
  registry.add("spring.datasource.url", { -> IsolatedTestDatabase.urlFor(SeriesControllerLookupSpec) })
}
```
(substituting that class's own literal in place of `SeriesControllerLookupSpec` in each file).

---

### TOOLING-010-AC-05 [MANUAL]
**Statement**: Running the full backend suite (`gradlew.bat test`) 5 times consecutively shall
produce zero `SQLITE_BUSY`/`CannotAcquireLockException` failures across all 5 runs.

**References**: the original failing runs (`SeriesControllerImportSpec`,
`SeriesControllerKeywordsSpec`) this spec exists to fix; both Requirement 1 and Requirement 2
contribute to this outcome.

**Test Case (Manual)**: `for i in 1 2 3 4 5; do ./gradlew.bat test --rerun; done` (or equivalent) —
all 5 runs green, no `SQLITE_BUSY` in any run's output.

---

## Cross-References

| This spec | Source |
|---|---|
| The two flakes that prompted this investigation | `frontend_spec_136`'s push/merge session, 2026-09-27 |
| Precedent for a justified `[MANUAL]` AC verified by direct re-execution rather than an automated test | `tooling_spec_009_dev_server_scripts.md`, `TOOLING-009-AC-01` |
| Frontend Vitest worker-thread flake, deliberately out of scope here | `.claude/SPEC_CANDIDATES.md`'s "Bound Vitest's worker thread pool" candidate; `CHANGELOG.md`'s existing `testTimeout` 10s entry |
| Async work that makes production (not just test) contention a real, if rarer, possibility | `BulkRefreshService` (`series_spec_018_series_refresh.md`) |
| The 5 specs Requirement 2 touches, and why they're already separately cached | Direct grep of `@MockitoBean`/`@MockBean` usage across `backend/src/test/groovy`, 2026-09-27 |

---

## Acceptance Criteria Summary

- [x] TOOLING-010-AC-01: test datasource gets `busy_timeout=30000` + `maximum-pool-size: 1`
- [x] TOOLING-010-AC-02: production datasource gets the identical change
- [x] TOOLING-010-AC-03: `IsolatedTestDatabase.urlFor(Class)` helper, deterministic per-class URL + dir creation
- [x] TOOLING-010-AC-04: the 5 `@MockitoBean`-bearing specs each use their own isolated database file
- [x] TOOLING-010-AC-05: 5 consecutive full local test runs, zero `SQLITE_BUSY` failures
