import { NextResponse } from 'next/server';
import { requireUserApi } from '../../../../../../lib/auth';
import { db } from '../../../../../../lib/db';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../../../lib/request-security';
import { isDemoWorkspace } from '../../../../../../lib/demo-mode';
import { decryptTrendyolCredentials, validateTrendyolConnection } from '../../../../../../lib/trendyol-connection';

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await requireUserApi();
  if(!auth.ok)return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
  if(!auth.context.user.isSuperAdmin&&auth.context.membership?.role!=='ADMIN')return NextResponse.json({ok:false,code:'WORKSPACE_ADMIN_REQUIRED'},{status:403});
  if (isDemoWorkspace(auth.context.workspace))
    return NextResponse.json({ ok: false, code: 'DEMO_EXTERNAL_CONNECTOR_DISABLED' }, { status: 403 });
  const form=isHtmlForm(request);
  try {
    assertSameOrigin(request);
    const {id}=await params;
    const connector=await db.storeConnector.findFirst({where:{id,workspaceId:auth.context.workspace.id,provider:'trendyol'},select:{id:true,encryptedConfig:true}});
    if(!connector)return NextResponse.json({ok:false,code:'CONNECTOR_NOT_FOUND'},{status:404});
    if(!connector.encryptedConfig)return NextResponse.json({ok:false,code:'CREDENTIALS_NOT_CONFIGURED'},{status:409});
    const credentials=await decryptTrendyolCredentials(connector.encryptedConfig);
    const result=await validateTrendyolConnection(credentials);
    await db.$transaction(async tx=>{
      await tx.storeConnector.update({where:{id:connector.id},data:{lastErrorCode:result.ok?null:result.code,lastValidatedAt:result.ok?new Date():undefined}});
      await tx.auditLog.create({data:{actorUserId:auth.context.user.id,workspaceId:auth.context.workspace.id,action:'commerce.trendyol.connection.test',entityType:'StoreConnector',entityId:connector.id,metadata:{ok:result.ok,code:result.code}}});
    });
    if(form)return NextResponse.redirect(publicRequestUrl(`/commerce/stores?${result.ok?'notice=verified':`error=${result.code}`}`,request),303);
    return NextResponse.json({ok:result.ok,code:result.code},{status:result.ok?200:502});
  }catch {
    if(form)return NextResponse.redirect(publicRequestUrl('/commerce/stores?error=CONNECTION_TEST_FAILED',request),303);
    return NextResponse.json({ok:false,code:'CONNECTION_TEST_FAILED'},{status:502});
  }
}
