import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { assertFeatureEnabled } from '../../../../lib/entitlements';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../lib/request-security';

const schema = z.object({
 orderNumber: z.string().trim().min(3).max(80),
 customerReference: z.string().trim().max(100).optional(),
 totalMinor: z.coerce.number().int().min(0).max(2_000_000_000),
 currency: z.enum(['TRY','EUR','USD']).default('TRY'),
 notes: z.string().trim().max(1000).optional(),
});

export async function GET(request: Request) {
 const auth=await requireUserApi();
 if(!auth.ok) return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
 try {
  await assertFeatureEnabled(auth.context.workspace.id,auth.context.user.isSuperAdmin,'commerce.products');
  const status=new URL(request.url).searchParams.get('status');
  const parsed=z.enum(['NEW','CONFIRMED','PACKING','SHIPPED','DELIVERED','CANCELLED']).safeParse(status);
  const orders=await db.commerceOrder.findMany({where:{workspaceId:auth.context.workspace.id,...(parsed.success?{status:parsed.data}:{})},orderBy:{createdAt:'desc'},take:100,select:{id:true,orderNumber:true,status:true,totalMinor:true,currency:true,source:true,customerReference:true,createdAt:true}});
  return NextResponse.json({ok:true,orders});
 } catch {return NextResponse.json({ok:false,code:'ORDERS_UNAVAILABLE'},{status:403});}
}
export async function POST(request:Request) {
 const auth=await requireUserApi();
 if(!auth.ok)return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
 const form=isHtmlForm(request);
 const fail=(code:string,status:number)=>form?NextResponse.redirect(publicRequestUrl('/commerce/orders?error='+encodeURIComponent(code),request),303):NextResponse.json({ok:false,code},{status});
 try {
  assertSameOrigin(request);
  if(!auth.context.user.isSuperAdmin&&auth.context.membership?.role!=='ADMIN')return fail('ADMIN_REQUIRED',403);
  await assertFeatureEnabled(auth.context.workspace.id,auth.context.user.isSuperAdmin,'commerce.products');
  const input=schema.parse(form?Object.fromEntries(await request.formData()):await request.json());
  const order=await db.$transaction(async tx=>{
   const created=await tx.commerceOrder.create({data:{...input,workspaceId:auth.context.workspace.id,source:'MANUAL'}});
   await tx.commerceOrderEvent.create({data:{orderId:created.id,actorUserId:auth.context.user.id,toStatus:'NEW',reason:'Manual entry'}});
   await tx.auditLog.create({data:{workspaceId:auth.context.workspace.id,actorUserId:auth.context.user.id,action:'commerce.order.create',entityType:'CommerceOrder',entityId:created.id}});
   return created;
  });
  return form?NextResponse.redirect(publicRequestUrl('/commerce/orders?notice=created',request),303):NextResponse.json({ok:true,order:{id:order.id,orderNumber:order.orderNumber}},{status:201});
 }catch(error){
  const code=error instanceof z.ZodError?'INVALID_ORDER':typeof error==='object'&&error!==null&&'code'in error&&error.code==='P2002'?'DUPLICATE_ORDER_NUMBER':'ORDER_CREATE_FAILED';
  return fail(code,code==='DUPLICATE_ORDER_NUMBER'?409:400);
 }
}
