import type { ReactNode } from 'react';
import { AuthenticatedShell } from '../../components/authenticated-shell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
