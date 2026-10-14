import { z } from 'zod';
import { protectProviderSecret, revealProviderSecret } from './provider-credentials';

export const trendyolCredentialsSchema = z.object({
  sellerId: z.string().regex(/^[0-9]{1,15}$/),
  apiKey: z.string().min(8).max(256),
  apiSecret: z.string().min(8).max(256),
  mode: z.enum(['STAGE', 'PRODUCTION']),
});

export type TrendyolCredentials = z.infer<typeof trendyolCredentialsSchema>;

export async function encryptTrendyolCredentials(value: TrendyolCredentials) {
  return (await protectProviderSecret(JSON.stringify(value))).encryptedValue;
}

export async function decryptTrendyolCredentials(encrypted: string): Promise<TrendyolCredentials> {
  return trendyolCredentialsSchema.parse(JSON.parse(await revealProviderSecret(encrypted)));
}

/**
 * Read-only connection check. No product, inventory or order writes.
 * The host and route are fixed; credentials may never control outgoing URLs.
 * The result never includes secrets or marketplace response bodies.
 */
export async function validateTrendyolConnection(creds: TrendyolCredentials) {
  const validated = trendyolCredentialsSchema.parse(creds);
  const base = validated.mode === 'PRODUCTION' ? 'https://apigw.trendyol.com' : 'https://stageapigw.trendyol.com';
  const url = `${base}/integration/product/sellers/${validated.sellerId}/products/approved?size=1&page=0`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${validated.apiKey}:${validated.apiSecret}`, 'utf8').toString('base64'),
        'User-Agent': `${validated.sellerId} - EntegrePilot`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (response.ok) return { ok: true as const, code: 'CONNECTION_VERIFIED' };
    const code = response.status === 401 || response.status === 403 ? 'AUTH_FAILED'
      : response.status === 429 ? 'RATE_LIMITED'
      : response.status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_REQUEST_FAILED';
    return { ok: false as const, code };
  } catch {
    return { ok: false as const, code: 'PROVIDER_NETWORK_ERROR' };
  }
}
