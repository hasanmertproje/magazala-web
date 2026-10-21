import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireExternalProviderApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { reserveFeatureUse, releaseFeatureUse, type FeatureReservation } from '../../../../lib/entitlements';
import { assertSameOrigin } from '../../../../lib/request-security';
import { generateProviderBackedText } from '../../../../lib/ai-text';

const inputSchema = z.object({ query: z.string().trim().min(3).max(1800), context: z.string().trim().max(2400).optional() });
const responseSchema = z.object({ ideas: z.array(z.object({ title: z.string().trim().min(2).max(140), rationale: z.string().trim().min(10).max(1800), productionFit: z.string().trim().max(1200), designDirection: z.string().trim().max(1200), risks: z.array(z.string().trim().max(400)).max(8).default([]) })).min(1).max(10) });
function parseJson(text: string) { const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''); return responseSchema.parse(JSON.parse(cleaned)); }

export async function POST(request: Request) {
  const auth = await requireExternalProviderApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  let reservation: FeatureReservation | null = null;
  try {
    assertSameOrigin(request);
    const input = inputSchema.parse(await request.json());
    reservation = await reserveFeatureUse(auth.context.workspace.id, auth.context.user.isSuperAdmin, 'product_intelligence.basic');
    const result = await generateProviderBackedText({ workspaceId: auth.context.workspace.id, userId: auth.context.user.id, operation: 'product_intelligence.idea', jsonMode: true, systemPrompt: `Sen Magazala Product Intelligence içindeki IDEA MODE asistanısın. Görevin yaratıcı ürün fikirleri geliştirmektir. Gerçek satış, talep, trend, rekabet, gelir veya pazar payı verisine sahipmişsin gibi davranma. Kaynaksız sayısal pazar iddiası üretme. Kullanıcının üretim kabiliyeti ve verdiği bağlama göre uygulanabilir, özgün ve fikri mülkiyet riski düşük yönler öner. Marka/karakter/telif riski varsa açıkça belirt. Yalnızca geçerli JSON döndür: {"ideas":[{"title":"...","rationale":"...","productionFit":"...","designDirection":"...","risks":["..."]}]}`, messages: [{ role: 'user', content: `${input.query}${input.context ? `\n\nEk bağlam:\n${input.context}` : ''}` }] });
    const parsed = parseJson(result.text);
    const session = await db.productResearchSession.create({ data: { workspaceId: auth.context.workspace.id, userId: auth.context.user.id, mode: 'IDEA', query: input.query, opportunities: { create: parsed.ideas.map((idea) => ({ title: idea.title, rationale: idea.rationale, evidence: { kind: 'AI_IDEA', marketDataClaim: false, productionFit: idea.productionFit, designDirection: idea.designDirection, providerId: result.providerId, modelId: result.modelId }, risks: idea.risks })) } }, include: { opportunities: true } });
    await db.auditLog.create({ data: { workspaceId: auth.context.workspace.id, actorUserId: auth.context.user.id, action: 'product_intelligence.idea.create', entityType: 'ProductResearchSession', entityId: session.id } });
    return NextResponse.json({ ok: true, sessionId: session.id, mode: 'IDEA', ideas: session.opportunities });
  } catch (error) {
    await releaseFeatureUse(reservation);
    const code = error instanceof Error ? error.message : 'PRODUCT_IDEA_FAILED';
    const status = ['FEATURE_DISABLED','QUOTA_EXHAUSTED','AI_MODEL_NOT_CONFIGURED','AI_TEXT_ADAPTER_NOT_CONFIGURED','AI_PROVIDER_UNAVAILABLE'].includes(code) ? 409 : 400;
    return NextResponse.json({ ok: false, code }, { status });
  }
}
