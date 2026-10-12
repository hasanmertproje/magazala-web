import { NextResponse } from 'next/server';
import { getAuthContext } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { assertSameOrigin, isHtmlForm } from '../../../../lib/request-security';

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });
  const form = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const result = await db.notification.updateMany({ where: { userId: auth.user.id, readAt: null }, data: { readAt: new Date() } });
    if (form) return NextResponse.redirect(new URL('/notifications?notice=all-read', request.url), 303);
    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'NOTIFICATION_UPDATE_FAILED';
    if (form) return NextResponse.redirect(new URL(`/notifications?error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: 400 });
  }
}
