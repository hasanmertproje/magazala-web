import { NextResponse } from 'next/server';
import { getAuthContext } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { assertSameOrigin, isHtmlForm } from '../../../../../lib/request-security';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });
  const form = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const updated = await db.notification.updateMany({ where: { id, userId: auth.user.id }, data: { readAt: new Date() } });
    if (!updated.count) throw new Error('NOTIFICATION_NOT_FOUND');
    if (form) return NextResponse.redirect(new URL('/notifications?notice=read', request.url), 303);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'NOTIFICATION_UPDATE_FAILED';
    if (form) return NextResponse.redirect(new URL(`/notifications?error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: code === 'NOTIFICATION_NOT_FOUND' ? 404 : 400 });
  }
}
