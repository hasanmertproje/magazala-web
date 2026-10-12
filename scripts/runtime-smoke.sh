#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${APP_URL:-http://localhost:3000}"
LOG_FILE="/tmp/magazala-runtime.log"
COOKIE_JAR="/tmp/magazala-cookies.txt"
EMAIL="ci-runtime@example.com"
PASSWORD="CiRuntimePassword123!"

npm start >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

ready=0
for _ in $(seq 1 40); do
  if curl -fsS "$BASE_URL/api/health/live" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  cat "$LOG_FILE"
  echo "Application did not become live" >&2
  exit 1
fi

curl -fsS "$BASE_URL/api/health/ready" >/dev/null
curl -fsS "$BASE_URL/setup" >/dev/null

setup_status=$(curl -sS -o /tmp/magazala-setup.out -w '%{http_code}' \
  -c "$COOKIE_JAR" \
  -H "Origin: $BASE_URL" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASSWORD" \
  --data-urlencode 'displayName=CI Runtime Admin' \
  --data-urlencode 'workspaceName=CI Workspace' \
  "$BASE_URL/api/auth/setup")
if [[ "$setup_status" != "303" ]]; then
  cat /tmp/magazala-setup.out
  echo "Expected setup HTTP 303, got $setup_status" >&2
  exit 1
fi

curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/auth/me" | grep -F "$EMAIL" >/dev/null

curl -fsS -o /dev/null -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -H "Origin: $BASE_URL" \
  -X POST "$BASE_URL/api/auth/logout"

login_status=$(curl -sS -o /tmp/magazala-login.out -w '%{http_code}' \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -H "Origin: $BASE_URL" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASSWORD" \
  --data-urlencode 'next=/' \
  "$BASE_URL/api/auth/login")
if [[ "$login_status" != "303" ]]; then
  cat /tmp/magazala-login.out
  echo "Expected login HTTP 303, got $login_status" >&2
  exit 1
fi

curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/auth/me" | grep -F "$EMAIL" >/dev/null

echo "Runtime smoke passed: live, ready, setup, session, logout and login."
