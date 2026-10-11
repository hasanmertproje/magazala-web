import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { reserveFeatureUse, releaseFeatureUse, type FeatureReservation } from '../../../../lib/entitlements';
import { assertSameOrigin } from '../../../../lib/request-security';
import { detectImageDimensions, detectImageMime, storeReferenceImage } from '../../../../lib/object-storage';

const MAX_REFERENCE_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ ok:false, code:auth.code }, { status:auth.status });
  let reservation: FeatureReservation | null = null;
  try {
    assertSameOrigin(request);
    reservation = await reserveFeatureUse(auth.context.workspace.id, auth.context.user.isSuperAdmin, 'ai.design.reference');
    const form = await request.formData();
    const file = form.get('file');
    const projectIdRaw = form.get('projectId');
    const projectId = typeof projectIdRaw === 'string' && projectIdRaw.trim() ? projectIdRaw.trim() : null;
    if (!(file instanceof File)) throw new Error('REFERENCE_FILE_REQUIRED');
    if (file.size <= 0 || file.size > MAX_REFERENCE_BYTES) throw new Error('REFERENCE_FILE_SIZE_INVALID');
    if (projectId && !await db.project.findFirst({ where:{ id:projectId, workspaceId:auth.context.workspace.id }, select:{ id:true } })) throw new Error('PROJECT_NOT_FOUND');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = detectImageMime(bytes, file.type || undefined);
    const dimensions = detectImageDimensions(bytes, mimeType);
    const referenceId = randomUUID();
    const stored = await storeReferenceImage({ workspaceId:auth.context.workspace.id, referenceId, bytes, mimeType });
    const asset = await db.asset.create({ data:{
      workspaceId:auth.context.workspace.id,
      projectId,
      createdById:auth.context.user.id,
      kind:'REFERENCE_IMAGE',
      storageKey:stored.storageKey,
      originalName:file.name.slice(0,240),
      mimeType,
      sizeBytes:BigInt(stored.sizeBytes),
      checksum:stored.checksum,
      width:dimensions?.width ?? null,
      height:dimensions?.height ?? null,
      metadata:{ source:'user-upload' },
    } });
    await db.auditLog.create({ data:{ workspaceId:auth.context.workspace.id, actorUserId:auth.context.user.id, action:'asset.reference.upload', entityType:'Asset', entityId:asset.id, metadata:{ mimeType, sizeBytes:stored.sizeBytes } } });
    return NextResponse.json({ ok:true, asset:{ id:asset.id, originalName:asset.originalName, mimeType, width:asset.width, height:asset.height, contentUrl:`/api/assets/${asset.id}/content` } }, { status:201 });
  } catch(error) {
    await releaseFeatureUse(reservation);
    const code=error instanceof Error?error.message:'REFERENCE_UPLOAD_FAILED';
    const status=['FEATURE_DISABLED','QUOTA_EXHAUSTED','OBJECT_STORAGE_NOT_CONFIGURED'].includes(code)?409:code==='PROJECT_NOT_FOUND'?404:400;
    return NextResponse.json({ok:false,code},{status});
  }
}
