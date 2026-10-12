import type { Prisma } from '@prisma/client';
import { db } from './db';

export async function assertParentGeneration(workspaceId: string, parentGenerationId?: string) {
  if (!parentGenerationId) return null;
  const parent = await db.generation.findFirst({
    where: { id: parentGenerationId, workspaceId },
    select: { id: true, status: true, prompt: true, projectId: true },
  });
  if (!parent) throw new Error('PARENT_GENERATION_NOT_FOUND');
  if (parent.status !== 'COMPLETED') throw new Error('PARENT_GENERATION_NOT_COMPLETED');
  return parent;
}

export async function attachGenerationLineage(
  tx: Prisma.TransactionClient,
  childGenerationId: string,
  parentGenerationId?: string,
) {
  if (!parentGenerationId) return;
  await tx.generationLineage.create({ data: { childGenerationId, parentGenerationId } });
}

export async function loadGenerationParents(generationIds: string[]) {
  if (generationIds.length === 0) return new Map<string, string>();
  const rows = await db.generationLineage.findMany({
    where: { childGenerationId: { in: generationIds } },
    select: { childGenerationId: true, parentGenerationId: true },
  });
  return new Map(rows.map((row) => [row.childGenerationId, row.parentGenerationId]));
}
