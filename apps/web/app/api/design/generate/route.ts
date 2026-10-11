import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { reserveFeatureUse, releaseFeatureUse, type FeatureReservation } from '../../../../lib/entitlements';
import { assertSameOrigin } from '../../../../lib/request-security';
import { generateAndStoreImage } from '../../../../lib/image-generation';

const inputSchema = z.object({
  prompt: z.string().trim().min(3).max(4000),
  negativePrompt: z.string().trim().max(2400).optional(),
  width: z.number().int().min(256).max(2048).default(1024),
  height: z.number().int().min(256).max(2048).default(1024),
  seed: z.number().int().min(0).max(2147483647).optional(),
  qualityProfile: z.enum(['FAST','BALANCED','BEST_QUALITY','PRINT_PREFERRED']).default('BALANCED'),
  projectId: z.string().trim().max(120).optional(),
});

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  let reservation: FeatureReservation | null = null;
  try {
    assertSameOrigin(request);
    const input = inputSchema.parse(await request.json());
    reservation = await reserveFeatureUse(auth.context.workspace.id, auth.context.user.isSuperAdmin, 'ai.design.generate');
    const output = await generateAndStoreImage({ workspaceId: auth.context.workspace.id, userId: auth.context.user.id, ...input });
    return NextResponse.json({ ok: true, ...output, contentUrl: `/api/assets/${output.assetId}/content` });
  } catch (error) {
    await releaseFeatureUse(reservation);
    const code = error instanceof Error ? error.message : 'IMAGE_GENERATION_FAILED';
    const status = ['FEATURE_DISABLED','QUOTA_EXHAUSTED','NO_IMAGE_PROVIDER_CONFIGURED','NO_ELIGIBLE_MODEL','OBJECT_STORAGE_NOT_CONFIGURED'].includes(code) ? 409 : code === 'PROJECT_NOT_FOUND' ? 404 : 502;
    return NextResponse.json({ ok: false, code }, { status });
  }
}
