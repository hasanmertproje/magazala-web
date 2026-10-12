import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { reserveFeatureUse, releaseFeatureUse, type FeatureReservation } from '../../../../lib/entitlements';
import { assertSameOrigin } from '../../../../lib/request-security';
import { searchResearchSources } from '../../../../lib/research-search';
import { generateProviderBackedText } from '../../../../lib/ai-text';

const inputSchema = z.object({ query: z.string().trim().min(3).max(1200) });
const synthesisSchema = z.object({
  opportunities: z.array(z.object({
    title: z.string().trim().min(2).max(140),
    rationale: z.string().trim().min(10).max(1800),
    sourceIndexes: z.array(z.number().int().min(1).max(12)).min(1).max(8),
    risks: z.array(z.string().trim().max(400)).max(8).default([]),
  })).max(8),
});

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return synthesisSchema.parse(JSON.parse(cleaned));
}

export async function POST(request: Request) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  let reservation: FeatureReservation | null = null;
  try {
    assertSameOrigin(request);
    const input = inputSchema.parse(await request.json());
    reservation = await reserveFeatureUse(auth.context.workspace.id, auth.context.user.isSuperAdmin, 'product_intelligence.web_research');
    const searchSources = await searchResearchSources(input.query, 8);
    if (searchSources.length === 0) throw new Error('RESEARCH_NO_SOURCES');

    const now = new Date();
    const session = await db.productResearchSession.create({
      data: {
        workspaceId: auth.context.workspace.id,
        userId: auth.context.user.id,
        mode: 'RESEARCH',
        query: input.query,
        sources: {
          create: searchSources.map((source) => ({
            url: source.url,
            title: source.title,
            retrievedAt: now,
            evidenceKind: 'INFERRED',
            confidence: source.snippet ? 0.55 : 0.35,
          })),
        },
      },
      include: { sources: true },
    });

    const savedSourceByUrl = new Map(session.sources.map((source) => [source.url, source]));
    const sources = searchSources.map((source, index) => {
      const saved = savedSourceByUrl.get(source.url);
      return {
        id: saved?.id ?? `source-${index + 1}`,
        title: source.title,
        url: source.url,
        retrievedAt: now.toISOString(),
        evidenceKind: 'INFERRED' as const,
        confidence: source.snippet ? 0.55 : 0.35,
        position: index + 1,
        snippet: source.snippet,
        engine: source.engine ?? null,
        evidenceNote: 'Arama motoru sonuç özetidir; kaynak sayfanın tam metni bu aşamada doğrulanmamıştır.',
      };
    });

    let synthesis: z.infer<typeof synthesisSchema> | null = null;
    let synthesisCode: string | null = null;
    try {
      const evidenceText = sources.map((source) => `[${source.position}] ${source.title}\nURL: ${source.url}\nArama sonucu özeti (tam sayfa metni değildir): ${source.snippet || '(arama sonucu özeti yok)'}`).join('\n\n');
      const ai = await generateProviderBackedText({
        workspaceId: auth.context.workspace.id,
        userId: auth.context.user.id,
        operation: 'product_intelligence.research_synthesis',
        jsonMode: true,
        systemPrompt: `Sen Magazala Product Intelligence RESEARCH MODE analiz asistanısın. Sana verilen içerikler arama motoru sonuç snippet'leridir; kaynak sayfaların tam metni değildir. Yalnızca snippet'lerde açıkça görülen bilgilere dayan. Kaynakta olmayan satış, gelir, talep hacmi, büyüme oranı, rekabet sayısı veya pazar metriği uydurma. Bir üçüncü taraf tahmini görünüyorsa tahmin olduğunu koru. Kanıt yetersizse bunu açıkça belirt. Her fırsat en az bir gerçek kaynak numarasına referans vermeli. Telif/marka riskini ayrıca değerlendir. Yalnızca JSON döndür: {"opportunities":[{"title":"...","rationale":"...","sourceIndexes":[1,2],"risks":["..."]}]}`,
        messages: [{ role: 'user', content: `Araştırma sorusu: ${input.query}\n\nArama kanıtları:\n${evidenceText}` }],
      });
      synthesis = parseJson(ai.text);

      const supported = synthesis.opportunities.flatMap((item) => {
        const sourceIndexes = [...new Set(item.sourceIndexes)].filter((index) => index >= 1 && index <= sources.length);
        if (sourceIndexes.length === 0) return [];
        const sourceEvidence = sourceIndexes.map((index) => sources[index - 1]).map((source) => ({
          position: source.position,
          sourceId: source.id,
          title: source.title,
          url: source.url,
          snippet: source.snippet,
          engine: source.engine,
          evidenceKind: 'SEARCH_RESULT_SNIPPET',
        }));
        return [{
          sessionId: session.id,
          title: item.title,
          rationale: item.rationale,
          evidence: {
            sourceIndexes,
            sourceIds: sourceEvidence.map((source) => source.sourceId),
            sourceEvidence,
            evidenceKind: 'SEARCH_RESULT_SNIPPET',
            marketMetricsVerified: false,
            fullPageVerified: false,
          },
          risks: item.risks,
        }];
      });
      if (supported.length) await db.opportunity.createMany({ data: supported });
    } catch (error) {
      synthesisCode = error instanceof Error ? error.message : 'RESEARCH_SYNTHESIS_UNAVAILABLE';
    }

    const opportunities = await db.opportunity.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: 'asc' } });
    await db.auditLog.create({
      data: {
        workspaceId: auth.context.workspace.id,
        actorUserId: auth.context.user.id,
        action: 'product_intelligence.research.create',
        entityType: 'ProductResearchSession',
        entityId: session.id,
        metadata: { sourceCount: sources.length, synthesisAvailable: Boolean(synthesis), evidenceKind: 'SEARCH_RESULT_SNIPPET', fullPageVerified: false },
      },
    });
    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      mode: 'RESEARCH',
      sources,
      opportunities,
      evidencePolicy: { kind: 'SEARCH_RESULT_SNIPPET', fullPageVerified: false },
      synthesis: synthesis ? { available: true, supportedOpportunityCount: opportunities.length } : { available: false, code: synthesisCode, supportedOpportunityCount: 0 },
    });
  } catch (error) {
    await releaseFeatureUse(reservation);
    const code = error instanceof Error ? error.message : 'PRODUCT_RESEARCH_FAILED';
    const status = ['FEATURE_DISABLED','QUOTA_EXHAUSTED','RESEARCH_PROVIDER_NOT_CONFIGURED'].includes(code) ? 409 : code === 'RESEARCH_NO_SOURCES' ? 404 : code.startsWith('RESEARCH_PROVIDER_HTTP_') ? 502 : 400;
    return NextResponse.json({ ok: false, code }, { status });
  }
}
