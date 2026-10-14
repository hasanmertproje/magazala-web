import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { assertFeatureEnabled } from '../../../../../lib/entitlements';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../../lib/request-security';

const schema=z.object({
  warehouseId:z.string().min(1).max(120),
  productId:z.string().min(1).max(120),
  delta:z.preprocess(v=>Number(v),z.number().int().min(-100000).max(100000).refine(v=>v!==0)),
  idempotencyKey:z.string().uuid(),
  reason:z.enum(['INITIAL_STOCK','PURCHASE','RETURN','MANUAL_ADJUSTMENT','CORRECTION']),
});

function knownCode(error:unknown) {
  if(error instanceof z.ZodError)return 'INVALID_STOCK_INPUT';
  if(error instanceof Error&&['PRODUCT_NOT_FOUND','WAREHOUSE_NOT_FOUND','INSUFFICIENT_STOCK','IDEMPOTENCY_KEY_CONFLICT','FEATURE_DISABLED'].includes(error.message))return error.message;
  return 'STOCK_UPDATE_FAILED';
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
    const workspaceId=auth.context.workspace.id;
    const update=async()=>db.$transaction(async tx=>{
      const prior=await tx.stockMovement.findUnique({where:{workspaceId_idempotencyKey:{workspaceId,idempotencyKey:input.idempotencyKey}}});
      if(prior) {
        if(prior.productId!==input.productId||prior.warehouseId!==input.warehouseId||prior.delta!==input.delta||prior.reason!==input.reason)throw new Error('IDEMPOTENCY_KEY_CONFLICT');
        return {id:prior.id,onHand:prior.afterQuantity,idempotent:true};
      }
      const [product,warehouse]=await Promise.all([
        tx.product.findFirst({where:{id:input.productId,workspaceId},select:{id:true}}),
        tx.warehouse.findFirst({where:{id:input.warehouseId,workspaceId,active:true},select:{id:true}}),
      ]);
      if(!product)throw new Error('PRODUCT_NOT_FOUND');
      if(!warehouse)throw new Error('WAREHOUSE_NOT_FOUND');
      const balance=await tx.inventoryBalance.upsert({
        where:{warehouseId_productId:{warehouseId:input.warehouseId,productId:input.productId}},
        create:{workspaceId,warehouseId:input.warehouseId,productId:input.productId,onHand:0,reserved:0},
        update:{},
      });
      if(balance.workspaceId!==workspaceId)throw new Error('WAREHOUSE_NOT_FOUND');
      // Atomic conditional update prevents selling/adjusting below reserved or zero.
      const updated=await tx.$queryRaw<Array<{onHand:number;reserved:number}>>`
        UPDATE "InventoryBalance" SET "onHand"="onHand"+${input.delta}, "updatedAt"=NOW()
        WHERE "id"=${balance.id} AND ("onHand"+${input.delta}) >= "reserved" AND ("onHand"+${input.delta}) >= 0
        RETURNING "onHand", "reserved"
      `;
      if(updated.length!==1)throw new Error('INSUFFICIENT_STOCK');
      const after=updated[0].onHand;
      const movement=await tx.stockMovement.create({data:{
        workspaceId,warehouseId:input.warehouseId,productId:input.productId,
        delta:input.delta,beforeQuantity:after-input.delta,afterQuantity:after,
        reason:input.reason,idempotencyKey:input.idempotencyKey,actorUserId:auth.context.user.id,
      }});
      await tx.auditLog.create({data:{workspaceId,actorUserId:auth.context.user.id,action:'inventory.stock.adjust',entityType:'StockMovement',entityId:movement.id,metadata:{productId:input.productId,warehouseId:input.warehouseId,delta:input.delta,reason:input.reason}}});
      return {id:movement.id,onHand:after,idempotent:false};
    },{isolationLevel:'Serializable',timeout:15000});
    let result:Awaited<ReturnType<typeof update>>|undefined;
    for(let attempt=0;attempt<3;attempt++){
      try{result=await update();break;}
      catch(error){
        const code=typeof error==='object'&&error!==null&&'code' in error?error.code:null;
        if(code==='P2034'&&attempt<2)continue;
        if(code==='P2002'){
          const old=await db.stockMovement.findUnique({where:{workspaceId_idempotencyKey:{workspaceId,idempotencyKey:input.idempotencyKey}}});
          if(old&&old.productId===input.productId&&old.warehouseId===input.warehouseId&&old.delta===input.delta&&old.reason===input.reason){
            result={id:old.id,onHand:old.afterQuantity,idempotent:true};break;
          }
        }
        throw error;
      }
    }
    if(!result)throw new Error('STOCK_UPDATE_FAILED');
    if(form)return NextResponse.redirect(publicRequestUrl('/commerce/inventory?notice=stock-updated',request),303);
    return NextResponse.json({ok:true,movement:result});
  }catch(error){
    const code=knownCode(error);
    if(form)return NextResponse.redirect(publicRequestUrl('/commerce/inventory?error='+code,request),303);
    return NextResponse.json({ok:false,code},{status:code==='INSUFFICIENT_STOCK'||code==='IDEMPOTENCY_KEY_CONFLICT'?409:code==='FEATURE_DISABLED'?403:400});
  }
}
