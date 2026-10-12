import Link from 'next/link';
import { DiscoveryChat } from '../../../../components/discovery-chat';
import { requireUserPage } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { parseDiscoveryAnalysis } from '../../../../lib/discovery-analysis';

export const dynamic = 'force-dynamic';

const statusLabels: Record<string,string> = {
  NEW:'Alındı', NEEDS_REVIEW:'İnceleniyor', NEEDS_CLARIFICATION:'Ek bilgi gerekli', ACCEPTED:'Kabul edildi', PLANNED:'Planlandı', IN_PROGRESS:'Geliştiriliyor', BETA:'Beta', RELEASED:'Yayınlandı', REJECTED:'Reddedildi', MERGED:'Başka taleple birleştirildi',
};

export default async function FeaturesConversationPage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const context = await requireUserPage();
  if (!context.workspace) return <div className="content"><h1 className="page-title">Özellikler Hakkında Konuş</h1><section className="card" style={{marginTop:18}}>Bu alanı kullanmak için bir çalışma alanına bağlı olmanız gerekir.</section></div>;
  const params = await searchParams;
  const recent = await db.discoveryConversation.findMany({ where: { workspaceId: context.workspace.id, userId: context.user.id }, orderBy: { updatedAt: 'desc' }, take: 12, select: { id: true, title: true, mode: true, status: true, updatedAt: true } });
  const selectedId = params.conversation ?? recent[0]?.id;
  const selected = selectedId ? await db.discoveryConversation.findFirst({ where: { id: selectedId, workspaceId: context.workspace.id, userId: context.user.id }, include: { messages: { orderBy: { createdAt: 'asc' } }, requirements: { orderBy: { createdAt: 'asc' } } } }) : null;
  let analysis = null;
  if (selected?.aiInterpretation) { try { analysis = parseDiscoveryAnalysis(selected.aiInterpretation); } catch { analysis = null; } }
  const initialConversation = selected ? { id: selected.id, mode: selected.mode, status: selected.status, confirmationState: selected.confirmationState, messages: selected.messages.map((message) => ({ id: message.id, role: message.role, content: message.content, createdAt: message.createdAt.toISOString() })), aiInterpretation: analysis } : null;
  return <div className="content"><h1 className="page-title">Özellikler Hakkında Konuş</h1><p className="page-subtitle">Tasarlayalım AI ihtiyacınızı netleştirir, riskleri ve açık soruları ayırır; yalnız sizin onayınızdan sonra admin incelemesine gereksinim kaydı gönderir.</p><div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 240px',gap:16,marginTop:18}}><div style={{display:'grid',gap:16}}><DiscoveryChat initialConversation={initialConversation}/>{selected?.requirements.length?<section className="card"><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><h3 style={{margin:0}}>Gönderilen talepler</h3><p className="page-subtitle" style={{margin:'5px 0 0'}}>Sizin onayınızla admin incelemesine geçen gereksinimlerin güncel durumu.</p></div><span className="badge active">{selected.requirements.length} TALEP</span></div><div style={{display:'grid',gap:9,marginTop:12}}>{selected.requirements.map((requirement)=><div key={requirement.id} style={{padding:12,border:'1px solid var(--line)',borderRadius:12}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',flexWrap:'wrap'}}><div><strong>{requirement.title}</strong><div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>{requirement.module} · {requirement.category}</div></div><span className={`badge ${['ACCEPTED','PLANNED','IN_PROGRESS','BETA','RELEASED'].includes(requirement.status)?'active':''}`}>{statusLabels[requirement.status]??requirement.status}</span></div>{requirement.status==='NEEDS_CLARIFICATION'?<p style={{margin:'9px 0 0',fontSize:12,color:'var(--muted)'}}>Admin ek bilgiye ihtiyaç duyuyor. Onaylanmış bu görüşme değiştirilemez; ek bilgi için yeni bir özellik görüşmesi başlatabilirsiniz. Talebe özel admin-kullanıcı açıklama akışı ayrı olarak geliştirilecektir.</p>:null}</div>)}</div></section>:null}</div><aside className="card"><h3>Geçmiş</h3>{recent.length === 0 ? <p className="page-subtitle">Henüz görüşme yok.</p> : <div style={{display:'grid',gap:8}}>{recent.map((item) => <Link key={item.id} href={`/help/features?conversation=${item.id}`} className="nav-item"><span>{item.title ?? item.mode.replaceAll('_',' ')}</span><span className="badge">{item.status}</span></Link>)}</div>}</aside></div></div>;
}
