# Tooling Spec 011: Dev-Server Debug Mode

**Status**: Done (2026-09-28). Implemented as written, with one correction found during
verification: Gradle's `--debug-jvm` defaults to `suspend=true` (blocks the forked JVM at the JDWP
handshake until a debugger attaches), which made `start-dev.sh`'s health check time out every time —
not caught by design review, only by actually running `start-dev.sh --debug` and watching it fail.
Fixed by pinning `debugOptions { suspend.set(false) }` on the `bootRun` task in
`backend/build.gradle.kts` (not originally planned as part of this spec's scope, but required to
make TOOLING-011-AC-02 actually true). Verified end-to-end, by direct execution: `start-dev.sh
--debug` (backend ready in ~6-8s, `:5005` confirmed `LISTENING` via `netstat`), `start-dev.sh
--debug` again against an already-running backend (idempotent-skip path prints the caveat),
`stop-dev.sh backend --debug`, `restart-dev.sh backend --debug`, and rejection of bogus arguments —
all behaved as specified. **Not independently verified**: the actual IntelliJ attach-and-hit-a-
breakpoint step in AC-02/AC-03's test cases requires a human at the IDE (no GUI access from this
session) — the mechanism it depends on (an open, non-suspended JDWP port; Vite serving sourcemapped
`.tsx`) is confirmed working, but the attach itself should get a real one-time check the next time
either debug path is actually used.
**Priority**: P3 (personal developer-experience tooling — doesn't touch shipped app behavior)
**Depends on**: `tooling_spec_009_dev_server_scripts.md` (extends `start-dev.sh`/`stop-dev.sh`/`restart-dev.sh`
and their shared `scripts/lib/dev-common.sh`, rather than introducing a parallel mechanism)
**Area**: Tooling (`scripts/`, `RUNBOOK.md`) — no backend/frontend source change

## Overview

There is currently no way to start the backend with a remote-debug port open, or to be pointed at
how to attach a debugger to the frontend, without reaching for the manual `gradlew.bat` command
each time or asking Claude. This spec adds an optional `--debug` flag to `start-dev.sh` (passed
through unchanged by `restart-dev.sh`, and tolerated as a no-op by `stop-dev.sh` so passthrough
doesn't break its argument validation):

- **Backend**: launches via `gradlew.bat bootRun --debug-jvm` instead of `gradlew.bat bootRun`,
  which opens a JDWP (Java Debug Wire Protocol) port on `5005`. Gradle's own `--debug-jvm` default is
  `server=true`, **`suspend=true`** — confirmed by direct testing, not assumed — which blocks the JVM
  at the JDWP handshake until a debugger attaches, meaning Spring never starts and
  `start-dev.sh`'s health check always times out. `backend/build.gradle.kts` pins
  `debugOptions { suspend.set(false) }` on the `bootRun` task so the script's flag actually works:
  the JVM starts immediately either way, and the debug port stays open for a debugger to attach at
  any later point. Any standard Java remote debugger can attach — IntelliJ's built-in **Remote JVM
  Debug** run configuration (no plugin, no extra scripts needed) is the primary target given this
  developer's toolchain.
- **Frontend**: there is no equivalent server-side "debug mode" — Vite's dev server already serves
  unminified, sourcemapped code by default, which is the actual thing that makes in-browser
  breakpoints work. `--debug` therefore changes nothing about how the frontend is launched; it only
  prints a pointer to how to actually attach a debugger to the running page (IntelliJ's built-in
  **JavaScript Debug** run configuration against `http://localhost:5173`, or a browser's own
  DevTools). Documented so this isn't left as a silent no-op the user has to infer.

**Verification note**: same posture as `tooling_spec_009` — no bash test runner exists for these
scripts, and introducing one for a single added flag is disproportionate. Every AC below is
`[MANUAL]`, verified by direct execution and an actual debugger attach against the real Windows/git
bash/IntelliJ environment.

## Design Decisions

- **One flag (`--debug`), not a separate `start-dev-debug.sh` script or a `backend`-only flag.**
  Keeps the existing `[backend|frontend|all]` positional argument's meaning unchanged and just adds
  an orthogonal modifier, consistent with how `restart-dev.sh` already composes with `stop-dev.sh` +
  `start-dev.sh` — no new script surface to keep in sync.
- **`--debug` is accepted in any position relative to the existing positional argument**
  (`start-dev.sh --debug backend`, `start-dev.sh backend --debug`, `start-dev.sh --debug`), parsed
  via a new shared `parse_args()` in `scripts/lib/dev-common.sh` rather than duplicating flag-parsing
  in three files.
- **`stop-dev.sh` accepts and silently ignores `--debug`.** It has no debug-specific behavior of its
  own (killing a debug-launched process is identical to killing a normal one — the JDWP port closes
  with the JVM), but `restart-dev.sh --debug` forwards `"$@"` unchanged to both `stop-dev.sh` and
  `start-dev.sh`, so `stop-dev.sh`'s own argument parsing must tolerate the flag rather than reject
  it as an invalid positional argument.
- **Port 5005, not a configurable one.** This is Gradle/Spring Boot's own well-known `--debug-jvm`
  default (matches `-agentlib:jdwp=...,address=5005`) — hardcoding it keeps the script and the
  documented IntelliJ run-configuration setup in sync with zero extra configuration surface. If a
  port conflict ever becomes a real problem (e.g. running two backend instances), that's a future
  spec, not a speculative option added now.
- **`suspend=false` pinned in `build.gradle.kts`, not left at Gradle's own default.** Found during
  verification, not planned upfront: `--debug-jvm`'s actual default is `suspend=true`, which parks
  the JVM at the JDWP handshake until a debugger attaches — Spring never starts, so
  `start-dev.sh`'s health check always times out. A `suspend=true` workflow (attach before any code
  runs) is a legitimate debugging style in general, but it's incompatible with this project's
  background-launch-then-health-check script design specifically, so `suspend=false` is the right
  call here: the debug port is still open the whole time the backend runs, a debugger can attach at
  any point after startup (not just at the very first line), and breakpoints still work identically
  once attached — the only thing lost is "pause on the very first bytecode instruction before
  `main()` runs," which isn't a need this project's controller/service-level debugging has.
- **No `.idea/` run-configuration files committed.** IntelliJ run configurations are per-developer
  environment setup, not project source — `RUNBOOK.md` documents the two-minute manual setup
  (Remote JVM Debug: host `localhost`, port `5005`; JavaScript Debug: URL `http://localhost:5173`)
  instead of checking in `.idea/runConfigurations/*.xml`, consistent with this repo not otherwise
  tracking IDE-specific project files.
- **`--debug-jvm` only, no `--continuous` interaction handled specially.** `RUNBOOK.md`'s existing
  `--continuous`/devtools hot-reload guidance and this flag are independent; a developer wanting both
  can combine `gradlew.bat bootRun --debug-jvm --continuous` manually, but wiring that combination
  into the script is unrequested scope — the flag this spec adds maps to a single, well-defined
  Gradle invocation.

---

## Requirement 1: Shared flag parsing

**User story**: As a developer maintaining these scripts, I want `--debug` parsed once, not
duplicated across `start-dev.sh`/`stop-dev.sh`/`restart-dev.sh`.

### TOOLING-011-AC-01 [MANUAL]
**Statement**: The `scripts/lib/dev-common.sh` library shall provide `parse_args(...)`, which sets
`TARGET` (`all`/`backend`/`frontend`, default `all`) and `DEBUG_MODE` (`0`/`1`, default `0`) from any
combination and order of a `backend`/`frontend`/`all` positional argument and a `--debug` flag,
returning failure (without setting either variable to a guessed value) on any other argument.

**References**: consumed by `start-dev.sh`, `stop-dev.sh`, `restart-dev.sh`'s argument handling
(Requirements 2–4).

**Test Case (Manual)**: `parse_args --debug backend` and `parse_args backend --debug` both yield
`TARGET=backend`, `DEBUG_MODE=1`; `parse_args` (no args) yields `TARGET=all`, `DEBUG_MODE=0`;
`parse_args bogus` returns non-zero.

---

## Requirement 2: `start-dev.sh --debug`

**User story**: As a developer, I want to start the backend with a debug port open (and be told how
to attach to the frontend) without hand-typing the Gradle flag or looking up the IntelliJ setup each
time.

### TOOLING-011-AC-02 [MANUAL]
**Statement**: When `--debug` is passed and the backend is being started (not already running),
`start-dev.sh` shall launch it via `gradlew.bat bootRun --debug-jvm` instead of `gradlew.bat
bootRun`; once the health-check succeeds, it shall additionally print that the JDWP debug port
(`5005`) is listening and that IntelliJ's Remote JVM Debug run configuration (host `localhost`, port
`5005`) can attach to it.

**References**: Gradle's `--debug-jvm` convention (port `5005`, `server=true`); `bootRun`'s
`suspend=false` pin in `build.gradle.kts` (Design Decisions), without which this AC's health-check
timing could never actually succeed; `RUNBOOK.md`'s new Debugging section (Requirement 4).

**Test Case (Manual)**: `bash scripts/start-dev.sh backend --debug`, then confirm `netstat -ano |
grep 5005` shows a `LISTENING` entry once the backend reports ready (verified: ready in ~6-8s, same
order as a non-debug start), and that IntelliJ's Remote JVM Debug run configuration (host
`localhost`, port `5005`) attaches successfully and a breakpoint in a controller method is hit on
the next matching request.

---

### TOOLING-011-AC-03 [MANUAL]
**Statement**: When `--debug` is passed and the frontend is being started (not already running),
`start-dev.sh` shall launch it exactly as it would without the flag (no change to the `npm run dev`
invocation); once the health-check succeeds, it shall additionally print that the dev server already
serves debuggable (unminified, sourcemapped) code and point to IntelliJ's JavaScript Debug run
configuration (URL `http://localhost:5173`) or direct browser DevTools as how to actually attach.

**References**: Vite's default dev-mode behavior (no build step, inline sourcemaps); `RUNBOOK.md`'s
new Debugging section (Requirement 4).

**Test Case (Manual)**: `bash scripts/start-dev.sh frontend --debug` starts the frontend identically
to a plain `start-dev.sh frontend` (same process, same port), and prints the attach-pointer message;
separately, confirm a breakpoint set in a `.tsx` source file (not the transpiled output) via
IntelliJ's JavaScript Debug run configuration against `http://localhost:5173` is actually hit when
that code path runs in the opened browser tab.

---

### TOOLING-011-AC-04 [MANUAL]
**Statement**: `start-dev.sh`'s existing idempotent-skip behavior (a target already running is left
untouched with a message, per `TOOLING-009-AC-05`) shall apply unchanged when `--debug` is passed —
`start-dev.sh` shall not attempt to relaunch an already-running service just to add a debug port,
and shall say so (e.g. noting the running instance may not have debug enabled) rather than silently
implying it does.

**References**: `TOOLING-009-AC-05`'s idempotent-start behavior, which this AC extends rather than
overrides.

**Test Case (Manual)**: with the backend already running (started without `--debug`), run `bash
scripts/start-dev.sh backend --debug` — it reports "already running — skipping" (as today) plus a
note that the running instance wasn't started with `--debug-jvm`, so its debug port isn't open;
`netstat -ano | grep 5005` shows nothing listening.

---

## Requirement 3: `stop-dev.sh`/`restart-dev.sh` tolerate `--debug`

**User story**: As a developer, I want `restart-dev.sh --debug` to work as a single command, without
`stop-dev.sh` rejecting the flag it doesn't itself need.

### TOOLING-011-AC-05 [MANUAL]
**Statement**: `stop-dev.sh` shall accept `--debug` (via the shared `parse_args`) without error,
ignoring it entirely — stopping a debug-launched service is identical to stopping a normal one.

**References**: `parse_args` (Requirement 1).

**Test Case (Manual)**: with the backend running via `start-dev.sh backend --debug`, `bash
scripts/stop-dev.sh backend --debug` stops it exactly as `bash scripts/stop-dev.sh backend` would.

---

### TOOLING-011-AC-06 [MANUAL]
**Statement**: `restart-dev.sh --debug` (with or without a `backend`/`frontend` argument) shall stop
then start the target(s), with the restarted service(s) launched in debug mode per Requirement 2 —
no logic duplicated from `start-dev.sh`/`stop-dev.sh` beyond the existing pure-wrapper pattern
(`TOOLING-009-AC-12`).

**References**: `TOOLING-009-AC-12`.

**Test Case (Manual)**: `bash scripts/restart-dev.sh backend --debug` stops the backend (if running)
and restarts it with the debug port open, confirmed via the same `netstat`/attach check as
`TOOLING-011-AC-02`.

---

## Requirement 4: Documentation

**User story**: As a developer, I want the one-time IntelliJ setup written down, not something I have
to reconstruct or ask for each time.

### TOOLING-011-AC-07 [MANUAL]
**Statement**: `RUNBOOK.md`'s "Quick Start (scripts)" section shall document the `--debug` flag's
usage, and a new "Debugging" subsection shall document the one-time IntelliJ setup: a Remote JVM
Debug run configuration (host `localhost`, port `5005`) for the backend, and a JavaScript Debug run
configuration (URL `http://localhost:5173`) for the frontend — stating explicitly that the frontend
needs no server-side debug flag, only the dev server running.

**References**: `RUNBOOK.md`'s existing "Quick Start (scripts)" and "Running the Backend/Frontend
Locally" sections, which this extends rather than duplicates.

**Test Case (Manual)**: visual review — `RUNBOOK.md` documents both flows clearly enough to follow
without asking Claude, and doesn't contradict the manual `gradlew.bat bootRun --debug-jvm` command
already implicitly available (per `--debug-jvm` being a stock Gradle flag).

---

## Cross-References

| This spec | Source |
|---|---|
| The scripts and shared helper library this spec extends | `tooling_spec_009_dev_server_scripts.md` |
| Gradle's `--debug-jvm` convention (port 5005, server=true); its actual `suspend=true` default, confirmed by direct testing, and why `build.gradle.kts` overrides it | Gradle `JavaExec`/`BootRun` task documentation; Design Decisions above |
| Backend health-check this spec's timing assumption (suspend=false, no block on attach) relies on | `TOOLING-009-AC-05`, `wait_for_health` |
| Existing `--continuous`/devtools hot-reload guidance, deliberately not combined here | `RUNBOOK.md`, "Running the Backend Locally" |

---

## Acceptance Criteria Summary

- [x] TOOLING-011-AC-01: `parse_args` shared helper (`TARGET`/`DEBUG_MODE`, order-independent)
- [x] TOOLING-011-AC-02: `start-dev.sh --debug` launches backend via `--debug-jvm`, reports port 5005
- [x] TOOLING-011-AC-03: `start-dev.sh --debug` frontend unchanged launch + attach-pointer message
- [x] TOOLING-011-AC-04: idempotent-skip path notes the running instance may not have debug open
- [x] TOOLING-011-AC-05: `stop-dev.sh` tolerates and ignores `--debug`
- [x] TOOLING-011-AC-06: `restart-dev.sh --debug` restarts with debug mode applied, no duplicated logic
- [x] TOOLING-011-AC-07: `RUNBOOK.md` documents the flag and the one-time IntelliJ setup
