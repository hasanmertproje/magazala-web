import { NextResponse } from 'next/server';
import { requireSuperAdminApi } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { assertSameOrigin, isHtmlForm, publicRequestUrl } from '../../../../../lib/request-security';

const PLAN_MATRIX = [
  { slug: 'baslangic', name: 'Başlangıç', imageCredits: 20, researchCredits: 0, enabled: ['inventory.basic','commerce.stores.dashboard','commerce.products','commerce.barcode','commerce.import_export','ai.design.generate'] },
  { slug: 'gelisim', name: 'Gelişim', imageCredits: 100, researchCredits: 30, enabled: ['inventory.basic','commerce.stores.dashboard','commerce.products','commerce.barcode','commerce.import_export','ai.design.generate','ai.design.reference','product_intelligence.basic','product_intelligence.web_research','automation.workflows'] },
  { slug: 'kurumsal', name: 'Kurumsal', imageCredits: 500, researchCredits: 150, enabled: ['inventory.basic','commerce.stores.dashboard','commerce.products','commerce.barcode','commerce.import_export','ai.design.generate','ai.design.reference','ai.design.vector','ai.design.print','product_intelligence.basic','product_intelligence.web_research','automation.workflows','tasarlayalim_ai.discovery'] },
] as const;

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status });
  try {
    assertSameOrigin(request);
    const result = await db.$transaction(async tx => {
      const features = await tx.feature.findMany({ select: { id: true, key: true, status: true } });
      if (!features.some(f => f.key === 'ai.design.generate')) throw new Error('FEATURE_CATALOG_MISSING');
      const installed = [];
      for (const plan of PLAN_MATRIX) {
        // Preserve existing price and current workspace assignments.
        const pkg = await tx.package.upsert({
          where: { slug: plan.slug },
          create: { slug: plan.slug, name: plan.name, active: true, currency: 'TRY' },
          update: { name: plan.name },
        });
        for (const feature of features) {
          const permitted = feature.status !== 'PREVIEW' && plan.enabled.some(key => key === feature.key);
          const limit = feature.key === 'ai.design.generate' ? plan.imageCredits
            : feature.key === 'product_intelligence.basic' || feature.key === 'product_intelligence.web_research' ? plan.researchCredits : null;
          await tx.packageFeature.upsert({
            where: { packageId_featureId: { packageId: pkg.id, featureId: feature.id } },
            create: { packageId: pkg.id, featureId: feature.id, enabled: permitted, limit: permitted ? limit : null },
            update: { enabled: permitted, limit: permitted ? limit : null },
          });
        }
        installed.push({ slug: pkg.slug, id: pkg.id });
      }
      await tx.auditLog.create({ data: { actorUserId: auth.context.user.id, action: 'packages.presets.sync', entityType: 'Package', entityId: installed[0].id, metadata: { packages: installed } } });
      return installed;
    }, { isolationLevel: 'Serializable', timeout: 30000 });
    if (isHtmlForm(request)) return NextResponse.redirect(publicRequestUrl('/admin/packages?notice=presets-synced', request), 303);
    return NextResponse.json({ ok: true, packages: result }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PLAN_SYNC_FAILED';
    if (isHtmlForm(request)) return NextResponse.redirect(publicRequestUrl(`/admin/packages?error=${encodeURIComponent(code)}`, request), 303);
    return NextResponse.json({ ok: false, code }, { status: 400 });
  }
}
