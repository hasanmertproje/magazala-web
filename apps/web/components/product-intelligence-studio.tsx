'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Idea = { id: string; title: string; rationale: string; evidence: unknown; risks: unknown };
type Source = { id: string; title: string; url: string; retrievedAt: string; evidenceKind: string; confidence: number; position?: number; snippet?: string; engine?: string | null; evidenceNote?: string };
type Opportunity = { id: string; title: string; rationale: string; evidence: unknown; risks: unknown };
type EvidencePolicy = { kind: string; fullPageVerified: boolean };
type SavedSession = { id:string; mode:'IDEA'|'RESEARCH'; query:string; projectId:string|null; createdAt:string; sourceCount:number; opportunityCount:number; previewTitles:string[] };
type PersistedSession = { id:string; mode:'IDEA'|'RESEARCH'; query:string; projectId:string|null; createdAt:string; sources:Source[]; opportunities:Opportunity[]; evidencePolicy:EvidencePolicy|null };

const errorLabels: Record<string,string> = {
  AI_MODEL_NOT_CONFIGURED: 'Fikir üretimi için etkin bir metin modeli yapılandırılmamış.',
  AI_TEXT_ADAPTER_NOT_CONFIGURED: 'Etkin model için desteklenen metin sağlayıcı adaptörü bulunmuyor.',
  AI_PROVIDER_UNAVAILABLE: 'Yapılandırılmış yapay zekâ sağlayıcıları şu anda yanıt vermiyor.',
  RESEARCH_PROVIDER_NOT_CONFIGURED: 'Kaynaklı araştırma için SearXNG bağlantısı henüz yapılandırılmamış.',
  RESEARCH_NO_SOURCES: 'Bu sorgu için doğrulanabilir arama sonucu bulunamadı.',
  PRODUCT_INTELLIGENCE_SESSION_NOT_FOUND: 'Bu kayıt artık aktif çalışma alanında bulunmuyor.',
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function asString(value: unknown) { return typeof value === 'string' ? value : ''; }
function asStringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function asNumberArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number' && Number.isInteger(item)) : []; }

function ideaDesignPrompt(idea: Idea) {
  const evidence = asRecord(idea.evidence);
  const risks = asStringArray(idea.risks);
  return [
    `Ürün konsepti: ${idea.title}`,
    `Amaç ve gerekçe: ${idea.rationale}`,
    asString(evidence.productionFit) ? `Üretim uyumu: ${asString(evidence.productionFit)}` : '',
    asString(evidence.designDirection) ? `Tasarım yönü: ${asString(evidence.designDirection)}` : '',
    risks.length ? `Kaçınılacak riskler: ${risks.join('; ')}` : '',
    'Bu konseptten özgün, ticari kullanıma uygun bir görsel tasarım geliştir. Üçüncü taraf marka/karakter/telif unsurlarını kopyalama.',
  ].filter(Boolean).join('\n\n');
}

function researchDesignPrompt(item: Opportunity) {
  const evidence = asRecord(item.evidence);
  const refs = asNumberArray(evidence.sourceIndexes);
  const risks = asStringArray(item.risks);
  return [
    `Araştırmadan çıkan ürün fırsatı: ${item.title}`,
    `Analiz gerekçesi: ${item.rationale}`,
    refs.length ? `Araştırma referansları: ${refs.map((value) => `#${value}`).join(', ')}` : '',
    risks.length ? `Riskler: ${risks.join('; ')}` : '',
    'Bu araştırma yalnız ürün yönü için bağlamdır. Kaynaklardaki mevcut tasarımları kopyalama; özgün ve ticari kullanıma uygun yeni bir görsel yön geliştir.',
  ].filter(Boolean).join('\n\n');
}

export function ProductIntelligenceStudio() {
  const [mode,setMode] = useState<'IDEA'|'RESEARCH'>('IDEA');
  const [query,setQuery] = useState('');
  const [context,setContext] = useState('');
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const [ideas,setIdeas] = useState<Idea[]>([]);
  const [sources,setSources] = useState<Source[]>([]);
  const [opportunities,setOpportunities] = useState<Opportunity[]>([]);
  const [synthesisAvailable,setSynthesisAvailable] = useState<boolean | null>(null);
  const [evidencePolicy,setEvidencePolicy] = useState<EvidencePolicy | null>(null);
  const [savedSessions,setSavedSessions] = useState<SavedSession[]>([]);
  const [historyLoading,setHistoryLoading] = useState(true);
  const [historyError,setHistoryError] = useState<string | null>(null);
  const [openingSessionId,setOpeningSessionId] = useState<string | null>(null);
  const [activeSessionId,setActiveSessionId] = useState<string | null>(null);
  const [loadedFromHistory,setLoadedFromHistory] = useState(false);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true); setHistoryError(null);
    try {
      const response = await fetch('/api/product-intelligence/history?limit=16', { cache:'no-store' });
      const body = await response.json() as { ok?:boolean; code?:string; sessions?:SavedSession[] };
      if (!response.ok || !body.ok) throw new Error(body.code || 'HISTORY_LOAD_FAILED');
      setSavedSessions(body.sessions ?? []);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'HISTORY_LOAD_FAILED';
      setHistoryError(`Kaydedilmiş çalışmalar yüklenemedi (${code}).`);
    } finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  async function submit() {
    if (query.trim().length < 3 || loading) return;
    setLoading(true); setError(null); setIdeas([]); setSources([]); setOpportunities([]); setSynthesisAvailable(null); setEvidencePolicy(null); setLoadedFromHistory(false); setActiveSessionId(null);
    try {
      const endpoint = mode === 'IDEA' ? '/api/product-intelligence/idea' : '/api/product-intelligence/research';
      const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(mode === 'IDEA' ? { query, context: context || undefined } : { query }) });
      const body = await response.json() as { ok?:boolean; code?:string; sessionId?:string; ideas?:Idea[]; sources?:Source[]; opportunities?:Opportunity[]; synthesis?:{available:boolean}; evidencePolicy?:EvidencePolicy };
      if (!response.ok || !body.ok) throw new Error(body.code || 'REQUEST_FAILED');
      setIdeas(body.ideas ?? []); setSources(body.sources ?? []); setOpportunities(body.opportunities ?? []); setSynthesisAvailable(body.synthesis?.available ?? null); setEvidencePolicy(body.evidencePolicy ?? null); setActiveSessionId(body.sessionId ?? null);
      await refreshHistory();
    } catch (err) {
      const code = err instanceof Error ? err.message : 'REQUEST_FAILED';
      setError(errorLabels[code] ?? `İşlem tamamlanamadı (${code}).`);
    } finally { setLoading(false); }
  }

  async function openSession(id:string) {
    if (openingSessionId) return;
    setOpeningSessionId(id); setError(null);
    try {
      const response = await fetch(`/api/product-intelligence/sessions/${encodeURIComponent(id)}`, { cache:'no-store' });
      const body = await response.json() as { ok?:boolean; code?:string; session?:PersistedSession };
      if (!response.ok || !body.ok || !body.session) throw new Error(body.code || 'SESSION_LOAD_FAILED');
      const session = body.session;
      setMode(session.mode); setQuery(session.query); setContext(''); setActiveSessionId(session.id); setLoadedFromHistory(true); setEvidencePolicy(session.evidencePolicy);
      if (session.mode === 'IDEA') {
        setIdeas(session.opportunities); setSources([]); setOpportunities([]); setSynthesisAvailable(null);
      } else {
        setIdeas([]); setSources(session.sources); setOpportunities(session.opportunities); setSynthesisAvailable(session.opportunities.length ? true : null);
      }
      window.scrollTo({top:0,behavior:'smooth'});
    } catch (err) {
      const code = err instanceof Error ? err.message : 'SESSION_LOAD_FAILED';
      setError(errorLabels[code] ?? `Kayıt açılamadı (${code}).`);
    } finally { setOpeningSessionId(null); }
  }

  return <div>
    <div style={{display:'flex',gap:8,margin:'18px 0',alignItems:'center',flexWrap:'wrap'}}>
      <button className={`action ${mode==='IDEA'?'primary':''}`} onClick={()=>setMode('IDEA')}>Fikir Modu</button>
      <button className={`action ${mode==='RESEARCH'?'primary':''}`} onClick={()=>setMode('RESEARCH')}>Araştırma Modu</button>
      {activeSessionId ? <span className={`badge ${loadedFromHistory?'':'active'}`}>{loadedFromHistory?'KAYITLI OTURUM':'YENİ OTURUM'} · #{activeSessionId.slice(-7)}</span> : null}
    </div>
    <section className="card">
      <label style={{display:'block',fontWeight:700,marginBottom:8}}>{mode==='IDEA'?'Ne tür ürünler geliştirmek istiyorsunuz?':'Neyi araştırmak istiyorsunuz?'}</label>
      <textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder={mode==='IDEA'?'Örn. Vinyl sticker üretiyorum; özgün ve seri üretime uygun yeni koleksiyon fikirleri istiyorum.':'Örn. Türkiye ve global pazarda kahve temalı sticker tasarım eğilimleri'} style={{width:'100%',minHeight:110,background:'#0b0e14',border:'1px solid var(--line)',borderRadius:12,color:'white',padding:14,resize:'vertical'}} />
      {mode==='IDEA' ? <><textarea value={context} onChange={e=>setContext(e.target.value)} placeholder="İsteğe bağlı: üretim imkanları, hedef kitle, fiyat aralığı, kaçınılacak konular…" style={{width:'100%',minHeight:82,marginTop:10,background:'#0b0e14',border:'1px solid var(--line)',borderRadius:12,color:'white',padding:14,resize:'vertical'}} />{loadedFromHistory ? <p style={{margin:'8px 0 0',color:'var(--muted)',fontSize:11}}>Bu oturumun eski ek bağlam alanı kalıcı olarak saklanmadığı için yeniden oluşturulmadı. Kaydedilmiş çıktı aynen gösteriliyor.</p> : null}</> : null}
      <button className="action primary" onClick={submit} disabled={loading || query.trim().length<3} style={{marginTop:12}}>{loading?'İşleniyor…':mode==='IDEA'?'Yeni fikir çalışması oluştur':'Yeni kaynaklı araştırma başlat'}</button>
      {loadedFromHistory ? <p style={{margin:'10px 0 0',color:'var(--muted)',fontSize:12}}>Kaydedilmiş oturumu görüntülüyorsunuz. Yukarıdaki buton yeni bir çalışma ve yeni AI/API kullanımı oluşturur.</p> : null}
      {error ? <p style={{color:'#ff9b9b',marginTop:14}}>{error}</p> : null}
    </section>

    <section className="card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><h3 style={{margin:0}}>Kaydedilmiş çalışmalar</h3><p className="page-subtitle" style={{margin:'5px 0 0'}}>Daha önce üretilen fikir ve araştırmaları yeniden API çalıştırmadan açın.</p></div><button className="action" type="button" onClick={()=>void refreshHistory()} disabled={historyLoading}>{historyLoading?'Yükleniyor…':'Yenile'}</button></div>
      {historyError ? <p style={{color:'#ff9b9b'}}>{historyError}</p> : null}
      {!historyLoading && savedSessions.length===0 ? <div className="empty" style={{marginTop:12}}><div><strong>Kaydedilmiş çalışma yok</strong><br/><span>Oluşturduğunuz fikir ve araştırma oturumları burada görünecek.</span></div></div> : <div style={{display:'grid',gap:9,marginTop:12}}>{savedSessions.map(session=><div key={session.id} style={{padding:12,border:'1px solid var(--line)',borderRadius:12,display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap',background:activeSessionId===session.id?'rgba(255,255,255,.025)':'transparent'}}><div style={{minWidth:0,flex:'1 1 360px'}}><div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}><span className={`badge ${session.mode==='RESEARCH'?'active':''}`}>{session.mode==='IDEA'?'FİKİR':'ARAŞTIRMA'}</span><strong style={{fontSize:13}}>{session.query}</strong></div><div style={{color:'var(--muted)',fontSize:11,marginTop:5}}>{new Date(session.createdAt).toLocaleString('tr-TR')} · {session.opportunityCount} sonuç{session.mode==='RESEARCH'?` · ${session.sourceCount} kaynak`:''}</div>{session.previewTitles.length?<div style={{color:'var(--muted)',fontSize:11,marginTop:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{session.previewTitles.join(' · ')}</div>:null}</div><button className="action" type="button" disabled={openingSessionId!==null} onClick={()=>void openSession(session.id)}>{openingSessionId===session.id?'Açılıyor…':activeSessionId===session.id?'Tekrar aç':'Aç'}</button></div>)}</div>}
    </section>

    {ideas.length ? <div className="grid">{ideas.map(idea=>{
      const evidence = asRecord(idea.evidence); const risks = asStringArray(idea.risks);
      return <section className="card span-6" key={idea.id}><span className="badge active">AI FİKRİ · PAZAR VERİSİ DEĞİL</span><h3>{idea.title}</h3><p>{idea.rationale}</p>{asString(evidence.productionFit)?<div style={{marginTop:12}}><strong>Üretim uyumu</strong><p className="page-subtitle">{asString(evidence.productionFit)}</p></div>:null}{asString(evidence.designDirection)?<div style={{marginTop:12}}><strong>Tasarım yönü</strong><p className="page-subtitle">{asString(evidence.designDirection)}</p></div>:null}{risks.length?<div style={{marginTop:12}}><strong>Riskler</strong><p className="page-subtitle">{risks.join(' · ')}</p></div>:null}<Link className="action primary" style={{marginTop:14}} href={{pathname:'/create/design-studio',query:{prompt:ideaDesignPrompt(idea)}}}>Design Studio’da geliştir</Link></section>;
    })}</div> : null}

    {sources.length ? <div className="grid"><section className="card span-12"><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><h3 style={{margin:0}}>Araştırma kanıtları</h3><p className="page-subtitle" style={{margin:'5px 0 0'}}>Bu sürüm kaynak sayfanın tam metnini değil, arama motoru sonuç özetlerini kullanır. Sonuçlar bu sınır korunarak yorumlanır.</p></div><span className="badge">{evidencePolicy?.fullPageVerified ? 'TAM SAYFA DOĞRULANDI' : 'ARAMA ÖZETİ'}</span></div>{sources.map((source,index)=><div key={source.id} style={{padding:'14px 0',borderBottom:'1px solid var(--line)'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}><div style={{minWidth:0}}><a href={source.url} target="_blank" rel="noreferrer" style={{fontWeight:700}}>{source.position ?? index+1}. {source.title}</a><div style={{color:'var(--muted)',fontSize:12,overflow:'hidden',textOverflow:'ellipsis'}}>{source.url}{source.engine?` · ${source.engine}`:''}</div></div><span className="badge">ARAMA ÖZETİ</span></div>{source.snippet?<p style={{margin:'9px 0 0',fontSize:13,lineHeight:1.55}}>{source.snippet}</p>:null}{source.evidenceNote?<p style={{margin:'7px 0 0',color:'var(--muted)',fontSize:11}}>{source.evidenceNote}</p>:null}</div>)}</section></div> : null}
    {mode==='RESEARCH' && synthesisAvailable===false && sources.length ? <p className="subtitle">Arama kaynakları bulundu ve kaydedildi. AI sentezi kullanılamadığı için kaynaklardan desteklenmeyen çıkarım üretilmedi.</p> : null}
    {opportunities.length ? <div className="grid">{opportunities.map(item=>{
      const evidence = asRecord(item.evidence); const refs = asNumberArray(evidence.sourceIndexes); const risks = asStringArray(item.risks);
      return <section className="card span-6" key={item.id}><span className="badge active">ARAMA KANITINDAN SENTEZ</span><h3>{item.title}</h3><p>{item.rationale}</p>{refs.length?<p className="page-subtitle">Dayanak: {refs.map((value)=>`#${value}`).join(' · ')} · Tam sayfa doğrulaması yapılmadı.</p>:null}{risks.length?<div style={{marginTop:12}}><strong>Riskler</strong><p className="page-subtitle">{risks.join(' · ')}</p></div>:null}<Link className="action primary" style={{marginTop:14}} href={{pathname:'/create/design-studio',query:{prompt:researchDesignPrompt(item)}}}>Bu fırsat için tasarım oluştur</Link></section>;
    })}</div> : null}
  </div>;
}
