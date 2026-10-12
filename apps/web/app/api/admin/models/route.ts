import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { assertSameOrigin, isHtmlForm } from '../../../../lib/request-security';

const knownCapabilities = [
  'text_generation','reasoning','vision_input','text_to_image','image_to_image','image_edit','inpainting','outpainting','reference_images','native_vector','vectorization','transparent_background','high_resolution','text_rendering','embeddings','reranking','web_search','moderation',
] as const;
const capabilitySchema = z.enum(knownCapabilities);
const schema = z.object({
  providerId: z.string().min(1),
  externalModelId: z.string().trim().min(2).max(200),
  name: z.string().trim().min(2).max(120),
  version: z.string().trim().max(80).optional().or(z.literal('')),
  commercialUseAllowed: z.boolean().nullable(),
  capabilities: z.array(capabilitySchema).min(1),
});

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const models = await db.aIModel.findMany({ include: { provider: true, capabilities: true }, orderBy: { name: 'asc' } });
  return NextResponse.json({ ok: true, models });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  const form = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    let raw: unknown;
    if (form) {
      const data = await request.formData();
      raw = {
        providerId: data.get('providerId'),
        externalModelId: data.get('externalModelId'),
        name: data.get('name'),
        version: data.get('version') ?? '',
        commercialUseAllowed: data.get('commercialUseAllowed') === 'on' ? true : null,
        capabilities: data.getAll('capabilities'),
      };
    } else raw = await request.json();
    const input = schema.parse(raw);
    const provider = await db.provider.findUnique({ where: { id: input.providerId }, select: { id: true } });
    if (!provider) throw new Error('PROVIDER_NOT_FOUND');
    const model = await db.$transaction(async (tx) => {
      const created = await tx.aIModel.create({ data: {
        providerId: input.providerId,
        externalModelId: input.externalModelId,
        name: input.name,
        version: input.version || null,
        commercialUseAllowed: input.commercialUseAllowed,
        enabled: false,
      } });
      await tx.modelCapability.createMany({ data: input.capabilities.map((capability) => ({ modelId: created.id, capability })) });
      await tx.auditLog.create({ data: { actorUserId: auth.context.user.id, action: 'model.create', entityType: 'AIModel', entityId: created.id, metadata: { providerId: input.providerId, capabilities: input.capabilities } } });
      return created;
    });
    if (form) return NextResponse.redirect(new URL('/admin/models?notice=created', request.url), 303);
    return NextResponse.json({ ok: true, model }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'MODEL_CREATE_FAILED';
    if (form) return NextResponse.redirect(new URL(`/admin/models?error=${encodeURIComponent(code)}`, request.url), 303);
    return NextResponse.json({ ok: false, code }, { status: 400 });
  }
}
