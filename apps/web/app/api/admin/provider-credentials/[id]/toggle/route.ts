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
    const current = await db.providerCredential.findUnique({ where: { id }, select: { enabled: true, providerId: true } });
    if (!current) throw new Error('PROVIDER_CREDENTIAL_NOT_FOUND');
    const credential = await db.providerCredential.update({ where: { id }, data: { enabled: !current.enabled } });
    await db.auditLog.create({ data: { actorUserId: auth.context.user.id, action: credential.enabled ? 'provider.credential.enable' : 'provider.credential.disable', entityType: 'ProviderCredential', entityId: id, metadata: { providerId: current.providerId } } });
    return NextResponse.redirect(new URL('/admin/providers?notice=credential-updated', request.url), 303);
  } catch (error) {
    return NextResponse.redirect(new URL(`/admin/providers?error=${encodeURIComponent(error instanceof Error ? error.message : 'CREDENTIAL_TOGGLE_FAILED')}`, request.url), 303);
  }
}
