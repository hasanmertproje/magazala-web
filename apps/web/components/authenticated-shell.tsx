import type { ReactNode } from 'react';
import { requireUserPage } from '../lib/auth';
import { AppShell } from './app-shell';

export async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const context = await requireUserPage();
  return <AppShell
    displayName={context.user.displayName ?? context.user.email}
    workspaceName={context.workspace?.name ?? 'Sistem'}
    isSuperAdmin={context.user.isSuperAdmin}
  >{children}</AppShell>;
}
