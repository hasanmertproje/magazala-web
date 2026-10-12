import type { ReactNode } from 'react';
import { requireSuperAdminPage } from '../../lib/auth';
import { db } from '../../lib/db';
import { AdminShell } from '../../components/admin-shell';

export default async function Layout({ children }: { children: ReactNode }) {
  const context = await requireSuperAdminPage();
  const unreadNotifications = await db.notification.count({ where: { userId: context.user.id, readAt: null } });
  return <AdminShell displayName={context.user.displayName ?? context.user.email} unreadNotifications={unreadNotifications}>{children}</AdminShell>;
}
