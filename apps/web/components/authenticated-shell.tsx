import type { ReactNode } from 'react';
import { requireUserPage } from '../lib/auth';
import { AppShell } from './app-shell';

export async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const context = await requireUserPage();
  return <AppShell
    displayName={context.user.displayName ?? context.user.email}
    workspaceId={context.workspace?.id}
    workspaceName={context.workspace?.name ?? 'Sistem'}
    workspaces={context.user.memberships.map((membership) => ({ id: membership.workspace.id, name: membership.workspace.name }))}
    isSuperAdmin={context.user.isSuperAdmin}
  >{children}</AppShell>;
}
