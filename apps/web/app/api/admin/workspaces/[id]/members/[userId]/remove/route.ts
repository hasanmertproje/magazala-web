import { NextResponse } from 'next/server';
import { requireSuperAdminApi } from '../../../../../../../../lib/auth';
import { db } from '../../../../../../../../lib/db';
import { safeInternalPath } from '../../../../../../../../lib/navigation';
import { assertSameOrigin, isHtmlForm } from '../../../../../../../../lib/request-security';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const form = isHtmlForm(request);
  let returnTo = '/admin/workspaces';
  try {
    assertSameOrigin(request);
    if (form) {
      const data = await request.formData();
      returnTo = safeInternalPath(data.get('returnTo'), '/admin/workspaces');
    }
    const { id, userId } = await params;

    await db.$transaction(async (tx) => {
      const current = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: id, userId } } });
      if (!current) throw new Error('MEMBERSHIP_NOT_FOUND');
      if (current.role === 'ADMIN') {
        const adminCount = await tx.workspaceMember.count({ where: { workspaceId: id, role: 'ADMIN' } });
        if (adminCount <= 1) throw new Error('WORKSPACE_REQUIRES_ADMIN');
      }
      await tx.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: id, userId } } });
      await tx.auditLog.create({ data: { actorUserId: auth.context.user.id, workspaceId: id, action: 'workspace.member.remove', entityType: 'WorkspaceMember', entityId: `${id}:${userId}`, metadata: { removedRole: current.role } } });
    }, { isolationLevel: 'Serializable' });

    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}notice=member-removed`, request.url), 303);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'MEMBER_REMOVE_FAILED';
    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: code === 'MEMBERSHIP_NOT_FOUND' ? 404 : code === 'WORKSPACE_REQUIRES_ADMIN' ? 409 : 400 });
  }
}
