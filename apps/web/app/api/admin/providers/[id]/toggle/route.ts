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
    const current = await db.provider.findUnique({ where: { id }, select: { enabled: true } });
    if (!current) throw new Error('PROVIDER_NOT_FOUND');
    const provider = await db.provider.update({ where: { id }, data: { enabled: !current.enabled } });
    await db.auditLog.create({ data: { actorUserId: auth.context.user.id, action: provider.enabled ? 'provider.enable' : 'provider.disable', entityType: 'Provider', entityId: id } });
    return NextResponse.redirect(new URL('/admin/providers?notice=updated', request.url), 303);
  } catch (error) {
    return NextResponse.redirect(new URL(`/admin/providers?error=${encodeURIComponent(error instanceof Error ? error.message : 'PROVIDER_TOGGLE_FAILED')}`, request.url), 303);
  }
}
