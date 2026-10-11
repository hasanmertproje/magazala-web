import { NextResponse } from 'next/server';
import { requireSuperAdminApi } from '../../../../../../lib/auth';
import { db } from '../../../../../../lib/db';
import { revealProviderSecret } from '../../../../../../lib/provider-credentials';
import { testKnownProvider } from '../../../../../../lib/provider-health';
import { assertSameOrigin } from '../../../../../../lib/request-security';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const provider = await db.provider.findUnique({ where: { id }, include: { credentials: { where: { enabled: true }, orderBy: { updatedAt: 'desc' }, take: 1 } } });
    if (!provider) throw new Error('PROVIDER_NOT_FOUND');
    const credential = provider.credentials[0];
    if (!credential) throw new Error('PROVIDER_CREDENTIAL_REQUIRED');
    const secret = await revealProviderSecret(credential.encryptedValue);
    const result = await testKnownProvider(provider.slug, secret);
    if (!result.supported) return NextResponse.redirect(new URL(`/admin/providers?error=${encodeURIComponent(result.code)}`, request.url), 303);

    await db.$transaction([
      db.providerHealth.create({ data: { providerId: id, status: result.status, latencyMs: result.latencyMs, detail: result.detail } }),
      db.providerCredential.update({ where: { id: credential.id }, data: result.status === 'HEALTHY' ? { lastSuccessAt: new Date(), lastErrorCode: null } : { lastErrorAt: new Date(), lastErrorCode: result.code } }),
    ]);
    await db.auditLog.create({ data: { actorUserId: auth.context.user.id, action: 'provider.connection.test', entityType: 'Provider', entityId: id, metadata: { status: result.status, code: result.code, latencyMs: result.latencyMs } } });
    return NextResponse.redirect(new URL(`/admin/providers?notice=tested&status=${encodeURIComponent(result.status)}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(new URL(`/admin/providers?error=${encodeURIComponent(error instanceof Error ? error.message : 'PROVIDER_TEST_FAILED')}`, request.url), 303);
  }
}
