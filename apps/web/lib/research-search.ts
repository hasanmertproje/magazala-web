export type SearchEvidence = {
  title: string;
  url: string;
  snippet: string;
  engine?: string;
};

type SearxResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  engine?: unknown;
};

type SearxPayload = { results?: SearxResult[] };

function safeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function searchResearchSources(query: string, limit = 8): Promise<SearchEvidence[]> {
  const configured = process.env.SEARXNG_BASE_URL?.trim();
  if (!configured) throw new Error('RESEARCH_PROVIDER_NOT_CONFIGURED');

  const endpoint = new URL('/search', configured.endsWith('/') ? configured : `${configured}/`);
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('safesearch', '1');
  endpoint.searchParams.set('language', 'tr-TR');

  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json', 'User-Agent': 'Magazala/0.1 Product Intelligence' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`RESEARCH_PROVIDER_HTTP_${response.status}`);

  const payload = await response.json() as SearxPayload;
  const seen = new Set<string>();
  const results: SearchEvidence[] = [];
  for (const item of payload.results ?? []) {
    if (typeof item.url !== 'string' || typeof item.title !== 'string') continue;
    const url = safeHttpUrl(item.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    results.push({
      title: item.title.trim().slice(0, 300) || url,
      url,
      snippet: typeof item.content === 'string' ? item.content.trim().slice(0, 1800) : '',
      engine: typeof item.engine === 'string' ? item.engine : undefined,
    });
    if (results.length >= Math.max(1, Math.min(limit, 12))) break;
  }
  return results;
}
