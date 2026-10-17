/** Runtime safety boundary: demo tenants can never invoke real marketplace credentials. */
export const DEMO_WORKSPACE_SLUG = 'entegrepilot-demo';

export function isDemoWorkspace(workspace: { slug: string } | null | undefined): boolean {
  return workspace?.slug === DEMO_WORKSPACE_SLUG;
}
