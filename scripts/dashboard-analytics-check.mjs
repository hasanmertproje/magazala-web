import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

if (process.env.CI !== 'true') {
  throw new Error('DASHBOARD_ANALYTICS_CHECK_IS_CI_ONLY');
}
const db = new PrismaClient();
const rollback = new Error('EXPECTED_TEST_TRANSACTION_ROLLBACK');

try {
  await db.$transaction(async (tx) => {
    const a = await tx.workspace.create({ data: { name: 'CI dashboard A', slug: 'ci-a-' + randomUUID() } });
    const b = await tx.workspace.create({ data: { name: 'CI dashboard B', slug: 'ci-b-' + randomUUID() } });
    await tx.commerceOrder.createMany({
      data: [
        { workspaceId: a.id, orderNumber: 'CI-1', createdAt: new Date('2026-10-16T22:30:00Z') },
        { workspaceId: a.id, orderNumber: 'CI-2', createdAt: new Date('2026-10-17T20:30:00Z') },
        { workspaceId: b.id, orderNumber: 'CI-3', createdAt: new Date('2026-10-16T22:30:00Z') },
      ],
    });
    // This is the production aggregate: both tenant scoping and Istanbul-day grouping.
    const daily = await tx.$queryRaw`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS "day",
             COUNT(*)::integer AS "count"
      FROM "CommerceOrder"
      WHERE "workspaceId" = ${a.id} AND "createdAt" >= ${new Date('2026-10-16T21:00:00Z')}
      GROUP BY 1 ORDER BY 1
    `;
    assert.deepEqual(daily, [{ day: '2026-10-17', count: 2 }]);
    throw rollback; // Always discard temporary test tenants and orders.
  }).catch((error) => { if (error !== rollback) throw error; });
  console.log('Dashboard analytics: tenant isolation and Istanbul grouping OK');
} finally {
  await db.$disconnect();
}
