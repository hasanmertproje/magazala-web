import { NextResponse } from 'next/server';
import { requireSuperAdminApi } from '../../../../../../../../lib/auth';
import { db } from '../../../../../../../../lib/db';
import { safeInternalPath } from '../../../../../../../../lib/navigation';
import { assertSameOrigin, isHtmlForm } from '../../../../../../../../lib/request-security';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; featureId: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const form = isHtmlForm(request);
  let returnTo = '/admin/packages';
  try {
    assertSameOrigin(request);
    if (form) {
      const data = await request.formData();
      returnTo = safeInternalPath(data.get('returnTo'), '/admin/packages');
    }
    const { id, featureId } = await params;
    if (!await db.workspace.findUnique({ where: { id }, select: { id: true } })) throw new Error('WORKSPACE_NOT_FOUND');
    const removed = await db.workspaceFeatureOverride.deleteMany({ where: { workspaceId: id, featureId } });
    if (removed.count > 0) {
      await db.auditLog.create({ data: { actorUserId: auth.context.user.id, workspaceId: id, action: 'workspace.feature.override.remove', entityType: 'WorkspaceFeatureOverride', entityId: `${id}:${featureId}` } });
    }
    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}notice=override-removed`, request.url), 303);
    return NextResponse.json({ ok: true, removed: removed.count > 0 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'FEATURE_OVERRIDE_REMOVE_FAILED';
    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: code === 'WORKSPACE_NOT_FOUND' ? 404 : 400 });
  }
}
