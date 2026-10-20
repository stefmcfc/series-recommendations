# Tooling Spec 013: Dev Scripts Pause on Failure So a Disposable Window Can Be Read

**Status**: Implemented (2026-10-20). `pause_on_failure` added to `scripts/lib/dev-common.sh`;
`trap pause_on_failure EXIT` wired into all three scripts; `restart-dev.sh` passes
`DEV_SCRIPT_NESTED=1` to its two nested calls via the `VAR=value cmd` form (never `export`, per
the Overview's warning) and captures both exit codes independently. See Verification below for
what was and wasn't directly reproducible from this environment.
**Priority**: Low — UX/DX gap in local tooling, no effect on the app itself
**Depends on**: none (purely `scripts/` — no backend/frontend code touched)
**Area**: Tooling (repo-wide dev scripts — not backend or frontend feature work)

## Overview

Ported from the sibling project `behavioural-activation`'s
`tooling_spec_004_dev_script_pause_on_failure.md`, which itself adapted this project's
`scripts/start-dev.sh`/`stop-dev.sh`/`restart-dev.sh` (`tooling_spec_009`) and then fixed a gap
found there: when one of these scripts is launched in a way that spawns a fresh Git Bash window
scoped to just that one invocation — typing `.\scripts\restart-dev.sh --debug` from PowerShell, or
double-clicking the `.sh` file in Explorer, both via Windows' `.sh` file association — that window
closes itself the instant the script process exits, success or failure alike. Any diagnostic
(`Backend failed to become ready within 90s...`, the `tail -n 20` of `logs/backend.log`, a bad-arg
usage message) is printed and then gone before it can be read. This project's scripts already
print clear, specific diagnostics on failure; the gap is purely about *where* that output goes.
Running the same scripts from inside an already-open, persistent Git Bash session (the common case
`RUNBOOK.md`'s Quick Start documents) never hits this, since that window stays open regardless of
what the script prints or returns.

That fix was never ported back to this project, where the same three scripts (same structure,
same ports `8080`/`5173`, same `MSYS_NO_PATHCONV=1`/`netstat`/`taskkill` mechanics) have the
identical gap today.

**Fix**: a shared `pause_on_failure` helper in `scripts/lib/dev-common.sh`, registered via `trap
pause_on_failure EXIT` in all three scripts, that blocks on a single keypress only when the script
is about to exit non-zero — so a disposable spawned window stays up long enough to read the
diagnostic, without adding any friction to the normal success path.

**Two design problems solved along the way, not just the headline one** (carried over unchanged
from the reference spec, since both the problem and the fix are structural, not app-specific):

1. **Double-pausing through `restart-dev.sh`**: it invokes `stop-dev.sh` and `start-dev.sh` as real
   subprocesses (not sourced), sharing the same terminal/stdin. If all three scripts installed the
   trap naively, a failure during `restart-dev.sh` could pause up to three times in a row (once from
   whichever nested script actually failed, once from `restart-dev.sh`'s own trap, and potentially
   from the other nested script too). Fixed with a `DEV_SCRIPT_NESTED` environment flag, scoped to
   each nested call's own environment via the `VAR=value cmd` form (`DEV_SCRIPT_NESTED=1
   "$DIR/stop-dev.sh" "$@"`) — **never** a preceding `export`, which would still be set when
   `restart-dev.sh`'s own trap fires at the bottom and incorrectly suppress its own pause too. This
   exact mistake shipped in the reference project's first revision and was only caught by a real
   (non-sandboxed) terminal test — see that spec's Summary for the full incident. Avoid repeating it
   here.
2. **`restart-dev.sh` doesn't propagate failure correctly today**: it currently runs `stop-dev.sh`
   then `start-dev.sh` with no exit-code handling between them (no `&&`, no capture — see
   `scripts/restart-dev.sh`'s current body, just two bare calls), so its own final exit status is
   just whatever `start-dev.sh` happened to return. A `stop-dev.sh` failure followed by a successful
   `start-dev.sh` currently makes `restart-dev.sh` exit `0`, silently swallowing the stop failure.
   This matters directly for the pause fix: if `restart-dev.sh`'s own exit code doesn't reflect a
   nested failure, its trap won't fire for that failure either, and — since the nested child's own
   trap is suppressed by `DEV_SCRIPT_NESTED` — nothing pauses at all. Fixed by having
   `restart-dev.sh` capture both sub-scripts' exit codes independently and exit with a combined
   non-zero status if either failed.

**Out of scope**: detecting *whether* a given invocation is actually a disposable spawned window
versus an already-open session (no reliable signal for this from inside bash) — the fix pauses
unconditionally on failure instead, accepting one keypress of friction on an already-open session's
failure path as the tradeoff for never losing the diagnostic in a disposable one. Also out of
scope: any change to what each script prints, or the success path's behavior/output.
`behavioural-activation`'s companion `load_dotenv`/`docker-common.sh` helpers are not ported —
they exist there to bootstrap Postgres/secrets before `start_backend` runs, which this project's
SQLite-backed scripts have no equivalent need for today. (A Docker-aware preflight check could
become relevant to `start-dev.sh` after `tooling_spec_012` ships, but that is that spec's own
future extension, not this one's.)

## Requirement 1 — A failing script pauses before a disposable window can close

**User story**: As a user who launched one of these scripts in a way that spawns a disposable
window (not an already-open terminal), I want the window to stay open long enough to read a failure
diagnostic, instead of vanishing the instant the script exits.

### TOOLING-013-AC-01 [MANUAL]: `start-dev.sh` pauses on a non-zero exit when run directly
**Statement**: When `start-dev.sh` is invoked directly (not nested under `restart-dev.sh`) and
exits non-zero, it shall print a prompt and block on a single keypress before the process actually
exits.

**Rationale**: Direct implementation of the headline fix for the script most likely to be launched
standalone — e.g. after a bad backend compile error leaves it failing to become healthy within
`BACKEND_TIMEOUT`.

**References**: `scripts/start-dev.sh`, `scripts/lib/dev-common.sh` (new `pause_on_failure`)

**Verification** (`[MANUAL]` — no bash test harness exists in this project, per `tooling_spec_009`'s
own precedent; manual, but exact and reproducible):
```bash
bash scripts/start-dev.sh badarg
# Expect: "Usage: start-dev.sh [backend|frontend] [--debug]" to stderr, then a
# "Press any key to close this window..." prompt that blocks until a key is pressed, then exit 1.
```

### TOOLING-013-AC-02 [MANUAL]: `stop-dev.sh` pauses on a non-zero exit when run directly
**Statement**: When `stop-dev.sh` is invoked directly and exits non-zero, it shall pause
identically to `TOOLING-013-AC-01`.

**Rationale**: Explicit per-script coverage — the same trap must be wired into every entry point,
not just `start-dev.sh`.

**References**: `scripts/stop-dev.sh`

**Verification** (`[MANUAL]`):
```bash
bash scripts/stop-dev.sh badarg
# Expect: usage message, then the pause prompt, then exit 1.
```

### TOOLING-013-AC-03 [MANUAL]: `restart-dev.sh` pauses exactly once on a nested failure, not doubled
**Statement**: When `restart-dev.sh` is invoked directly and either its `stop-dev.sh` step or its
`start-dev.sh` step fails, exactly one pause prompt shall appear (from `restart-dev.sh`'s own
trap) — the nested script's own trap shall not also pause.

**Rationale**: Closes the double-pause problem described in the Overview — `restart-dev.sh` shares
a terminal with the real subprocesses it invokes, so without suppression a single failure could
trigger two or three sequential prompts.

**References**: `scripts/restart-dev.sh` (`DEV_SCRIPT_NESTED=1` scoped to each nested call's own
environment via the `VAR=value cmd` form), `scripts/lib/dev-common.sh` (`pause_on_failure`'s
`DEV_SCRIPT_NESTED` check)

**Verification** (`[MANUAL]`):
```bash
bash scripts/restart-dev.sh badarg
# Expect: usage message (from the nested stop-dev.sh, which fails first), then exactly ONE
# "Press any key to close this window..." prompt -- not two or three.
```

## Requirement 2 — The success path and non-interactive invocations are unaffected

**User story**: As a user running these scripts normally (success, or from automation), I don't
want any new keypress or hang added to a path that already works fine today.

### TOOLING-013-AC-04 [MANUAL]: A successful (exit 0) run does not pause
**Statement**: When any of the three scripts exits `0`, it shall return control to the caller
immediately — no prompt, no pause.

**Rationale**: Regression guard — the fix must add friction only to the failure path.

**References**: `scripts/lib/dev-common.sh` (`pause_on_failure`)

**Verification** (`[MANUAL]`, side-effect-free regardless of local backend/frontend process
state):
```bash
bash scripts/stop-dev.sh
# Expect: "backend not running"/"frontend not running" (or "stopped") messages, exit 0, prompt
# returns immediately -- no pause.
```

### TOOLING-013-AC-05 [MANUAL]: No pause (and no hang) when stdin isn't an interactive terminal
**Statement**: While stdin is not a terminal (e.g. redirected from `/dev/null`, piped, or closed —
as a future CI/automation invocation would do), `pause_on_failure` shall skip the keypress wait
entirely and let the script exit immediately, even on a non-zero exit.

**Rationale**: Safety net the fix itself introduces a real risk of without this guard: a `read`
with no guard blocks forever against a non-interactive stdin, turning a one-off local UX annoyance
into a hang for any future automated caller (`.github/workflows/ci.yml` doesn't invoke these
scripts today, but nothing should assume that stays true forever). Checked via `[ -t 0 ]`.

**References**: `scripts/lib/dev-common.sh` (`pause_on_failure`)

**Verification** (`[MANUAL]`):
```bash
bash scripts/stop-dev.sh badarg < /dev/null
# Expect: usage message, exit 1, command returns immediately -- no hang waiting on a keypress
# that a non-interactive stdin could never supply.
```

## Requirement 3 — `restart-dev.sh` correctly reflects a nested failure in its own exit code

**User story**: As the `pause_on_failure` trap relies on the script's own exit code to decide
whether to pause, I want `restart-dev.sh`'s exit code to actually reflect a failure in either of
its two steps, not just whichever one happened to run last.

### TOOLING-013-AC-06 [MANUAL]: `restart-dev.sh`'s exit code reflects either nested step's failure
**Statement**: `restart-dev.sh` shall capture `stop-dev.sh`'s and `start-dev.sh`'s exit codes
independently and exit non-zero if either failed, even if the other succeeded — not simply exit
with whichever code the last-run command happened to produce.

**Rationale**: A pre-existing gap in this project's current `restart-dev.sh` (it is today a bare
two-line wrapper: `"$DIR/stop-dev.sh" "$@"` then `"$DIR/start-dev.sh" "$@"`, no `||`/capture
between them), not previously consequential since nothing read its exit code before this spec —
but load-bearing now: without this, a `stop-dev.sh`-only failure followed by a successful
`start-dev.sh` would make `restart-dev.sh` exit `0`, and — since the nested child's own trap is
suppressed by `DEV_SCRIPT_NESTED` (`TOOLING-013-AC-03`) — the diagnostic would be lost with no
pause anywhere to catch it.

**References**: `scripts/restart-dev.sh`

**Verification** (`[MANUAL]` — by code inspection, not runtime reproduction: a `stop-dev.sh`-fails-
but-`start-dev.sh`-succeeds scenario isn't reproducible without mutating real local port/process
state, so this is checked by reading the implementation directly rather than attempting a flaky
live repro): confirm `restart-dev.sh` captures each nested call's exit status independently (e.g.
`... || status=1` after each), and ends with an explicit `exit $status` reflecting the combination
of both — not a bare fall-through to the last command's own exit code.

## Cross-references

| Reference | What it provides |
|---|---|
| `scripts/lib/dev-common.sh` | `parse_args`/`is_port_listening`/`port_owner_pid`/`wait_for_health` — the existing helpers this spec adds `pause_on_failure` alongside |
| `scripts/start-dev.sh`, `stop-dev.sh`, `restart-dev.sh` | The three entry points gaining the `trap pause_on_failure EXIT` wiring |
| `tooling_spec_009_dev_server_scripts.md` | Original spec for these three scripts — this spec is an additive follow-on, no AC there changes |
| `tooling_spec_011_dev_server_debug_mode.md` | Most recent prior change to these scripts (`--debug`) — confirms the `parse_args`/usage-message failure path this spec's verification relies on |
| `behavioural-activation/.claude/specs/tooling_spec_004_dev_script_pause_on_failure.md` | The sibling-project spec this one ports back, including the exact `export`-scoping bug to avoid repeating |
| `RUNBOOK.md`'s "Quick Start (scripts)" section | Documents the scripts this spec modifies — update if the pause behavior needs explaining there |

## Acceptance Criteria Summary

- [x] TOOLING-013-AC-01 — `start-dev.sh` pauses on a non-zero exit when run directly
- [x] TOOLING-013-AC-02 — `stop-dev.sh` pauses on a non-zero exit when run directly
- [x] TOOLING-013-AC-03 — `restart-dev.sh` pauses exactly once on a nested failure, not doubled
- [x] TOOLING-013-AC-04 — a successful (exit 0) run never pauses
- [x] TOOLING-013-AC-05 — no pause/hang when stdin isn't an interactive terminal
- [x] TOOLING-013-AC-06 — `restart-dev.sh`'s exit code reflects either nested step's failure

## Verification

`bash -n` syntax-checked all four modified files.

**Directly reproduced in this environment** (no real attached console available — see below):
- **AC-04**: `bash scripts/stop-dev.sh` (both servers genuinely not running) returned in under a
  second with exit `0` and no pause — confirmed the success path is unaffected.
- **AC-05**: `bash scripts/stop-dev.sh badarg < /dev/null`, `start-dev.sh badarg < /dev/null`, and
  `restart-dev.sh badarg < /dev/null` each returned immediately (wrapped in `timeout 10` as a
  belt-and-suspenders guard) with exit `1` and no hang, confirming the `[ -t 0 ]` guard works
  against a genuinely non-interactive stdin.
- **AC-06**: the `restart-dev.sh badarg` run above exited `1` — both nested scripts fail
  independently (restart-dev.sh doesn't short-circuit between steps, by existing design — unlike
  the Requirement 3 verification note's framing, a bad arg actually fails *both* nested calls,
  each printing its own usage message; this is pre-existing `restart-dev.sh` behavior, not
  something this spec changes) and the combined `status` correctly ends up `1`.
- **AC-03's `DEV_SCRIPT_NESTED` scoping**: verified directly that the `VAR=value cmd` form (as
  used in `restart-dev.sh`) does not leak the variable into the calling shell's own environment —
  a minimal repro (`DEV_SCRIPT_NESTED=1 bash -c "true"; echo "${DEV_SCRIPT_NESTED:-unset}"`)
  confirmed `unset` in the parent, i.e. `restart-dev.sh`'s own `pause_on_failure` trap would see
  no leftover value when it fires at the bottom of the script — this is the exact mistake
  (`export` instead of `VAR=value cmd`) the reference project's first revision shipped.

**Not directly reproducible from this environment, verified by code review instead**: the actual
"a disposable spawned window stays open and blocks on a keypress" behavior (AC-01/02/03's
headline claim) requires a real attached console — confirmed unavailable here the same way the
reference project's own implementation found: `winpty bash -c "echo test"` itself fails with
`stdin is not a tty` in this sandboxed tool environment, and `[ -t 0 ]` is false here regardless
of which script runs it. The `pause_on_failure` implementation is a verbatim adaptation of the
reference project's own (already real-terminal-verified there, after its `export`-scoping bug was
caught and fixed) implementation, and the guard logic around it (`DEV_SCRIPT_NESTED`, `[ -t 0 ]`)
is verified above by direct reproduction of everything that *is* reachable without a tty. A quick
real-terminal spot check (`.\scripts\start-dev.sh badarg` from PowerShell, expecting the "Press
any key to close this window..." prompt to actually block) is recommended before relying on this
for the first time, but isn't blocking given the above.
