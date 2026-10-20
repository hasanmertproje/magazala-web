import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

if (process.env.CI !== 'true'
  || !process.env.DATABASE_URL?.includes('@localhost:5432/')) {
  throw new Error('BROWSER_FIXTURES_ALLOWED_ONLY_IN_LOCAL_CI_DATABASE');
}

const db = new PrismaClient();
const email = 'ci-workspace@example.invalid';
try {
  const admin = await db.user.findUnique({ where: { email: 'ci-runtime@example.com' },
    include: { memberships: true } });
  if (!admin?.isSuperAdmin || !admin.memberships.length) {
    throw new Error('CI_SUPERADMIN_SETUP_REQUIRED');
  }
  const workspaceId = admin.memberships[0].workspaceId;
  const user = await db.user.upsert({
    where: { email },
    create: { email, passwordHash: await hash('CiWorkspacePassword123!', 10),
      displayName: 'CI Workspace User', isSuperAdmin: false },
    update: { isSuperAdmin: false },
  });
  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    create: { workspaceId, userId: user.id, role: 'USER' },
    update: { role: 'USER' },
  });
  const isolated = await db.workspace.upsert({
    where: { slug: 'ci-e2e-other-tenant' },
    create: { name: 'CI Other Tenant', slug: 'ci-e2e-other-tenant' },
    update: {},
  });
  await db.commerceOrder.upsert({
    where: { workspaceId_orderNumber: { workspaceId, orderNumber: 'CI-E2E-VISIBLE-ORDER' } },
    create: { workspaceId, orderNumber: 'CI-E2E-VISIBLE-ORDER', totalMinor: 22000, source: 'MANUAL', status: 'NEW' },
    update: {},
  });
  await db.commerceOrder.upsert({
    where: { workspaceId_orderNumber: { workspaceId: isolated.id, orderNumber: 'CI-E2E-HIDDEN-ORDER' } },
    create: { workspaceId: isolated.id, orderNumber: 'CI-E2E-HIDDEN-ORDER', totalMinor: 9999999, source: 'MANUAL', status: 'NEW' },
    update: {},
  });
  console.log('CI browser fixtures created (two roles, two isolated tenants).');
} finally {
  await db.$disconnect();
}
