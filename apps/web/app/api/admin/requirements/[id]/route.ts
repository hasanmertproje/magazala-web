import { RequirementStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { safeInternalPath } from '../../../../../lib/navigation';
import { assertSameOrigin, isHtmlForm } from '../../../../../lib/request-security';

const statusValues = Object.values(RequirementStatus) as [RequirementStatus, ...RequirementStatus[]];
const schema = z.object({
  status: z.enum(statusValues),
  adminPriority: z.preprocess((value) => value === '' || value == null ? null : value, z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).nullable()),
  returnTo: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const form = isHtmlForm(request);
  let returnTo = '/admin/requirements';
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const raw = form ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    returnTo = safeInternalPath(input.returnTo, `/admin/requirements/${id}`);

    const existing = await db.requirement.findUnique({
      where: { id },
      include: { conversation: { select: { userId: true } }, workspace: { select: { name: true } } },
    });
    if (!existing) throw new Error('REQUIREMENT_NOT_FOUND');

    const statusChanged = existing.status !== input.status;
    const updated = await db.$transaction(async (tx) => {
      const requirement = await tx.requirement.update({
        where: { id },
        data: { status: input.status, adminPriority: input.adminPriority },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: auth.context.user.id,
          workspaceId: existing.workspaceId,
          action: 'requirement.admin.update',
          entityType: 'Requirement',
          entityId: id,
          metadata: { fromStatus: existing.status, toStatus: input.status, fromPriority: existing.adminPriority, toPriority: input.adminPriority },
        },
      });
      if (statusChanged) {
        await tx.notification.create({
          data: {
            userId: existing.conversation.userId,
            type: 'REQUIREMENT_STATUS_CHANGED',
            title: 'Özellik talebi durumu güncellendi',
            body: `${existing.title} talebinin durumu ${input.status} olarak güncellendi.`,
          },
        });
      }
      return requirement;
    });

    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}notice=requirement-updated`, request.url), 303);
    return NextResponse.json({ ok: true, requirement: updated });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'REQUIREMENT_UPDATE_FAILED';
    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: code === 'REQUIREMENT_NOT_FOUND' ? 404 : 400 });
  }
}
