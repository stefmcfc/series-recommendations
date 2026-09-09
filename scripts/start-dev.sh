#!/usr/bin/env bash
# Start the local backend/frontend dev servers in the background, with
# output captured to logs/. See .claude/specs/tooling_spec_009_dev_server_scripts.md.
#
# Usage: bash scripts/start-dev.sh [backend|frontend]   (default: both)

set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/dev-common.sh
source "$DIR/lib/dev-common.sh"

usage() {
  echo "Usage: $(basename "$0") [backend|frontend]" >&2
  exit 1
}

target="${1:-all}"
case "$target" in
  all | backend | frontend) ;;
  *) usage ;;
esac

# TOOLING-009-AC-05/06
start_backend() {
  if is_port_listening "$BACKEND_PORT"; then
    local pid
    pid=$(port_owner_pid "$BACKEND_PORT" || true)
    echo "Backend already running on :$BACKEND_PORT (pid ${pid:-unknown}) -- skipping"
    [ -n "${pid:-}" ] && echo "$pid" >"$LOGS_DIR/backend.pid"
    return 0
  fi

  ensure_logs_dir
  echo "Starting backend (cd backend && gradlew.bat bootRun)..."
  (cd "$REPO_ROOT/backend" && nohup ./gradlew.bat bootRun >"$LOGS_DIR/backend.log" 2>&1 &)

  if wait_for_health "$BACKEND_HEALTH_URL" "$BACKEND_TIMEOUT" "backend"; then
    local pid
    pid=$(port_owner_pid "$BACKEND_PORT")
    if [ -z "${pid:-}" ]; then
      echo "Backend: health check passed but could not resolve a port-owner PID for :$BACKEND_PORT" >&2
      return 1
    fi
    echo "$pid" >"$LOGS_DIR/backend.pid"
    echo "Backend ready on :$BACKEND_PORT (pid $pid). Logs: $LOGS_DIR/backend.log"
  else
    echo "Backend failed to become ready within ${BACKEND_TIMEOUT}s. Last log lines:" >&2
    tail -n 20 "$LOGS_DIR/backend.log" >&2 2>/dev/null || true
    return 1
  fi
}

# TOOLING-009-AC-05/06
start_frontend() {
  if is_port_listening "$FRONTEND_PORT"; then
    local pid
    pid=$(port_owner_pid "$FRONTEND_PORT" || true)
    echo "Frontend already running on :$FRONTEND_PORT (pid ${pid:-unknown}) -- skipping"
    [ -n "${pid:-}" ] && echo "$pid" >"$LOGS_DIR/frontend.pid"
    return 0
  fi

  ensure_logs_dir
  echo "Starting frontend (cd frontend && npm run dev)..."
  (cd "$REPO_ROOT/frontend" && nohup npm run dev >"$LOGS_DIR/frontend.log" 2>&1 &)

  if wait_for_health "$FRONTEND_HEALTH_URL" "$FRONTEND_TIMEOUT" "frontend"; then
    local pid
    pid=$(port_owner_pid "$FRONTEND_PORT")
    if [ -z "${pid:-}" ]; then
      echo "Frontend: health check passed but could not resolve a port-owner PID for :$FRONTEND_PORT" >&2
      return 1
    fi
    echo "$pid" >"$LOGS_DIR/frontend.pid"
    echo "Frontend ready on :$FRONTEND_PORT (pid $pid). Logs: $LOGS_DIR/frontend.log"
  else
    echo "Frontend failed to become ready within ${FRONTEND_TIMEOUT}s. Last log lines:" >&2
    tail -n 20 "$LOGS_DIR/frontend.log" >&2 2>/dev/null || true
    return 1
  fi
}

status=0
if [ "$target" = "all" ] || [ "$target" = "backend" ]; then
  start_backend || status=1
fi
if [ "$target" = "all" ] || [ "$target" = "frontend" ]; then
  start_frontend || status=1
fi

exit $status
