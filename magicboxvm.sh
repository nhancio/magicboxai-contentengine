#!/usr/bin/env bash
#
# SSH to the Convex backend VM.
#
#   ./magicboxvm.sh                 interactive shell
#   ./magicboxvm.sh docker ps       run a command and exit
#   ./magicboxvm.sh -t              shell + tunnel the Convex dashboard (6791)
#   ./magicboxvm.sh -t 3210         shell + tunnel any port
#
set -euo pipefail

PROJECT="magicboxai-50927"
ZONE="us-east4-b"
VM="convex-backend"
ACCOUNT="nithindidigam@nhancio.com"

GC=(gcloud compute ssh "$VM" --project "$PROJECT" --zone "$ZONE" --account "$ACCOUNT")

if [ "${1:-}" = "-t" ] || [ "${1:-}" = "--tunnel" ]; then
  PORT="${2:-6791}"
  echo "Tunnelling localhost:${PORT} → ${VM}:${PORT} — open http://localhost:${PORT}"
  exec "${GC[@]}" -- -L "${PORT}:localhost:${PORT}"
fi

if [ $# -gt 0 ]; then
  exec "${GC[@]}" --command "$*"
fi

exec "${GC[@]}"
