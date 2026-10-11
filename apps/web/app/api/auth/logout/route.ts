import { NextResponse } from 'next/server';
import { assertSameOrigin } from '../../../../lib/request-security';
import { SESSION_COOKIE } from '../../../../lib/session';

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ ok: false, code: 'INVALID_ORIGIN' }, { status: 403 }); }
  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
