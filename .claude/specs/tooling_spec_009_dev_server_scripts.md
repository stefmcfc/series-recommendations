# Tooling Spec 009: Dev-Server Start/Stop/Restart Scripts

**Status**: Implemented
**Priority**: P3 (personal developer-experience tooling — doesn't touch shipped app behavior)
**Depends on**: none — new standalone tooling, not a refactor of existing code
**Area**: Tooling (new `scripts/` directory; not backend, not frontend)

## Overview

There is currently no way to start or stop the two local dev servers (backend `gradlew.bat
bootRun` on `:8080`, frontend `npm run dev` on `:5173`) other than running RUNBOOK.md's manual
commands in two separate terminal windows, or asking Claude to do it. This spec adds three bash
scripts (`start-dev.sh`, `stop-dev.sh`, `restart-dev.sh`, backed by a shared
`scripts/lib/dev-common.sh`) runnable via git bash on this Windows machine, launching both servers
in the background with output captured to log files, so the user can start/stop/restart them
without help each time.

**Verification note**: this repo has no bash test runner (no `bats-core` or equivalent), and
introducing one for three small scripts used by a single developer is disproportionate. Every AC
below is therefore `[MANUAL]`, verified by direct execution against the real Windows/git-bash
environment (the thing that actually matters here — port binding, `taskkill` behavior, and Gradle
Daemon interaction can't be meaningfully unit-tested without emulating all three). This mirrors
`TOOLING-008-AC-07`'s precedent of a justified `[MANUAL]` AC verified by direct re-scan rather than
an automated test.

## Design Decisions

- **Live port-owner PID resolution, not `$!`.** `gradlew.bat bootRun` runs through a Gradle
  Daemon — a persistent background JVM not reliably a child of the launching shell — so capturing
  bash's `$!` immediately after backgrounding `./gradlew.bat bootRun &` does not reliably give the
  PID of the JVM that ends up bound to `:8080`. Instead, after launching, the target port is polled
  via health-check until live, then the actual PID currently bound to that port is resolved via
  `netstat -ano` — the same technique RUNBOOK.md's own existing manual troubleshooting recipe uses
  (`netstat -ano | findstr :8080` → `taskkill /PID <pid> /F`). This resolved PID, not `$!`, is what
  gets persisted to the pid file.
- **Stop always re-resolves the live port-owner PID, never trusts the saved pid file as the value
  passed to `taskkill`.** A saved PID can go stale (Gradle Daemon reused across sessions, service
  restarted manually outside the scripts, machine rebooted and the PID number reused by something
  else entirely). The port is the one thing that's always ground-truth for "what currently needs to
  be freed." The pid file is still written/read for bookkeeping (existence check, informational
  display) but is never itself the kill target.
- **Image-name safety check before every kill.** Before `taskkill`, `stop-dev.sh` checks the
  resolved PID's process image name (via `tasklist`) against what's expected (`java.exe` for
  backend, `node.exe` for frontend). On mismatch, it refuses to kill and prints the PID/image name
  plus the manual `tasklist`/`taskkill` commands instead — this guards against ever killing an
  unrelated process that happens to be sitting on `:8080`/`:5173` (e.g. something else grabbed the
  port after a crash).
- **Idempotent start.** If a target port is already listening when `start-dev.sh` runs, that
  service is skipped with a message rather than double-launched or erroring.
- **`MSYS_NO_PATHCONV=1` with plain single-slash flags** (`/PID`, `/F`, `/T`, `/FI`, `/FO`, `/NH`)
  for every `taskkill`/`tasklist` invocation, since git bash's MSYS layer otherwise mangles
  slash-prefixed flags meant for native Windows binaries into filesystem paths. Confirmed by direct
  testing that this and "double-slashing" (`//PID`) instead are two *alternative* fixes for the
  same problem, not composable — with `MSYS_NO_PATHCONV=1` set, `//PID` is passed through literally
  and the Windows binary itself rejects it (`ERROR: Invalid argument/option`). This spec picks the
  env-var approach and uses it consistently.
- **Logs truncate per run, not append** (`>`, not `>>`) — each `start-dev.sh` invocation is a fresh
  session, log output starts capturing from the very first line (so a cold-start crash during the
  Gradle Daemon's 30–90s startup is captured, not lost before a pid file could be resolved).
- **`restart-dev.sh` is a pure wrapper** — calls `stop-dev.sh "$@"` then `start-dev.sh "$@"`, no
  duplicated logic.
- **Optional `backend`/`frontend` positional argument on `start-dev.sh`/`stop-dev.sh`/
  `restart-dev.sh`** (default: both) — low-cost since the per-service logic is naturally two
  separate function calls anyway, and genuinely useful (e.g. restarting only the backend after a
  Java change without cold-starting the frontend too).
- **Health-check targets**: backend `http://localhost:8080/api/v1/series` (matches RUNBOOK's own
  documented verification step), 90s timeout (Gradle Daemon cold start); frontend
  `http://localhost:5173/`, 20s timeout (Vite is fast). Both plain `localhost` — the VPN/IPv6 issue
  that previously would have forced `127.0.0.1` for the frontend check is resolved (see the
  companion `vite.config.ts` revert, tracked outside this spec).

---

## Requirement 1: Shared helper library

**User story**: As a developer maintaining these scripts, I want the port/PID/health-check logic
written once, not duplicated across three files.

### TOOLING-009-AC-01 [MANUAL]
**Statement**: The `scripts/lib/dev-common.sh` library shall provide `is_port_listening(port)`,
returning success if and only if `netstat -ano` shows a `LISTENING` entry for that port.

**References**: `netstat -ano | findstr :8080` — RUNBOOK.md's existing manual troubleshooting
recipe this reimplements as a reusable function.

**Test Case (Manual)**: with the backend running, `is_port_listening 8080` returns success (`$?
-eq 0`); with nothing on `:8081`, `is_port_listening 8081` returns failure.

---

### TOOLING-009-AC-02 [MANUAL]
**Statement**: The library shall provide `port_owner_pid(port)`, returning the numeric PID
currently bound to that port, parsed from the same `netstat -ano` output; where both an IPv4
(`0.0.0.0:<port>`) and IPv6 (`[::]:<port>`) `LISTENING` line exist for the same PID, it shall
de-duplicate to a single value; where more than one *distinct* PID is found for the same port, it
shall abort with an explicit "ambiguous port owner" message rather than guessing.

**References**: feeds both `start-dev.sh`'s pid-file write and `stop-dev.sh`'s kill target.

**Test Case (Manual)**: with the backend running, `port_owner_pid 8080` returns exactly one
numeric PID matching `tasklist`'s own listing for that PID.

---

### TOOLING-009-AC-03 [MANUAL]
**Statement**: The library shall provide `tasklist_image_name(pid)`, returning the process image
name (e.g. `java.exe`, `node.exe`) for a given PID via `tasklist`.

**References**: consumed by `stop-dev.sh`'s pre-kill safety check (Requirement 3).

**Test Case (Manual)**: `tasklist_image_name <backend pid>` returns `java.exe`;
`tasklist_image_name <frontend pid>` returns `node.exe`.

---

### TOOLING-009-AC-04 [MANUAL]
**Statement**: The library shall provide `wait_for_health(url, timeout_s, label)`, polling `curl
-sf` against `url` every 2 seconds (printing a progress indicator per attempt) until it succeeds or
`timeout_s` elapses, returning non-zero on timeout.

**References**: consumed by `start-dev.sh` (Requirement 2).

**Test Case (Manual)**: against a URL that becomes reachable within the timeout, the function
returns success once reachable; against a URL that never becomes reachable, it returns failure
after approximately `timeout_s` seconds, not immediately and not indefinitely.

---

## Requirement 2: `start-dev.sh`

**User story**: As a developer, I want a single command that starts both servers in the background,
captures their output, and tells me once each is actually ready — not just launched.

### TOOLING-009-AC-05 [MANUAL]
**Statement**: When run with no argument (or `all`), `scripts/start-dev.sh` shall, for both
backend and frontend: if `is_port_listening` reports the target port already listening, print an
"already running — skipping" message and leave that service untouched; otherwise create `logs/` if
absent, launch the service backgrounded with stdout/stderr redirected to a fresh (truncated)
`logs/<service>.log`, poll `wait_for_health` against that service's target URL/timeout, and on
success resolve and persist the live `port_owner_pid` to `logs/<service>.pid`.

**References**: backend health-check `http://localhost:8080/api/v1/series` (90s); frontend
`http://localhost:5173/` (20s).

**Test Case (Manual)**: from a clean state (`:8080`/`:5173` free), `bash scripts/start-dev.sh`
brings both up, prints a ready message for each, and leaves `logs/backend.pid`/`logs/frontend.pid`
containing PIDs that match `netstat`'s live listeners.

---

### TOOLING-009-AC-06 [MANUAL]
**Statement**: If a launched service's health-check does not succeed within its timeout,
`start-dev.sh` shall print a failure message, print the last 20 lines of that service's log file,
and exit non-zero without writing a pid file for that service.

**References**: `wait_for_health`'s timeout return.

**Test Case (Manual)**: temporarily break the backend (e.g. an invalid `application.yml` value) and
run `start-dev.sh` — it reports failure within ~90s, shows recent log output, and no
`logs/backend.pid` is written.

---

### TOOLING-009-AC-07 [MANUAL]
**Statement**: `start-dev.sh` shall accept an optional `backend`|`frontend` positional argument,
restricting Requirement 2's behavior to only that service; an unrecognized argument shall print
usage and exit non-zero rather than silently starting both.

**References**: Design Decisions — optional per-service targeting.

**Test Case (Manual)**: `bash scripts/start-dev.sh backend` starts only `:8080`, leaving `:5173`
untouched; `bash scripts/start-dev.sh frontend` then starts only `:5173`.

---

## Requirement 3: `stop-dev.sh`

**User story**: As a developer, I want to reliably stop whatever's currently listening on the dev
ports, without risking killing something unrelated.

### TOOLING-009-AC-08 [MANUAL]
**Statement**: When run with no argument (or `all`), `scripts/stop-dev.sh` shall, for both backend
and frontend: if `is_port_listening` reports the target port not listening, print a "not running"
message, remove any stale pid file for that service, and continue; otherwise resolve the live
`port_owner_pid` (not the saved pid-file value) and check its `tasklist_image_name` against the
expected image (`java.exe`/`node.exe`).

**References**: Design Decisions — live re-resolution, never trust the saved file as the kill
target.

**Test Case (Manual)**: with both servers running, `bash scripts/stop-dev.sh` correctly identifies
both live PIDs regardless of whether their pid files are present, stale, or deleted beforehand.

---

### TOOLING-009-AC-09 [MANUAL]
**Statement**: Where the resolved PID's image name matches the expected value, `stop-dev.sh` shall
run `taskkill //PID <pid> //T //F`, remove that service's pid file, and print a confirmation;
where it does not match, `stop-dev.sh` shall refuse to kill, print the PID, its actual image name,
and the manual `tasklist`/`taskkill` commands, and exit non-zero for that service without touching
the process.

**References**: Design Decisions — image-name safety check.

**Test Case (Manual)**: with both servers running via the scripts, `stop-dev.sh` frees both ports
and removes both pid files. Separately: bind an unrelated process (e.g. `python -m http.server
5173`) to `:5173` and run `stop-dev.sh frontend` — it refuses to kill and prints the manual
fallback instead of taskkilling the unrelated process.

---

### TOOLING-009-AC-10 [MANUAL]
**Statement**: `stop-dev.sh` shall accept the same optional `backend`|`frontend` positional
argument as `start-dev.sh`, with the same restriction/validation behavior.

**References**: Design Decisions — optional per-service targeting.

**Test Case (Manual)**: `bash scripts/stop-dev.sh backend` stops only `:8080`, `:5173` stays up.

---

### TOOLING-009-AC-11 [MANUAL]
**Statement**: `stop-dev.sh` shall never terminate the Gradle Daemon itself — only the forked JVM
process actually bound to `:8080` (the `bootRun` `JavaExec` task's process, distinct from the
Daemon that launched it).

**References**: Design Decisions.

**Test Case (Manual)**: before/after `stop-dev.sh`, `tasklist | grep -i java` (or `cd backend &&
./gradlew.bat --status`) shows the Daemon process still present after the backend's dev-server JVM
has been stopped.

---

## Requirement 4: `restart-dev.sh`

**User story**: As a developer, I want to cycle a server (e.g. after a config change not picked up
by `--continuous`) with one command.

### TOOLING-009-AC-12 [MANUAL]
**Statement**: `scripts/restart-dev.sh` shall call `stop-dev.sh "$@"` followed by `start-dev.sh
"$@"`, passing through any `backend`|`frontend` argument unchanged, with no logic duplicated from
either script.

**References**: `stop-dev.sh` (Requirement 3), `start-dev.sh` (Requirement 2).

**Test Case (Manual)**: `bash scripts/restart-dev.sh` stops and restarts both servers, health-checks
passing again afterward, with no orphaned/duplicate `java`/`node` processes left behind.

---

## Requirement 5: Logging and repo hygiene

**User story**: As a developer, I want each run's output captured cleanly without polluting git
history.

### TOOLING-009-AC-13 [MANUAL]
**Statement**: Each `start-dev.sh` invocation shall truncate (not append to) that service's log
file, so `logs/<service>.log` always reflects only the most recent run.

**References**: Design Decisions.

**Test Case (Manual)**: note `logs/backend.log`'s size/content, run `restart-dev.sh`, confirm the
file was replaced, not appended to.

---

### TOOLING-009-AC-14 [MANUAL]
**Statement**: The repository's `.gitignore` shall exclude the `logs/` directory in its entirety.

**References**: `.gitignore`'s existing `# Logs` section (`*.log`, `npm-debug.log*`).

**Test Case (Manual)**: after running `start-dev.sh`, `git status` shows no untracked entries under
`logs/`.

---

## Known Limitation (found during verification)

The image-name safety check (`TOOLING-009-AC-09`) only compares process image name
(`java.exe`/`node.exe`), not command-line arguments — confirmed during manual testing that an
unrelated `node.exe` process (not the frontend) sitting on `:5173` would **not** be caught by this
check, since it shares the same image name as the real frontend dev server. A differently-imaged
decoy (e.g. `powershell.exe`) was correctly refused. This matches the AC's literal scope as
written — full command-line disambiguation was judged disproportionate for a single-developer
local tool — but is worth knowing about rather than assuming the guard is airtight against every
possible collision.

## Cross-References

| This spec | Source |
|---|---|
| Manual `netstat`/`taskkill` port-conflict recipe this spec's `stop-dev.sh` reimplements reliably | `RUNBOOK.md`'s Troubleshooting section, "Port 8080 already in use" |
| Backend health-check endpoint/expected response this spec polls | `RUNBOOK.md`'s "Verify it is running" step, `GET /api/v1/series` |
| Companion fix riding along on the same branch (not part of this spec's ACs) | `frontend/vite.config.ts`'s `server.host` pin revert, now that the VPN/IPv6 issue it worked around is resolved |
| Precedent for a justified `[MANUAL]` AC verified by direct re-scan/execution rather than an automated test | `tooling_spec_008_recommendation_controls_decomposition.md`, `TOOLING-008-AC-07` |

---

## Acceptance Criteria Summary

- [x] TOOLING-009-AC-01: `is_port_listening(port)` helper
- [x] TOOLING-009-AC-02: `port_owner_pid(port)` helper, dedupes dual-bind, aborts on ambiguity
- [x] TOOLING-009-AC-03: `tasklist_image_name(pid)` helper
- [x] TOOLING-009-AC-04: `wait_for_health(url, timeout_s, label)` helper
- [x] TOOLING-009-AC-05: `start-dev.sh` idempotent launch + health-check + pid persistence
- [x] TOOLING-009-AC-06: `start-dev.sh` failure path (timeout, log tail, no pid file, non-zero exit)
- [x] TOOLING-009-AC-07: `start-dev.sh` optional `backend`|`frontend` targeting
- [x] TOOLING-009-AC-08: `stop-dev.sh` live re-resolution of port-owner PID, not trusting pid file
- [x] TOOLING-009-AC-09: `stop-dev.sh` image-name safety check, kill vs. refuse
- [x] TOOLING-009-AC-10: `stop-dev.sh` optional `backend`|`frontend` targeting
- [x] TOOLING-009-AC-11: `stop-dev.sh` never kills the Gradle Daemon itself
- [x] TOOLING-009-AC-12: `restart-dev.sh` thin wrapper, no duplicated logic
- [x] TOOLING-009-AC-13: logs truncate per run, not append
- [x] TOOLING-009-AC-14: `logs/` excluded via `.gitignore`
