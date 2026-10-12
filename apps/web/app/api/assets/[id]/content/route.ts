import { NextResponse } from 'next/server';
import { requireUserApi } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { readPrivateObject } from '../../../../../lib/object-storage';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  try {
    const { id } = await params;
    const asset = await db.asset.findFirst({ where: { id, workspaceId: auth.context.workspace.id }, select: { storageKey: true, mimeType: true } });
    if (!asset) return NextResponse.json({ ok: false, code: 'ASSET_NOT_FOUND' }, { status: 404 });
    const object = await readPrivateObject(asset.storageKey);
    return new Response(object.bytes as BodyInit, { headers: { 'Content-Type': asset.mimeType || object.contentType, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    return NextResponse.json({ ok: false, code: error instanceof Error ? error.message : 'ASSET_READ_FAILED' }, { status: 500 });
  }
}
