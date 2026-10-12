import type { ProviderHealthStatus } from '@prisma/client';

type TestResult = {
  supported: boolean;
  status: ProviderHealthStatus;
  code: string;
  latencyMs?: number;
  detail: string;
};

function classifyHttp(statusCode: number): ProviderHealthStatus {
  if (statusCode >= 200 && statusCode < 300) return 'HEALTHY';
  if (statusCode === 401 || statusCode === 403) return 'AUTH_ERROR';
  if (statusCode === 429) return 'RATE_LIMITED';
  if (statusCode >= 500) return 'UNAVAILABLE';
  return 'DEGRADED';
}

async function timedFetch(url: string, init: RequestInit): Promise<{ status: number; latencyMs: number }> {
  const started = Date.now();
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  return { status: response.status, latencyMs: Date.now() - started };
}

export async function testKnownProvider(slug: string, secret: string): Promise<TestResult> {
  try {
    let result: { status: number; latencyMs: number };
    if (slug === 'nvidia-nim') {
      result = await timedFetch('https://integrate.api.nvidia.com/v1/models', { headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' } });
    } else if (slug === 'huggingface-inference-providers') {
      result = await timedFetch('https://huggingface.co/api/whoami-v2', { headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' } });
    } else if (slug === 'google-gemini') {
      result = await timedFetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': secret, 'x-goog-api-client': 'magazala/0.1.0', Accept: 'application/json' } });
    } else if (slug === 'cloudflare-workers-ai') {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) return { supported: false, status: 'DISABLED', code: 'CLOUDFLARE_ACCOUNT_ID_REQUIRED', detail: 'Cloudflare bağlantı testi için sunucuda geçerli Account ID yapılandırılmalıdır.' };
      result = await timedFetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?per_page=1`, { headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' } });
    } else {
      return { supported: false, status: 'DISABLED', code: 'TEST_STRATEGY_NOT_AVAILABLE', detail: 'Bu sağlayıcı için güvenli ve doğrulanmış bağlantı testi henüz tanımlı değil.' };
    }
    const status = classifyHttp(result.status);
    return { supported: true, status, code: status === 'HEALTHY' ? 'CONNECTION_OK' : `HTTP_${result.status}`, latencyMs: result.latencyMs, detail: status === 'HEALTHY' ? 'Kimlik doğrulama ve servis erişimi doğrulandı.' : `Sağlayıcı HTTP ${result.status} döndürdü.` };
  } catch (error) {
    return { supported: true, status: 'UNAVAILABLE', code: error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR', detail: 'Sağlayıcıya güvenli bağlantı kurulamadı.' };
  }
}
