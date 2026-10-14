import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { assertFeatureEnabled } from '../../../../../lib/entitlements';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../../lib/request-security';

const schema=z.object({
  name:z.string().trim().min(2).max(120),
  code:z.string().trim().min(2).max(32).transform(v=>v.toUpperCase()).pipe(z.string().regex(/^[A-Z0-9_-]+$/)),
});

export async function GET() {
  const auth=await requireUserApi();
  if(!auth.ok)return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
  try { await assertFeatureEnabled(auth.context.workspace.id,auth.context.user.isSuperAdmin,'inventory.basic'); }
  catch { return NextResponse.json({ok:false,code:'FEATURE_DISABLED'},{status:403}); }
  const warehouses=await db.warehouse.findMany({where:{workspaceId:auth.context.workspace.id},select:{id:true,name:true,code:true,active:true},orderBy:{name:'asc'},take:100});
  return NextResponse.json({ok:true,warehouses});
}

export async function POST(request:Request) {
  const auth=await requireUserApi();
  if(!auth.ok)return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
  if(!auth.context.user.isSuperAdmin&&auth.context.membership?.role!=='ADMIN')return NextResponse.json({ok:false,code:'WORKSPACE_ADMIN_REQUIRED'},{status:403});
  const form=isHtmlForm(request);
  try {
    assertSameOrigin(request);
    await assertFeatureEnabled(auth.context.workspace.id,auth.context.user.isSuperAdmin,'inventory.basic');
    const input=schema.parse(form?Object.fromEntries(await request.formData()):await request.json());
    const created=await db.$transaction(async tx=>{
      const warehouse=await tx.warehouse.create({data:{workspaceId:auth.context.workspace.id,name:input.name,code:input.code},select:{id:true,name:true,code:true}});
      await tx.auditLog.create({data:{workspaceId:auth.context.workspace.id,actorUserId:auth.context.user.id,action:'inventory.warehouse.create',entityType:'Warehouse',entityId:warehouse.id}});
      return warehouse;
    });
    if(form)return NextResponse.redirect(publicRequestUrl('/commerce/inventory?notice=warehouse-created',request),303);
    return NextResponse.json({ok:true,warehouse:created},{status:201});
  }catch(error){
    const code=error instanceof z.ZodError?'INVALID_WAREHOUSE_INPUT':error instanceof Error&&error.message==='FEATURE_DISABLED'?'FEATURE_DISABLED':typeof error==='object'&&error!==null&&'code' in error&&error.code==='P2002'?'WAREHOUSE_CODE_EXISTS':'WAREHOUSE_CREATE_FAILED';
    if(form)return NextResponse.redirect(publicRequestUrl('/commerce/inventory?error='+code,request),303);
    return NextResponse.json({ok:false,code},{status:code==='WAREHOUSE_CODE_EXISTS'?409:code==='FEATURE_DISABLED'?403:400});
  }
}
