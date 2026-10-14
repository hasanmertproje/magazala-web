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

# Subscription presets are admin-only, database-backed and idempotent.
curl -fsS -b "$COOKIE_JAR" -H "Origin: $BASE_URL" \
  -H 'Content-Type: application/json' -X POST \
  "$BASE_URL/api/admin/packages/presets" | grep -F '"slug":"baslangic"' >/dev/null

curl -fsS -b "$COOKIE_JAR" "$BASE_URL/billing" | grep -F 'Paketim ve Kredilerim' >/dev/null

# Product operations must not be accessible without authentication.
unauthenticated_status=$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Origin: $BASE_URL" -H 'Content-Type: application/json' \
  --data '{"name":"Unauthorized Product"}' "$BASE_URL/api/commerce/products")
if [[ "$unauthenticated_status" != "401" ]]; then
  echo "Expected product endpoint HTTP 401 without session, got $unauthenticated_status" >&2
  exit 1
fi

# Persist a draft product in the CI PostgreSQL service using the admin session.
curl -fsS -b "$COOKIE_JAR" -H "Origin: $BASE_URL" \
  -H 'Content-Type: application/json' \
  --data '{"name":"CI Catalog Product","internalSku":"CI-RUNTIME-001","currency":"TRY","price":"149.90"}' \
  "$BASE_URL/api/commerce/products" | grep -F '"ok":true' >/dev/null

curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/commerce/products" | grep -F 'CI Catalog Product' >/dev/null
curl -fsS -b "$COOKIE_JAR" "$BASE_URL/dashboard" | grep -F 'Genel Bakış' >/dev/null

# Stage-mode marketplace connector setup stores secrets encrypted without attempting an external API call.
curl -fsS -b "$COOKIE_JAR" -H "Origin: $BASE_URL" \
  -H 'Content-Type: application/json' \
  --data '{"name":"CI Trendyol Stage","sellerId":"1234567","apiKey":"CI_FAKE_KEY_DO_NOT_USE","apiSecret":"CI_FAKE_SECRET_DO_NOT_USE","mode":"STAGE"}' \
  "$BASE_URL/api/commerce/stores" | grep -F '"ok":true' >/dev/null

# The dashboard must not expose marketplace API keys or secrets.
if curl -fsS -b "$COOKIE_JAR" "$BASE_URL/commerce/stores" | grep -F 'CI_FAKE_SECRET_DO_NOT_USE' >/dev/null; then
  echo "Marketplace credentials leaked into store management HTML" >&2
  exit 1
fi

# Distributed throttle: reject password guessing after the defined limit.
for attempt in $(seq 1 10); do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Origin: $BASE_URL" \
    -H 'Content-Type: application/json' \
    --data '{"email":"rate-limit-nonexistent@example.com","password":"invalid"}' \
    "$BASE_URL/api/auth/login")
  if [[ "$code" != "401" ]]; then echo "Expected login 401 at attempt $attempt, got $code" >&2; exit 1; fi
done
blocked=$(curl -sS -o /dev/null -w '%{http_code}' -H "Origin: $BASE_URL" \
  -H 'Content-Type: application/json' \
  --data '{"email":"rate-limit-nonexistent@example.com","password":"invalid"}' \
  "$BASE_URL/api/auth/login")
if [[ "$blocked" != "429" ]]; then echo "Expected login throttle HTTP 429, got $blocked" >&2; exit 1; fi

echo "Runtime smoke passed: auth, packages, subscription UI, product CRUD creation, access restrictions and dashboard."
