import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../lib/request-security';
import { assertFeatureEnabled } from '../../../../lib/entitlements';

const schema = z.object({ name: z.string().trim().min(2).max(100), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,24}$/) });

export async function GET() {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
  const warehouses = await db.warehouse.findMany({where:{workspaceId:auth.context.workspace.id},orderBy:{name:'asc'},select:{id:true,name:true,code:true,_count:{select:{balances:true}}}});
  return NextResponse.json({ok:true,warehouses});
}

export async function POST(request: Request) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
  const form = isHtmlForm(request);
  const returnError = (code:string,status:number) => form ? NextResponse.redirect(publicRequestUrl('/commerce/inventory?error='+encodeURIComponent(code),request),303) : NextResponse.json({ok:false,code},{status});
  try {
    assertSameOrigin(request);
    if (!auth.context.user.isSuperAdmin && auth.context.membership?.role !== 'ADMIN') return returnError('ADMIN_REQUIRED',403);
    await assertFeatureEnabled(auth.context.workspace.id,auth.context.user.isSuperAdmin,'commerce.products');
    const input = schema.parse(form ? Object.fromEntries(await request.formData()) : await request.json());
    const warehouse = await db.$transaction(async tx => {
      const item=await tx.warehouse.create({data:{workspaceId:auth.context.workspace.id,...input}});
      await tx.auditLog.create({data:{workspaceId:auth.context.workspace.id,actorUserId:auth.context.user.id,action:'commerce.warehouse.create',entityType:'Warehouse',entityId:item.id}});
      return item;
    });
    return form ? NextResponse.redirect(publicRequestUrl('/commerce/inventory?notice=warehouse-created',request),303) : NextResponse.json({ok:true,warehouse},{status:201});
  } catch (error) {
    const code = error instanceof z.ZodError ? 'INVALID_WAREHOUSE' : typeof error==='object' && error!==null && 'code' in error && error.code==='P2002' ? 'WAREHOUSE_CODE_EXISTS' : 'WAREHOUSE_CREATE_FAILED';
    return returnError(code,code==='WAREHOUSE_CODE_EXISTS'?409:400);
  }
}
