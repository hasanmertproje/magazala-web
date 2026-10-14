# EntegrePilot — PoyrazHosting Reseller P1 / cPanel deployment plan

Target: https://entegrepilot.tasarlayalim.com
Temporary brand/domain only. The permanent apex domain may be configured later.

## Critical hosting compatibility finding

EntegrePilot is a **server-rendered Next.js 16 + Prisma + PostgreSQL + S3** application, NOT a static HTML site. Do not put a build's `dist`, `.next` or source files in cPanel `public_html` expecting the app to work.

PoyrazHosting's publicly advertised Reseller P1 features do not guarantee a persistent Next.js process, PostgreSQL access, Linux shell or container support. A cPanel Node.js Selector, if enabled on *this exact account*, uses CloudLinux/Passenger and may require a CommonJS startup file and provider permission to run the app; this still **does not supply PostgreSQL or S3**, nor does it guarantee enough RAM/CPU. No SSH/terminal is available in the known reseller account. Therefore a full cPanel-only production deployment is **not verified**.

## Deployable, minimal-risk topology (recommended now)

1. Keep the existing **Railway** application service, PostgreSQL database and `MagazalaAssets` object bucket online. Do not delete the existing database.
2. Change the application brand and configure `APP_URL=https://entegrepilot.tasarlayalim.com` on the Railway web service **at the same time as domain routing**. `APP_URL` is used for redirects and origin security, so misconfiguration can break login/setup.
3. Railway > project `magazala-test` > service `magazala-web` > Settings > Networking > **Custom Domain**: add `entegrepilot.tasarlayalim.com`. Copy the exact DNS record and value Railway gives you.
4. In the **authoritative DNS provider** for `tasarlayalim.com` (which might be PoyrazHosting DNS, Cloudflare or your registrar; check nameservers), create exactly the required CNAME/TXT records using values displayed by Railway. Do not guess the target hostname; do not proxy through cPanel File Manager.
5. Wait for Railway's DNS/TLS verification to complete, then test `https://entegrepilot.tasarlayalim.com/api/health/live` and `/api/health/ready`, anonymous login routing, credentialed session, private assets, and upload.
6. Once verified, deprecate the temporary railway.app URL in user-facing messages; leave it available for rollback until acceptance is complete.
7. In the future, attach the permanent domain as a second Railway custom domain, prepare DNS/TLS, update `APP_URL`, test all redirects/cookies/Origin checks, then retire the temporary subdomain.

**Where PoyrazHosting P1 participates:** domain/DNS and existing websites/email. Railway continues to run the actual EntegrePilot backend. This is a hybrid solution, not a claim that the app has migrated to cPanel.

## Full migration to cPanel (only if separately verified)

Requires all of:
- Actual cPanel Node.js Selector with Node.js 22 and working Passenger startup;
- verified server-side Next.js process startup, environment variables and sufficient CPU/RAM;
- remote PostgreSQL securely reachable from Poyraz server IP **or** a supported managed PostgreSQL service;
- functioning S3-compatible storage, external image APIs and outbound HTTPS;
- a reliable build or prebuilt upload route with native package compatibility (Prisma query engine/OpenSSL);
- deploy-time database migration process without SSH (not optional);
- healthcheck, backups, rotation of secrets and rollback.

CloudLinux documentation: https://docs.cloudlinux.com/cloudlinuxos/cloudlinux_os_components/
Poyraz reseller plan: https://www.poyrazhosting.com.tr/reseller_hosting.php

Do not attempt direct migration until these requirements are demonstrated on the actual account.

## Invariants
- Do not change Prisma table names, npm workspace package names or GitHub repo name as part of visual rebranding.
- Keep secrets out of Git.
- No database reset or privileged account recreation.
- `/setup` stays protected after the first admin exists.
- Auth recovery must remain explicit, time-limited and operator-authorized.
- Do not enable Preview commerce integrations as real fulfillment.
