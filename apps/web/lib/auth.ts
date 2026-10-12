import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { ACTIVE_WORKSPACE_COOKIE, SESSION_COOKIE, verifySessionToken } from './session';

export async function getAuthContext() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const claims = verifySessionToken(raw);
  if (!claims) return null;

  const user = await db.user.findUnique({
    where: { id: claims.sub },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!user) return null;

  const requestedWorkspaceId = jar.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const membership = user.memberships.find((item) => item.workspaceId === requestedWorkspaceId) ?? user.memberships[0] ?? null;
  if (!user.isSuperAdmin && !membership) return null;
  return { user, membership, workspace: membership?.workspace ?? null };
}

export async function requireUserPage() {
  const context = await getAuthContext();
  if (!context) redirect('/login');
  return context;
}

export async function requireSuperAdminPage() {
  const context = await requireUserPage();
  if (!context.user.isSuperAdmin) redirect('/');
  return context;
}

export async function requireUserApi() {
  const context = await getAuthContext();
  if (!context) return { ok: false as const, status: 401, code: 'AUTH_REQUIRED' };
  if (!context.workspace) return { ok: false as const, status: 409, code: 'WORKSPACE_REQUIRED' };
  return { ok: true as const, context: { ...context, workspace: context.workspace } };
}

export async function requireSuperAdminApi() {
  const context = await getAuthContext();
  if (!context) return { ok: false as const, status: 401, code: 'AUTH_REQUIRED' };
  if (!context.user.isSuperAdmin) return { ok: false as const, status: 403, code: 'ADMIN_REQUIRED' };
  return { ok: true as const, context };
}
