#!/usr/bin/env bash
# Shared helpers for scripts/start-dev.sh, stop-dev.sh, restart-dev.sh.
# See .claude/specs/tooling_spec_009_dev_server_scripts.md.
#
# MSYS_NO_PATHCONV=1 disables git bash's MSYS layer from mangling
# slash-prefixed flags (/PID, /FI, /FO, ...) meant for native Windows
# binaries (tasklist.exe, taskkill.exe) into filesystem paths. Every
# invocation of those binaries in this file/its callers must use plain
# single-slash flags -- do NOT "double-slash" (//PID) on top of this, that
# combination is broken: with the var set, MSYS passes // through literally,
# which the Windows binaries themselves don't understand either.
export MSYS_NO_PATHCONV=1

DEV_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DEV_COMMON_DIR/../.." && pwd)"
LOGS_DIR="$REPO_ROOT/logs"

BACKEND_PORT=8080
FRONTEND_PORT=5173
BACKEND_HEALTH_URL="http://localhost:${BACKEND_PORT}/api/v1/series"
FRONTEND_HEALTH_URL="http://localhost:${FRONTEND_PORT}/"
BACKEND_TIMEOUT=90
FRONTEND_TIMEOUT=20
BACKEND_IMAGE="java.exe"
FRONTEND_IMAGE="node.exe"

ensure_logs_dir() {
  mkdir -p "$LOGS_DIR"
}

# TOOLING-009-AC-01: success iff netstat shows a LISTENING entry for $1.
is_port_listening() {
  local port="$1"
  netstat -ano | grep -E "TCP[[:space:]]+[^[:space:]]*:${port}[[:space:]]" | grep -q "LISTENING"
}

# TOOLING-009-AC-02: the PID currently bound to $1, de-duped across IPv4/IPv6
# dual-bind lines. Aborts (prints to stderr, returns 2) if genuinely ambiguous.
port_owner_pid() {
  local port="$1"
  local pids
  pids=$(netstat -ano \
    | grep -E "TCP[[:space:]]+[^[:space:]]*:${port}[[:space:]].*LISTENING" \
    | awk '{print $NF}' \
    | sort -u)

  local count
  count=$(printf '%s\n' "$pids" | grep -c '[0-9]')

  if [ "$count" -eq 0 ]; then
    return 1
  elif [ "$count" -gt 1 ]; then
    echo "ERROR: ambiguous port owner for :$port -- multiple distinct PIDs found: $pids" >&2
    return 2
  fi

  echo "$pids"
}

# TOOLING-009-AC-03: the process image name (e.g. java.exe) for a PID.
tasklist_image_name() {
  local pid="$1"
  tasklist /FI "PID eq $pid" /FO CSV /NH 2>/dev/null \
    | head -n1 \
    | awk -F'","' '{gsub(/^"/, "", $1); print $1}'
}

# TOOLING-009-AC-04: poll $1 with curl every 2s until it succeeds or $2
# seconds elapse. $3 is a label for progress output.
wait_for_health() {
  local url="$1" timeout_s="$2" label="$3"
  local elapsed=0

  printf "Waiting for %s" "$label"
  while [ "$elapsed" -lt "$timeout_s" ]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo " ready (${elapsed}s)"
      return 0
    fi
    printf "."
    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo " timed out after ${timeout_s}s"
  return 1
}
