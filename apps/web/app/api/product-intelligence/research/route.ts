import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { reserveFeatureUse, releaseFeatureUse, type FeatureReservation } from '../../../../lib/entitlements';
import { assertSameOrigin } from '../../../../lib/request-security';
import { searchResearchSources } from '../../../../lib/research-search';
import { generateProviderBackedText } from '../../../../lib/ai-text';

const inputSchema = z.object({ query: z.string().trim().min(3).max(1200) });
const synthesisSchema = z.object({ opportunities: z.array(z.object({ title: z.string().trim().min(2).max(140), rationale: z.string().trim().min(10).max(1800), sourceIndexes: z.array(z.number().int().min(1).max(12)).max(8), risks: z.array(z.string().trim().max(400)).max(8).default([]) })).max(8) });
function parseJson(text: string) { const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''); return synthesisSchema.parse(JSON.parse(cleaned)); }

export async function POST(request: Request) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  let reservation: FeatureReservation | null = null;
  try {
    assertSameOrigin(request);
    const input = inputSchema.parse(await request.json());
    reservation = await reserveFeatureUse(auth.context.workspace.id, auth.context.user.isSuperAdmin, 'product_intelligence.web_research');
    const sources = await searchResearchSources(input.query, 8);
    if (sources.length === 0) throw new Error('RESEARCH_NO_SOURCES');
    const now = new Date();
    const session = await db.productResearchSession.create({ data: { workspaceId: auth.context.workspace.id, userId: auth.context.user.id, mode: 'RESEARCH', query: input.query, sources: { create: sources.map((source) => ({ url: source.url, title: source.title, retrievedAt: now, evidenceKind: 'DIRECT', confidence: source.snippet ? 0.72 : 0.58 })) } }, include: { sources: true } });
    let synthesis: z.infer<typeof synthesisSchema> | null = null;
    let synthesisCode: string | null = null;
    try {
      const evidenceText = sources.map((source, index) => `[${index + 1}] ${source.title}\nURL: ${source.url}\nÖzet: ${source.snippet || '(arama sonucu özeti yok)'}`).join('\n\n');
      const ai = await generateProviderBackedText({ workspaceId: auth.context.workspace.id, userId: auth.context.user.id, operation: 'product_intelligence.research_synthesis', jsonMode: true, systemPrompt: `Sen Magazala Product Intelligence RESEARCH MODE analiz asistanısın. Yalnızca verilen kaynak parçalarına dayan. Kaynakta olmayan satış, gelir, talep hacmi, büyüme oranı veya rekabet sayısı uydurma. Bir üçüncü taraf tahmini varsa tahmin olduğunu açıkça koru. Kanıt yetersizse bunu belirt. Telif/marka riskini ayrıca değerlendir. Yalnızca JSON döndür: {"opportunities":[{"title":"...","rationale":"...","sourceIndexes":[1,2],"risks":["..."]}]}`, messages: [{ role: 'user', content: `Araştırma sorusu: ${input.query}\n\nKaynaklar:\n${evidenceText}` }] });
      synthesis = parseJson(ai.text);
      if (synthesis.opportunities.length) await db.opportunity.createMany({ data: synthesis.opportunities.map((item) => ({ sessionId: session.id, title: item.title, rationale: item.rationale, evidence: { sourceIndexes: item.sourceIndexes, evidenceConfidence: 0.68, marketMetricsVerified: false }, risks: item.risks })) });
    } catch (error) { synthesisCode = error instanceof Error ? error.message : 'RESEARCH_SYNTHESIS_UNAVAILABLE'; }
    const opportunities = await db.opportunity.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: 'asc' } });
    await db.auditLog.create({ data: { workspaceId: auth.context.workspace.id, actorUserId: auth.context.user.id, action: 'product_intelligence.research.create', entityType: 'ProductResearchSession', entityId: session.id, metadata: { sourceCount: session.sources.length, synthesisAvailable: Boolean(synthesis) } } });
    return NextResponse.json({ ok: true, sessionId: session.id, mode: 'RESEARCH', sources: session.sources, opportunities, synthesis: synthesis ? { available: true } : { available: false, code: synthesisCode } });
  } catch (error) {
    await releaseFeatureUse(reservation);
    const code = error instanceof Error ? error.message : 'PRODUCT_RESEARCH_FAILED';
    const status = ['FEATURE_DISABLED','QUOTA_EXHAUSTED','RESEARCH_PROVIDER_NOT_CONFIGURED'].includes(code) ? 409 : code === 'RESEARCH_NO_SOURCES' ? 404 : code.startsWith('RESEARCH_PROVIDER_HTTP_') ? 502 : 400;
    return NextResponse.json({ ok: false, code }, { status });
  }
}
