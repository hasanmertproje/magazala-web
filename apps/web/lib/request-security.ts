export function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new Error('CROSS_SITE_REQUEST_REJECTED');

  const origin = request.headers.get('origin');
  if (!origin) return;
  const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : new URL(request.url).origin;
  if (new URL(origin).origin !== expected) throw new Error('ORIGIN_MISMATCH');
}

export function isHtmlForm(request: Request): boolean {
  return (request.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded');
}
