import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../../../lib/auth';
import { db } from '../../../../../../lib/db';
import { createInvitationToken, hashInvitationToken, normalizeInvitationEmail } from '../../../../../../lib/invitations';
import { assertSameOrigin } from '../../../../../../lib/request-security';

const schema = z.object({
  email: z.string().email().max(254).transform(normalizeInvitationEmail),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
  expiresInHours: z.coerce.number().int().min(1).max(168).default(72),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });

  try {
    assertSameOrigin(request);
    const { id: workspaceId } = await params;
    const input = schema.parse(await request.json());
    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);

    const invitation = await db.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true } });
      if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');

      const existingUser = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (existingUser) {
        const membership = await tx.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
          select: { userId: true },
        });
        if (membership) throw new Error('USER_ALREADY_MEMBER');
      }

      await tx.workspaceInvitation.updateMany({
        where: { workspaceId, email: input.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const created = await tx.workspaceInvitation.create({
        data: {
          workspaceId,
          email: input.email,
          role: input.role,
          tokenHash,
          expiresAt,
          createdByUserId: auth.context.user.id,
        },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, workspace: { select: { name: true } } },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: auth.context.user.id,
          workspaceId,
          action: 'workspace.invitation.create',
          entityType: 'WorkspaceInvitation',
          entityId: created.id,
          metadata: { email: created.email, role: created.role, expiresAt: created.expiresAt.toISOString() },
        },
      });
      return created;
    }, { isolationLevel: 'Serializable' });

    return NextResponse.json({
      ok: true,
      invitation,
      invitePath: `/invite?token=${encodeURIComponent(token)}`,
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVITATION_CREATE_FAILED';
    const status = code === 'WORKSPACE_NOT_FOUND' ? 404 : code === 'USER_ALREADY_MEMBER' ? 409 : 400;
    return NextResponse.json({ ok: false, code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
