import type { ReactNode } from 'react';
import { requireUserPage } from '../lib/auth';
import { db } from '../lib/db';
import { AppShell } from './app-shell';

export async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const context = await requireUserPage();
  const unreadNotifications = await db.notification.count({ where: { userId: context.user.id, readAt: null } });
  return <AppShell
    displayName={context.user.displayName ?? context.user.email}
    workspaceId={context.workspace?.id}
    workspaceName={context.workspace?.name ?? 'Sistem'}
    workspaces={context.user.memberships.map((membership) => ({ id: membership.workspace.id, name: membership.workspace.name }))}
    isSuperAdmin={context.user.isSuperAdmin}
    unreadNotifications={unreadNotifications}
  >{children}</AppShell>;
}
