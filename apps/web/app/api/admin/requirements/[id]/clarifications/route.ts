import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../../../lib/auth';
import { db } from '../../../../../../lib/db';
import { safeInternalPath } from '../../../../../../lib/navigation';
import { assertSameOrigin, isHtmlForm } from '../../../../../../lib/request-security';

const schema = z.object({
  content: z.string().trim().min(2).max(4000),
  returnTo: z.string().optional(),
});
const closed = new Set(['RELEASED','REJECTED','MERGED']);

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
    const requirement = await db.requirement.findUnique({
      where: { id },
      include: { conversation: { select: { userId: true } } },
    });
    if (!requirement) throw new Error('REQUIREMENT_NOT_FOUND');
    if (closed.has(requirement.status)) throw new Error('REQUIREMENT_CLOSED');

    const message = await db.$transaction(async (tx) => {
      const created = await tx.requirementClarificationMessage.create({ data: {
        requirementId: requirement.id,
        authorUserId: auth.context.user.id,
        authorRole: 'ADMIN',
        content: input.content,
      } });
      await tx.requirement.update({ where: { id: requirement.id }, data: { status: 'NEEDS_CLARIFICATION' } });
      await tx.notification.create({ data: {
        userId: requirement.conversation.userId,
        type: 'REQUIREMENT_CLARIFICATION_REQUESTED',
        title: 'Özellik talebi için ek bilgi gerekiyor',
        body: `${requirement.title} talebi için admin tarafından ek bilgi istendi.`,
      } });
      await tx.auditLog.create({ data: {
        actorUserId: auth.context.user.id,
        workspaceId: requirement.workspaceId,
        action: 'requirement.clarification.admin',
        entityType: 'Requirement',
        entityId: requirement.id,
        metadata: { messageId: created.id },
      } });
      return created;
    });

    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}notice=clarification-requested`, request.url), 303);
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CLARIFICATION_REQUEST_FAILED';
    if (form) return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: code === 'REQUIREMENT_NOT_FOUND' ? 404 : code === 'REQUIREMENT_CLOSED' ? 409 : 400 });
  }
}
