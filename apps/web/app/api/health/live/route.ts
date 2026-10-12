import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function version() {
  const explicit = process.env.APP_VERSION?.trim();
  if (explicit) return explicit;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.RAILWAY_GIT_COMMIT_SHA?.trim() || process.env.GIT_COMMIT_SHA?.trim();
  return sha ? `git:${sha.slice(0, 12)}` : 'unversioned-build';
}

export async function GET() {
  return NextResponse.json(
    { ok: true, status: 'live', version: version(), timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
