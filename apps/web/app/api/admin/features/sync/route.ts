import { NextResponse } from 'next/server';
import { requireSuperAdminApi } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { CORE_FEATURE_CATALOG } from '../../../../../lib/feature-catalog';
import { assertSameOrigin } from '../../../../../lib/request-security';

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok:false, code:auth.code }, { status:auth.status });
  try {
    assertSameOrigin(request);
    await db.$transaction(async (tx) => {
      for (const feature of CORE_FEATURE_CATALOG) {
        await tx.feature.upsert({
          where: { key: feature.key },
          create: { ...feature },
          update: { label: feature.label, module: feature.module, status: feature.status, description: 'description' in feature ? feature.description ?? null : null },
        });
      }
      await tx.auditLog.create({ data: { actorUserId:auth.context.user.id, action:'feature.catalog.sync', entityType:'Feature', metadata:{ count:CORE_FEATURE_CATALOG.length } } });
    });
    return NextResponse.redirect(new URL('/admin/packages?notice=features-synced', request.url), 303);
  } catch(error) {
    return NextResponse.redirect(new URL(`/admin/packages?error=${encodeURIComponent(error instanceof Error ? error.message : 'FEATURE_SYNC_FAILED')}`, request.url), 303);
  }
}
