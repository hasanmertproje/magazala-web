/**
 * Build public URLs from a deployment-controlled origin.
 * Never trust client-supplied Forwarded / X-Forwarded-* headers.
 */
export function publicRequestUrl(path: string, request: Request): URL {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    const origin = new URL(configured);
    const localHttp = (origin.hostname === 'localhost' || origin.hostname === '127.0.0.1') && origin.protocol === 'http:';
    if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:' && !localHttp) {
      throw new Error('PUBLIC_ORIGIN_HTTPS_REQUIRED');
    }
    return new URL(path, origin);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_URL_REQUIRED');
  }
  return new URL(path, request.url);
}

export function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new Error('CROSS_SITE_REQUEST_REJECTED');

  const origin = request.headers.get('origin');
  if (!origin) return;
  const expected = publicRequestUrl('/', request).origin;
  let supplied: string;
  try {
    supplied = new URL(origin).origin;
  } catch {
    throw new Error('ORIGIN_INVALID');
  }
  if (supplied !== expected) throw new Error('ORIGIN_MISMATCH');
}

export function isHtmlForm(request: Request): boolean {
  return (request.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded');
}
