import { db } from './db';

export type FeatureReservation = { quotaId: string | null; reserved: boolean; featureKey: string };

type ResolvedEntitlement = { featureId: string; limit: number | null };

function currentPeriodKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function resolveEntitlement(workspaceId: string, featureKey: string): Promise<ResolvedEntitlement> {
  const feature = await db.feature.findUnique({ where: { key: featureKey }, select: { id: true } });
  if (!feature) throw new Error('FEATURE_NOT_REGISTERED');
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      package: { include: { features: { where: { featureId: feature.id } } } },
      overrides: { where: { featureId: feature.id } },
    },
  });
  if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');
  const now = new Date();
  const override = workspace.overrides.find((item) => !item.validUntil || item.validUntil > now);
  const packageFeature = workspace.package?.features[0];
  const enabled = override ? override.enabled : packageFeature?.enabled ?? false;
  const limit = override ? override.limit : packageFeature?.limit ?? null;
  if (!enabled) throw new Error('FEATURE_DISABLED');
  return { featureId: feature.id, limit };
}

export async function assertFeatureEnabled(workspaceId: string, isSuperAdmin: boolean, featureKey: string) {
  if (isSuperAdmin) return;
  await resolveEntitlement(workspaceId, featureKey);
}

export async function reserveFeatureUse(workspaceId: string, isSuperAdmin: boolean, featureKey: string): Promise<FeatureReservation> {
  if (isSuperAdmin) return { quotaId: null, reserved: false, featureKey };
  const entitlement = await resolveEntitlement(workspaceId, featureKey);
  if (entitlement.limit == null) return { quotaId: null, reserved: false, featureKey };
  if (entitlement.limit <= 0) throw new Error('QUOTA_EXHAUSTED');
  const periodKey = currentPeriodKey();
  return db.$transaction(async (tx) => {
    let quota = await tx.usageQuota.findUnique({ where: { workspaceId_featureId_periodKey: { workspaceId, featureId: entitlement.featureId, periodKey } } });
    if (!quota) quota = await tx.usageQuota.create({ data: { workspaceId, featureId: entitlement.featureId, periodKey, limit: entitlement.limit, used: 0 } });
    const updated = await tx.usageQuota.updateMany({ where: { id: quota.id, used: { lt: entitlement.limit } }, data: { used: { increment: 1 }, limit: entitlement.limit } });
    if (updated.count !== 1) throw new Error('QUOTA_EXHAUSTED');
    return { quotaId: quota.id, reserved: true, featureKey };
  }, { isolationLevel: 'Serializable' });
}

export async function releaseFeatureUse(reservation: FeatureReservation | null | undefined) {
  if (!reservation?.reserved || !reservation.quotaId) return;
  await db.usageQuota.updateMany({ where: { id: reservation.quotaId, used: { gt: 0 } }, data: { used: { decrement: 1 } } });
}
