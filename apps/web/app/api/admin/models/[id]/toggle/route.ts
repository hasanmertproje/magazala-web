import { NextResponse } from 'next/server';
import { requireSuperAdminApi } from '../../../../../../lib/auth';
import { db } from '../../../../../../lib/db';
import { assertSameOrigin } from '../../../../../../lib/request-security';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const current = await db.aIModel.findUnique({ where: { id }, include: { capabilities: true, provider: { include: { credentials: { where: { enabled: true }, take: 1 } } } } });
    if (!current) throw new Error('MODEL_NOT_FOUND');
    if (!current.enabled) {
      if (!current.provider.enabled) throw new Error('PROVIDER_MUST_BE_ENABLED');
      if (current.provider.credentials.length === 0) throw new Error('PROVIDER_CREDENTIAL_REQUIRED');
      if (current.capabilities.length === 0) throw new Error('MODEL_CAPABILITY_REQUIRED');
    }
    const model = await db.aIModel.update({ where: { id }, data: { enabled: !current.enabled } });
    await db.auditLog.create({ data: { actorUserId: auth.context.user.id, action: model.enabled ? 'model.enable' : 'model.disable', entityType: 'AIModel', entityId: id } });
    return NextResponse.redirect(new URL('/admin/models?notice=updated', request.url), 303);
  } catch (error) {
    return NextResponse.redirect(new URL(`/admin/models?error=${encodeURIComponent(error instanceof Error ? error.message : 'MODEL_TOGGLE_FAILED')}`, request.url), 303);
  }
}
