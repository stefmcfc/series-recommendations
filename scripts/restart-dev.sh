#!/usr/bin/env bash
# Restart the local backend/frontend dev servers: stop then start.
# See .claude/specs/tooling_spec_009_dev_server_scripts.md (TOOLING-009-AC-12),
# .claude/specs/tooling_spec_011_dev_server_debug_mode.md (TOOLING-011-AC-06, --debug), and
# .claude/specs/tooling_spec_013_dev_script_pause_on_failure.md (pause-on-failure).
#
# Usage: bash scripts/restart-dev.sh [backend|frontend] [--debug]   (default: both, no debug)

set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/dev-common.sh
source "$DIR/lib/dev-common.sh"

# tooling_spec_013_dev_script_pause_on_failure.md -- pauses on a keypress before this script's
# window closes, if (and only if) it's about to exit non-zero.
trap pause_on_failure EXIT

# DEV_SCRIPT_NESTED tells stop-dev.sh/start-dev.sh's own pause_on_failure trap to stay silent --
# they run as real subprocesses sharing this terminal, so without this a single failure could
# pause up to three times (TOOLING-013-AC-03). Only this, the outermost invocation, pauses.
# Scoped to each nested call's own environment only (VAR=value cmd), NOT `export`ed into this
# script's own shell -- an earlier version in the sibling project this was ported from exported
# it instead, which meant it was still set when THIS script's own trap fired at the bottom,
# incorrectly suppressing its own pause too (see tooling_spec_013's Overview for the full
# incident).
#
# Exit codes captured independently (not a bare fall-through to the last command's own exit
# code) so this script's own exit status -- and therefore its pause_on_failure trap -- correctly
# reflects a failure in *either* step, not just start-dev.sh's (TOOLING-013-AC-06).
status=0
DEV_SCRIPT_NESTED=1 "$DIR/stop-dev.sh" "$@" || status=1
DEV_SCRIPT_NESTED=1 "$DIR/start-dev.sh" "$@" || status=1
exit $status
