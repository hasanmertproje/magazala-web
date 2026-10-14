import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { assertFeatureEnabled } from '../../../../lib/entitlements';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../lib/request-security';
import { encryptTrendyolCredentials, trendyolCredentialsSchema } from '../../../../lib/trendyol-connection';

const inputSchema = trendyolCredentialsSchema.extend({name:z.string().trim().min(2).max(100)});

export async function POST(request:Request) {
  const auth=await requireUserApi();
  if(!auth.ok)return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
  if(!auth.context.user.isSuperAdmin && auth.context.membership?.role!=='ADMIN')return NextResponse.json({ok:false,code:'WORKSPACE_ADMIN_REQUIRED'},{status:403});
  const form=isHtmlForm(request);
  try {
    assertSameOrigin(request);
    await assertFeatureEnabled(auth.context.workspace.id,auth.context.user.isSuperAdmin,'commerce.stores.dashboard');
    const input=inputSchema.parse(form?Object.fromEntries(await request.formData()):await request.json());
    const encryptedConfig=await encryptTrendyolCredentials(input);
    const result=await db.$transaction(async tx=>{
      const connector=await tx.storeConnector.create({
        data:{workspaceId:auth.context.workspace.id,name:input.name,provider:'trendyol',mode:input.mode,enabled:false,encryptedConfig},
        select:{id:true,name:true,mode:true}
      });
      await tx.auditLog.create({data:{actorUserId:auth.context.user.id,workspaceId:auth.context.workspace.id,action:'commerce.trendyol.configured',entityType:'StoreConnector',entityId:connector.id,metadata:{provider:'trendyol',mode:input.mode}}});
      return connector;
    });
    if(form)return NextResponse.redirect(publicRequestUrl('/commerce/stores?notice=created',request),303);
    return NextResponse.json({ok:true,connector:result},{status:201});
  }catch(error){
    const code=error instanceof z.ZodError?'INVALID_CONNECTION_INPUT':error instanceof Error&&error.message==='FEATURE_DISABLED'?'FEATURE_DISABLED':'CONNECTOR_CREATE_FAILED';
    if(form)return NextResponse.redirect(publicRequestUrl(`/commerce/stores?error=${code}`,request),303);
    return NextResponse.json({ok:false,code},{status:code==='FEATURE_DISABLED'?403:400});
  }
}
