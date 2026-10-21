/** Runtime safety boundary for demo external-provider operations. */
export const DEMO_WORKSPACE_SLUG = 'entegrepilot-demo';

export function isDemoWorkspace(workspace: { slug: string } | null | undefined): boolean {
  return workspace?.slug === DEMO_WORKSPACE_SLUG;
}

/** Premium demo entitlements never imply permission to contact external providers. */
export function assertDemoExternalOperationAllowed(workspace: { slug: string } | null | undefined): void {
  if (isDemoWorkspace(workspace)) throw new Error('DEMO_EXTERNAL_OPERATION_DISABLED');
}
