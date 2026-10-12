export function publicRequestUrl(path: string, request: Request): URL {
  const configured = process.env.APP_URL?.trim();
  if (configured) return new URL(path, configured);

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedHost) return new URL(path, `${forwardedProto || 'https'}://${forwardedHost}`);

  return new URL(path, request.url);
}

export function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new Error('CROSS_SITE_REQUEST_REJECTED');

  const origin = request.headers.get('origin');
  if (!origin) return;
  const expected = publicRequestUrl('/', request).origin;
  if (new URL(origin).origin !== expected) throw new Error('ORIGIN_MISMATCH');
}

export function isHtmlForm(request: Request): boolean {
  return (request.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded');
}
