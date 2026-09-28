#!/usr/bin/env bash
# Start the local backend/frontend dev servers in the background, with
# output captured to logs/. See .claude/specs/tooling_spec_009_dev_server_scripts.md
# and .claude/specs/tooling_spec_011_dev_server_debug_mode.md (--debug).
#
# Usage: bash scripts/start-dev.sh [backend|frontend] [--debug]   (default: both, no debug)

set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/dev-common.sh
source "$DIR/lib/dev-common.sh"

usage() {
  echo "Usage: $(basename "$0") [backend|frontend] [--debug]" >&2
  exit 1
}

parse_args "$@" || usage
target="$TARGET"

# TOOLING-009-AC-05/06, TOOLING-011-AC-02/AC-04
start_backend() {
  if is_port_listening "$BACKEND_PORT"; then
    local pid
    pid=$(port_owner_pid "$BACKEND_PORT" || true)
    echo "Backend already running on :$BACKEND_PORT (pid ${pid:-unknown}) -- skipping"
    if [ "$DEBUG_MODE" -eq 1 ]; then
      echo "  Note: the running instance wasn't (necessarily) started with --debug-jvm --" \
        "if it wasn't, :$BACKEND_DEBUG_PORT isn't open. Restart with --debug to be sure."
    fi
    [ -n "${pid:-}" ] && echo "$pid" >"$LOGS_DIR/backend.pid"
    return 0
  fi

  ensure_logs_dir
  local gradle_args=(bootRun)
  if [ "$DEBUG_MODE" -eq 1 ]; then
    gradle_args+=(--debug-jvm)
    echo "Starting backend (cd backend && gradlew.bat bootRun --debug-jvm)..."
  else
    echo "Starting backend (cd backend && gradlew.bat bootRun)..."
  fi
  (cd "$REPO_ROOT/backend" && nohup ./gradlew.bat "${gradle_args[@]}" >"$LOGS_DIR/backend.log" 2>&1 &)

  if wait_for_health "$BACKEND_HEALTH_URL" "$BACKEND_TIMEOUT" "backend"; then
    local pid
    pid=$(port_owner_pid "$BACKEND_PORT")
    if [ -z "${pid:-}" ]; then
      echo "Backend: health check passed but could not resolve a port-owner PID for :$BACKEND_PORT" >&2
      return 1
    fi
    echo "$pid" >"$LOGS_DIR/backend.pid"
    echo "Backend ready on :$BACKEND_PORT (pid $pid). Logs: $LOGS_DIR/backend.log"
    if [ "$DEBUG_MODE" -eq 1 ]; then
      echo "  Debug port :$BACKEND_DEBUG_PORT (JDWP) is listening -- attach IntelliJ's" \
        "Remote JVM Debug run config (host localhost, port $BACKEND_DEBUG_PORT)."
    fi
  else
    echo "Backend failed to become ready within ${BACKEND_TIMEOUT}s. Last log lines:" >&2
    tail -n 20 "$LOGS_DIR/backend.log" >&2 2>/dev/null || true
    return 1
  fi
}

# TOOLING-009-AC-05/06, TOOLING-011-AC-03/AC-04
start_frontend() {
  if is_port_listening "$FRONTEND_PORT"; then
    local pid
    pid=$(port_owner_pid "$FRONTEND_PORT" || true)
    echo "Frontend already running on :$FRONTEND_PORT (pid ${pid:-unknown}) -- skipping"
    [ -n "${pid:-}" ] && echo "$pid" >"$LOGS_DIR/frontend.pid"
    if [ "$DEBUG_MODE" -eq 1 ]; then
      print_frontend_debug_note
    fi
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
    if [ "$DEBUG_MODE" -eq 1 ]; then
      print_frontend_debug_note
    fi
  else
    echo "Frontend failed to become ready within ${FRONTEND_TIMEOUT}s. Last log lines:" >&2
    tail -n 20 "$LOGS_DIR/frontend.log" >&2 2>/dev/null || true
    return 1
  fi
}

# TOOLING-011-AC-03: there's no server-side frontend debug mode -- Vite
# already serves unminified, sourcemapped code in dev mode. --debug only
# points at how to actually attach.
print_frontend_debug_note() {
  echo "  No frontend debug flag needed -- Vite already serves unminified," \
    "sourcemapped code in dev mode. Attach via IntelliJ's JavaScript Debug" \
    "run config (URL http://localhost:$FRONTEND_PORT) or open browser DevTools" \
    "directly against that URL."
}

status=0
if [ "$target" = "all" ] || [ "$target" = "backend" ]; then
  start_backend || status=1
fi
if [ "$target" = "all" ] || [ "$target" = "frontend" ]; then
  start_frontend || status=1
fi

exit $status
