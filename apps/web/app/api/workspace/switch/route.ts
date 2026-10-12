import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../lib/request-security';
import { ACTIVE_WORKSPACE_COOKIE, activeWorkspaceCookieOptions } from '../../../../lib/session';

const schema = z.object({
  workspaceId: z.string().min(1).max(128),
  next: z.string().max(2048).optional(),
});

function safeNext(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) return '/';
  return value;
}

export async function POST(request: Request) {
  const form = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });
    const raw = form ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    const membership = auth.user.memberships.find((item) => item.workspaceId === input.workspaceId);
    if (!membership) throw new Error('WORKSPACE_ACCESS_DENIED');

    await db.auditLog.create({
      data: {
        actorUserId: auth.user.id,
        workspaceId: membership.workspaceId,
        action: 'workspace.switch',
        entityType: 'Workspace',
        entityId: membership.workspaceId,
      },
    });

    const response = form
      ? NextResponse.redirect(publicRequestUrl(safeNext(input.next), request), 303)
      : NextResponse.json({ ok: true, workspace: { id: membership.workspace.id, name: membership.workspace.name } });
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, membership.workspaceId, activeWorkspaceCookieOptions());
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : 'WORKSPACE_SWITCH_FAILED';
    if (form) return NextResponse.redirect(publicRequestUrl(`/?error=${encodeURIComponent(code)}`, request), 303);
    return NextResponse.json({ ok: false, code }, { status: code === 'WORKSPACE_ACCESS_DENIED' ? 403 : 400 });
  }
}
