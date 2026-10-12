import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { assertSameOrigin, isHtmlForm } from '../../../../lib/request-security';
import { issueSessionToken, SESSION_COOKIE, sessionCookieOptions } from '../../../../lib/session';

const schema = z.object({
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  const formRequest = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const raw = formRequest ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const valid = user ? await compare(input.password, user.passwordHash) : false;
    if (!valid || !user) {
      await delay(250);
      if (formRequest) return NextResponse.redirect(new URL('/login?error=INVALID_CREDENTIALS', request.url), 303);
      return NextResponse.json({ ok: false, code: 'INVALID_CREDENTIALS' }, { status: 401 });
    }

    const response = formRequest
      ? NextResponse.redirect(new URL('/', request.url), 303)
      : NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, issueSessionToken(user.id), sessionCookieOptions());
    await db.auditLog.create({ data: { actorUserId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id } });
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : 'LOGIN_FAILED';
    if (formRequest) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: 400 });
  }
}
