import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function stringList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }

export default async function RequirementsAdminPage() {
  const requirements = await db.requirement.findMany({
    include: { workspace: true, conversation: { include: { messages: { orderBy: { createdAt: 'asc' } } } } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  return <div className="content"><h1 className="page-title">Tasarlayalım AI Talepleri</h1><p className="page-subtitle">Ham görüşme, AI yorumu ve kullanıcı tarafından onaylanmış gereksinimler birbirinden ayrı tutulur.</p><div className="grid" style={{marginTop:18}}><section className="card span-12">{requirements.length === 0 ? <div className="empty"><div><strong>İncelenecek talep yok</strong><br/><span>Kullanıcı tarafından onaylanmış gereksinimler burada görüntülenir.</span></div></div> : requirements.map((requirement) => { const questions = stringList(requirement.openQuestions); return <article key={requirement.id} style={{padding:'18px 0',borderBottom:'1px solid var(--line)',display:'grid',gap:10}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}><div><strong>{requirement.title}</strong><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:7}}><span className="badge">{requirement.workspace.name}</span><span className="badge">{requirement.module}</span><span className="badge">{requirement.category}</span><span className="badge">{requirement.status}</span></div></div><small>{requirement.userConfirmedAt?.toLocaleString('tr-TR') ?? 'Onay bekliyor'}</small></div><p style={{margin:0}}>{requirement.description}</p>{questions.length > 0 && <div><small>Açık sorular</small><ul>{questions.map((question) => <li key={question}>{question}</li>)}</ul></div>}<details><summary>Ham görüşme ve AI analizi</summary><div style={{display:'grid',gap:10,marginTop:12}}><div><strong>Ham görüşme</strong>{requirement.conversation.messages.map((message) => <p key={message.id} style={{whiteSpace:'pre-wrap'}}><small>{message.role === 'assistant' ? 'Tasarlayalım AI' : 'Kullanıcı'}</small><br/>{message.content}</p>)}</div><div><strong>AI analizi</strong><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(requirement.conversation.aiInterpretation, null, 2)}</pre></div><div><strong>Kullanıcı tarafından onaylanan gereksinimler</strong><ul>{stringList(requirement.confirmedRequirements).map((value) => <li key={value}>{value}</li>)}</ul></div></div></details></article>; })}</section></div></div>;
}
