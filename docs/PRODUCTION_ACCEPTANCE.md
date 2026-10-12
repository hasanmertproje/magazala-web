# Production Acceptance

This checklist defines what may be claimed as production-ready for the current Magazala core.

## Infrastructure
- [ ] `npm run preflight:production` passes with production environment values.
- [ ] `npm run prisma:migrate:deploy` succeeds against a clean PostgreSQL database.
- [ ] `GET /api/health/live` returns HTTP 200.
- [ ] `GET /api/health/ready` returns HTTP 200 after database and required storage/configuration are available.
- [ ] Private S3-compatible object storage is reachable from the application runtime.

## Authentication / tenancy
- [ ] Fresh installation allows `/setup` only before the first user exists.
- [ ] First setup creates a super-admin and workspace membership.
- [ ] Login/logout/session persistence works after restart.
- [ ] Workspace switching only accepts real memberships.
- [ ] Invitation tokens are single-use, expiring and stored only as hashes.
- [ ] Cross-workspace asset, generation, research and requirement IDs cannot be opened by another workspace.

## Admin / SaaS control
- [ ] Customer workspace can be opened from Admin > Müşteriler.
- [ ] Package assignment and feature overrides persist.
- [ ] Last workspace admin cannot be accidentally removed/demoted.
- [ ] Provider credentials remain masked in UI and encrypted at rest.
- [ ] Provider/model runtime readiness never claims unsupported adapters as active.

## AI Design Studio
- [ ] At least one supported image provider/model is configured and healthy.
- [ ] A generation stores its provider/model attempt and usage record.
- [ ] Generated image bytes are stored privately and can be read only through authorized asset access.
- [ ] Reference upload and image-to-image flow enforce workspace scope.
- [ ] Generation history reopens correctly.
- [ ] Parent/child variation lineage persists in the database.

## Product Intelligence
- [ ] Idea Mode does not fabricate external market metrics.
- [ ] Research Mode only runs when an approved research endpoint is configured.
- [ ] Search snippets are not represented as full-page/direct verification.
- [ ] Saved research/idea sessions can be reopened without a new provider call.
- [ ] Opportunity-to-Design-Studio handoff preserves risk/provenance context.

## Tasarlayalım AI / requirements
- [ ] User can open one central `Özellikler Hakkında Konuş` conversation.
- [ ] AI analysis stays separate from raw user conversation.
- [ ] Requirement is created only after user confirmation.
- [ ] Admin sees requirement queue/detail and can set status/priority.
- [ ] Admin clarification and user reply use the separate clarification thread.
- [ ] Requirement export contains raw conversation, AI analysis, confirmed requirement, clarification thread and feature snapshot as separate sections.
- [ ] Notification center surfaces requirement/clarification events.

## Production copy / integrity
- [ ] No customer-specific personal heading or copy is committed to the product UI.
- [ ] No Lorem Ipsum, TODO or FIXME markers exist in production application/core source.
- [ ] Beta/Preview marketplace, inventory and automation features are not described as production-connected.

## CI release gate
A change may merge to `main` only after the pull request CI succeeds on:
1. dependency installation and high-severity production audit,
2. Prisma generate/validate,
3. clean PostgreSQL migration deployment,
4. production configuration preflight,
5. production text policy,
6. core tests and TypeScript checks,
7. Next production build.

## Explicitly outside current production acceptance
- Live Trendyol publishing/synchronization
- Final marketplace product mapping rules
- Final warehouse/shelf/inventory workflows
- Order/fulfillment workflows
- Production accounting integrations

Those workflows remain Beta/Preview until real operational requirements are confirmed and separately accepted.
