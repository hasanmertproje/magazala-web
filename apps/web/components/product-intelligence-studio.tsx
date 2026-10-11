'use client';

import { useState } from 'react';

type Idea = { id: string; title: string; rationale: string; evidence: unknown; risks: unknown };
type Source = { id: string; title: string; url: string; retrievedAt: string; evidenceKind: string; confidence: number };
type Opportunity = { id: string; title: string; rationale: string; evidence: unknown; risks: unknown };

const errorLabels: Record<string,string> = {
  AI_MODEL_NOT_CONFIGURED: 'Fikir üretimi için etkin bir metin modeli yapılandırılmamış.',
  AI_TEXT_ADAPTER_NOT_CONFIGURED: 'Etkin model için desteklenen metin sağlayıcı adaptörü bulunmuyor.',
  AI_PROVIDER_UNAVAILABLE: 'Yapılandırılmış yapay zekâ sağlayıcıları şu anda yanıt vermiyor.',
  RESEARCH_PROVIDER_NOT_CONFIGURED: 'Kaynaklı araştırma için SearXNG bağlantısı henüz yapılandırılmamış.',
  RESEARCH_NO_SOURCES: 'Bu sorgu için doğrulanabilir kaynak bulunamadı.',
};

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

  async function submit() {
    if (query.trim().length < 3 || loading) return;
    setLoading(true); setError(null); setIdeas([]); setSources([]); setOpportunities([]); setSynthesisAvailable(null);
    try {
      const endpoint = mode === 'IDEA' ? '/api/product-intelligence/idea' : '/api/product-intelligence/research';
      const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(mode === 'IDEA' ? { query, context: context || undefined } : { query }) });
      const body = await response.json() as { ok?:boolean; code?:string; ideas?:Idea[]; sources?:Source[]; opportunities?:Opportunity[]; synthesis?:{available:boolean} };
      if (!response.ok || !body.ok) throw new Error(body.code || 'REQUEST_FAILED');
      setIdeas(body.ideas ?? []); setSources(body.sources ?? []); setOpportunities(body.opportunities ?? []); setSynthesisAvailable(body.synthesis?.available ?? null);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'REQUEST_FAILED';
      setError(errorLabels[code] ?? `İşlem tamamlanamadı (${code}).`);
    } finally { setLoading(false); }
  }

  return <div>
    <div style={{display:'flex',gap:8,margin:'18px 0'}}>
      <button className={`action ${mode==='IDEA'?'primary':''}`} onClick={()=>setMode('IDEA')}>Fikir Modu</button>
      <button className={`action ${mode==='RESEARCH'?'primary':''}`} onClick={()=>setMode('RESEARCH')}>Araştırma Modu</button>
    </div>
    <section className="card">
      <label style={{display:'block',fontWeight:700,marginBottom:8}}>{mode==='IDEA'?'Ne tür ürünler geliştirmek istiyorsunuz?':'Neyi araştırmak istiyorsunuz?'}</label>
      <textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder={mode==='IDEA'?'Örn. Vinyl sticker üretiyorum; özgün ve seri üretime uygun yeni koleksiyon fikirleri istiyorum.':'Örn. Türkiye ve global pazarda kahve temalı sticker tasarım eğilimleri'} style={{width:'100%',minHeight:110,background:'#0b0e14',border:'1px solid var(--line)',borderRadius:12,color:'white',padding:14,resize:'vertical'}} />
      {mode==='IDEA' ? <textarea value={context} onChange={e=>setContext(e.target.value)} placeholder="İsteğe bağlı: üretim imkanları, hedef kitle, fiyat aralığı, kaçınılacak konular…" style={{width:'100%',minHeight:82,marginTop:10,background:'#0b0e14',border:'1px solid var(--line)',borderRadius:12,color:'white',padding:14,resize:'vertical'}} /> : null}
      <button className="action primary" onClick={submit} disabled={loading || query.trim().length<3} style={{marginTop:12}}>{loading?'İşleniyor…':mode==='IDEA'?'Fikirleri geliştir':'Kaynaklı araştırmayı başlat'}</button>
      {error ? <p style={{color:'#ff9b9b',marginTop:14}}>{error}</p> : null}
    </section>

    {ideas.length ? <div className="grid">{ideas.map(idea=><section className="card span-6" key={idea.id}><span className="badge active">AI FİKRİ · PAZAR VERİSİ DEĞİL</span><h3>{idea.title}</h3><p>{idea.rationale}</p>{Array.isArray(idea.risks)&&idea.risks.length?<p style={{color:'var(--muted)'}}>Riskler: {(idea.risks as string[]).join(' · ')}</p>:null}</section>)}</div> : null}

    {sources.length ? <div className="grid"><section className="card span-12"><h3>Kaynaklar</h3>{sources.map((source,index)=><div className="row" key={source.id}><div style={{minWidth:0}}><strong>{index+1}. {source.title}</strong><div style={{color:'var(--muted)',fontSize:12,overflow:'hidden',textOverflow:'ellipsis'}}>{source.url}</div></div><span className="badge">{source.evidenceKind}</span></div>)}</section></div> : null}
    {mode==='RESEARCH' && synthesisAvailable===false && sources.length ? <p className="subtitle">Kaynaklar bulundu ve kaydedildi. AI sentezi kullanılamadığı için kaynaklardan desteklenmeyen çıkarım üretilmedi.</p> : null}
    {opportunities.length ? <div className="grid">{opportunities.map(item=><section className="card span-6" key={item.id}><span className="badge active">KAYNAKLI ANALİZ</span><h3>{item.title}</h3><p>{item.rationale}</p></section>)}</div> : null}
  </div>;
}
