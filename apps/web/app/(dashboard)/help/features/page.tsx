import Link from 'next/link';
import { DiscoveryChat } from '../../../../components/discovery-chat';
import { requireUserPage } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { parseDiscoveryAnalysis } from '../../../../lib/discovery-analysis';

export const dynamic = 'force-dynamic';

export default async function FeaturesConversationPage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const context = await requireUserPage();
  if (!context.workspace) return <div className="content"><h1 className="page-title">Özellikler Hakkında Konuş</h1><section className="card" style={{marginTop:18}}>Bu alanı kullanmak için bir çalışma alanına bağlı olmanız gerekir.</section></div>;
  const params = await searchParams;
  const recent = await db.discoveryConversation.findMany({ where: { workspaceId: context.workspace.id, userId: context.user.id }, orderBy: { updatedAt: 'desc' }, take: 12, select: { id: true, title: true, mode: true, status: true, updatedAt: true } });
  const selectedId = params.conversation ?? recent[0]?.id;
  const selected = selectedId ? await db.discoveryConversation.findFirst({ where: { id: selectedId, workspaceId: context.workspace.id, userId: context.user.id }, include: { messages: { orderBy: { createdAt: 'asc' } } } }) : null;
  let analysis = null;
  if (selected?.aiInterpretation) { try { analysis = parseDiscoveryAnalysis(selected.aiInterpretation); } catch { analysis = null; } }
  const initialConversation = selected ? { id: selected.id, mode: selected.mode, status: selected.status, confirmationState: selected.confirmationState, messages: selected.messages.map((message) => ({ id: message.id, role: message.role, content: message.content, createdAt: message.createdAt.toISOString() })), aiInterpretation: analysis } : null;
  return <div className="content"><h1 className="page-title">Özellikler Hakkında Konuş</h1><p className="page-subtitle">Tasarlayalım AI ihtiyacınızı netleştirir, riskleri ve açık soruları ayırır; yalnız sizin onayınızdan sonra admin incelemesine gereksinim kaydı gönderir.</p><div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 240px',gap:16,marginTop:18}}><DiscoveryChat initialConversation={initialConversation}/><aside className="card"><h3>Geçmiş</h3>{recent.length === 0 ? <p className="page-subtitle">Henüz görüşme yok.</p> : <div style={{display:'grid',gap:8}}>{recent.map((item) => <Link key={item.id} href={`/help/features?conversation=${item.id}`} className="nav-item"><span>{item.title ?? item.mode.replaceAll('_',' ')}</span><span className="badge">{item.status}</span></Link>)}</div>}</aside></div></div>;
}
