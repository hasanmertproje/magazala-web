import { InferenceClient } from '@huggingface/inference';
import { routeModel, type ProviderHealthStatus, type QualityProfile, type RouteCandidate } from '@magazala/core';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { revealProviderSecret } from './provider-credentials';
import { detectImageMime, storeGeneratedImage } from './object-storage';

type ImageInput = {
  workspaceId: string;
  userId: string;
  projectId?: string;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  seed?: number;
  qualityProfile: QualityProfile;
};

type ImageModelRow = Awaited<ReturnType<typeof loadImageModels>>[number];

function healthStatus(value?: string): ProviderHealthStatus {
  const normalized = (value ?? 'HEALTHY').toLowerCase();
  if (['healthy','degraded','rate_limited','quota_exhausted','auth_error','unavailable','disabled'].includes(normalized)) return normalized as ProviderHealthStatus;
  return 'degraded';
}

async function loadImageModels() {
  return db.aIModel.findMany({
    where: {
      enabled: true,
      capabilities: { some: { capability: 'text_to_image' } },
      provider: {
        slug: 'huggingface-inference-providers',
        enabled: true,
        credentials: { some: { enabled: true } },
      },
    },
    include: {
      capabilities: true,
      benchmarkRuns: { orderBy: { createdAt: 'desc' }, take: 20 },
      provider: {
        include: {
          credentials: { where: { enabled: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
          health: { orderBy: { checkedAt: 'desc' }, take: 1 },
        },
      },
    },
  });
}

function toRouteCandidate(row: ImageModelRow): RouteCandidate {
  const benchmark: Record<string, number> = {};
  for (const run of row.benchmarkRuns) if (run.score != null && benchmark[run.category] == null) benchmark[run.category] = run.score;
  return {
    model: {
      id: row.id,
      providerId: row.providerId,
      name: row.name,
      version: row.version ?? undefined,
      enabled: row.enabled,
      capabilities: row.capabilities.map((item) => item.capability) as RouteCandidate['model']['capabilities'],
      benchmark,
      costScore: row.costScore,
      latencyMsP50: row.latencyMsP50,
      failureRate: row.failureRate,
      commercialUseAllowed: row.commercialUseAllowed,
    },
    runtime: {
      providerId: row.providerId,
      health: healthStatus(row.provider.health[0]?.status),
      quotaRemaining: null,
      adminPriority: row.provider.priority,
      fallbackPriority: row.provider.fallbackPriority,
    },
  };
}

function safeErrorCode(error: unknown) {
  if (!(error instanceof Error)) return 'IMAGE_PROVIDER_ERROR';
  return error.message.replace(/[^A-Z0-9_\-]/gi, '_').slice(0, 120) || 'IMAGE_PROVIDER_ERROR';
}

async function invokeHuggingFace(row: ImageModelRow, secret: string, input: ImageInput) {
  const client = new InferenceClient(secret);
  const blob = await client.textToImage({
    model: row.externalModelId,
    inputs: input.prompt,
    parameters: {
      width: input.width,
      height: input.height,
      ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {}),
      ...(input.seed != null ? { seed: input.seed } : {}),
    },
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error('IMAGE_PROVIDER_EMPTY_RESPONSE');
  return { bytes, mimeType: detectImageMime(bytes, blob.type) };
}

export async function generateAndStoreImage(input: ImageInput) {
  if (input.projectId) {
    const project = await db.project.findFirst({ where: { id: input.projectId, workspaceId: input.workspaceId }, select: { id: true } });
    if (!project) throw new Error('PROJECT_NOT_FOUND');
  }

  const rows = await loadImageModels();
  if (!rows.length) throw new Error('NO_IMAGE_PROVIDER_CONFIGURED');
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const decision = routeModel({
    operation: 'design.text_to_image',
    qualityProfile: input.qualityProfile,
    requiredCapabilities: ['text_to_image'],
    preferredCapabilities: input.qualityProfile === 'PRINT_PREFERRED' ? ['high_resolution'] : [],
    benchmarkCategory: 'illustration',
    requireCommercialUse: true,
  }, rows.map(toRouteCandidate));

  const generation = await db.generation.create({ data: {
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    userId: input.userId,
    prompt: input.prompt,
    operation: 'text_to_image',
    qualityProfile: input.qualityProfile,
    status: 'RUNNING',
    selectedModelId: decision.selected.model.id,
    selectedProviderId: decision.selected.model.providerId,
    routerReason: { score: decision.selected.score, reasons: decision.selected.reasons, alternatives: decision.alternatives.map((item) => ({ modelId: item.model.id, score: item.score })) },
  } });

  const ordered = [decision.selected, ...decision.alternatives];
  let lastCode = 'IMAGE_PROVIDER_UNAVAILABLE';
  for (let index = 0; index < ordered.length; index += 1) {
    const routed = ordered[index];
    const row = rowById.get(routed.model.id);
    if (!row) continue;
    const credential = row.provider.credentials[0];
    if (!credential) continue;
    const attemptNo = index + 1;
    const attempt = await db.generationAttempt.create({ data: { generationId: generation.id, providerId: row.providerId, modelId: row.id, attemptNo, startedAt: new Date() } });
    const requestId = randomUUID();
    const startedAt = new Date();
    const startedMs = Date.now();
    try {
      const secret = await revealProviderSecret(credential.encryptedValue);
      const output = await invokeHuggingFace(row, secret, input);
      const finishedAt = new Date();
      const latencyMs = Date.now() - startedMs;
      const stored = await storeGeneratedImage({ workspaceId: input.workspaceId, generationId: generation.id, bytes: output.bytes, mimeType: output.mimeType });
      const asset = await db.asset.create({ data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? null,
        createdById: input.userId,
        kind: 'GENERATED_IMAGE',
        storageKey: stored.storageKey,
        mimeType: output.mimeType,
        sizeBytes: BigInt(stored.sizeBytes),
        checksum: stored.checksum,
        width: input.width,
        height: input.height,
        metadata: { generationId: generation.id, providerId: row.providerId, modelId: row.id },
      } });
      await db.$transaction([
        db.generationAttempt.update({ where: { id: attempt.id }, data: { finishedAt, success: true, latencyMs } }),
        db.generation.update({ where: { id: generation.id }, data: { status: 'COMPLETED', completedAt: finishedAt, selectedModelId: row.id, selectedProviderId: row.providerId } }),
        db.usageLedger.create({ data: { workspaceId: input.workspaceId, userId: input.userId, providerId: row.providerId, modelId: row.id, operation: 'design.text_to_image', requestId, startedAt, finishedAt, success: true, imagesGenerated: 1, latencyMs } }),
        db.providerCredential.update({ where: { id: credential.id }, data: { lastSuccessAt: finishedAt, lastErrorCode: null } }),
      ]);
      return { generationId: generation.id, assetId: asset.id, mimeType: output.mimeType, providerId: row.providerId, modelId: row.id, routerReason: generation.routerReason };
    } catch (error) {
      const finishedAt = new Date();
      const code = safeErrorCode(error);
      lastCode = code;
      await db.$transaction([
        db.generationAttempt.update({ where: { id: attempt.id }, data: { finishedAt, success: false, errorCode: code, latencyMs: Date.now() - startedMs } }),
        db.usageLedger.create({ data: { workspaceId: input.workspaceId, userId: input.userId, providerId: row.providerId, modelId: row.id, operation: 'design.text_to_image', requestId, startedAt, finishedAt, success: false, latencyMs: Date.now() - startedMs } }),
        db.providerCredential.update({ where: { id: credential.id }, data: { lastErrorAt: finishedAt, lastErrorCode: code } }),
      ]);
    }
  }

  await db.generation.update({ where: { id: generation.id }, data: { status: 'FAILED', completedAt: new Date() } });
  throw new Error(lastCode);
}
