# PROJECT_STATE.md

Updated: 2026-10-13
Project: Magazala Web
Version: 0.1.0 (package metadata; no release claim)
Repository: https://github.com/hasanmertproje/magazala-web
Default branch: main
Working branch: hardening/production-gates-20261013
Baseline SHA: d07fd280521527fefd88750473c6ae2ccca21246

## Stack
Next.js 16, React 19, TypeScript, npm workspaces, Prisma 6, PostgreSQL, S3-compatible private object storage, Node 22, Docker, GitHub Actions.

## Architecture
- apps/web: application and API
- packages/core: shared domain
- prisma: database schema/migrations
- AI text providers: NVIDIA NIM, Gemini, Cloudflare Workers AI
- Workspace-scoped tenancy; encrypted provider credentials

## Existing capabilities (code presence; operational verification required)
Session/setup, workspaces/invitations, SaaS package/entitlements, provider registry/router, Design Studio, Product Intelligence, requirement discovery, notifications/audit/usage.
Beta: products, SKU/barcode, import/export, automation.
Preview only: Trendyol, inventory/warehouse, order fulfillment.

## Current changes
- Public redirect URL derivation no longer trusts X-Forwarded-Host / X-Forwarded-Proto; requires APP_URL in production; production public origin HTTPS except loopback.
- Docker multi-stage build separates build/runtime and runtime uses non-root node user.
- CI workflow now triggers on push to main in addition to pull_request.

## Test evidence
- GitHub file mutations succeeded. CI build/typecheck/test/runtime smoke NOT YET verified for this branch.
- No live Railway, external provider, PostgreSQL or S3 acceptance testing has been performed.
- CI currently has a PostgreSQL service but no live S3 integration test.
- A successful CI run and independent security validation are release gates.

## Security
- Potential proxy spoofing vector reduced by trusting configured APP_URL, not forwarded headers.
- Cross-workspace API authorization remains to be exhaustively verified.
- Readiness checks DB plus storage configuration presence, not live S3 reachability.
- Verify credentials, CSP, CSRF, rate limiting, upload scanning, storage ACL, dependencies, secrets and container filesystem.

## Open issues
1. Verify CI status and fix any failures before merge.
2. Improve storage readiness checks and explicit e2e tests.
3. Review auth/session, tenancy boundaries, authorization and request security.
4. Verify AI real provider calls, cost/quota enforcement, private assets.
5. Complete commerce operational rules before making live inventory/marketplace mutations.
6. Run production acceptance checklist and deployment smoke against actual infrastructure.

## Commands
npm ci
npm run prisma:migrate:deploy
npm run preflight:production
npm run check
npm run build
bash scripts/runtime-smoke.sh

## Next task
Review new PR CI results, resolve any regressions, then add dedicated authorization/isolation integration tests and runtime object storage health checks. Do not claim production-ready until docs/PRODUCTION_ACCEPTANCE.md passes against live configuration.
