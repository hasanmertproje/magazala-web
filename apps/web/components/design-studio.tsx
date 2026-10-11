'use client';

import { useState } from 'react';

type Quality = 'FAST'|'BALANCED'|'BEST_QUALITY'|'PRINT_PREFERRED';
const errors: Record<string,string> = {
  NO_IMAGE_PROVIDER_CONFIGURED: 'Görsel üretimi için etkin bir text-to-image modeli ve API anahtarı yapılandırılmalı.',
  NO_ELIGIBLE_MODEL: 'Bu üretim için uygun ve ticari kullanımı doğrulanmış bir model bulunamadı.',
  OBJECT_STORAGE_NOT_CONFIGURED: 'Üretilen dosyaları güvenli saklamak için object storage yapılandırılmalı.',
  IMAGE_PROVIDER_UNAVAILABLE: 'Görsel sağlayıcısı şu anda yanıt vermiyor.',
};

export function DesignStudio() {
  const [prompt,setPrompt] = useState('');
  const [negativePrompt,setNegativePrompt] = useState('');
  const [size,setSize] = useState('1024x1024');
  const [quality,setQuality] = useState<Quality>('BALANCED');
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [result,setResult] = useState<{contentUrl:string;generationId:string;assetId:string;modelId:string}|null>(null);

  async function generate() {
    if (prompt.trim().length < 3 || loading) return;
    setLoading(true); setError(null); setResult(null);
    const [width,height] = size.split('x').map(Number);
    try {
      const response = await fetch('/api/design/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ prompt, negativePrompt:negativePrompt||undefined, width, height, qualityProfile:quality }) });
      const body = await response.json() as {ok?:boolean;code?:string;contentUrl?:string;generationId?:string;assetId?:string;modelId?:string};
      if (!response.ok || !body.ok || !body.contentUrl || !body.generationId || !body.assetId || !body.modelId) throw new Error(body.code || 'IMAGE_GENERATION_FAILED');
      setResult({contentUrl:body.contentUrl,generationId:body.generationId,assetId:body.assetId,modelId:body.modelId});
    } catch (err) {
      const code = err instanceof Error ? err.message : 'IMAGE_GENERATION_FAILED';
      setError(errors[code] ?? `Görsel üretimi tamamlanamadı (${code}).`);
    } finally { setLoading(false); }
  }

  return <div className="chat-layout">
    <section className="card chat">
      <div className="chat-feed" style={{padding:0}}>
        {result ? <div style={{display:'grid',gap:12}}><img src={result.contentUrl} alt="Üretilen tasarım" style={{width:'100%',maxHeight:720,objectFit:'contain',borderRadius:14,background:'#080a0f'}}/><div style={{color:'var(--muted)',fontSize:12}}>Üretim #{result.generationId.slice(-8)} · Asset #{result.assetId.slice(-8)}</div></div> : <div className="empty"><div><strong>Yeni tasarım üretimi</strong><br/><span>İsteğinizi yazın. Sonuç özel dosya alanına kaydedilir.</span></div></div>}
      </div>
      <div className="chat-composer" style={{display:'block'}}>
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} aria-label="Tasarım isteği" placeholder="Örn. Baskıya uygun kompozisyonda retro kahve temalı özgün bir sticker illüstrasyonu…" style={{width:'100%'}}/>
        <textarea value={negativePrompt} onChange={e=>setNegativePrompt(e.target.value)} aria-label="Kaçınılacak özellikler" placeholder="İsteğe bağlı: kaçınılacak detaylar…" style={{width:'100%',marginTop:8,minHeight:56}}/>
        {error ? <p style={{color:'#ff9b9b'}}>{error}</p> : null}
        <button className="action primary" onClick={generate} disabled={loading||prompt.trim().length<3} style={{marginTop:10}}>{loading?'Üretiliyor…':'Görsel oluştur'}</button>
      </div>
    </section>
    <aside className="card">
      <h3>Üretim Ayarları</h3>
      <label style={{display:'block',margin:'14px 0 6px',color:'var(--muted)'}}>Boyut</label>
      <select value={size} onChange={e=>setSize(e.target.value)} style={{width:'100%',padding:10,background:'#0b0e14',color:'white',border:'1px solid var(--line)',borderRadius:10}}><option value="1024x1024">1024 × 1024</option><option value="1024x1536">1024 × 1536</option><option value="1536x1024">1536 × 1024</option></select>
      <label style={{display:'block',margin:'14px 0 6px',color:'var(--muted)'}}>Kalite yönlendirmesi</label>
      <select value={quality} onChange={e=>setQuality(e.target.value as Quality)} style={{width:'100%',padding:10,background:'#0b0e14',color:'white',border:'1px solid var(--line)',borderRadius:10}}><option value="FAST">Hızlı</option><option value="BALANCED">Dengeli</option><option value="BEST_QUALITY">En yüksek kalite</option><option value="PRINT_PREFERRED">Baskı öncelikli</option></select>
      <p style={{marginTop:16}}>Model otomatik seçilir. Yalnızca <code>text_to_image</code> yeteneği açık ve ticari kullanım durumu admin tarafından doğrulanmış modeller değerlendirilir.</p>
      <p style={{color:'var(--muted)',fontSize:12}}>Şeffaf arka plan, gerçek vektör ve referans görsel seçenekleri yalnız destekleyen provider adapter’ları etkinleştirildiğinde açılacaktır.</p>
    </aside>
  </div>;
}
