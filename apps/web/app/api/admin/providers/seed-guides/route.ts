import { NextResponse } from 'next/server';
import { requireSuperAdminApi } from '../../../../../lib/auth';
import { assertSameOrigin, isHtmlForm } from '../../../../../lib/request-security';
import { seedVerifiedProviderGuides } from '../../../../../lib/provider-seed';

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const form = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const count = await seedVerifiedProviderGuides(auth.context.user.id);
    if (form) return NextResponse.redirect(new URL(`/admin/providers?notice=seeded&count=${count}`, request.url), 303);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PROVIDER_SEED_FAILED';
    if (form) return NextResponse.redirect(new URL(`/admin/providers?error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: 400 });
  }
}
