import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { assertSameOrigin, isHtmlForm } from '../../../../../lib/request-security';

const schema = z.object({ content: z.string().trim().min(2).max(4000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const form = isHtmlForm(request);
  let conversationId = '';
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const raw = form ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    const requirement = await db.requirement.findFirst({
      where: { id, workspaceId: auth.context.workspace.id, conversation: { is: { userId: auth.context.user.id } } },
      include: { conversation: { select: { id: true } } },
    });
    if (!requirement) throw new Error('REQUIREMENT_NOT_FOUND');
    conversationId = requirement.conversation.id;
    if (requirement.status !== 'NEEDS_CLARIFICATION') throw new Error('CLARIFICATION_NOT_REQUESTED');

    const admins = await db.user.findMany({ where: { isSuperAdmin: true }, select: { id: true } });
    const message = await db.$transaction(async (tx) => {
      const created = await tx.requirementClarificationMessage.create({ data: {
        requirementId: requirement.id,
        authorUserId: auth.context.user.id,
        authorRole: 'USER',
        content: input.content,
      } });
      await tx.requirement.update({ where: { id: requirement.id }, data: { status: 'NEEDS_REVIEW' } });
      if (admins.length) await tx.notification.createMany({ data: admins.map((admin) => ({
        userId: admin.id,
        type: 'REQUIREMENT_CLARIFICATION_ANSWERED',
        title: 'Özellik talebi için ek bilgi geldi',
        body: `${requirement.title} talebi için kullanıcı açıklama gönderdi.`,
      })) });
      await tx.auditLog.create({ data: {
        actorUserId: auth.context.user.id,
        workspaceId: requirement.workspaceId,
        action: 'requirement.clarification.user',
        entityType: 'Requirement',
        entityId: requirement.id,
        metadata: { messageId: created.id },
      } });
      return created;
    });

    if (form) return NextResponse.redirect(new URL(`/help/features?conversation=${encodeURIComponent(conversationId)}&notice=clarification-sent`, request.url), 303);
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CLARIFICATION_REPLY_FAILED';
    if (form && conversationId) return NextResponse.redirect(new URL(`/help/features?conversation=${encodeURIComponent(conversationId)}&error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: code === 'REQUIREMENT_NOT_FOUND' ? 404 : code === 'CLARIFICATION_NOT_REQUESTED' ? 409 : 400 });
  }
}
