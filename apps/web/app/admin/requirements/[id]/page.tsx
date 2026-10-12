import { RequirementStatus } from '@prisma/client';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const statusLabels: Record<RequirementStatus,string> = {
  NEW:'Yeni', NEEDS_REVIEW:'İnceleme gerekli', NEEDS_CLARIFICATION:'Ek bilgi gerekli', ACCEPTED:'Kabul edildi', PLANNED:'Planlandı', IN_PROGRESS:'Geliştiriliyor', BETA:'Beta', RELEASED:'Yayınlandı', REJECTED:'Reddedildi', MERGED:'Birleştirildi',
};

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function PrettyList({title,items,empty='Yok'}:{title:string;items:string[];empty?:string}){
  return <div style={{padding:'14px 0',borderBottom:'1px solid var(--line)'}}><strong>{title}</strong>{items.length?<ul style={{margin:'9px 0 0',paddingLeft:20,lineHeight:1.65}}>{items.map((item,index)=><li key={`${title}-${index}`}>{item}</li>)}</ul>:<p className="page-subtitle" style={{margin:'7px 0 0'}}>{empty}</p>}</div>;
}

export default async function RequirementDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{notice?:string;error?:string}>}){
  const {id}=await params;
  const query=await searchParams;
  const requirement=await db.requirement.findUnique({
    where:{id},
    include:{
      workspace:{select:{id:true,name:true,slug:true}},
      conversation:{include:{messages:{orderBy:{createdAt:'asc'}}}},
      clarifications:{include:{author:{select:{email:true,displayName:true}}},orderBy:{createdAt:'asc'}},
      relationsFrom:{include:{to:{select:{id:true,title:true,status:true}}}},
      relationsTo:{include:{from:{select:{id:true,title:true,status:true}}}},
    },
  });
  if(!requirement)notFound();
  const user=await db.user.findUnique({where:{id:requirement.conversation.userId},select:{email:true,displayName:true}});
  const confirmed=strings(requirement.confirmedRequirements);
  const acceptance=strings(requirement.acceptanceSuggestions);
  const openQuestions=strings(requirement.openQuestions);
  const risks=strings(requirement.risks);
  const dependencies=strings(requirement.dependencies);
  const outOfScope=strings(requirement.outOfScope);
  const aiAnalysis=requirement.conversation.aiInterpretation?JSON.stringify(requirement.conversation.aiInterpretation,null,2):null;
  const returnTo=`/admin/requirements/${requirement.id}`;
  const closed=['RELEASED','REJECTED','MERGED'].includes(requirement.status);

  return <div className="content">
    <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><Link href="/admin/requirements" style={{fontSize:12,color:'var(--muted)'}}>← Tasarlayalım AI Talepleri</Link><h1 className="page-title" style={{marginTop:8}}>{requirement.title}</h1><p className="page-subtitle">{requirement.workspace.name} · {requirement.module} · {user?.displayName??user?.email??'Kullanıcı'} · REQ #{requirement.id.slice(-8)}</p></div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}><span className={`badge ${requirement.status==='NEW'?'active':''}`}>{statusLabels[requirement.status]}</span><span className="badge">{requirement.category}</span>{requirement.userConfirmedAt?<span className="badge active">KULLANICI ONAYLI</span>:<span className="badge">ONAY ZAMANI YOK</span>}</div>
    </div>

    {query.notice?<section className="card" style={{marginTop:14}}>İşlem tamamlandı.</section>:null}
    {query.error?<section className="card" style={{marginTop:14,color:'var(--danger)'}}>İşlem tamamlanamadı: {query.error}</section>:null}

    <div className="grid" style={{marginTop:18}}>
      <section className="card span-7">
        <h2 style={{marginTop:0}}>Admin değerlendirmesi</h2>
        <form action={`/api/admin/requirements/${requirement.id}`} method="post" style={{display:'grid',gridTemplateColumns:'minmax(180px,1fr) minmax(160px,220px) auto',gap:8,alignItems:'end'}}>
          <input type="hidden" name="returnTo" value={returnTo}/>
          <label>Durum<select className="input" name="status" defaultValue={requirement.status}>{Object.values(RequirementStatus).map((value)=><option value={value} key={value}>{statusLabels[value]}</option>)}</select></label>
          <label>Admin önceliği<select className="input" name="adminPriority" defaultValue={requirement.adminPriority??''}><option value="">Belirlenmedi</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label>
          <button className="action primary" type="submit">Kaydet</button>
        </form>
        <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:14}}><span className="badge">KULLANICI: {requirement.userPriority??'—'}</span><span className="badge">AI ÖNERİSİ: {requirement.aiPrioritySuggestion??'—'}</span><span className="badge">ADMIN: {requirement.adminPriority??'—'}</span></div>
      </section>

      <section className="card span-5">
        <h2 style={{marginTop:0}}>Geliştirme için dışa aktar</h2>
        <p className="page-subtitle">Export; onaylı requirement, AI analizi, ham sohbet, açıklama thread’i ve özellik kataloğu snapshot’ını birlikte taşır.</p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><a className="action primary" href={`/api/admin/requirements/${requirement.id}/export?format=md`}>Markdown indir</a><a className="action" href={`/api/admin/requirements/${requirement.id}/export?format=json`}>JSON indir</a><a className="action" href={`/api/admin/requirements/${requirement.id}/export?format=txt`}>TXT indir</a></div>
      </section>
    </div>

    <section className="card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><span className="badge active">KULLANICI TARAFINDAN ONAYLANAN KAYIT</span><h2 style={{margin:'9px 0 0'}}>Gereksinim</h2></div><Link className="action" href={`/admin/workspaces/${requirement.workspaceId}`}>Müşteri hesabını aç</Link></div>
      <p style={{lineHeight:1.7,marginTop:14}}>{requirement.description}</p>
      <PrettyList title="Onaylanan gereksinimler" items={confirmed}/><PrettyList title="Kabul kriteri önerileri" items={acceptance}/><PrettyList title="Açık sorular" items={openQuestions}/><PrettyList title="Riskler" items={risks}/><PrettyList title="Bağımlılıklar" items={dependencies}/><PrettyList title="Kapsam dışı" items={outOfScope}/>
      <div style={{fontSize:11,color:'var(--muted)',marginTop:12}}>Kullanıcı onayı: {requirement.userConfirmedAt?.toLocaleString('tr-TR')??'kayıt yok'} · Son güncelleme: {requirement.updatedAt.toLocaleString('tr-TR')}</div>
    </section>

    <section className="card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><span className="badge">ADMİN ↔ KULLANICI AÇIKLAMA KANALI</span><h2 style={{margin:'9px 0 0'}}>Talep açıklamaları</h2></div><span className="badge">{requirement.clarifications.length} MESAJ</span></div>
      <p className="page-subtitle">Bu thread orijinal Tasarlayalım AI sohbetinden ayrıdır. Admin mesajı AI mesajı olarak, kullanıcı cevabı da eski onaylı gereksinimin parçası olarak gösterilmez.</p>
      <div style={{display:'grid',gap:9,marginTop:12}}>{requirement.clarifications.length?requirement.clarifications.map((message)=><div key={message.id} style={{padding:12,border:'1px solid var(--line)',borderRadius:12,background:message.authorRole==='ADMIN'?'rgba(255,255,255,.025)':'transparent'}}><div style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:6}}><strong style={{fontSize:12}}>{message.authorRole==='ADMIN'?'Admin':'Kullanıcı'}{message.author?.displayName||message.author?.email?` · ${message.author?.displayName??message.author?.email}`:''}</strong><span style={{fontSize:10,color:'var(--muted)'}}>{message.createdAt.toLocaleString('tr-TR')}</span></div><div style={{whiteSpace:'pre-wrap',lineHeight:1.6,fontSize:13}}>{message.content}</div></div>):<p className="page-subtitle">Henüz açıklama mesajı yok.</p>}</div>
      {!closed?<form action={`/api/admin/requirements/${requirement.id}/clarifications`} method="post" style={{display:'grid',gap:8,marginTop:14}}><input type="hidden" name="returnTo" value={returnTo}/><label>Ek bilgi iste<textarea name="content" required minLength={2} maxLength={4000} placeholder="Netleştirilmesi gereken noktayı kullanıcıya sorun…" style={{width:'100%',minHeight:90,marginTop:6,background:'#0b0e14',border:'1px solid var(--line)',borderRadius:12,color:'white',padding:12}}/></label><button className="action primary" type="submit" style={{width:'fit-content'}}>Kullanıcıdan açıklama iste</button></form>:<p className="page-subtitle" style={{marginTop:12}}>Kapalı taleplerde yeni açıklama istenemez.</p>}
    </section>

    <section className="card" style={{marginTop:18}}>
      <span className="badge">AI ANALİZİ · KULLANICI METNİ DEĞİLDİR</span><h2 style={{margin:'9px 0 10px'}}>Tasarlayalım AI analizi</h2>{aiAnalysis?<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',background:'#090b10',border:'1px solid var(--line)',borderRadius:12,padding:14,fontSize:12,lineHeight:1.55,maxHeight:620,overflow:'auto'}}>{aiAnalysis}</pre>:<p className="page-subtitle">AI analiz kaydı bulunmuyor.</p>}
    </section>

    <section className="card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><span className="badge">HAM KONUŞMA</span><h2 style={{margin:'9px 0 0'}}>Kullanıcı ↔ Tasarlayalım AI</h2></div><span style={{fontSize:11,color:'var(--muted)'}}>Conversation #{requirement.conversationId.slice(-8)} · {requirement.conversation.mode} · {requirement.conversation.status}</span></div>
      <div style={{display:'grid',gap:10,marginTop:14}}>{requirement.conversation.messages.length?requirement.conversation.messages.map((message)=><div key={message.id} style={{padding:13,border:'1px solid var(--line)',borderRadius:12,background:message.role==='assistant'?'rgba(255,255,255,.025)':'transparent'}}><div style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:7}}><strong style={{fontSize:12}}>{message.role==='assistant'?'Tasarlayalım AI':'Kullanıcı'}</strong><span style={{fontSize:10,color:'var(--muted)'}}>{message.createdAt.toLocaleString('tr-TR')}</span></div><div style={{whiteSpace:'pre-wrap',lineHeight:1.6,fontSize:13}}>{message.content}</div></div>):<p className="page-subtitle">Ham mesaj kaydı bulunmuyor.</p>}</div>
    </section>

    {(requirement.relationsFrom.length||requirement.relationsTo.length)?<section className="card" style={{marginTop:18}}><h2 style={{marginTop:0}}>İlişkili gereksinimler</h2>{requirement.relationsFrom.map((relation)=><div className="row" key={`to-${relation.toId}`}><Link href={`/admin/requirements/${relation.to.id}`}>{relation.to.title}</Link><span className="badge">{relation.type} · {relation.to.status}</span></div>)}{requirement.relationsTo.map((relation)=><div className="row" key={`from-${relation.fromId}`}><Link href={`/admin/requirements/${relation.from.id}`}>{relation.from.title}</Link><span className="badge">{relation.type} · {relation.from.status}</span></div>)}</section>:null}
  </div>;
}
