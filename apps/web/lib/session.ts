import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'magazala_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

type SessionClaims = {
  v: 1;
  sub: string;
  iat: number;
  exp: number;
};

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET_MUST_BE_AT_LEAST_32_CHARACTERS');
  return secret;
}

function sign(value: string): string {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

export function issueSessionToken(userId: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const claims: SessionClaims = { v: 1, sub: userId, iat, exp: iat + SESSION_TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string, now = Date.now()): SessionClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = sign(payload);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<SessionClaims>;
    const current = Math.floor(now / 1000);
    if (claims.v !== 1 || typeof claims.sub !== 'string' || typeof claims.iat !== 'number' || typeof claims.exp !== 'number') return null;
    if (claims.exp <= current || claims.iat > current + 60) return null;
    return claims as SessionClaims;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
