import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../../../lib/auth';
import { db } from '../../../../../../lib/db';
import { assertFeatureEnabled } from '../../../../../../lib/entitlements';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../../../lib/request-security';

const schema=z.object({
 status:z.enum(['CONFIRMED','PACKING','SHIPPED','DELIVERED','CANCELLED']),
 reason:z.string().trim().max(500).optional(),
});
const transitions:Record<string,string[]>={
 NEW:['CONFIRMED','CANCELLED'],CONFIRMED:['PACKING','CANCELLED'],PACKING:['SHIPPED','CANCELLED'],SHIPPED:['DELIVERED'],DELIVERED:[],CANCELLED:[]
};
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireUserApi();
 if(!auth.ok)return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
 const form=isHtmlForm(request);
 const fail=(code:string,status:number)=>form?NextResponse.redirect(publicRequestUrl('/commerce/orders?error='+encodeURIComponent(code),request),303):NextResponse.json({ok:false,code},{status});
 try{
  assertSameOrigin(request);
  if(!auth.context.user.isSuperAdmin&&auth.context.membership?.role!=='ADMIN')return fail('ADMIN_REQUIRED',403);
  await assertFeatureEnabled(auth.context.workspace.id,auth.context.user.isSuperAdmin,'commerce.products');
  const input=schema.parse(form?Object.fromEntries(await request.formData()):await request.json());
  const {id}=await params;
  const workspaceId=auth.context.workspace.id;
  const result=await db.$transaction(async tx=>{
   // Conditional update prevents simultaneous state transitions from overwriting each other.
   const current=await tx.commerceOrder.findFirst({where:{id,workspaceId},select:{status:true,source:true}});
   if(!current)throw new Error('ORDER_NOT_FOUND');
   if(current.source!=='MANUAL')throw new Error('EXTERNAL_ORDER_READ_ONLY');
   if(!transitions[current.status]?.includes(input.status))throw new Error('INVALID_ORDER_TRANSITION');
   const updated=await tx.commerceOrder.updateMany({where:{id,workspaceId,status:current.status},data:{status:input.status}});
   if(updated.count!==1)throw new Error('ORDER_CONFLICT');
   await tx.commerceOrderEvent.create({data:{orderId:id,actorUserId:auth.context.user.id,fromStatus:current.status,toStatus:input.status,reason:input.reason||null}});
   await tx.auditLog.create({data:{workspaceId,actorUserId:auth.context.user.id,action:'commerce.order.status',entityType:'CommerceOrder',entityId:id,metadata:{from:current.status,to:input.status}}});
   return {id,status:input.status};
  },{isolationLevel:'Serializable'});
  return form?NextResponse.redirect(publicRequestUrl('/commerce/orders?notice=updated',request),303):NextResponse.json({ok:true,order:result});
 }catch(e){
  const code=e instanceof z.ZodError?'INVALID_STATUS':e instanceof Error&&['ORDER_NOT_FOUND','EXTERNAL_ORDER_READ_ONLY','INVALID_ORDER_TRANSITION','ORDER_CONFLICT'].includes(e.message)?e.message:'ORDER_UPDATE_FAILED';
  return fail(code,code==='ORDER_NOT_FOUND'?404:code==='ORDER_CONFLICT'||code==='INVALID_ORDER_TRANSITION'?409:400);
 }
}
