# PROJECT_STATE.md

Updated: 2026-10-13
Project: Magazala Web
Version: 0.1.0 (package metadata; no release claim)
Repository: https://github.com/hasanmertproje/magazala-web
Default branch: main
Current branch: main
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

## Merged and verified changes
- PR #18 merged as 57a20627e5ed5657d10b0baad276b72c751c2932 (CI #75 success)
- PR #19 merged as b3704c688c57264dae526c3507d303fc3240c3a8 (CI #77 success)
- Automated request-origin regression tests added and executed via npm run check.

## Current changes
- Public redirect URL derivation no longer trusts X-Forwarded-Host / X-Forwarded-Proto; requires APP_URL in production; production public origin HTTPS except loopback.
- Docker multi-stage build separates build/runtime and runtime uses non-root node user.
- CI workflow now triggers on push to main in addition to pull_request.

## Test evidence
- PR #18 CI #75: success (npm ci, audit, Prisma validation/migration, preflight, core and type checks, build, runtime smoke).
- PR #19 CI #77: success (same gates plus new request-origin regression suite).
- No live Railway, external provider, PostgreSQL or S3 acceptance testing has been performed.
- CI currently has a PostgreSQL service but no live S3 integration test.
- A successful CI run and independent security validation are release gates.

## Security
- Potential proxy spoofing vector reduced by trusting configured APP_URL, not forwarded headers.
- Cross-workspace API authorization remains to be exhaustively verified.
- Readiness checks DB plus storage configuration presence, not live S3 reachability.
- Verify credentials, CSP, CSRF, rate limiting, upload scanning, storage ACL, dependencies, secrets and container filesystem.

## Open issues
1. Monitor main push CI and validate live deployment before production release.
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

## Account recovery change (2026-10-13)
- PR #20 merged and deployed to Railway (commit 8b9a1b7); /setup is super-admin-only after first user exists.
- PR #21 adds gated single-use /recover route and user session revocation migration; requires CI and Railway deployment validation.
- Operator must set ADMIN_RECOVERY_TOKEN (>=32 random characters) and ADMIN_RECOVERY_EXPIRES_AT (ISO8601 short TTL) on the Railway web service before recovery.
- Recovery requires a matching super-admin email, or when omitted requires exactly one super-admin. Never creates admins or clears database.
- After successful recovery, remove temporary Railway recovery variables and verify old JWT sessions are rejected.

## EntegrePilot brand and hosting — 2026-10-14
- User selected EntegrePilot as the public brand; temporary domain: https://entegrepilot.tasarlayalim.com.
- Keep technical/internal package and schema IDs untouched to avoid destructive changes.
- PoyrazHosting Reseller P1 has not been verified as compatible with long-running Next.js + Prisma/PostgreSQL. Prefer Railway application + DB + S3 with custom domain DNS under tasarlayalim.com. See docs/ENTEGREPILOT_CPANEL_DEPLOYMENT.md.
- Blockers for live custom-domain cutover: authoritative DNS access and Railway custom domain records/SSL verification. No DNS change, environment secret rotation, or DB migration to cPanel performed in this PR.


## Commerce-first SaaS overhaul (2026-10-14, feature branch)
- Visual direction: actual responsive Tabler-inspired operations console (original CSS/JSX, not a screenshot).
- Core IA: commerce/store management primary; visual generation and product research under Add-ons.
- Dashboard: tenant-scoped store, product, draft, listing and file counts; actual 14-day product-creation chart, store status, and no synthetic order/sales metrics.
- Store overview: DB-backed connector rows, environment labels, errors and linkage counts; Preview connectors not represented as live Trendyol integrations.
- Product catalog: authenticated tenant-scoped product GET/POST with entitlement enforcement, Zod validation and audit trail, plus operational UI.
- Three monthly tiers: Başlangıç 20 image credits; Gelişim 100 image and 30 research; Kurumsal 500 image and 150 research. Non-destructive Prisma migration provisions packages; super-admins may assign package per workspace and set per-feature overrides. Existing UsageQuota enforces monthly UTC quota per feature. Pricing and payment capture are **not implemented**; no subscriptions are charged.
- Package overview page: assigned package + actual quota utilization.
- CI smoke tests expanded to cover package presets, authorization and product persistence.

### Not yet implemented or verified
1. Order lifecycle, fulfillment, returns/refunds, invoicing, stock reservations, warehouse movements.
2. Real Trendyol and other marketplace OAuth/API credentials, product/order/stock sync, webhook signatures, scheduling, idempotency, retries, rate limits, reconciliation and conflict resolution.
3. Production payment subscription billing, invoices, customer checkout, renewal, cancellation, proration and payment webhooks.
4. Credit wallet transaction ledger or billing settlement beyond monthly per-feature UsageQuota; monthly plan limits should not be described as prepaid currency.
5. Responsive browser-based visual regression, keyboard/a11y audit, load test, end-to-end tenancy and object storage verification.
6. Global security hardening, CSRF/SSRF/rate-limiting boundary review, subdomain migration and secret expiry policy.

Keep unavailable features marked Preview; never publish fake revenue, order counts or connected stores. Do not claim SaaS release readiness before these gates pass.
