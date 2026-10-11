'use client';

import { useMemo, useRef, useState } from 'react';

type Message = { id: string; role: string; content: string; createdAt: string };
type Analysis = { summary: string; requirements: Array<{ title: string; module: string; category: string; description: string; confirmedRequirements: string[]; acceptanceSuggestions: string[]; openQuestions: string[]; risks: string[]; dependencies: string[]; outOfScope: string[] }>; overallOpenQuestions: string[] };
type Conversation = { id: string; mode: string; status: string; confirmationState: string; messages: Message[]; aiInterpretation: Analysis | null };

const modes = [
  ['FEATURE_IDEA','Yeni özellik fikrim var'],['WORKFLOW','Bir iş akışını anlatacağım'],['CHANGE_REQUEST','Mevcut özelliği değiştirmek istiyorum'],['PROBLEM','Bir problem yaşıyorum'],['EXPLORE','Sistemde ne yapılabilir konuşalım'],
] as const;

function friendlyError(code: string) {
  if (code === 'AI_MODEL_NOT_CONFIGURED') return 'Tasarlayalım AI için henüz etkin bir metin modeli yapılandırılmamış. Admin panelindeki Model Registry üzerinden model eklenip etkinleştirilmelidir.';
  if (code === 'AI_TEXT_ADAPTER_NOT_CONFIGURED') return 'Etkin model için desteklenen bir metin sağlayıcı adaptörü bulunmuyor.';
  if (code === 'AI_PROVIDER_UNAVAILABLE') return 'Yapılandırılmış AI sağlayıcılarına şu anda erişilemiyor. Provider Center sağlık durumunu kontrol edin.';
  return `İşlem tamamlanamadı (${code}).`;
}

async function api(path: string, body?: unknown) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.code ?? 'REQUEST_FAILED');
  return payload;
}

export function DiscoveryChat({ initialConversation }: { initialConversation: Conversation | null }) {
  const [conversation, setConversation] = useState(initialConversation);
  const [mode, setMode] = useState('FEATURE_IDEA');
  const [messages, setMessages] = useState<Message[]>(initialConversation?.messages ?? []);
  const [analysis, setAnalysis] = useState<Analysis | null>(initialConversation?.aiInterpretation ?? null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const confirmed = conversation?.confirmationState === 'CONFIRMED';
  const canAnalyze = messages.some((message) => message.role === 'user') && !confirmed;
  const title = useMemo(() => modes.find(([value]) => value === (conversation?.mode ?? mode))?.[1] ?? 'Özellik görüşmesi', [conversation?.mode, mode]);

  async function startConversation() {
    setBusy(true); setError(null);
    try {
      const payload = await api('/api/discovery/conversations', { mode });
      window.location.href = `/help/features?conversation=${encodeURIComponent(payload.conversation.id)}`;
    } catch (e) { setError(friendlyError(e instanceof Error ? e.message : 'REQUEST_FAILED')); setBusy(false); }
  }

  async function sendMessage() {
    if (!conversation || text.trim().length < 2 || busy || confirmed) return;
    const content = text.trim();
    setText(''); setBusy(true); setError(null);
    const optimistic: Message = { id: `local-${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, optimistic]);
    try {
      const payload = await api(`/api/discovery/conversations/${conversation.id}/messages`, { content });
      setMessages((current) => [...current.filter((message) => message.id !== optimistic.id), payload.userMessage, payload.assistantMessage]);
      setAnalysis(null);
      setConversation((current) => current ? { ...current, status: 'ACTIVE', confirmationState: 'UNCONFIRMED' } : current);
    } catch (e) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setText(content);
      setError(friendlyError(e instanceof Error ? e.message : 'REQUEST_FAILED'));
    } finally { setBusy(false); }
  }

  async function analyze() {
    if (!conversation || !canAnalyze || busy) return;
    setBusy(true); setError(null);
    try {
      const payload = await api(`/api/discovery/conversations/${conversation.id}/analyze`);
      setAnalysis(payload.analysis);
      setConversation((current) => current ? { ...current, status: 'ANALYZED', confirmationState: 'PENDING' } : current);
    } catch (e) { setError(friendlyError(e instanceof Error ? e.message : 'REQUEST_FAILED')); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!conversation || !analysis || busy || confirmed) return;
    setBusy(true); setError(null);
    try {
      await api(`/api/discovery/conversations/${conversation.id}/confirm`);
      setConversation((current) => current ? { ...current, status: 'SUBMITTED', confirmationState: 'CONFIRMED' } : current);
    } catch (e) { setError(friendlyError(e instanceof Error ? e.message : 'REQUEST_FAILED')); }
    finally { setBusy(false); }
  }

  if (!conversation) return <section className="card" style={{maxWidth:760}}><h3>Yeni görüşme</h3><p className="page-subtitle">Konuyu seçin. Tasarlayalım AI yalnız gerekli noktaları netleştirir; siz onaylamadan gereksinim oluşturulmaz.</p><div style={{display:'grid',gap:9,marginTop:18}}>{modes.map(([value,label]) => <label key={value} className="inspector-row" style={{cursor:'pointer'}}><span>{label}</span><input type="radio" checked={mode === value} onChange={() => setMode(value)} /></label>)}</div>{error && <p style={{marginTop:14}}>{error}</p>}<button className="action primary" style={{marginTop:18}} disabled={busy} onClick={startConversation}>{busy ? 'Başlatılıyor…' : 'Görüşmeyi başlat'}</button></section>;

  return <div className="chat-layout"><section className="card chat"><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><strong>Tasarlayalım AI</strong><div style={{fontSize:12,color:'var(--muted)'}}>{title}</div></div><a className="action" href="/help/features">Yeni görüşme</a></div><div className="chat-feed" style={{marginTop:14}}>{messages.length === 0 && <div className="empty"><div><strong>İhtiyacınızı anlatın</strong><br/><span>İş akışını, yeni özelliği, değişikliği veya yaşadığınız problemi doğal şekilde yazabilirsiniz.</span></div></div>}{messages.map((message) => <div key={message.id} style={{alignSelf:message.role === 'user' ? 'flex-end' : 'flex-start',maxWidth:'86%',padding:'12px 14px',border:'1px solid var(--line)',borderRadius:14,background:message.role === 'user' ? 'var(--panel-2)' : 'var(--panel)'}}><div style={{fontSize:11,color:'var(--muted)',marginBottom:5}}>{message.role === 'user' ? 'Siz' : 'Tasarlayalım AI'}</div><div style={{whiteSpace:'pre-wrap'}}>{message.content}</div></div>)}</div>{error && <p style={{margin:'12px 0 0'}}>{error}</p>}{!confirmed && <div className="chat-composer"><textarea ref={composerRef} aria-label="Özellik görüşmesi" placeholder="İhtiyacınızı anlatın…" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}/><button className="action primary" disabled={busy || text.trim().length < 2} onClick={sendMessage}>{busy ? 'İşleniyor…' : 'Gönder'}</button></div>}</section><aside className="card"><h3>Gereksinim analizi</h3>{confirmed && <p><span className="badge active">ONAYLANDI</span></p>}{!analysis ? <><p className="page-subtitle">Görüşme yeterince netleştiğinde AI’dan yapılandırılmış gereksinim özeti isteyin.</p><button className="action" disabled={!canAnalyze || busy} onClick={analyze}>İsteğimi özetle</button></> : <div style={{display:'grid',gap:14}}><p style={{whiteSpace:'pre-wrap'}}>{analysis.summary}</p>{analysis.requirements.map((item, index) => <div key={`${item.title}-${index}`} style={{paddingTop:12,borderTop:'1px solid var(--line)'}}><strong>{item.title}</strong><div style={{display:'flex',gap:6,margin:'7px 0',flexWrap:'wrap'}}><span className="badge">{item.module}</span><span className="badge">{item.category}</span></div><p>{item.description}</p>{item.openQuestions.length > 0 && <><small>Açık sorular</small><ul>{item.openQuestions.map((value) => <li key={value}>{value}</li>)}</ul></>}</div>)}{!confirmed && <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="action primary" disabled={busy} onClick={confirm}>Doğru anladım</button><button className="action" disabled={busy} onClick={() => { setAnalysis(null); setConversation((current) => current ? { ...current, confirmationState: 'UNCONFIRMED' } : current); setTimeout(() => composerRef.current?.focus(), 0); }}>Düzeltelim</button></div>}</div>}</aside></div>;
}
