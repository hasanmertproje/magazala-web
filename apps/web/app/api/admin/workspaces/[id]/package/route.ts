import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../../../lib/auth';
import { db } from '../../../../../../lib/db';
import { safeInternalPath } from '../../../../../../lib/navigation';
import { assertSameOrigin, isHtmlForm } from '../../../../../../lib/request-security';

const schema = z.object({
  packageId: z.string().optional().transform((value) => value?.trim() || null),
  returnTo: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const form = isHtmlForm(request);
  let returnTo = '/admin/packages';
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const raw = form ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    returnTo = safeInternalPath(input.returnTo, '/admin/packages');
    if (input.packageId && !await db.package.findUnique({ where: { id: input.packageId }, select: { id: true } })) throw new Error('PACKAGE_NOT_FOUND');
    const workspace = await db.workspace.update({ where: { id }, data: { packageId: input.packageId } });
    await db.auditLog.create({ data: { actorUserId: auth.context.user.id, workspaceId: id, action: 'workspace.package.assign', entityType: 'Workspace', entityId: id, metadata: { packageId: input.packageId } } });
    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}notice=package-assigned`, request.url), 303);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PACKAGE_ASSIGN_FAILED';
    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: 400 });
  }
}
