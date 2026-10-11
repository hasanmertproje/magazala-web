import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminApi } from '../../../../../../lib/auth';
import { db } from '../../../../../../lib/db';
import { assertSameOrigin, isHtmlForm } from '../../../../../../lib/request-security';

const schema=z.object({
  featureId:z.string().min(1),
  enabled:z.preprocess((v)=>v==='on'||v==='true'||v===true,z.boolean()),
  limit:z.preprocess((v)=>v===''||v==null?null:Number(v),z.number().int().min(0).nullable()),
});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await requireSuperAdminApi(); if(!auth.ok)return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
  const form=isHtmlForm(request);
  try{
    assertSameOrigin(request); const {id}=await params; const raw=form?Object.fromEntries(await request.formData()):await request.json(); const input=schema.parse(raw);
    if(!await db.package.findUnique({where:{id},select:{id:true}}))throw new Error('PACKAGE_NOT_FOUND');
    if(!await db.feature.findUnique({where:{id:input.featureId},select:{id:true}}))throw new Error('FEATURE_NOT_FOUND');
    const item=await db.packageFeature.upsert({where:{packageId_featureId:{packageId:id,featureId:input.featureId}},create:{packageId:id,featureId:input.featureId,enabled:input.enabled,limit:input.limit},update:{enabled:input.enabled,limit:input.limit}});
    await db.auditLog.create({data:{actorUserId:auth.context.user.id,action:'package.feature.upsert',entityType:'Package',entityId:id,metadata:{featureId:input.featureId,enabled:input.enabled,limit:input.limit}}});
    if(form)return NextResponse.redirect(new URL('/admin/packages?notice=feature-updated',request.url),303); return NextResponse.json({ok:true,item});
  }catch(error){const code=error instanceof Error?error.message:'PACKAGE_FEATURE_UPDATE_FAILED';if(form)return NextResponse.redirect(new URL(`/admin/packages?error=${encodeURIComponent(code)}`,request.url),303);return NextResponse.json({ok:false,code},{status:400});}
}
