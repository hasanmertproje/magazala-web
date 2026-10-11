export interface WorkspaceActor {
  userId: string;
  workspaceId: string;
  role: 'ADMIN' | 'USER';
  isSuperAdmin?: boolean;
}

export function assertWorkspaceAccess(actor: WorkspaceActor, resourceWorkspaceId: string): void {
  if (actor.isSuperAdmin) return;
  if (actor.workspaceId !== resourceWorkspaceId) throw new Error('WORKSPACE_ACCESS_DENIED');
}

export function assertWorkspaceAdmin(actor: WorkspaceActor, resourceWorkspaceId: string): void {
  assertWorkspaceAccess(actor, resourceWorkspaceId);
  if (!actor.isSuperAdmin && actor.role !== 'ADMIN') throw new Error('WORKSPACE_ADMIN_REQUIRED');
}
