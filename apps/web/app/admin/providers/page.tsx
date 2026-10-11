import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const usageHints: Record<string, { title: string; steps: string[] }> = {
  'huggingface-inference-providers': {
    title: 'Görsel üretimi için başlangıç',
    steps: [
      'Hugging Face hesabınızdan Inference Providers izinli bir access token oluşturun.',
      'Anahtarı aşağıdaki API Anahtarları alanından ekleyin ve bağlantıyı test edin.',
      'Model Registry içinde sağlayıcıya ait bir model ekleyip text_to_image yeteneğini işaretleyin.',
      'Model lisansını ayrıca kontrol etmeden “Ticari kullanım doğrulandı” seçeneğini açmayın.',
      'Model etkinleştirildiğinde AI Design Studio router tarafından otomatik değerlendirilir.',
    ],
  },
  'nvidia-nim': {
    title: 'Metin ve analiz kullanımı',
    steps: ['build.nvidia.com üzerinden geliştirici API anahtarı alın.', 'Model Registry içine text_generation destekli modeli ekleyin.', 'Geliştirici erişimini production ticari lisansı olarak değerlendirmeyin.'],
  },
  'google-gemini': {
    title: 'Metin modeli kullanımı',
    steps: ['Google AI Studio üzerinden API anahtarı oluşturun.', 'Metin/reasoning modelini Model Registry içine ekleyin.', 'Görsel üretim için ücretsiz katman varmış gibi varsaymayın; model bazında fiyat bilgisini tekrar doğrulayın.'],
  },
  'recraft': {
    title: 'Vektör ve tasarım odaklı kullanım',
    steps: ['Recraft API hesabından anahtar oluşturun.', 'Native vector destekleyen modeli capability bilgisiyle ayrı kaydedin.', 'Web uygulamasındaki ücretsiz kullanım ile API fiyatlandırmasını birbirine karıştırmayın.'],
  },
};

export default async function ProvidersPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; status?: string; count?: string }> }) {
  const params = await searchParams;
  const providers = await db.provider.findMany({
    orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    include: {
      credentials: { orderBy: { updatedAt: 'desc' } },
      health: { orderBy: { checkedAt: 'desc' }, take: 1 },
      models: { include: { capabilities: true }, orderBy: { name: 'asc' } },
    },
  });

  return <div className="content">
    <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><h1 className="page-title">AI Provider Center</h1><p className="page-subtitle">Sağlayıcı, anahtar, doğrulama kaynağı, kullanım sınıfı, model yetenekleri ve bağlantı sağlığı tek merkezden yönetilir. Ücretsiz kullanım bilgileri kalıcı varsayım değildir.</p></div>
      <form action="/api/admin/providers/seed-guides" method="post"><button className="action primary" type="submit">Doğrulanmış rehberleri eşitle</button></form>
    </div>
    {params.notice ? <section className="card" style={{marginTop:16}}>İşlem tamamlandı{params.status ? ` · ${params.status}` : ''}{params.count ? ` · ${params.count} kayıt` : ''}.</section> : null}
    {params.error ? <section className="card" style={{marginTop:16,color:'#ff9b9b'}}>İşlem tamamlanamadı: {params.error}</section> : null}

    {providers.length === 0 ? <section className="card" style={{marginTop:18}}><div className="empty"><div><strong>Provider kaydı yok</strong><br/><span>Doğrulanmış rehber kayıtlarını eşitleyerek başlayın.</span></div></div></section> : null}

    <div style={{display:'grid',gap:18,marginTop:18}}>{providers.map((provider) => {
      const health = provider.health[0];
      const hint = usageHints[provider.slug];
      return <section className="card" key={provider.id}>
        <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div><h2 style={{margin:'0 0 6px'}}>{provider.name}</h2><div style={{display:'flex',gap:7,flexWrap:'wrap'}}><span className="badge">{provider.pricingClassification}</span><span className={`badge ${provider.enabled?'active':''}`}>{provider.enabled?'ETKİN':'PASİF'}</span><span className="badge">{health?.status ?? 'TEST EDİLMEDİ'}</span></div></div>
          <div style={{display:'flex',gap:8}}><form action={`/api/admin/providers/${provider.id}/test`} method="post"><button className="action" type="submit" disabled={provider.credentials.every(c=>!c.enabled)}>Bağlantıyı test et</button></form><form action={`/api/admin/providers/${provider.id}/toggle`} method="post"><button className={`action ${provider.enabled?'':'primary'}`} type="submit">{provider.enabled?'Devre dışı bırak':'Etkinleştir'}</button></form></div>
        </div>

        <div className="grid" style={{marginTop:10}}>
          <div className="span-6"><h3>Doğrulama ve erişim</h3><div style={{display:'grid',gap:8,color:'var(--muted)',fontSize:14}}><div>Son doğrulama: <strong style={{color:'var(--text)'}}>{provider.lastVerifiedAt ? provider.lastVerifiedAt.toISOString().slice(0,10) : 'Doğrulama gerekli'}</strong></div><div>{provider.verificationNote || 'Doğrulama notu bulunmuyor.'}</div>{provider.commercialUseNote ? <div><strong style={{color:'var(--text)'}}>Ticari kullanım:</strong> {provider.commercialUseNote}</div> : null}<div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{provider.officialWebsite ? <a href={provider.officialWebsite} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>Resmi site ↗</a> : null}{provider.docsUrl ? <a href={provider.docsUrl} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>API dokümantasyonu ↗</a> : null}{provider.keyAcquisitionUrl ? <a href={provider.keyAcquisitionUrl} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>API anahtarı al ↗</a> : null}{provider.verificationSourceUrl ? <a href={provider.verificationSourceUrl} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>Doğrulama kaynağı ↗</a> : null}</div></div></div>
          <div className="span-6"><h3>Çalışma durumu</h3><div style={{display:'grid',gap:8,color:'var(--muted)',fontSize:14}}><div>Kayıtlı model: <strong style={{color:'var(--text)'}}>{provider.models.length}</strong></div><div>Etkin API anahtarı: <strong style={{color:'var(--text)'}}>{provider.credentials.filter(c=>c.enabled).length}</strong></div><div>Son bağlantı testi: <strong style={{color:'var(--text)'}}>{health?.checkedAt ? health.checkedAt.toISOString().replace('T',' ').slice(0,16) : 'Henüz yok'}</strong></div>{health?.latencyMs != null ? <div>Gecikme: <strong style={{color:'var(--text)'}}>{health.latencyMs} ms</strong></div> : null}</div></div>
        </div>

        {hint ? <div style={{marginTop:16,padding:16,border:'1px solid var(--line)',borderRadius:14,background:'#0b0e14'}}><strong>{hint.title}</strong><ol style={{color:'var(--muted)',lineHeight:1.65,paddingLeft:20,marginBottom:0}}>{hint.steps.map(step=><li key={step}>{step}</li>)}</ol></div> : null}

        <div style={{marginTop:18}}><h3>API Anahtarları</h3>{provider.credentials.length === 0 ? <p className="page-subtitle">Henüz anahtar eklenmemiş.</p> : provider.credentials.map((credential)=><div className="row" key={credential.id}><div><strong>{credential.label}</strong><div style={{color:'var(--muted)',fontSize:12}}>{credential.maskedHint} · {credential.enabled?'etkin':'pasif'}{credential.lastErrorCode ? ` · son hata: ${credential.lastErrorCode}` : ''}</div></div><form action={`/api/admin/provider-credentials/${credential.id}/toggle`} method="post"><button className="action" type="submit">{credential.enabled?'Devre dışı bırak':'Etkinleştir'}</button></form></div>)}<form action={`/api/admin/providers/${provider.id}/credentials`} method="post" style={{display:'grid',gridTemplateColumns:'minmax(140px,220px) minmax(240px,1fr) auto',gap:8,marginTop:12}}><input className="input" name="label" placeholder="Anahtar etiketi" defaultValue="Production" required/><input className="input" name="secret" type="password" autoComplete="new-password" placeholder="API anahtarı" required/><button className="action primary" type="submit">Anahtar ekle</button></form></div>

        {provider.models.length ? <div style={{marginTop:18}}><h3>Modeller</h3>{provider.models.map(model=><div className="row" key={model.id}><div><strong>{model.name}</strong><div style={{color:'var(--muted)',fontSize:12}}>{model.externalModelId}</div></div><div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>{model.capabilities.map(cap=><span className="badge" key={cap.capability}>{cap.capability}</span>)}</div></div>)}</div> : null}
      </section>;
    })}</div>

    <section className="card" style={{marginTop:18}}><h3>Özel sağlayıcı ekle</h3><form action="/api/admin/providers" method="post" style={{display:'grid',gap:10}}><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}}><input className="input" name="name" placeholder="Sağlayıcı adı" required/><input className="input" name="slug" placeholder="provider-slug" required/><select className="input" name="pricingClassification" defaultValue="NEEDS_REVERIFY"><option>FREE_ENDPOINT</option><option>FREE_CREDIT</option><option>FREE_TIER</option><option>TRIAL</option><option>PAID</option><option>SELF_HOSTED</option><option>NEEDS_REVERIFY</option></select></div><input className="input" name="officialWebsite" placeholder="Resmi site URL"/><input className="input" name="docsUrl" placeholder="API dokümantasyon URL"/><input className="input" name="keyAcquisitionUrl" placeholder="API key alma URL"/><button className="action primary" type="submit" style={{width:'fit-content'}}>Sağlayıcı oluştur</button></form></section>
  </div>;
}
