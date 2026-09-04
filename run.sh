#!/usr/bin/env bash
set -eu

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="/tmp/magicbox-dev-logs"
mkdir -p "$LOG_DIR"

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

start_app() {
  local name="$1"
  local dir="$2"

  (
    cd "$ROOT_DIR/$dir"
    npm run dev > "$LOG_DIR/$name.log" 2>&1
  ) &

  PIDS+=("$!")
}

# Waits until something listens on the port; on timeout, shows the app's log.
wait_for_port() {
  local name="$1"
  local port="$2"
  for _ in $(seq 1 60); do
    if lsof -ti :"$port" >/dev/null 2>&1; then
      echo "  ✔ $name ready → http://localhost:$port"
      return 0
    fi
    sleep 0.5
  done
  echo "  ✖ $name did not start on port $port — last lines of $LOG_DIR/$name.log:"
  tail -10 "$LOG_DIR/$name.log" 2>/dev/null || true
  return 0
}

declare -a PIDS=()
trap cleanup EXIT INT TERM

cd "$ROOT_DIR"
echo "Installing dependencies..."
# --loglevel=error hides harmless EBADENGINE warnings: functions/ pins
# "node": "20" because Firebase uses it to select the Cloud runtime, and the
# local Node version is newer. Real install errors still print.
npm install --no-fund --no-audit --loglevel=error

echo "Freeing up ports..."
for PORT in 8173 8174 8175 8005; do
  EXISTING_PIDS=$(lsof -ti :$PORT || true)
  if [ -n "$EXISTING_PIDS" ]; then
    kill -9 $EXISTING_PIDS 2>/dev/null || true
  fi
done

start_app "landing" "apps/landing"
start_app "web" "apps/web"
start_app "admin" "apps/admin"
start_app "renderer" "apps/renderer"
start_app "convex" "packages/backend"

echo ""
echo "Starting MagicBox AI (logs in $LOG_DIR)..."
wait_for_port "landing" 8173
wait_for_port "web" 8174
wait_for_port "admin" 8175
wait_for_port "renderer" 8005

echo ""
echo "Press Ctrl+C to stop all apps."

wait
