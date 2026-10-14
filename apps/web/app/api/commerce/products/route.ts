import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserApi } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
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

export async function GET() {
  const auth = await requireUserApi();
  if (!auth.ok) return NextResponse.json({ok:false, code:auth.code}, {status:auth.status});
  try { await assertFeatureEnabled(auth.context.workspace.id, auth.context.user.isSuperAdmin, 'commerce.products'); }
  catch { return NextResponse.json({ok:false,code:'FEATURE_DISABLED'}, {status:403}); }
  const products = await db.product.findMany({
    where: { workspaceId:auth.context.workspace.id },
    select: { id:true,name:true,internalSku:true,status:true,price:true,currency:true,updatedAt:true },
    orderBy: { updatedAt:'desc' },
    take: 100,
  });
  return NextResponse.json({ok:true,products:products.map(p=>({...p,price:p.price?.toString()??null}))});
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
