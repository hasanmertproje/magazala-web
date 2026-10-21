import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { clampPage, parsePage } from '../../../../lib/order-filters';
import { parseCommerceSearch, parseProductStatus, productSearchCondition } from '../../../../lib/commerce-search';
import { assertFeatureEnabled } from '../../../../lib/entitlements';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../lib/request-security';

const productSchema = z.object({
  name: z.string().trim().min(2).max(180),
  internalSku: z.string().trim().max(80).optional().or(z.literal('')),
  internalBarcode: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  price: z.union([z.string(), z.number()]).optional().transform(value => value == null || value === '' ? null : Number(value)).refine(value => value === null || Number.isFinite(value) && value >= 0 && value <= 1_000_000_000, 'INVALID_PRICE'),
  currency: z.enum(['TRY', 'USD', 'EUR']).default('TRY'),
});

export async function GET(request: Request) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ok:false, code:auth.code}, {status:auth.status});
  try { await assertFeatureEnabled(auth.context.workspace.id, auth.context.user.isSuperAdmin, 'commerce.products'); }
  catch { return NextResponse.json({ok:false,code:'FEATURE_DISABLED'}, {status:403}); }
  const params = new URL(request.url).searchParams;
  const search = parseCommerceSearch(params.get('q'));
  const rawStatus = params.get('status');
  const status = parseProductStatus(rawStatus);
  if (rawStatus && !status) return NextResponse.json({ok:false,code:'INVALID_PRODUCT_STATUS'}, {status:400});
  const where = {workspaceId:auth.context.workspace.id,...productSearchCondition(search),...(status ? { status } : {})};
  // Maintain the API's existing default 100 records per page for older clients.
  const limit = 100;
  const total = await db.product.count({where});
  const pages = Math.max(1,Math.ceil(total/limit));
  const page = clampPage(parsePage(params.get('page')),total,limit);
  const products = await db.product.findMany({
    where,
    select: { id:true,name:true,internalSku:true,internalBarcode:true,status:true,price:true,currency:true,updatedAt:true },
    orderBy: [{ updatedAt:'desc' },{ id:'desc' }],
    skip: (page-1)*limit, take:limit,
  });
  return NextResponse.json({ok:true,products:products.map(p=>({...p,price:p.price?.toString()??null})),
    pagination:{page,pages,total,limit,hasNext:page<pages}});
}

export async function POST(request: Request) {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ok:false,code:auth.code},{status:auth.status});
  const form = isHtmlForm(request);
  try {
    assertSameOrigin(request);
    await assertFeatureEnabled(auth.context.workspace.id,auth.context.user.isSuperAdmin,'commerce.products');
    const raw=form ? Object.fromEntries(await request.formData()) : await request.json();
    const input=productSchema.parse(raw);
    const product=await db.$transaction(async tx=>{
      const created=await tx.product.create({data:{
        workspaceId:auth.context.workspace.id,name:input.name,
        internalSku:input.internalSku||null,internalBarcode:input.internalBarcode||null,
        description:input.description||null,price:input.price===null?null:String(input.price),currency:input.currency,status:'DRAFT',
      }});
      await tx.auditLog.create({data:{actorUserId:auth.context.user.id,workspaceId:auth.context.workspace.id,action:'commerce.product.create',entityType:'Product',entityId:created.id}});
      return created;
    });
    if(form)return NextResponse.redirect(publicRequestUrl('/commerce/products?notice=created',request),303);
    return NextResponse.json({ok:true,product:{id:product.id,name:product.name}}, {status:201});
  } catch(error) {
    const internalCode = error instanceof Error ? error.message : '';
    const code = internalCode === 'FEATURE_DISABLED' ? 'FEATURE_DISABLED'
      : error instanceof z.ZodError ? 'INVALID_PRODUCT_INPUT'
      : typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002' ? 'DUPLICATE_PRODUCT_IDENTIFIER'
      : 'PRODUCT_CREATE_FAILED';
    if(form)return NextResponse.redirect(publicRequestUrl(`/commerce/products?error=${encodeURIComponent(code)}`,request),303);
    return NextResponse.json({ok:false,code},{status:code==='FEATURE_DISABLED'?403:code==='DUPLICATE_PRODUCT_IDENTIFIER'?409:400});
  }
}
