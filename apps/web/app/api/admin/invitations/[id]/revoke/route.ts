import { NextResponse } from 'next/server';
import { requireSuperAdminApi } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { assertSameOrigin, isHtmlForm } from '../../../../../lib/request-security';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const form = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const invitation = await db.workspaceInvitation.findUnique({
      where: { id },
      select: { id: true, workspaceId: true, acceptedAt: true, revokedAt: true },
    });
    if (!invitation) throw new Error('INVITATION_NOT_FOUND');
    if (invitation.acceptedAt) throw new Error('INVITATION_ALREADY_ACCEPTED');

    if (!invitation.revokedAt) {
      await db.$transaction([
        db.workspaceInvitation.update({ where: { id }, data: { revokedAt: new Date() } }),
        db.auditLog.create({ data: { actorUserId: auth.context.user.id, workspaceId: invitation.workspaceId, action: 'workspace.invitation.revoke', entityType: 'WorkspaceInvitation', entityId: id } }),
      ]);
    }

    if (form) return NextResponse.redirect(new URL('/admin/users?notice=invitation-revoked', request.url), 303);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVITATION_REVOKE_FAILED';
    if (form) return NextResponse.redirect(new URL(`/admin/users?error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: code === 'INVITATION_NOT_FOUND' ? 404 : 409 });
  }
}
