import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { assertSameOrigin } from '../../../../../lib/request-security';

const patchSchema = z.object({ enabled: z.boolean().optional(), priority: z.number().int().min(0).max(10000).optional(), fallbackPriority: z.number().int().min(0).max(10000).optional(), verificationNote: z.string().max(2000).nullable().optional(), commercialUseNote: z.string().max(2000).nullable().optional() }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const input = patchSchema.parse(await request.json());
    const provider = await db.provider.update({ where: { id }, data: input });
    await db.auditLog.create({ data: { actorUserId: auth.context.user.id, action: 'provider.update', entityType: 'Provider', entityId: id, metadata: input } });
    return NextResponse.json({ ok: true, provider });
  } catch (error) {
    return NextResponse.json({ ok: false, code: error instanceof Error ? error.message : 'PROVIDER_UPDATE_FAILED' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  try {
    assertSameOrigin(request);
    const { id } = await params;
    await db.$transaction([db.provider.update({ where: { id }, data: { enabled: false } }), db.providerCredential.updateMany({ where: { providerId: id }, data: { enabled: false } })]);
    await db.auditLog.create({ data: { actorUserId: auth.context.user.id, action: 'provider.disable', entityType: 'Provider', entityId: id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, code: error instanceof Error ? error.message : 'PROVIDER_DISABLE_FAILED' }, { status: 400 });
  }
}
