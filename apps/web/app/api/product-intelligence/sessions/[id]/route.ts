import { NextResponse } from 'next/server';
import { requireUserApi } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function persistedSourceEvidence(opportunities: Array<{ evidence: unknown }>) {
  const byId = new Map<string, { snippet?: string; engine?: string | null }>();
  for (const opportunity of opportunities) {
    const evidence = asRecord(opportunity.evidence);
    const sourceEvidence = Array.isArray(evidence.sourceEvidence) ? evidence.sourceEvidence : [];
    for (const raw of sourceEvidence) {
      const item = asRecord(raw);
      const sourceId = typeof item.sourceId === 'string' ? item.sourceId : null;
      if (!sourceId || byId.has(sourceId)) continue;
      byId.set(sourceId, {
        snippet: typeof item.snippet === 'string' ? item.snippet : undefined,
        engine: typeof item.engine === 'string' ? item.engine : null,
      });
    }
  }
  return byId;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  try {
    const { id } = await params;
    const session = await db.productResearchSession.findFirst({
      where: { id, workspaceId: auth.context.workspace.id },
      include: {
        sources: { orderBy: { retrievedAt: 'asc' } },
        opportunities: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) return NextResponse.json({ ok: false, code: 'PRODUCT_INTELLIGENCE_SESSION_NOT_FOUND' }, { status: 404 });

    const persistedEvidence = persistedSourceEvidence(session.opportunities);
    const sources = session.sources.map((source, index) => {
      const extra = persistedEvidence.get(source.id);
      return {
        id: source.id,
        title: source.title,
        url: source.url,
        retrievedAt: source.retrievedAt.toISOString(),
        evidenceKind: source.evidenceKind,
        confidence: source.confidence,
        position: index + 1,
        snippet: extra?.snippet,
        engine: extra?.engine ?? null,
        evidenceNote: session.mode === 'RESEARCH' ? 'Kaydedilmiş arama sonucu kaydıdır. Tam kaynak sayfası doğrulaması yapıldığı anlamına gelmez.' : undefined,
      };
    });

    return NextResponse.json({
      ok: true,
      session: {
        id: session.id,
        mode: session.mode,
        query: session.query,
        projectId: session.projectId,
        createdAt: session.createdAt.toISOString(),
        sources,
        opportunities: session.opportunities,
        evidencePolicy: session.mode === 'RESEARCH' ? { kind: 'SEARCH_RESULT_SNIPPET', fullPageVerified: false } : null,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PRODUCT_INTELLIGENCE_SESSION_LOAD_FAILED';
    return NextResponse.json({ ok: false, code }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
