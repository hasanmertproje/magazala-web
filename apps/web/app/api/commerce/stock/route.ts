import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { assertFeatureEnabled } from '../../../../lib/entitlements';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../lib/request-security';

const schema=z.object({
  warehouseId:z.string().min(8).max(64),
  productId:z.string().min(8).max(64),
  delta:z.coerce.number().int().min(-1_000_000).max(1_000_000).refine(v=>v!==0),
  reason:z.string().trim().min(3).max(200),
  idempotencyKey:z.string().uuid(),
});

export async function GET(request:Request) {
  const auth=await requireUserApi();
  if(!auth.ok)return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
  try {
    await assertFeatureEnabled(auth.context.workspace.id,auth.context.user.isSuperAdmin,'commerce.products');
    const url=new URL(request.url);
    const warehouseId=url.searchParams.get('warehouseId');
    const rows=await db.stockBalance.findMany({
      where:{workspaceId:auth.context.workspace.id,...(warehouseId?{warehouseId}:{})},
      include:{product:{select:{name:true,internalSku:true}},warehouse:{select:{name:true,code:true}}},
      orderBy:{updatedAt:'desc'},take:200
    });
    return NextResponse.json({ok:true,balances:rows});
  }catch{return NextResponse.json({ok:false,code:'INVENTORY_UNAVAILABLE'},{status:403});}
}

export async function POST(request:Request){
  const auth=await requireUserApi();
  if(!auth.ok)return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
  const form=isHtmlForm(request);
  const fail=(code:string,status:number)=>form?NextResponse.redirect(publicRequestUrl('/commerce/inventory?error='+encodeURIComponent(code),request),303):NextResponse.json({ok:false,code},{status});
  try{
    assertSameOrigin(request);
    if(!auth.context.user.isSuperAdmin && auth.context.membership?.role!=='ADMIN')return fail('ADMIN_REQUIRED',403);
    await assertFeatureEnabled(auth.context.workspace.id,auth.context.user.isSuperAdmin,'commerce.products');
    const input=schema.parse(form?Object.fromEntries(await request.formData()):await request.json());
    const workspaceId=auth.context.workspace.id;
    const outcome=await db.$transaction(async tx=>{
      // Serialize all changes to a product/warehouse pair, including the first insert.
      const lockKey=input.warehouseId+':'+input.productId;
      await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${lockKey},0))) AS lock_result`;
      const previous=await tx.stockMovement.findUnique({where:{workspaceId_idempotencyKey:{workspaceId,idempotencyKey:input.idempotencyKey}}});
      if(previous)return {id:previous.id,quantityAfter:previous.quantityAfter,replayed:true};
      const [warehouse,product]=await Promise.all([
        tx.warehouse.findFirst({where:{id:input.warehouseId,workspaceId},select:{id:true}}),
        tx.product.findFirst({where:{id:input.productId,workspaceId},select:{id:true}}),
      ]);
      if(!warehouse||!product)throw new Error('RESOURCE_NOT_FOUND');
      const existing=await tx.stockBalance.findUnique({where:{warehouseId_productId:{warehouseId:warehouse.id,productId:product.id}}});
      const quantityAfter=(existing?.quantity??0)+input.delta;
      if(quantityAfter<0)throw new Error('INSUFFICIENT_STOCK');
      if(!Number.isSafeInteger(quantityAfter)||quantityAfter>2_000_000_000)throw new Error('STOCK_LIMIT_EXCEEDED');
      await tx.stockBalance.upsert({
        where:{warehouseId_productId:{warehouseId:warehouse.id,productId:product.id}},
        create:{workspaceId,warehouseId:warehouse.id,productId:product.id,quantity:quantityAfter},
        update:{quantity:quantityAfter},
      });
      const movement=await tx.stockMovement.create({data:{workspaceId,warehouseId:warehouse.id,productId:product.id,quantityDelta:input.delta,quantityAfter,reason:input.reason,idempotencyKey:input.idempotencyKey,actorUserId:auth.context.user.id}});
      await tx.auditLog.create({data:{workspaceId,actorUserId:auth.context.user.id,action:'commerce.stock.adjust',entityType:'StockMovement',entityId:movement.id,metadata:{productId:product.id,warehouseId:warehouse.id,delta:input.delta,quantityAfter}}});
      return {id:movement.id,quantityAfter,replayed:false};
    },{isolationLevel:'Serializable',timeout:15000});
    return form?NextResponse.redirect(publicRequestUrl('/commerce/inventory?notice=stock-updated',request),303):NextResponse.json({ok:true,...outcome},{status:outcome.replayed?200:201});
  }catch(e){
    const code=e instanceof z.ZodError?'INVALID_ADJUSTMENT':e instanceof Error && ['RESOURCE_NOT_FOUND','INSUFFICIENT_STOCK','STOCK_LIMIT_EXCEEDED'].includes(e.message)?e.message:'STOCK_ADJUSTMENT_FAILED';
    return fail(code,code==='RESOURCE_NOT_FOUND'?404:code==='INSUFFICIENT_STOCK'?409:400);
  }
}
