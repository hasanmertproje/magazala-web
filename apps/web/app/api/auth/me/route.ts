import { NextResponse } from 'next/server';
import { getAuthContext } from '../../../../lib/auth';

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });
  return NextResponse.json({
    ok: true,
    user: { id: context.user.id, email: context.user.email, displayName: context.user.displayName, isSuperAdmin: context.user.isSuperAdmin },
    workspace: context.workspace ? { id: context.workspace.id, name: context.workspace.name, slug: context.workspace.slug } : null,
    role: context.membership?.role ?? null,
    workspaces: context.user.memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
      active: membership.workspaceId === context.workspace?.id,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
