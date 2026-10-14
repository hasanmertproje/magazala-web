import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../lib/request-security';
import { issueSessionToken, SESSION_COOKIE, sessionCookieOptions } from '../../../../lib/session';

const schema = z.object({
  email: z.union([z.literal(''), z.string().email().max(254).transform((value) => value.trim().toLowerCase())]),
  password: z.string().min(1).max(128),
  next: z.string().max(2048).optional(),
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function safeNext(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) return '/';
  return value;
}

export async function POST(request: Request) {
  const formRequest = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const raw = formRequest ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    // Allow password-only login exclusively when exactly one super-admin exists.
    // A correct password is still required; all other users must supply an email.
    const adminCandidates = input.email ? [] : await db.user.findMany({ where: { isSuperAdmin: true }, take: 2 });
    const user = input.email
      ? await db.user.findUnique({ where: { email: input.email } })
      : adminCandidates.length === 1 ? adminCandidates[0] : null;
    const valid = user ? await compare(input.password, user.passwordHash) : false;
    if (!valid || !user) {
      await delay(250);
      if (formRequest) {
        const url = publicRequestUrl('/login', request);
        url.searchParams.set('error', 'INVALID_CREDENTIALS');
        if (safeNext(input.next) !== '/') url.searchParams.set('next', safeNext(input.next));
        return NextResponse.redirect(url, 303);
      }
      return NextResponse.json({ ok: false, code: 'INVALID_CREDENTIALS' }, { status: 401 });
    }

    const response = formRequest
      ? NextResponse.redirect(publicRequestUrl(safeNext(input.next), request), 303)
      : NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, issueSessionToken(user.id), sessionCookieOptions());
    await db.auditLog.create({ data: { actorUserId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id } });
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : 'LOGIN_FAILED';
    if (formRequest) return NextResponse.redirect(publicRequestUrl(`/login?error=${encodeURIComponent(code)}`, request), 303);
    return NextResponse.json({ ok: false, code }, { status: 400 });
  }
}
