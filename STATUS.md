# Implementation Status

## Production-connected core
- Authentication setup/login/logout + persistent session
- Workspace isolation, invitations and workspace switching
- Customer/workspace control center
- Package, entitlement, feature override and quota foundation
- Provider Center with encrypted credentials
- Model registry, provider discovery and Smart Model Router
- Supported text/image provider runtime adapters
- AI Design Studio generation, reference upload, private storage, history and lineage
- Product Intelligence Idea/Research modes, provenance and saved sessions
- Tasarlayalım AI discovery conversations
- User-confirmed requirements
- Admin requirement queue, status/priority, clarification threads and exports
- Notifications, audit logs and usage ledger
- System Health + public liveness/readiness endpoints

## Beta
- Products
- Internal SKU/barcode foundation
- Import/export data model
- Automation foundation

## Preview / intentionally not production-connected
- Marketplace stores and synchronization
- Trendyol live publishing/sync
- Inventory/warehouse/shelf workflows
- Orders/fulfillment

These areas remain visible as product direction but must be finalized from real operational requirements before live marketplace or inventory mutations are enabled.

## Production gates
- Pull request CI performs dependency audit, Prisma validation, clean PostgreSQL migration deployment, production preflight, text-policy scan, tests/typechecks and Next production build.
- Production deploy must provide PostgreSQL, S3-compatible private object storage, secure session/encryption secrets and at least the AI providers required by enabled features.
- Source-backed Product Intelligence Research additionally requires an approved SearXNG endpoint.
