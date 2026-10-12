import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { hashInvitationToken, isStructurallyValidInvitationToken } from '../../../../lib/invitations';
import { assertSameOrigin, isHtmlForm } from '../../../../lib/request-security';
import { issueSessionToken, SESSION_COOKIE, sessionCookieOptions } from '../../../../lib/session';

const schema = z.object({
  token: z.string().min(40).max(80),
  displayName: z.string().trim().min(2).max(80).optional(),
  password: z.string().min(12).max(128).optional(),
});

function inviteRedirect(request: Request, token: string, key: 'error' | 'notice', value: string) {
  const url = new URL('/invite', request.url);
  url.searchParams.set('token', token);
  url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const form = isHtmlForm(request);
  let rawToken = '';
  try {
    assertSameOrigin(request);
    const raw = form ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    rawToken = input.token;
    if (!isStructurallyValidInvitationToken(input.token)) throw new Error('INVITATION_INVALID');

    const tokenHash = hashInvitationToken(input.token);
    const invitation = await db.workspaceInvitation.findUnique({
      where: { tokenHash },
      include: { workspace: { select: { id: true, name: true } } },
    });
    if (!invitation) throw new Error('INVITATION_INVALID');
    if (invitation.revokedAt) throw new Error('INVITATION_REVOKED');
    if (invitation.acceptedAt) throw new Error('INVITATION_ALREADY_ACCEPTED');
    if (invitation.expiresAt.getTime() <= Date.now()) throw new Error('INVITATION_EXPIRED');

    const existingUser = await db.user.findUnique({ where: { email: invitation.email } });
    const auth = await getAuthContext();

    if (existingUser) {
      if (!auth || auth.user.id !== existingUser.id) throw new Error('EXISTING_ACCOUNT_LOGIN_REQUIRED');

      await db.$transaction(async (tx) => {
        const fresh = await tx.workspaceInvitation.findUnique({ where: { id: invitation.id }, select: { acceptedAt: true, revokedAt: true, expiresAt: true } });
        if (!fresh || fresh.revokedAt || fresh.acceptedAt || fresh.expiresAt.getTime() <= Date.now()) throw new Error('INVITATION_NO_LONGER_VALID');
        await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: existingUser.id } },
          update: { role: invitation.role },
          create: { workspaceId: invitation.workspaceId, userId: existingUser.id, role: invitation.role },
        });
        await tx.workspaceInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
        await tx.auditLog.create({ data: { actorUserId: existingUser.id, workspaceId: invitation.workspaceId, action: 'workspace.invitation.accept', entityType: 'WorkspaceInvitation', entityId: invitation.id, metadata: { existingAccount: true } } });
      }, { isolationLevel: 'Serializable' });

      if (form) return NextResponse.redirect(new URL('/', request.url), 303);
      return NextResponse.json({ ok: true, workspace: invitation.workspace, existingAccount: true });
    }

    if (!input.displayName || !input.password) throw new Error('ACCOUNT_DETAILS_REQUIRED');
    const passwordHash = await hash(input.password, 12);
    const user = await db.$transaction(async (tx) => {
      const fresh = await tx.workspaceInvitation.findUnique({ where: { id: invitation.id }, select: { acceptedAt: true, revokedAt: true, expiresAt: true, email: true } });
      if (!fresh || fresh.revokedAt || fresh.acceptedAt || fresh.expiresAt.getTime() <= Date.now()) throw new Error('INVITATION_NO_LONGER_VALID');
      if (await tx.user.findUnique({ where: { email: fresh.email }, select: { id: true } })) throw new Error('ACCOUNT_CREATED_CONCURRENTLY');

      const created = await tx.user.create({ data: { email: fresh.email, displayName: input.displayName, passwordHash } });
      await tx.workspaceMember.create({ data: { workspaceId: invitation.workspaceId, userId: created.id, role: invitation.role } });
      await tx.workspaceInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: created.id, workspaceId: invitation.workspaceId, action: 'workspace.invitation.accept', entityType: 'WorkspaceInvitation', entityId: invitation.id, metadata: { existingAccount: false } } });
      return created;
    }, { isolationLevel: 'Serializable' });

    const response = form
      ? NextResponse.redirect(new URL('/', request.url), 303)
      : NextResponse.json({ ok: true, workspace: invitation.workspace, user: { id: user.id, email: user.email }, existingAccount: false }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, issueSessionToken(user.id), sessionCookieOptions());
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVITATION_ACCEPT_FAILED';
    if (form && rawToken) return inviteRedirect(request, rawToken, 'error', code);
    const status = code === 'EXISTING_ACCOUNT_LOGIN_REQUIRED' ? 401 : code.includes('EXPIRED') || code.includes('REVOKED') ? 410 : code.includes('ALREADY') || code.includes('CONCURRENTLY') ? 409 : 400;
    return NextResponse.json({ ok: false, code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
