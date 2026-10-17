import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

if (process.env.CI !== 'true') throw new Error('DEMO_SEED_CHECK_IS_CI_ONLY');
const suffix = randomBytes(6).toString('hex');
const name = 'ci_demo_' + suffix;
const mainUrl = new URL(process.env.DATABASE_URL);
const demoUrl = new URL(mainUrl);
demoUrl.pathname = '/' + name;

const adminDb = new PrismaClient();
let demoDb;
let created = false;
try {
  await adminDb.$executeRawUnsafe('CREATE DATABASE "' + name + '"');
  created = true;

  const env = {
    ...process.env,
    DATABASE_URL: demoUrl.toString(),
    DEMO_EMAIL: 'ci-demo@example.invalid',
    DEMO_PASSWORD: randomBytes(32).toString('base64url'),
    DEMO_ISOLATED_DATABASE: 'isolated-demo-only',
    RAILWAY_ENVIRONMENT_NAME: 'ci-isolated-demo',
    APP_URL: 'http://localhost:4400',
  };
  const command = (program, args, settings = env) =>
    execFileSync(program, args, { env: settings, stdio: 'pipe', timeout: 120000 });

  command('npm', ['run', 'prisma:migrate:deploy']);
  command('node', ['scripts/seed-isolated-demo.mjs']);
  demoDb = new PrismaClient({ datasources: { db: { url: demoUrl.toString() } } });

  async function snapshot() {
    return Promise.all([
      demoDb.user.count(), demoDb.workspace.count(), demoDb.package.count(),
      demoDb.storeConnector.count(), demoDb.product.count(), demoDb.warehouse.count(),
      demoDb.stockBalance.count(), demoDb.stockMovement.count(),
      demoDb.commerceOrder.count(), demoDb.commerceOrderEvent.count(), demoDb.notification.count(),
    ]);
  }
  const initial = await snapshot();
  assert.deepEqual(initial, [1, 1, 1, 3, 10, 2, 20, 20, 42, 42, 3]);
  const user = await demoDb.user.findFirst({ include: { memberships: { include: { workspace: { include: { package: true } } } } } });
  assert.equal(user.isSuperAdmin, false);
  assert.equal(user.memberships[0].role, 'ADMIN');
  assert.equal(user.memberships[0].workspace.package.slug, 'kurumsal-demo');
  const mockCount = await demoDb.storeConnector.count({ where: { mode: 'MOCK', encryptedConfig: null, enabled: false } });
  assert.equal(mockCount, 3);
  const preview = await demoDb.packageFeature.findMany({ where: { packageId: user.memberships[0].workspace.packageId }, include: { feature: true } });
  assert.ok(preview.some(x => x.feature.key === 'commerce.products' && x.enabled));
  assert.ok(preview.every(x => x.feature.status !== 'PREVIEW' || !x.enabled));

  // Run twice: reseeding changes no record counts and never creates duplicate orders or stock movements.
  await demoDb.$disconnect();
  demoDb = null;
  command('node', ['scripts/seed-isolated-demo.mjs']);
  demoDb = new PrismaClient({ datasources: { db: { url: demoUrl.toString() } } });
  assert.deepEqual(await snapshot(), initial);

  // Hard guard: production-like database with an unrelated user must refuse all seed writes.
  await demoDb.user.create({ data: {
    email: 'existing-customer@example.invalid',
    passwordHash: 'no-real-credential', isSuperAdmin: false,
  } });
  await demoDb.$disconnect();
  demoDb = null;
  assert.throws(() => command('node', ['scripts/seed-isolated-demo.mjs']),
    /DEMO_SEED_REFUSES_NON_DEMO_DATABASE/);
  console.log('Isolated demo: complete fixture set, idempotence, premium limits, mock-only connections and customer-data guard passed.');
} finally {
  if (demoDb) await demoDb.$disconnect();
  if (created) await adminDb.$executeRawUnsafe('DROP DATABASE IF EXISTS "' + name + '" WITH (FORCE)');
  await adminDb.$disconnect();
}
