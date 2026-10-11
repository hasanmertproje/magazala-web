import type { ReactNode } from 'react';
import { requireSuperAdminPage } from '../../lib/auth';
import { AdminShell } from '../../components/admin-shell';
export default async function Layout({ children }: { children: ReactNode }) { const context = await requireSuperAdminPage(); return <AdminShell displayName={context.user.displayName ?? context.user.email}>{children}</AdminShell>; }
