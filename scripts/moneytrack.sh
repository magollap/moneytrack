#!/usr/bin/env bash
# Start / stop / status for MoneyTrack on macOS and Linux.
#
#   ./scripts/moneytrack.sh start
#   ./scripts/moneytrack.sh stop
#   ./scripts/moneytrack.sh restart
#   ./scripts/moneytrack.sh status
#   ./scripts/moneytrack.sh logs
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-4000}"
PID_FILE=".moneytrack.pid"
LOG_DIR="logs"
LOG_FILE="$LOG_DIR/moneytrack.log"

mkdir -p "$LOG_DIR"

say() { printf '\033[1;32m›\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

is_running() {
  [ -f "$PID_FILE" ] || return 1
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [ -n "${pid:-}" ] || return 1
  kill -0 "$pid" 2>/dev/null
}

start() {
  if is_running; then
    warn "MoneyTrack is already running (pid $(cat "$PID_FILE"), port $PORT)."
    return 0
  fi
  command -v node >/dev/null 2>&1 || fail "Node.js not found in PATH."
  say "Starting MoneyTrack on port $PORT…"
  PORT="$PORT" nohup node server.js >>"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 2
  if is_running; then
    say "Running (pid $(cat "$PID_FILE")). Open http://localhost:$PORT"
  else
    rm -f "$PID_FILE"
    fail "Failed to start. Check $LOG_FILE"
  fi
}

stop() {
  if ! is_running; then
    rm -f "$PID_FILE"
    warn "MoneyTrack is not running."
    return 0
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  say "Stopping pid $pid…"
  kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 20); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.25
  done
  if kill -0 "$pid" 2>/dev/null; then
    warn "Process did not exit; sending SIGKILL."
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  say "Stopped."
}

status() {
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    say "MoneyTrack is RUNNING (pid $pid, port $PORT)."
    if command -v curl >/dev/null 2>&1; then
      curl -fsS "http://localhost:$PORT/api/v1/system/status" 2>/dev/null \
        && echo \
        || warn "Process is up but the API did not respond yet."
    fi
  else
    warn "MoneyTrack is STOPPED."
    return 3
  fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  logs) tail -n 100 -f "$LOG_FILE" ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
