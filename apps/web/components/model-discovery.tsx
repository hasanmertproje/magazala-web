'use client';

import { useMemo, useState } from 'react';

type ProviderOption = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  hasCredential: boolean;
};

type DiscoveredModel = {
  id: string;
  name: string;
  methods: string[];
  suggestedCapabilities: string[];
  note?: string;
};

type Payload = {
  ok: boolean;
  code?: string;
  provider?: { id: string; name: string; slug: string };
  models?: DiscoveredModel[];
};

const supported = new Set(['nvidia-nim', 'google-gemini', 'cloudflare-workers-ai']);

function friendlyError(code?: string) {
  if (code === 'PROVIDER_CREDENTIAL_REQUIRED') return 'Bu sağlayıcı için önce etkin bir API anahtarı ekleyin.';
  if (code === 'CLOUDFLARE_ACCOUNT_ID_REQUIRED') return 'Cloudflare model keşfi için sunucuda CLOUDFLARE_ACCOUNT_ID yapılandırılmalıdır.';
  if (code === 'MODEL_DISCOVERY_NOT_SUPPORTED') return 'Bu sağlayıcı için güvenilir otomatik model keşfi henüz desteklenmiyor.';
  if (code?.includes('HTTP_401') || code?.includes('HTTP_403')) return 'API anahtarı model listesini okumaya yetkili değil.';
  if (code?.includes('HTTP_429')) return 'Sağlayıcı istek sınırına ulaştı. Daha sonra yeniden deneyin.';
  return `Model listesi alınamadı${code ? ` (${code})` : ''}.`;
}

export function ModelDiscovery({ providers }: { providers: ProviderOption[] }) {
  const discoveryProviders = useMemo(() => providers.filter((provider) => supported.has(provider.slug)), [providers]);
  const [providerId, setProviderId] = useState(discoveryProviders[0]?.id ?? '');
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProvider = discoveryProviders.find((provider) => provider.id === providerId);
  const visibleModels = models.filter((model) => `${model.id} ${model.name} ${model.methods.join(' ')}`.toLowerCase().includes(filter.toLowerCase()));

  async function discover() {
    if (!providerId || busy) return;
    setBusy(true);
    setError(null);
    setModels([]);
    try {
      const response = await fetch(`/api/admin/providers/${encodeURIComponent(providerId)}/models/discover`, { cache: 'no-store' });
      const payload = await response.json() as Payload;
      if (!response.ok || !payload.ok) throw new Error(payload.code ?? 'MODEL_DISCOVERY_FAILED');
      setModels(payload.models ?? []);
    } catch (errorValue) {
      setError(friendlyError(errorValue instanceof Error ? errorValue.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  function transfer(model: DiscoveredModel) {
    const providerSelect = document.querySelector<HTMLSelectElement>('#model-form select[name="providerId"]');
    const externalId = document.querySelector<HTMLInputElement>('#model-form input[name="externalModelId"]');
    const nameInput = document.querySelector<HTMLInputElement>('#model-form input[name="name"]');
    if (providerSelect) {
      providerSelect.value = providerId;
      providerSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (externalId) {
      externalId.value = model.id;
      externalId.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (nameInput) {
      nameInput.value = model.name;
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    for (const capability of model.suggestedCapabilities) {
      const checkbox = document.querySelector<HTMLInputElement>(`#model-form input[name="capabilities"][value="${CSS.escape(capability)}"]`);
      if (checkbox) checkbox.checked = true;
    }
    document.getElementById('model-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (discoveryProviders.length === 0) {
    return <section className="card span-12"><h3>Model keşfi</h3><p className="page-subtitle">Otomatik model keşfi destekleyen bir sağlayıcı henüz eklenmemiş. Provider Center üzerinden NVIDIA, Gemini veya Cloudflare rehberlerini eşitleyin.</p></section>;
  }

  return <section className="card span-12">
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><h3 style={{marginTop:0}}>API’den model keşfet</h3><p className="page-subtitle">Model ID’lerini doğrudan sağlayıcı API’sinden alın. Sistem ticari kullanım veya yetenekleri kesinleştirmez; yalnız güvenilir metadata varsa öneri sunar.</p></div>
      <span className="badge">ANAHTAR TARAYICIYA GÖNDERİLMEZ</span>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'minmax(200px,1fr) auto',gap:8,marginTop:14}}>
      <select className="input" value={providerId} onChange={(event) => { setProviderId(event.target.value); setModels([]); setError(null); }}>
        {discoveryProviders.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}{provider.hasCredential ? '' : ' · anahtar gerekli'}{provider.enabled ? '' : ' · pasif'}</option>)}
      </select>
      <button className="action primary" type="button" disabled={busy || !providerId || !selectedProvider?.hasCredential} onClick={discover}>{busy ? 'Alınıyor…' : 'Model listesini getir'}</button>
    </div>
    {error ? <p style={{color:'#ff9b9b',marginTop:12}}>{error}</p> : null}
    {models.length > 0 ? <div style={{marginTop:14}}>
      <input className="input" placeholder="Model listesinde ara" value={filter} onChange={(event) => setFilter(event.target.value)} />
      <div style={{display:'grid',gap:8,marginTop:10,maxHeight:420,overflow:'auto'}}>
        {visibleModels.map((model) => <div className="row" key={model.id} style={{alignItems:'flex-start'}}>
          <div style={{minWidth:0}}><strong>{model.name}</strong><div style={{fontSize:12,color:'var(--muted)',wordBreak:'break-all'}}>{model.id}</div>{model.methods.length ? <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:6}}>{model.methods.map((method) => <span className="badge" key={method}>{method}</span>)}</div> : null}{model.note ? <div style={{fontSize:12,color:'var(--muted)',marginTop:6}}>{model.note}</div> : null}</div>
          <button className="action" type="button" onClick={() => transfer(model)}>Forma aktar</button>
        </div>)}
      </div>
    </div> : null}
  </section>;
}
