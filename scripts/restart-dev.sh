#!/usr/bin/env bash
# Restart the local backend/frontend dev servers: stop then start.
# See .claude/specs/tooling_spec_009_dev_server_scripts.md (TOOLING-009-AC-12).
#
# Usage: bash scripts/restart-dev.sh [backend|frontend]   (default: both)

set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$DIR/stop-dev.sh" "$@"
"$DIR/start-dev.sh" "$@"
