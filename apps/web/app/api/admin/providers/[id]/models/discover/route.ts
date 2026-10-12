import { NextResponse } from 'next/server';
import { requireSuperAdminApi } from '../../../../../../../lib/auth';
import { db } from '../../../../../../../lib/db';
import { revealProviderSecret } from '../../../../../../../lib/provider-credentials';

type DiscoveredModel = {
  id: string;
  name: string;
  methods: string[];
  suggestedCapabilities: string[];
  note?: string;
};

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
  return response.json() as Promise<unknown>;
}

function discoverNvidia(payload: unknown): DiscoveredModel[] {
  const data = (payload as { data?: Array<{ id?: string }> })?.data ?? [];
  return data
    .map((item) => item.id?.trim())
    .filter((id): id is string => Boolean(id))
    .map((id) => ({
      id,
      name: id.split('/').at(-1) ?? id,
      methods: [],
      suggestedCapabilities: [],
      note: 'NVIDIA model kataloğu model türünü güvenilir biçimde belirtmediği için yetenekleri admin doğrulamalıdır.',
    }))
    .slice(0, 250);
}

function discoverGemini(payload: unknown): DiscoveredModel[] {
  const models = (payload as { models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }> })?.models ?? [];
  return models
    .map((model) => {
      const id = model.name?.replace(/^models\//, '').trim();
      if (!id) return null;
      const methods = model.supportedGenerationMethods ?? [];
      const suggestedCapabilities = methods.includes('generateContent') ? ['text_generation'] : [];
      return {
        id,
        name: model.displayName?.trim() || id,
        methods,
        suggestedCapabilities,
        note: suggestedCapabilities.length ? 'Yetenek yalnız API metoduna göre önerildi; ticari kullanım ve çıktı türü ayrıca doğrulanmalıdır.' : undefined,
      } satisfies DiscoveredModel;
    })
    .filter((item): item is DiscoveredModel => item !== null)
    .slice(0, 250);
}

function discoverCloudflare(payload: unknown): DiscoveredModel[] {
  const result = (payload as { result?: Array<{ name?: string; task?: { name?: string } | string }> })?.result ?? [];
  const capabilityByTask: Record<string, string[]> = {
    'Text Generation': ['text_generation'],
    'Text to Image': ['text_to_image'],
    'Image to Text': ['vision_input'],
    'Text Embeddings': ['embeddings'],
  };
  return result
    .map((model) => {
      const id = model.name?.trim();
      if (!id) return null;
      const task = typeof model.task === 'string' ? model.task : model.task?.name;
      return {
        id,
        name: id,
        methods: task ? [task] : [],
        suggestedCapabilities: task ? (capabilityByTask[task] ?? []) : [],
        note: 'Cloudflare task bilgisi yalnız başlangıç önerisidir; model lisansı ve gerçek capability admin tarafından doğrulanmalıdır.',
      } satisfies DiscoveredModel;
    })
    .filter((item): item is DiscoveredModel => item !== null)
    .slice(0, 250);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });

  try {
    const { id } = await params;
    const provider = await db.provider.findUnique({
      where: { id },
      include: { credentials: { where: { enabled: true }, orderBy: { updatedAt: 'desc' }, take: 1 } },
    });
    if (!provider) return NextResponse.json({ ok: false, code: 'PROVIDER_NOT_FOUND' }, { status: 404 });
    const credential = provider.credentials[0];
    if (!credential) return NextResponse.json({ ok: false, code: 'PROVIDER_CREDENTIAL_REQUIRED' }, { status: 409 });
    const secret = await revealProviderSecret(credential.encryptedValue);

    let models: DiscoveredModel[];
    if (provider.slug === 'nvidia-nim') {
      const payload = await fetchJson('https://integrate.api.nvidia.com/v1/models', {
        headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
      });
      models = discoverNvidia(payload);
    } else if (provider.slug === 'google-gemini') {
      const payload = await fetchJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
        headers: { 'x-goog-api-key': secret, 'x-goog-api-client': 'magazala/0.2.0', Accept: 'application/json' },
      });
      models = discoverGemini(payload);
    } else if (provider.slug === 'cloudflare-workers-ai') {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
        return NextResponse.json({ ok: false, code: 'CLOUDFLARE_ACCOUNT_ID_REQUIRED' }, { status: 409 });
      }
      const payload = await fetchJson(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?per_page=100`, {
        headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
      });
      models = discoverCloudflare(payload);
    } else {
      return NextResponse.json({ ok: false, code: 'MODEL_DISCOVERY_NOT_SUPPORTED' }, { status: 409 });
    }

    await db.auditLog.create({
      data: {
        actorUserId: auth.context.user.id,
        action: 'provider.models.discover',
        entityType: 'Provider',
        entityId: provider.id,
        metadata: { count: models.length, providerSlug: provider.slug },
      },
    });

    return NextResponse.json({ ok: true, provider: { id: provider.id, name: provider.name, slug: provider.slug }, models });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'MODEL_DISCOVERY_FAILED';
    const status = code.includes('HTTP_401') || code.includes('HTTP_403') ? 401 : code.includes('HTTP_429') ? 429 : 502;
    return NextResponse.json({ ok: false, code }, { status });
  }
}
