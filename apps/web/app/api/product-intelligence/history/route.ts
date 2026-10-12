import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });

export async function GET(request: Request) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  try {
    const url = new URL(request.url);
    const { limit } = querySchema.parse({ limit: url.searchParams.get('limit') ?? undefined });
    const sessions = await db.productResearchSession.findMany({
      where: { workspaceId: auth.context.workspace.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { sources: true, opportunities: true } },
        opportunities: { select: { title: true }, orderBy: { createdAt: 'asc' }, take: 3 },
      },
    });
    return NextResponse.json({
      ok: true,
      sessions: sessions.map((session) => ({
        id: session.id,
        mode: session.mode,
        query: session.query,
        projectId: session.projectId,
        createdAt: session.createdAt.toISOString(),
        sourceCount: session._count.sources,
        opportunityCount: session._count.opportunities,
        previewTitles: session.opportunities.map((item) => item.title),
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PRODUCT_INTELLIGENCE_HISTORY_FAILED';
    return NextResponse.json({ ok: false, code }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
