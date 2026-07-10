#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

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
    npm run dev
  ) &

  local pid=$!
  PIDS+=("$pid")
  echo "Started $name ($dir) with PID $pid"
}

declare -a PIDS=()
trap cleanup EXIT INT TERM

cd "$ROOT_DIR"
npm install

start_app "landing" "apps/landing"
start_app "web" "apps/web"
start_app "admin" "apps/admin"

echo ""
echo "MagicBox AI is starting:"
echo "  landing: http://localhost:5173"
echo "  web:     http://localhost:5174"
echo "  admin:   http://localhost:5175"
echo ""
echo "Press Ctrl+C to stop all apps."

wait
