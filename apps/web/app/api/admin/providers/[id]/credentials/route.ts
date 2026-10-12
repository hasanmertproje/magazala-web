import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../../../lib/auth';
import { db } from '../../../../../../lib/db';
import { protectProviderSecret } from '../../../../../../lib/provider-credentials';
import { assertSameOrigin, isHtmlForm } from '../../../../../../lib/request-security';

const schema = z.object({ label: z.string().trim().min(2).max(80), secret: z.string().min(8).max(4096) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const form = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const { id } = await params;
    if (!await db.provider.findUnique({ where: { id }, select: { id: true } })) throw new Error('PROVIDER_NOT_FOUND');
    const raw = form ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    const protectedSecret = await protectProviderSecret(input.secret);
    const credential = await db.providerCredential.create({ data: { providerId: id, label: input.label, encryptedValue: protectedSecret.encryptedValue, maskedHint: protectedSecret.maskedHint } });
    await db.auditLog.create({ data: { actorUserId: auth.context.user.id, action: 'provider.credential.create', entityType: 'ProviderCredential', entityId: credential.id, metadata: { providerId: id, label: input.label } } });
    if (form) return NextResponse.redirect(new URL('/admin/providers?notice=credential-added', request.url), 303);
    return NextResponse.json({ ok: true, credential: { id: credential.id, label: credential.label, maskedHint: credential.maskedHint } }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CREDENTIAL_CREATE_FAILED';
    if (form) return NextResponse.redirect(new URL(`/admin/providers?error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: 400 });
  }
}
