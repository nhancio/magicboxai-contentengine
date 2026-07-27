#!/usr/bin/env bash
#
# Stop everything started by ./run.sh: apps/landing (8173), apps/web (8174),
# apps/admin (8175), and packages/backend (8005), plus any lingering
# `npm run dev` child processes under those app directories.
#
# Mirrors run.sh's own "Freeing up ports..." logic, as a standalone script.
#
# Usage: ./stop.sh [-h|--help]
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      echo "Usage: ./stop.sh"
      echo "  Frees ports 8173 (landing), 8174 (web), 8175 (admin), 8005 (backend),"
      echo "  and kills any lingering 'npm run dev' processes under apps/landing,"
      echo "  apps/web, apps/admin, apps/renderer, and packages/backend."
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)"
      exit 1
      ;;
  esac
done

echo "================================================="
echo "Stopping MagicBox AI"
echo "================================================="

echo "Freeing up ports..."
for PORT in 8173 8174 8175 8005; do
  EXISTING_PIDS=$(lsof -ti :$PORT || true)
  if [ -n "$EXISTING_PIDS" ]; then
    echo "  killing pid(s) on port $PORT: $EXISTING_PIDS"
    kill -9 $EXISTING_PIDS 2>/dev/null || true
  fi
done

echo "Killing lingering 'npm run dev' child processes..."
for APP_DIR in apps/landing apps/web apps/admin apps/renderer packages/backend; do
  PIDS=$(pgrep -f "${ROOT_DIR}/${APP_DIR}.*npm run dev" 2>/dev/null || true)
  # Fallback match for the actual child process (e.g. vite, convex dev, node --watch)
  # that npm spawns, in case the parent npm process has already exited.
  PIDS="${PIDS} $(pgrep -f "${ROOT_DIR}/${APP_DIR}" 2>/dev/null || true)"
  PIDS=$(echo "$PIDS" | tr ' ' '\n' | sort -u | grep -v '^$' || true)
  for pid in $PIDS; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "  stopping $APP_DIR (pid $pid)"
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
done

sleep 0.5
for APP_DIR in apps/landing apps/web apps/admin apps/renderer packages/backend; do
  PIDS=$(pgrep -f "${ROOT_DIR}/${APP_DIR}" 2>/dev/null || true)
  for pid in $PIDS; do
    kill -9 "$pid" 2>/dev/null || true
  done
done

echo ""
echo "Done. MagicBox AI dev apps should be stopped."
remaining=""
for port in 8173 8174 8175 8005; do
  if lsof -ti :"$port" >/dev/null 2>&1; then
    remaining="${remaining} ${port}"
  fi
done
if [ -n "$remaining" ]; then
  echo "Note: port(s) still in use:${remaining} (may be another app)."
fi
