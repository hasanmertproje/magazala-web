import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { assertFeatureEnabled, reserveFeatureUse, releaseFeatureUse, type FeatureReservation } from '../../../../lib/entitlements';
import { assertSameOrigin } from '../../../../lib/request-security';

const modeSchema = z.enum(['FEATURE_IDEA','WORKFLOW','CHANGE_REQUEST','PROBLEM','EXPLORE']);
const createSchema = z.object({ mode: modeSchema, title: z.string().trim().max(120).optional() });

export async function GET() {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ ok:false, code:auth.code }, { status:auth.status });
  try {
    await assertFeatureEnabled(auth.context.workspace.id, auth.context.user.isSuperAdmin, 'tasarlayalim_ai.discovery');
    const conversations=await db.discoveryConversation.findMany({where:{workspaceId:auth.context.workspace.id,userId:auth.context.user.id},orderBy:{updatedAt:'desc'},take:30,select:{id:true,title:true,mode:true,status:true,confirmationState:true,startedAt:true,updatedAt:true}});
    return NextResponse.json({ok:true,conversations});
  } catch(error) {
    const code=error instanceof Error?error.message:'DISCOVERY_LIST_FAILED';
    return NextResponse.json({ok:false,code},{status:code==='FEATURE_DISABLED'?403:400});
  }
}

export async function POST(request:Request){
  const auth=await requireUserApi();if(!auth.ok)return NextResponse.json({ok:false,code:auth.code},{status:auth.status});let reservation:FeatureReservation|null=null;
  try{
    assertSameOrigin(request);const input=createSchema.parse(await request.json());reservation=await reserveFeatureUse(auth.context.workspace.id,auth.context.user.isSuperAdmin,'tasarlayalim_ai.discovery');
    const conversation=await db.discoveryConversation.create({data:{workspaceId:auth.context.workspace.id,userId:auth.context.user.id,mode:input.mode,title:input.title||null,status:'DRAFT',confirmationState:'UNCONFIRMED'}});
    await db.auditLog.create({data:{workspaceId:auth.context.workspace.id,actorUserId:auth.context.user.id,action:'discovery.conversation.create',entityType:'DiscoveryConversation',entityId:conversation.id}});
    return NextResponse.json({ok:true,conversation},{status:201});
  }catch(error){await releaseFeatureUse(reservation);const code=error instanceof Error?error.message:'DISCOVERY_CREATE_FAILED';return NextResponse.json({ok:false,code},{status:['FEATURE_DISABLED','QUOTA_EXHAUSTED'].includes(code)?409:400});}
}
