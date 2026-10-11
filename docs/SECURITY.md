# Security Notes

## Dependency audit policy

CI fails on `npm audit --omit=dev --audit-level=high` findings. High-severity advisories are not hidden by raising the audit threshold and `npm audit fix --force` is not applied blindly.

### deepmerge-ts override

As of 2026-10-11, Prisma's configuration package resolves a vulnerable `deepmerge-ts` 7.x release affected by GHSA-ggr8-5vv4-36mx / CVE-2026-40345 (stack exhaustion on recursive object graphs). The patched line is `deepmerge-ts >= 8.0.0`.

The repository overrides `deepmerge-ts` to `8.0.2` instead of accepting npm's suggested forced downgrade of Prisma. This path is used by Prisma configuration/build tooling rather than Magazala's HTTP request runtime, but the known vulnerable package is still removed from the dependency tree.

Removal condition: remove this override once the pinned Prisma toolchain resolves `deepmerge-ts >= 8.0.0` itself, then confirm all of the following remain green:

- `npm audit --omit=dev --audit-level=high`
- `npm run prisma:generate`
- `npm run check`
- `npm run build`

## Secrets

Provider API credentials are entered through the admin Provider Center, encrypted with `CREDENTIAL_ENCRYPTION_KEY`, and never returned to the browser in plaintext. Provider secrets must not be committed to the repository or placed into client-side environment variables.

## Tenant isolation

Workspace-scoped resources must always be selected with the authenticated workspace ID. UI feature hiding is not authorization; entitlements and workspace scope are enforced server-side.
