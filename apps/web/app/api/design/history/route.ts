import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { loadGenerationParents } from '../../../../lib/design-lineage';

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(40).default(16) });

function metadataGenerationId(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>).generationId;
  return typeof candidate === 'string' ? candidate : null;
}

export async function GET(request: Request) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  try {
    const url = new URL(request.url);
    const { limit } = querySchema.parse({ limit: url.searchParams.get('limit') ?? undefined });
    const generations = await db.generation.findMany({
      where: { workspaceId: auth.context.workspace.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        projectId: true,
        prompt: true,
        operation: true,
        qualityProfile: true,
        status: true,
        selectedModelId: true,
        selectedProviderId: true,
        createdAt: true,
        completedAt: true,
      },
    });

    const ids = generations.map((item) => item.id);
    const [parents, assets, models] = await Promise.all([
      loadGenerationParents(ids),
      db.asset.findMany({
        where: { workspaceId: auth.context.workspace.id, kind: 'GENERATED_IMAGE' },
        orderBy: { createdAt: 'desc' },
        take: Math.max(limit * 3, 40),
        select: { id: true, metadata: true, width: true, height: true, mimeType: true, createdAt: true },
      }),
      db.aIModel.findMany({
        where: { id: { in: [...new Set(generations.map((item) => item.selectedModelId).filter((value): value is string => Boolean(value)))] } },
        select: { id: true, name: true, provider: { select: { name: true } } },
      }),
    ]);

    const assetByGeneration = new Map<string, typeof assets[number]>();
    for (const asset of assets) {
      const generationId = metadataGenerationId(asset.metadata);
      if (generationId && ids.includes(generationId) && !assetByGeneration.has(generationId)) assetByGeneration.set(generationId, asset);
    }
    const modelById = new Map(models.map((model) => [model.id, model]));
    const childCounts = new Map<string, number>();
    for (const parentId of parents.values()) childCounts.set(parentId, (childCounts.get(parentId) ?? 0) + 1);

    return NextResponse.json({
      ok: true,
      generations: generations.map((generation) => {
        const asset = assetByGeneration.get(generation.id);
        const model = generation.selectedModelId ? modelById.get(generation.selectedModelId) : null;
        return {
          id: generation.id,
          parentGenerationId: parents.get(generation.id) ?? null,
          childCount: childCounts.get(generation.id) ?? 0,
          projectId: generation.projectId,
          prompt: generation.prompt,
          operation: generation.operation,
          qualityProfile: generation.qualityProfile,
          status: generation.status,
          model: model ? { id: model.id, name: model.name, provider: model.provider.name } : null,
          createdAt: generation.createdAt.toISOString(),
          completedAt: generation.completedAt?.toISOString() ?? null,
          asset: asset ? {
            id: asset.id,
            width: asset.width,
            height: asset.height,
            mimeType: asset.mimeType,
            contentUrl: `/api/assets/${asset.id}/content`,
          } : null,
        };
      }),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DESIGN_HISTORY_FAILED';
    return NextResponse.json({ ok: false, code }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
