import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

function validEncryptionKey(value: string | undefined) {
  if (!value) return false;
  try {
    return Buffer.from(value, 'base64').byteLength === 32;
  } catch {
    return false;
  }
}

function configState() {
  const checks = {
    databaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    appUrl: Boolean(process.env.APP_URL?.trim()),
    sessionSecret: (process.env.SESSION_SECRET?.trim().length ?? 0) >= 32,
    credentialEncryptionKey: validEncryptionKey(process.env.CREDENTIAL_ENCRYPTION_KEY),
    objectStorage: ['S3_ENDPOINT','S3_BUCKET','S3_ACCESS_KEY','S3_SECRET_KEY'].every((name) => Boolean(process.env[name]?.trim())),
  };
  return { checks, ok: Object.values(checks).every(Boolean) };
}

export async function GET() {
  const config = configState();
  let database = false;
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  const ok = config.ok && database;
  return NextResponse.json(
    {
      ok,
      status: ok ? 'ready' : 'not_ready',
      checks: { ...config.checks, database },
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
