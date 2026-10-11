import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { assertSameOrigin, isHtmlForm } from '../../../../lib/request-security';

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  priceMinor: z.preprocess((value) => value === '' || value == null ? null : Number(value), z.number().int().min(0).nullable()),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional().or(z.literal('')),
});

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok:false, code:auth.code }, { status:auth.status });
  const form = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const raw = form ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    const item = await db.package.create({ data:{ name:input.name, slug:input.slug, priceMinor:input.priceMinor, currency:input.currency || null } });
    await db.auditLog.create({ data:{ actorUserId:auth.context.user.id, action:'package.create', entityType:'Package', entityId:item.id } });
    if (form) return NextResponse.redirect(new URL('/admin/packages?notice=package-created',request.url),303);
    return NextResponse.json({ok:true,package:item},{status:201});
  } catch(error) {
    const code=error instanceof Error?error.message:'PACKAGE_CREATE_FAILED';
    if(form)return NextResponse.redirect(new URL(`/admin/packages?error=${encodeURIComponent(code)}`,request.url),303);
    return NextResponse.json({ok:false,code},{status:400});
  }
}
