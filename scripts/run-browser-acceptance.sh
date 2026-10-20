#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/tmp/entegrepilot-browser-acceptance.log"
npm start >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

for attempt in $(seq 1 45); do
  if curl --silent --fail "${APP_URL:-http://localhost:3000}/api/health/ready" >/dev/null; then
    node scripts/browser-acceptance.mjs
    exit 0
  fi
  sleep 1
done
cat "$LOG_FILE"
echo "Browser acceptance server did not become ready" >&2
exit 1
