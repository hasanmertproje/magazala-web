import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const textAdapters = new Set(['nvidia-nim', 'google-gemini', 'cloudflare-workers-ai']);
const imageAdapters = new Set(['huggingface-inference-providers', 'cloudflare-workers-ai']);

type ReadinessState = 'OK' | 'WARNING' | 'MISSING';

type Check = {
  label: string;
  state: ReadinessState;
  detail: string;
};

function isConfigured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function encryptionKeyReady() {
  const value = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!value) return false;
  try { return Buffer.from(value, 'base64').byteLength === 32; } catch { return false; }
}

function cloudflareAccountReady() {
  return /^[a-f0-9]{32}$/i.test(process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? '');
}

function researchEndpointReady() {
  const value = process.env.SEARXNG_BASE_URL?.trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch { return false; }
}

function StateBadge({ state }: { state: ReadinessState }) {
  const label = state === 'OK' ? 'HAZIR' : state === 'WARNING' ? 'KONTROL' : 'EKSİK';
  return <span className={`badge ${state === 'OK' ? 'active' : ''}`}>{label}</span>;
}

export default async function SystemAdminPage() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [userCount, workspaceCount, providers, failedJobs24h, failedGenerations24h, failedProviderCalls24h, openRequirements] = await Promise.all([
    db.user.count(),
    db.workspace.count(),
    db.provider.findMany({
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
      include: {
        credentials: { where: { enabled: true }, select: { id: true }, take: 1 },
        health: { orderBy: { checkedAt: 'desc' }, take: 1 },
        models: { where: { enabled: true }, include: { capabilities: true } },
      },
    }),
    db.backgroundJobRecord.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
    db.generation.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
    db.usageLedger.count({ where: { success: false, startedAt: { gte: since } } }),
    db.requirement.count({ where: { status: { in: ['NEW', 'NEEDS_REVIEW', 'NEEDS_CLARIFICATION'] } } }),
  ]);

  const enabledProviders = providers.filter((provider) => provider.enabled);
  const readyProviders = enabledProviders.filter((provider) => provider.credentials.length > 0);
  const textReady = readyProviders.some((provider) => textAdapters.has(provider.slug) && provider.models.some((model) => model.capabilities.some((capability) => capability.capability === 'text_generation')));
  const imageReady = readyProviders.some((provider) => imageAdapters.has(provider.slug) && provider.models.some((model) => model.commercialUseAllowed === true && model.capabilities.some((capability) => capability.capability === 'text_to_image')));
  const cloudflareEnabled = enabledProviders.some((provider) => provider.slug === 'cloudflare-workers-ai');
  const storageReady = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'].every(isConfigured);

  const checks: Check[] = [
    { label: 'Oturum güvenliği', state: (process.env.SESSION_SECRET?.length ?? 0) >= 32 ? 'OK' : 'MISSING', detail: 'SESSION_SECRET en az 32 karakter olmalıdır.' },
    { label: 'Provider credential şifreleme', state: encryptionKeyReady() ? 'OK' : 'MISSING', detail: 'CREDENTIAL_ENCRYPTION_KEY tam 32 byte base64 anahtar olmalıdır.' },
    { label: 'Private object storage', state: storageReady ? 'OK' : 'MISSING', detail: 'S3-compatible storage; referans ve üretilen dosyalar için gereklidir.' },
    { label: 'Metin AI runtime', state: textReady ? 'OK' : 'MISSING', detail: 'Tasarlayalım AI ve Product Intelligence için desteklenen etkin metin modeli + credential gerekir.' },
    { label: 'Görsel AI runtime', state: imageReady ? 'OK' : 'MISSING', detail: 'Design Studio için desteklenen, etkin ve ticari kullanımı doğrulanmış text-to-image modeli gerekir.' },
    { label: 'Product Intelligence araştırma kaynağı', state: researchEndpointReady() ? 'OK' : 'WARNING', detail: 'SEARXNG_BASE_URL yoksa Idea Mode çalışır; kaynaklı Research Mode devre dışı kalır.' },
    { label: 'Cloudflare Account ID', state: !cloudflareEnabled ? 'OK' : cloudflareAccountReady() ? 'OK' : 'MISSING', detail: cloudflareEnabled ? 'Cloudflare Workers AI etkinse sunucuda geçerli CLOUDFLARE_ACCOUNT_ID gerekir.' : 'Cloudflare etkin değil; bu ayar zorunlu değil.' },
  ];
  const readyCount = checks.filter((check) => check.state === 'OK').length;
  const missingCount = checks.filter((check) => check.state === 'MISSING').length;

  return <div className="content">
    <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><h1 className="page-title">Sistem Sağlığı</h1><p className="page-subtitle">Sahte telemetri yerine gerçek veritabanı durumu, runtime konfigürasyonu ve son provider sağlık kayıtları gösterilir. Secret değerleri hiçbir zaman ekrana yazılmaz.</p></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><span className="badge active">{readyCount}/{checks.length} HAZIR</span>{missingCount ? <span className="badge">{missingCount} KRİTİK EKSİK</span> : null}</div>
    </div>

    <div className="grid" style={{marginTop:18}}>
      <section className="card span-3"><span className="eyebrow">Kullanıcı</span><div style={{fontSize:30,fontWeight:750,marginTop:8}}>{userCount}</div><p className="page-subtitle">Gerçek kullanıcı kaydı</p></section>
      <section className="card span-3"><span className="eyebrow">Workspace</span><div style={{fontSize:30,fontWeight:750,marginTop:8}}>{workspaceCount}</div><p className="page-subtitle">Tenant alanı</p></section>
      <section className="card span-3"><span className="eyebrow">Provider</span><div style={{fontSize:30,fontWeight:750,marginTop:8}}>{readyProviders.length}/{enabledProviders.length}</div><p className="page-subtitle">Anahtarı bulunan / etkin</p></section>
      <section className="card span-3"><span className="eyebrow">Açık talep</span><div style={{fontSize:30,fontWeight:750,marginTop:8}}>{openRequirements}</div><p className="page-subtitle">İnceleme veya açıklama bekliyor</p></section>

      <section className="card span-7">
        <h3 style={{marginTop:0}}>Production hazırlık kontrolü</h3>
        <div style={{display:'grid',gap:0}}>{checks.map((check) => <div className="row" key={check.label} style={{alignItems:'flex-start'}}><div><strong>{check.label}</strong><div style={{color:'var(--muted)',fontSize:12,marginTop:4}}>{check.detail}</div></div><StateBadge state={check.state}/></div>)}</div>
      </section>

      <section className="card span-5">
        <h3 style={{marginTop:0}}>Son 24 saat</h3>
        <div className="row"><div><strong>Başarısız provider çağrısı</strong><div style={{color:'var(--muted)',fontSize:12}}>Usage ledger</div></div><strong>{failedProviderCalls24h}</strong></div>
        <div className="row"><div><strong>Başarısız görsel üretimi</strong><div style={{color:'var(--muted)',fontSize:12}}>Generation kayıtları</div></div><strong>{failedGenerations24h}</strong></div>
        <div className="row"><div><strong>Başarısız background job</strong><div style={{color:'var(--muted)',fontSize:12}}>Queue/job kayıtları</div></div><strong>{failedJobs24h}</strong></div>
        <p className="page-subtitle" style={{marginTop:14}}>0 değeri yalnız gerçekten kayıt bulunmadığında gösterilir.</p>
      </section>

      <section className="card span-12">
        <h3 style={{marginTop:0}}>Provider runtime durumu</h3>
        {providers.length === 0 ? <div className="empty"><div><strong>Provider kaydı yok</strong><br/><span>Provider Center’dan doğrulanmış rehberleri eşitleyin.</span></div></div> : providers.map((provider) => {
          const latest = provider.health[0];
          const hasKey = provider.credentials.length > 0;
          const textModels = provider.models.filter((model) => model.capabilities.some((capability) => capability.capability === 'text_generation')).length;
          const imageModels = provider.models.filter((model) => model.commercialUseAllowed === true && model.capabilities.some((capability) => capability.capability === 'text_to_image')).length;
          return <div className="row" key={provider.id} style={{alignItems:'flex-start'}}><div><strong>{provider.name}</strong><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:7}}><span className={`badge ${provider.enabled?'active':''}`}>{provider.enabled?'ETKİN':'PASİF'}</span><span className="badge">{hasKey?'ANAHTAR VAR':'ANAHTAR YOK'}</span><span className="badge">METİN {textModels}</span><span className="badge">GÖRSEL {imageModels}</span></div></div><div style={{textAlign:'right'}}><strong>{latest?.status ?? 'TEST EDİLMEDİ'}</strong><div style={{color:'var(--muted)',fontSize:12,marginTop:4}}>{latest?.checkedAt ? latest.checkedAt.toISOString().replace('T',' ').slice(0,16) : 'Sağlık kaydı yok'}{latest?.latencyMs != null ? ` · ${latest.latencyMs} ms` : ''}</div></div></div>;
        })}
      </section>
    </div>
  </div>;
}
