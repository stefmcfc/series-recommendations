#!/usr/bin/env bash
# Restart the local backend/frontend dev servers: stop then start.
# See .claude/specs/tooling_spec_009_dev_server_scripts.md (TOOLING-009-AC-12)
# and .claude/specs/tooling_spec_011_dev_server_debug_mode.md (TOOLING-011-AC-06, --debug).
#
# Usage: bash scripts/restart-dev.sh [backend|frontend] [--debug]   (default: both, no debug)

set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$DIR/stop-dev.sh" "$@"
"$DIR/start-dev.sh" "$@"
