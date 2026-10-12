import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { assertSameOrigin, isHtmlForm } from '../../../../lib/request-security';

const pricing = z.enum(['FREE_ENDPOINT','FREE_CREDIT','FREE_TIER','TRIAL','PAID','SELF_HOSTED','UNKNOWN','NEEDS_REVERIFY']);
const schema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  pricingClassification: pricing,
  officialWebsite: z.string().url().optional().or(z.literal('')),
  docsUrl: z.string().url().optional().or(z.literal('')),
  keyAcquisitionUrl: z.string().url().optional().or(z.literal('')),
});

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const providers = await db.provider.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }], include: { credentials: { select: { id: true, label: true, maskedHint: true, enabled: true, lastSuccessAt: true, lastErrorAt: true, lastErrorCode: true } }, health: { orderBy: { checkedAt: 'desc' }, take: 1 } } });
  return NextResponse.json({ ok: true, providers });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const form = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const raw = form ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    const provider = await db.provider.create({ data: { ...input, officialWebsite: input.officialWebsite || null, docsUrl: input.docsUrl || null, keyAcquisitionUrl: input.keyAcquisitionUrl || null, enabled: false } });
    await db.auditLog.create({ data: { actorUserId: auth.context.user.id, action: 'provider.create', entityType: 'Provider', entityId: provider.id } });
    if (form) return NextResponse.redirect(new URL('/admin/providers?notice=created', request.url), 303);
    return NextResponse.json({ ok: true, provider }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PROVIDER_CREATE_FAILED';
    if (form) return NextResponse.redirect(new URL(`/admin/providers?error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: 400 });
  }
}
