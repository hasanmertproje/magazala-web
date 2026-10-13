import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { getAuthContext } from '../../../../lib/auth';
import { CORE_FEATURE_CATALOG } from '../../../../lib/feature-catalog';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../lib/request-security';
import { issueSessionToken, SESSION_COOKIE, sessionCookieOptions } from '../../../../lib/session';

const initialSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(80),
  workspaceName: z.string().trim().min(2).max(100),
});
const repeatSchema = initialSchema.pick({ workspaceName: true });

function workspaceSlug(name: string): string {
  const base = name.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'workspace';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

export async function POST(request: Request) {
  const formRequest = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const raw = formRequest ? Object.fromEntries(await request.formData()) : await request.json();

    // After initial installation, setup is an authenticated super-admin-only
    // operation that adds a workspace; it never creates another privileged user.
    if (await db.user.count() > 0) {
      const auth = await getAuthContext();
      if (!auth) throw new Error('AUTH_REQUIRED');
      if (!auth.user.isSuperAdmin) throw new Error('ADMIN_REQUIRED');
      const input = repeatSchema.parse(raw);
      const workspace = await db.$transaction(async (tx) => {
        const created = await tx.workspace.create({
          data: { name: input.workspaceName, slug: workspaceSlug(input.workspaceName),
            members: { create: { userId: auth.user.id, role: 'ADMIN' } } },
        });
        await tx.auditLog.create({ data: { actorUserId: auth.user.id, workspaceId: created.id, action: 'platform.workspace.setup', entityType: 'Workspace', entityId: created.id } });
        return created;
      });
      return formRequest
        ? NextResponse.redirect(publicRequestUrl('/create/design-studio', request), 303)
        : NextResponse.json({ ok: true, workspace: { id: workspace.id, name: workspace.name } }, { status: 201 });
    }

    const input = initialSchema.parse(raw);
    const passwordHash = await hash(input.password, 12);
    const result = await db.$transaction(async (tx) => {
      if (await tx.user.count() !== 0) throw new Error('SETUP_ALREADY_COMPLETED');
      await tx.feature.createMany({ data: CORE_FEATURE_CATALOG.map((feature) => ({ ...feature })), skipDuplicates: true });
      const user = await tx.user.create({ data: { email: input.email, displayName: input.displayName, passwordHash, isSuperAdmin: true } });
      const workspace = await tx.workspace.create({ data: { name: input.workspaceName, slug: workspaceSlug(input.workspaceName), members: { create: { userId: user.id, role: 'ADMIN' } } } });
      await tx.auditLog.create({ data: { actorUserId: user.id, workspaceId: workspace.id, action: 'platform.setup', entityType: 'Workspace', entityId: workspace.id } });
      return { user, workspace };
    }, { isolationLevel: 'Serializable' });

    const response = formRequest ? NextResponse.redirect(publicRequestUrl('/', request), 303) : NextResponse.json({ ok: true, user: { id: result.user.id, email: result.user.email }, workspace: { id: result.workspace.id, name: result.workspace.name } }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, issueSessionToken(result.user.id), sessionCookieOptions());
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : 'SETUP_FAILED';
    // Form failures do not bypass authentication. An unauthenticated request
    // may be redirected to login by the guarded setup page.
    if (formRequest) return NextResponse.redirect(publicRequestUrl(`/setup?error=${encodeURIComponent(code)}`, request), 303);
    return NextResponse.json({ ok: false, code }, { status: code === 'AUTH_REQUIRED' ? 401 : code === 'ADMIN_REQUIRED' ? 403 : code === 'SETUP_ALREADY_COMPLETED' ? 409 : 400 });
  }
}
