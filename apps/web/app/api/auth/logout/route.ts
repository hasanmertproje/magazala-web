import { NextResponse } from 'next/server';
import { assertSameOrigin } from '../../../../lib/request-security';
import { ACTIVE_WORKSPACE_COOKIE, SESSION_COOKIE } from '../../../../lib/session';

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ ok: false, code: 'INVALID_ORIGIN' }, { status: 403 }); }
  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  const clearCookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 0 };
  response.cookies.set(SESSION_COOKIE, '', clearCookie);
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, '', clearCookie);
  return response;
}
