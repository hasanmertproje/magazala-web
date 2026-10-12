import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../../../../../lib/auth';
import { db } from '../../../../../../../../lib/db';
import { safeInternalPath } from '../../../../../../../../lib/navigation';
import { assertSameOrigin, isHtmlForm } from '../../../../../../../../lib/request-security';

const schema = z.object({ role: z.enum(['ADMIN', 'USER']), returnTo: z.string().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const form = isHtmlForm(request);
  let returnTo = '/admin/workspaces';
  try {
    assertSameOrigin(request);
    const raw = form ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    returnTo = safeInternalPath(input.returnTo, '/admin/workspaces');
    const { id, userId } = await params;

    const membership = await db.$transaction(async (tx) => {
      const current = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: id, userId } } });
      if (!current) throw new Error('MEMBERSHIP_NOT_FOUND');
      if (current.role === 'ADMIN' && input.role === 'USER') {
        const adminCount = await tx.workspaceMember.count({ where: { workspaceId: id, role: 'ADMIN' } });
        if (adminCount <= 1) throw new Error('WORKSPACE_REQUIRES_ADMIN');
      }
      const updated = await tx.workspaceMember.update({ where: { workspaceId_userId: { workspaceId: id, userId } }, data: { role: input.role } });
      await tx.auditLog.create({ data: { actorUserId: auth.context.user.id, workspaceId: id, action: 'workspace.member.role', entityType: 'WorkspaceMember', entityId: `${id}:${userId}`, metadata: { from: current.role, to: input.role } } });
      return updated;
    }, { isolationLevel: 'Serializable' });

    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}notice=member-role-updated`, request.url), 303);
    return NextResponse.json({ ok: true, membership });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'MEMBER_ROLE_UPDATE_FAILED';
    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: code === 'MEMBERSHIP_NOT_FOUND' ? 404 : code === 'WORKSPACE_REQUIRES_ADMIN' ? 409 : 400 });
  }
}
