import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../../../lib/auth';
import { buildRequirementExport } from '../../../../../../lib/requirement-export';

const querySchema = z.object({ format: z.enum(['md','json','txt']).default('md') });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const { format } = querySchema.parse({ format: url.searchParams.get('format') ?? 'md' });
    const payload = await buildRequirementExport(id);
    const body = format === 'json' ? payload.json : payload.markdown;
    const contentType = format === 'json' ? 'application/json; charset=utf-8' : format === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8';
    const filename = `magazala-requirement-${id}.${format}`;
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'REQUIREMENT_EXPORT_FAILED';
    return NextResponse.json({ ok: false, code }, { status: code === 'REQUIREMENT_NOT_FOUND' ? 404 : 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
