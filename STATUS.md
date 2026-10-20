# EntegrePilot — Implementation and verification status

Updated: 2026-10-20. **Always verify `main`, CI and Railway before citing a deployment.** See [PROJECT_STATE.md](PROJECT_STATE.md).

## Deployed application foundation
- Authentication, persistent sessions, workspace isolation and invitations; superadmin-only administration guarded on the server
- Customer workspace and administrator shells with separate menus
- Packages, feature entitlements, quota usage, workspace overrides
- AI provider registry, credentials, model router, Design Studio and Product Intelligence foundations
- Requirements/discovery conversations, notifications, audit and usage records
- Internal product catalog and SKU/barcode tooling
- **Internal manual orders**: persisted state transitions and audit records (not marketplace order syncing)
- **Internal inventory**: warehouse balances and ledger adjustments (not marketplace inventory sync)
- Dashboard V3: tenant-scoped operational metrics and real, Istanbul-time order chart
- Filtered OPEN order and LOW stock drilldowns; paginated record lists

## Verified automated gates
- npm lockfile install, production dependency audit, Prisma validation and clean PostgreSQL migration
- TypeScript, domain/security regression tests and Next production build
- Runtime smoke of auth, packages, tenant products and marketplace secrets
- Separate disposable PostgreSQL database: idempotent demo fixture seed and refusal to use customer data
- Real Chromium: superadmin and ordinary customer sessions; authorization, tenant data separation, navigation/back-forward, keyboard/scroll and overflow checks at **320, 375, 390, 430, 768, 1024, 1440 px** across Dashboard/Orders/Inventory/Admin
- CI screenshot artifacts are available for visual review. Browser geometry and interaction tests are not evidence of full manual visual acceptance.

## Beta or preview / not falsely presented as live
- Product and internal commerce operations: beta
- External Trendyol marketplace integration, product/order/inventory sync: preview or not connected
- Delivery, invoicing, returns/refunds and marketplace settlement: not production-integrated
- Automation capabilities and external AI provider integrations require feature-specific live verification
- Subscription payment charging, billing and customer checkout: not implemented as a payment flow

## Demo status
- PR #41 supplies a **secure, repeatable, fully tested isolated seed**: 1 non-superadmin demo ADMIN user, premium entitlements, 3 MOCK storefronts, example products, warehouses, orders and notifications
- No separate live demo application/database or usable public demo login was confirmed/provisioned in the inspected Railway environment
- Never seed fixtures into the production customer database or enable real marketplace connections for demo tenants

## Remaining gates
1. Human review of CI screenshots and actual mobile/touch-device acceptance
2. Fully isolated demo Railway resources and privately provisioned credentials if a live demo is required; account for hosting cost
3. Production tenant authorization/integration, object storage, backups/restore, load and security acceptance
4. True marketplace integrations only after supported APIs, idempotency, retry and reconciliation are verified

See [production acceptance](docs/PRODUCTION_ACCEPTANCE.md) and [isolated demo environment](docs/ISOLATED_DEMO_ENVIRONMENT.md).
