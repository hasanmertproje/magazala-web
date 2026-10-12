import { ModelDiscovery } from '../../../components/model-discovery';
import { db } from '../../../lib/db';
import { supportsImageToImageRuntime, supportsTextRuntime, supportsTextToImageRuntime } from '../../../lib/provider-runtime';

export const dynamic = 'force-dynamic';

const capabilityOptions = [
  ['text_generation','Metin üretimi'],['reasoning','Akıl yürütme'],['vision_input','Görsel anlama'],['text_to_image','Görsel üretimi'],['image_to_image','Görselden görsele'],['image_edit','Görsel düzenleme'],['reference_images','Referans görsel'],['native_vector','Native vektör'],['vectorization','Vektörleştirme'],['transparent_background','Şeffaf arka plan'],['high_resolution','Yüksek çözünürlük'],['text_rendering','Tipografi'],['web_search','Web arama'],
] as const;

export default async function ModelsAdminPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const params = await searchParams;
  const [models, providers] = await Promise.all([
    db.aIModel.findMany({ include: { provider: true, capabilities: true }, orderBy: [{ provider: { priority: 'asc' } }, { name: 'asc' }] }),
    db.provider.findMany({ include: { credentials: { where: { enabled: true }, select: { id: true }, take: 1 } }, orderBy: { name: 'asc' } }),
  ]);
  const readyProviderIds = new Set(providers.filter((provider) => provider.enabled && provider.credentials.length > 0).map((provider) => provider.id));
  const enabledModels = models.filter((model) => model.enabled && readyProviderIds.has(model.providerId));
  const textReady = enabledModels.some((model) => supportsTextRuntime(model.provider.slug) && model.capabilities.some((item) => item.capability === 'text_generation'));
  const imageReady = enabledModels.some((model) => model.commercialUseAllowed && supportsTextToImageRuntime(model.provider.slug) && model.capabilities.some((item) => item.capability === 'text_to_image'));

  return <div className="content">
    <h1 className="page-title">Model Registry</h1>
    <p className="page-subtitle">Model yetenekleri provider kaydından ayrı tutulur. Bir model yalnız sağlayıcısı etkin, anahtarı mevcut, runtime adaptörü destekleniyor ve yetenekleri doğru tanımlanmışsa çalışma için hazır sayılır.</p>
    {params.notice && <section className="card" style={{marginTop:16}}>İşlem tamamlandı.</section>}
    {params.error && <section className="card" style={{marginTop:16,color:'#ff9b9b'}}>İşlem tamamlanamadı: {params.error}</section>}

    <section className="card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <div><h3 style={{margin:'0 0 5px'}}>Çalışma hazırlığı</h3><p className="page-subtitle" style={{margin:0}}>Tasarlayalım AI/Product Intelligence metin runtime’ı; Design Studio ise desteklenen ve ticari kullanımı doğrulanmış görsel model gerektirir.</p></div>
        <div style={{display:'flex',gap:7,flexWrap:'wrap'}}><span className={`badge ${textReady?'active':''}`}>{textReady?'METİN HAZIR':'METİN MODELİ GEREKLİ'}</span><span className={`badge ${imageReady?'active':''}`}>{imageReady?'GÖRSEL HAZIR':'GÖRSEL MODELİ GEREKLİ'}</span></div>
      </div>
    </section>

    <div className="grid" style={{marginTop:18}}>
      <ModelDiscovery providers={providers.map((provider) => ({ id: provider.id, name: provider.name, slug: provider.slug, enabled: provider.enabled, hasCredential: provider.credentials.length > 0 }))} />

      <section className="card span-12"><h3>Kayıtlı modeller</h3>{models.length === 0 && <div className="empty"><div><strong>Henüz model kaydı yok</strong><br/><span>Önce Provider Center üzerinden sağlayıcı ve anahtar yapılandırın; desteklenen sağlayıcılarda yukarıdaki keşif alanıyla gerçek model ID’lerini çekebilirsiniz.</span></div></div>}{models.map((model) => {
        const hasText = model.capabilities.some((item) => item.capability === 'text_generation');
        const hasTextToImage = model.capabilities.some((item) => item.capability === 'text_to_image');
        const hasImageToImage = model.capabilities.some((item) => item.capability === 'image_to_image');
        const runtimeReady =
          (hasText && supportsTextRuntime(model.provider.slug)) ||
          (hasTextToImage && supportsTextToImageRuntime(model.provider.slug)) ||
          (hasImageToImage && supportsImageToImageRuntime(model.provider.slug));
        return <div key={model.id} style={{display:'grid',gap:10,padding:'16px 0',borderBottom:'1px solid var(--line)'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><strong>{model.name}</strong><div style={{color:'var(--muted)',fontSize:13}}>{model.provider.name} · {model.externalModelId}</div></div><form action={`/api/admin/models/${model.id}/toggle`} method="post"><button className={`action ${model.enabled ? '' : 'primary'}`} type="submit">{model.enabled ? 'Devre dışı bırak' : 'Etkinleştir'}</button></form></div><div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{model.capabilities.map((item) => <span className="badge" key={item.capability}>{item.capability}</span>)}<span className={`badge ${model.enabled ? 'active' : ''}`}>{model.enabled ? 'AKTİF' : 'PASİF'}</span><span className={`badge ${runtimeReady ? 'active' : ''}`}>{runtimeReady ? 'RUNTIME DESTEKLİ' : 'RUNTIME ADAPTÖRÜ YOK'}</span>{model.commercialUseAllowed ? <span className="badge active">TİCARİ KULLANIM DOĞRULANDI</span> : <span className="badge">TİCARİ KULLANIM DOĞRULANMADI</span>}</div></div>;
      })}</section>

      <section className="card span-12" id="model-form"><h3>Model ekle</h3>{providers.length === 0 ? <p className="page-subtitle">Model eklemeden önce Provider Center üzerinden sağlayıcı oluşturun.</p> : <form action="/api/admin/models" method="post" style={{display:'grid',gap:14}}><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}><select className="input" name="providerId" required defaultValue=""><option value="" disabled>Sağlayıcı seçin</option>{providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}{provider.enabled ? '' : ' (pasif)'}</option>)}</select><input className="input" name="externalModelId" placeholder="Provider model ID" required/><input className="input" name="name" placeholder="Görünen model adı" required/><input className="input" name="version" placeholder="Versiyon (opsiyonel)"/></div><div><strong>Yetenekler</strong><p className="page-subtitle">Keşif alanındaki öneriler kesin kabul edilmez. Yalnız gerçekten desteklendiğini doğruladığınız yetenekleri işaretleyin.</p><div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:10}}>{capabilityOptions.map(([value,label]) => <label key={value} style={{display:'flex',gap:6,alignItems:'center'}}><input type="checkbox" name="capabilities" value={value}/>{label}</label>)}</div></div><label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" name="commercialUseAllowed"/> Ticari kullanım koşulları admin tarafından doğrulandı</label><button className="action primary" type="submit" style={{width:'fit-content'}}>Modeli kaydet</button></form>}</section>
    </div>
  </div>;
}
