import type { Entitlement, FeatureKey, UsageSnapshot } from './types';

export type EntitlementDecision =
  | { allowed: true; remaining: number | null }
  | { allowed: false; reason: 'NOT_ENTITLED' | 'EXPIRED' | 'QUOTA_EXHAUSTED' };

export function evaluateEntitlement(
  feature: FeatureKey,
  entitlements: readonly Entitlement[],
  usage: readonly UsageSnapshot[],
  now = new Date(),
): EntitlementDecision {
  const entitlement = entitlements.find((item) => item.feature === feature && item.enabled);
  if (!entitlement) return { allowed: false, reason: 'NOT_ENTITLED' };
  if (entitlement.validUntil && entitlement.validUntil.getTime() <= now.getTime()) {
    return { allowed: false, reason: 'EXPIRED' };
  }
  if (entitlement.limit == null) return { allowed: true, remaining: null };
  const used = usage.find((item) => item.feature === feature)?.used ?? 0;
  const remaining = Math.max(0, entitlement.limit - used);
  if (remaining <= 0) return { allowed: false, reason: 'QUOTA_EXHAUSTED' };
  return { allowed: true, remaining };
}
