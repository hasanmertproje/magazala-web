# EntegrePilot — Security and release review (2026-10-14)

Scope: repository source audit + GitHub CI + Railway service health. NOT a penetration test.

## Verified controls in source
- Session cookie is HTTP-only, Secure in production, SameSite=Lax and HMAC signed.
- Workspace selection resolves membership before privileged requests.
- Admin API endpoints use requireSuperAdminApi; admin routes are gated by requireSuperAdminPage in admin layout.
- Mutation endpoints tested enforce origin and server-side authorization.
- Provider credentials have encryption infrastructure; do not print/log key values.
- Product create endpoint enforces workspace scoping and feature entitlement, validates input and avoids exposing raw Prisma SQL errors.
- Login attempts are limited by atomic PostgreSQL counter per hashed account identifier, shared across replicas (PR #28), ten attempts per 15 minutes. Email/password plaintext is never stored in the limiter.
- CI verifies Prisma migrations on PostgreSQL, TS build, tests, runtime smoke and throttling.

## Remaining release blockers
1. Login throttle is identifier-based, not trusted-IP-based; configure edge/WAF anti-abuse and periodic expired-bucket cleanup.
2. No full cross-tenant access-control integration suite yet across all endpoints (especially marketplace listings, assets and admin operations).
3. API mutator CSRF, body limits, CSP, rate limits, outbound URL allowlists and SSRF surfaces require endpoint-by-endpoint assessment.
4. No production load test, private object-store connectivity smoke or external API credential rotation drill.
5. Billing, renewal, payment reconciliation, stock and order models are incomplete; do not accept paid orders or claim live Trendyol integration.
6. Provider API costs and workspace quota enforcement need concurrency tests and a durable billing ledger before charging customers.
7. Mobile/a11y browser-based visual regression is pending; CI smoke tests do not simulate real devices.
8. Recovery token must remain disabled/expired; do not expose admin recovery without owner-controlled short-lived authorization.

## Critical marketplace API versioning
Trendyol Product V2 must be used; old Product V1 was deprecated in September 2026.
Trendyol Order V2 becomes mandatory on October 15, 2026. Endpoint example:
`GET https://apigw.trendyol.com/integration/order/sellers/{sellerId}/v2/orders`.
Stage endpoint: `https://stageapigw.trendyol.com/integration/order/sellers/{sellerId}/v2/orders`.
Do not implement old Order V1 endpoints. Require Seller ID and master-user API credentials; use fixed allowlisted hosts, Basic Auth and User-Agent as documented; encrypt at rest. Implement paging / <=10,000 package window, idempotent upsert, scheduling, webhook verification, errors/retry/backoff and reconciliation before setting any connector LIVE.

Official sources:
https://developers.trendyol.com/tr/
https://developers.trendyol.com/tr/docs/2-authorization
https://developers.trendyol.com/docs/sipari%C5%9F-paketlerini-%C3%A7ekme-getshipmentpackages

## Actual release status
The commerce-first package and monthly-plan foundation are shipped. This does **not** mean order management, payment subscriptions, invoicing, Trendyol live sync or full production security are complete.
