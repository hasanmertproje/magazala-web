import { createHash, timingSafeEqual } from 'node:crypto';
import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { assertSameOrigin } from '../../../../lib/request-security';

export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  email: z.union([z.literal(''), z.string().trim().email().max(254).transform(v => v.toLowerCase())]).optional(),
  password: z.string().min(12).max(128),
  token: z.string().min(32).max(256),
});

function authorized(token: string): boolean {
  const configured = process.env.ADMIN_RECOVERY_TOKEN;
  const expiry = Date.parse(process.env.ADMIN_RECOVERY_EXPIRES_AT ?? '');
  if (!configured || configured.length < 32 || !Number.isFinite(expiry) || Date.now() >= expiry) return false;
  const a = createHash('sha256').update(token).digest();
  const b = createHash('sha256').update(configured).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success || !authorized(parsed.data.token)) {
      return NextResponse.json({ ok: false, code: 'RECOVERY_NOT_AUTHORIZED' }, { status: 403 });
    }
    const { email, password, token } = parsed.data;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const passwordHash = await hash(password, 12);
    await db.$transaction(async tx => {
      // Lock makes simultaneous requests with the same token serialize.
      await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(738118093)) AS lock_result`;
      const alreadyUsed = await tx.auditLog.findFirst({
        where: { action: 'platform.admin.recovery', entityType: 'RecoveryToken', entityId: tokenHash },
        select: { id: true },
      });
      if (alreadyUsed) throw new Error('RECOVERY_TOKEN_USED');
      const admins = await tx.user.findMany({ where: { isSuperAdmin: true, ...(email ? { email } : {}) }, select: { id: true }, take: 2 });
      if (admins.length !== 1) throw new Error('RECOVERY_NOT_AUTHORIZED');
      const admin = admins[0];
      await tx.user.update({ where: { id: admin.id }, data: { passwordHash, sessionRevokedAt: new Date() } });
      await tx.auditLog.create({
        data: { actorUserId: admin.id, action: 'platform.admin.recovery', entityType: 'RecoveryToken',
          entityId: tokenHash, metadata: { recoveredUserId: admin.id, method: 'operator_authorized' } },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error && error.message === 'RECOVERY_TOKEN_USED' ? 'RECOVERY_TOKEN_USED' : 'RECOVERY_FAILED';
    return NextResponse.json({ ok: false, code }, { status: code === 'RECOVERY_TOKEN_USED' ? 409 : 400 });
  }
}
