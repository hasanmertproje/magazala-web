import { InferenceClient } from '@huggingface/inference';
import { routeModel, type ProviderHealthStatus, type QualityProfile, type RouteCandidate } from '@magazala/core';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { revealProviderSecret } from './provider-credentials';
import { detectImageDimensions, detectImageMime, readPrivateObject, storeGeneratedImage } from './object-storage';

type ImageInput = {
  workspaceId: string;
  userId: string;
  projectId?: string;
  referenceAssetId?: string;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  seed?: number;
  qualityProfile: QualityProfile;
};

type ReferenceInput = { id:string; mimeType:string; bytes:Uint8Array } | null;
type ImageModelRow = Awaited<ReturnType<typeof loadImageModels>>[number];

type ImageProviderOutput = { bytes: Uint8Array; mimeType: string };

function healthStatus(value?: string): ProviderHealthStatus {
  const normalized=(value??'HEALTHY').toLowerCase();
  if(['healthy','degraded','rate_limited','quota_exhausted','auth_error','unavailable','disabled'].includes(normalized))return normalized as ProviderHealthStatus;
  return 'degraded';
}

async function loadImageModels(requiredCapability: 'text_to_image'|'image_to_image') {
  const supportedSlugs = requiredCapability === 'text_to_image'
    ? ['huggingface-inference-providers', 'cloudflare-workers-ai']
    : ['huggingface-inference-providers'];
  return db.aIModel.findMany({
    where:{enabled:true,capabilities:{some:{capability:requiredCapability}},provider:{slug:{in:supportedSlugs},enabled:true,credentials:{some:{enabled:true}}}},
    include:{capabilities:true,benchmarkRuns:{orderBy:{createdAt:'desc'},take:20},provider:{include:{credentials:{where:{enabled:true},orderBy:{updatedAt:'desc'},take:1},health:{orderBy:{checkedAt:'desc'},take:1}}}},
  });
}

function toRouteCandidate(row:ImageModelRow):RouteCandidate{
  const benchmark:Record<string,number>={}; for(const run of row.benchmarkRuns)if(run.score!=null&&benchmark[run.category]==null)benchmark[run.category]=run.score;
  return {model:{id:row.id,providerId:row.providerId,name:row.name,version:row.version??undefined,enabled:row.enabled,capabilities:row.capabilities.map(item=>item.capability) as RouteCandidate['model']['capabilities'],benchmark,costScore:row.costScore,latencyMsP50:row.latencyMsP50,failureRate:row.failureRate,commercialUseAllowed:row.commercialUseAllowed},runtime:{providerId:row.providerId,health:healthStatus(row.provider.health[0]?.status),quotaRemaining:null,adminPriority:row.provider.priority,fallbackPriority:row.provider.fallbackPriority}};
}
function safeErrorCode(error:unknown){if(!(error instanceof Error))return'IMAGE_PROVIDER_ERROR';return error.message.replace(/[^A-Z0-9_\-]/gi,'_').slice(0,120)||'IMAGE_PROVIDER_ERROR';}

async function invokeHuggingFace(row:ImageModelRow,secret:string,input:ImageInput,reference:ReferenceInput):Promise<ImageProviderOutput>{
  const client=new InferenceClient(secret);
  let blob:Blob;
  if(reference){
    const buffer=reference.bytes.buffer.slice(reference.bytes.byteOffset,reference.bytes.byteOffset+reference.bytes.byteLength) as ArrayBuffer;
    blob=await client.imageToImage({model:row.externalModelId,inputs:new Blob([buffer],{type:reference.mimeType}),parameters:{prompt:input.prompt,...(input.negativePrompt?{negative_prompt:input.negativePrompt}:{})}});
  }else{
    blob=await client.textToImage({model:row.externalModelId,inputs:input.prompt,parameters:{width:input.width,height:input.height,...(input.negativePrompt?{negative_prompt:input.negativePrompt}:{}),...(input.seed!=null?{seed:input.seed}:{})}},{outputType:'blob'});
  }
  const bytes=new Uint8Array(await blob.arrayBuffer()); if(bytes.byteLength===0)throw new Error('IMAGE_PROVIDER_EMPTY_RESPONSE');
  return {bytes,mimeType:detectImageMime(bytes,blob.type||undefined)};
}

function cloudflareAccountId(){
  const value=process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if(!value||!/^[a-f0-9]{32}$/i.test(value))throw new Error('CLOUDFLARE_ACCOUNT_ID_REQUIRED');
  return value;
}

function cloudflareModelId(row:ImageModelRow){
  const value=row.externalModelId.trim();
  if(!/^@cf\/[A-Za-z0-9._/-]+$/.test(value))throw new Error('CLOUDFLARE_MODEL_ID_INVALID');
  return value;
}

function decodeBase64Image(value:string){
  const normalized=value.includes(',')?value.slice(value.indexOf(',')+1):value;
  const buffer=Buffer.from(normalized,'base64');
  if(buffer.byteLength===0)throw new Error('CLOUDFLARE_IMAGE_EMPTY_RESPONSE');
  return new Uint8Array(buffer);
}

async function invokeCloudflareImage(row:ImageModelRow,secret:string,input:ImageInput,reference:ReferenceInput):Promise<ImageProviderOutput>{
  if(reference)throw new Error('CLOUDFLARE_REFERENCE_IMAGE_NOT_SUPPORTED_BY_GENERIC_ADAPTER');
  const accountId=cloudflareAccountId();
  const modelId=cloudflareModelId(row);
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`,{
    method:'POST',
    headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json',Accept:'application/json, image/*'},
    body:JSON.stringify({prompt:input.prompt,...(input.seed!=null?{seed:input.seed}:{})}),
    cache:'no-store',
    signal:AbortSignal.timeout(60_000),
  });
  if(!response.ok)throw new Error(`CLOUDFLARE_HTTP_${response.status}`);
  const contentType=response.headers.get('content-type')??'';
  if(contentType.startsWith('image/')){
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.byteLength===0)throw new Error('CLOUDFLARE_IMAGE_EMPTY_RESPONSE');
    return{bytes,mimeType:detectImageMime(bytes,contentType.split(';')[0])};
  }
  const payload=await response.json() as {result?:{image?:string}|string;image?:string;success?:boolean};
  const base64=(typeof payload.result==='object'&&payload.result!==null?payload.result.image:undefined)??(typeof payload.result==='string'?payload.result:undefined)??payload.image;
  if(!base64)throw new Error('CLOUDFLARE_IMAGE_MISSING');
  const bytes=decodeBase64Image(base64);
  return{bytes,mimeType:detectImageMime(bytes)};
}

async function invokeImageProvider(row:ImageModelRow,secret:string,input:ImageInput,reference:ReferenceInput){
  if(row.provider.slug==='huggingface-inference-providers')return invokeHuggingFace(row,secret,input,reference);
  if(row.provider.slug==='cloudflare-workers-ai')return invokeCloudflareImage(row,secret,input,reference);
  throw new Error('IMAGE_PROVIDER_ADAPTER_NOT_SUPPORTED');
}

export async function generateAndStoreImage(input:ImageInput){
  if(input.projectId&&!await db.project.findFirst({where:{id:input.projectId,workspaceId:input.workspaceId},select:{id:true}}))throw new Error('PROJECT_NOT_FOUND');
  let reference:ReferenceInput=null;
  if(input.referenceAssetId){
    const asset=await db.asset.findFirst({where:{id:input.referenceAssetId,workspaceId:input.workspaceId,kind:'REFERENCE_IMAGE'},select:{id:true,storageKey:true,mimeType:true}});
    if(!asset)throw new Error('REFERENCE_ASSET_NOT_FOUND');
    const object=await readPrivateObject(asset.storageKey); const mimeType=detectImageMime(object.bytes,asset.mimeType); reference={id:asset.id,mimeType,bytes:object.bytes};
  }
  const requiredCapability=reference?'image_to_image':'text_to_image';
  const rows=await loadImageModels(requiredCapability); if(!rows.length)throw new Error(reference?'NO_REFERENCE_IMAGE_MODEL_CONFIGURED':'NO_IMAGE_PROVIDER_CONFIGURED');
  const rowById=new Map(rows.map(row=>[row.id,row]));
  const decision=routeModel({operation:reference?'design.image_to_image':'design.text_to_image',qualityProfile:input.qualityProfile,requiredCapabilities:[requiredCapability],preferredCapabilities:[...(reference?['reference_images' as const]:[]),...(input.qualityProfile==='PRINT_PREFERRED'?['high_resolution' as const]:[])],benchmarkCategory:reference?'reference_adherence':'illustration',requireCommercialUse:true},rows.map(toRouteCandidate));
  const generation=await db.generation.create({data:{workspaceId:input.workspaceId,projectId:input.projectId??null,userId:input.userId,prompt:input.prompt,operation:reference?'image_to_image':'text_to_image',qualityProfile:input.qualityProfile,status:'RUNNING',selectedModelId:decision.selected.model.id,selectedProviderId:decision.selected.model.providerId,routerReason:{score:decision.selected.score,reasons:decision.selected.reasons,referenceAssetId:reference?.id??null,alternatives:decision.alternatives.map(item=>({modelId:item.model.id,score:item.score}))}}});
  const ordered=[decision.selected,...decision.alternatives]; let lastCode='IMAGE_PROVIDER_UNAVAILABLE';
  for(let index=0;index<ordered.length;index+=1){
    const routed=ordered[index]; const row=rowById.get(routed.model.id); if(!row)continue; const credential=row.provider.credentials[0]; if(!credential)continue;
    const attemptNo=index+1; const attempt=await db.generationAttempt.create({data:{generationId:generation.id,providerId:row.providerId,modelId:row.id,attemptNo,startedAt:new Date()}}); const requestId=randomUUID(); const startedAt=new Date(); const startedMs=Date.now();
    try{
      const secret=await revealProviderSecret(credential.encryptedValue); const output=await invokeImageProvider(row,secret,input,reference); const finishedAt=new Date(); const latencyMs=Date.now()-startedMs; const dimensions=detectImageDimensions(output.bytes,output.mimeType); const stored=await storeGeneratedImage({workspaceId:input.workspaceId,generationId:generation.id,bytes:output.bytes,mimeType:output.mimeType});
      const asset=await db.asset.create({data:{workspaceId:input.workspaceId,projectId:input.projectId??null,createdById:input.userId,kind:'GENERATED_IMAGE',storageKey:stored.storageKey,mimeType:output.mimeType,sizeBytes:BigInt(stored.sizeBytes),checksum:stored.checksum,width:dimensions?.width??null,height:dimensions?.height??null,metadata:{generationId:generation.id,providerId:row.providerId,modelId:row.id,referenceAssetId:reference?.id??null,requestedWidth:input.width,requestedHeight:input.height,providerHonorsRequestedDimensions:row.provider.slug==='huggingface-inference-providers'}}});
      await db.$transaction([db.generationAttempt.update({where:{id:attempt.id},data:{finishedAt,success:true,latencyMs}}),db.generation.update({where:{id:generation.id},data:{status:'COMPLETED',completedAt:finishedAt,selectedModelId:row.id,selectedProviderId:row.providerId}}),db.usageLedger.create({data:{workspaceId:input.workspaceId,userId:input.userId,providerId:row.providerId,modelId:row.id,operation:reference?'design.image_to_image':'design.text_to_image',requestId,startedAt,finishedAt,success:true,imagesGenerated:1,latencyMs}}),db.providerCredential.update({where:{id:credential.id},data:{lastSuccessAt:finishedAt,lastErrorCode:null}})]);
      return {generationId:generation.id,assetId:asset.id,mimeType:output.mimeType,providerId:row.providerId,modelId:row.id,width:asset.width,height:asset.height,routerReason:generation.routerReason};
    }catch(error){const finishedAt=new Date();const code=safeErrorCode(error);lastCode=code;await db.$transaction([db.generationAttempt.update({where:{id:attempt.id},data:{finishedAt,success:false,errorCode:code,latencyMs:Date.now()-startedMs}}),db.usageLedger.create({data:{workspaceId:input.workspaceId,userId:input.userId,providerId:row.providerId,modelId:row.id,operation:reference?'design.image_to_image':'design.text_to_image',requestId,startedAt,finishedAt,success:false,latencyMs:Date.now()-startedMs}}),db.providerCredential.update({where:{id:credential.id},data:{lastErrorAt:finishedAt,lastErrorCode:code}})]);}
  }
  await db.generation.update({where:{id:generation.id},data:{status:'FAILED',completedAt:new Date()}}); throw new Error(lastCode);
}
