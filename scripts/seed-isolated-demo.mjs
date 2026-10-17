/**
 * Idempotent demo fixtures. NEVER point this at the customer database.
 * Database guard requires an explicit isolated environment AND zero non-demo tenants/users.
 */
import { readFile } from 'node:fs/promises';
import { hash } from 'bcryptjs';
import ts from 'typescript';
import { PrismaClient } from '@prisma/client';

const slug = 'entegrepilot-demo';
const demoEmail = process.env.DEMO_EMAIL?.trim().toLowerCase();
const secret = process.env.DEMO_PASSWORD ?? '';
const environment = process.env.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase();

if (process.env.DEMO_ISOLATED_DATABASE !== 'isolated-demo-only'
    || environment === 'production'
    || process.env.APP_URL?.includes('entegrepilot.tasarlayalim.com')
    || !demoEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(demoEmail)
    || secret.length < 20 || !process.env.DATABASE_URL) {
  throw new Error('DEMO_SEED_REQUIRES_SEPARATE_DATABASE_AND_PRIVATE_CREDENTIALS');
}
const db = new PrismaClient();
try {
  // Reference the actual feature catalog: never hand-maintain a competing entitlement matrix.
  const featureSource = await readFile(new URL('../apps/web/lib/feature-catalog.ts', import.meta.url), 'utf8');
  const featureModule = ts.transpileModule(featureSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { CORE_FEATURE_CATALOG } = await import('data:text/javascript;base64,' + Buffer.from(featureModule).toString('base64'));
  const passwordHash = await hash(secret, 12);

  const result = await db.$transaction(async (tx) => {
    const [otherTenants, otherUsers] = await Promise.all([
      tx.workspace.count({ where: { slug: { not: slug } } }),
      tx.user.count({ where: { email: { not: demoEmail } } }),
    ]);
    if (otherTenants || otherUsers) throw new Error('DEMO_SEED_REFUSES_NON_DEMO_DATABASE');

    const existing = await tx.user.findUnique({ where: { email: demoEmail }, select: { isSuperAdmin: true } });
    if (existing?.isSuperAdmin) throw new Error('DEMO_USER_MUST_NEVER_BE_SUPERADMIN');

    const user = await tx.user.upsert({
      where: { email: demoEmail },
      create: { email: demoEmail, passwordHash, displayName: 'EntegrePilot Demo', isSuperAdmin: false },
      update: { passwordHash, isSuperAdmin: false },
    });
    const plan = await tx.package.upsert({
      where: { slug: 'kurumsal-demo' },
      create: { slug: 'kurumsal-demo', name: 'Kurumsal · Demo', active: true, currency: 'TRY', priceMinor: null },
      update: { priceMinor: null, active: true },
    });

    for (const item of CORE_FEATURE_CATALOG) {
      const feature = await tx.feature.upsert({
        where: { key: item.key },
        create: { key: item.key, label: item.label, module: item.module, status: item.status,
          description: 'description' in item ? item.description : null },
        update: {},
      });
      // PREVIEW features remain disabled, even on a premium demo.
      const enabled = item.status !== 'PREVIEW';
      const limit = item.key === 'ai.design.generate' ? 500
        : item.key.startsWith('product_intelligence.') ? 150 : null;
      await tx.packageFeature.upsert({
        where: { packageId_featureId: { packageId: plan.id, featureId: feature.id } },
        create: { packageId: plan.id, featureId: feature.id, enabled, limit: enabled ? limit : null },
        update: { enabled, limit: enabled ? limit : null },
      });
    }

    const workspace = await tx.workspace.upsert({
      where: { slug },
      create: { slug, name: 'EntegrePilot · Deneme Çalışma Alanı', packageId: plan.id },
      update: { packageId: plan.id },
    });
    await tx.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      create: { workspaceId: workspace.id, userId: user.id, role: 'ADMIN' },
      update: { role: 'ADMIN' },
    });

    const storefronts = [
      ['Trendyol · Örnek mağaza', 'trendyol'],
      ['Hepsiburada · Örnek mağaza', 'hepsiburada'],
      ['Pazar yeri · Simülasyon', 'demo'],
    ];
    for (const [name, provider] of storefronts) {
      const existingConnector = await tx.storeConnector.findFirst({
        where: { workspaceId: workspace.id, name }, select: { id: true },
      });
      if (!existingConnector) await tx.storeConnector.create({
        data: { workspaceId: workspace.id, name, provider, mode: 'MOCK',
          enabled: false, encryptedConfig: null, lastValidatedAt: null, lastSyncAt: null },
      });
    }

    const warehouseSpecs = [
      ['DEMO-MERKEZ', 'Merkez Depo · Demo'],
      ['DEMO-EK', 'Yedek Depo · Demo'],
    ];
    const warehouses = [];
    for (const [code, name] of warehouseSpecs) {
      warehouses.push(await tx.warehouse.upsert({
        where: { workspaceId_code: { workspaceId: workspace.id, code } },
        create: { workspaceId: workspace.id, code, name },
        update: {},
      }));
    }

    const productSpecs = [
      ['Atlas Kablosuz Masa Lambası', 1590, 45], ['Kavis Cam Sürahi', 675, 8],
      ['Modüler Masa Düzenleyici', 920, 3], ['Taş Seramik Kupa', 365, 0],
      ['Keten Masa Örtüsü', 1190, 42], ['Manyetik Kitap Ayracı', 185, 1],
      ['Ayarlanabilir Tablet Standı', 890, 17], ['Dokulu Defter', 320, 6],
      ['Alüminyum Kalemlik', 460, 36], ['Mini Saksı Seti', 790, 2],
    ];
    for (let i = 0; i < productSpecs.length; i++) {
      const [name, price, stock] = productSpecs[i];
      const internalSku = 'DEMO-' + String(i + 1).padStart(4, '0');
      const product = await tx.product.upsert({
        where: { workspaceId_internalSku: { workspaceId: workspace.id, internalSku } },
        create: { workspaceId: workspace.id, name, internalSku, currency: 'TRY', price,
          status: 'ACTIVE', metadata: { demo: true, simulated: true } },
        update: {},
      });
      for (let j = 0; j < warehouses.length; j++) {
        const warehouse = warehouses[j];
        const quantity = j === 0 ? Number(stock) : Math.floor(Number(stock) / 3);
        await tx.stockBalance.upsert({
          where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
          create: { workspaceId: workspace.id, warehouseId: warehouse.id, productId: product.id, quantity },
          update: {},
        });
        const idempotencyKey = 'seed-' + internalSku + '-' + warehouse.code;
        await tx.stockMovement.upsert({
          where: { workspaceId_idempotencyKey: { workspaceId: workspace.id, idempotencyKey } },
          create: { workspaceId: workspace.id, warehouseId: warehouse.id, productId: product.id,
            quantityDelta: quantity, quantityAfter: quantity,
            reason: 'Demo başlangıç stoğu', idempotencyKey, actorUserId: user.id },
          update: {},
        });
      }
    }

    const statuses = ['NEW', 'NEW', 'CONFIRMED', 'PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    const now = Date.now();
    for (let i = 0; i < 42; i++) {
      const orderNumber = 'DEMO-SIP-' + String(i + 1).padStart(5, '0');
      const status = statuses[i % statuses.length];
      const createdAt = new Date(now - (i % 21) * 86400000 - (i % 7) * 3600000);
      const order = await tx.commerceOrder.upsert({
        where: { workspaceId_orderNumber: { workspaceId: workspace.id, orderNumber } },
        create: { workspaceId: workspace.id, orderNumber, source: 'DEMO', status,
          currency: i % 9 === 0 ? 'EUR' : 'TRY', totalMinor: 5900 + i * 1475,
          customerReference: 'DEMO-ALICI-' + String(i + 1), notes: 'Tamamen örnek sipariş; gerçek satış değildir.',
          createdAt },
        update: {},
      });
      const hasEvent = await tx.commerceOrderEvent.findFirst({
        where: { orderId: order.id }, select: { id: true },
      });
      if (!hasEvent) await tx.commerceOrderEvent.create({
        data: { orderId: order.id, actorUserId: user.id, toStatus: status,
          reason: 'Demo örnek sipariş kaydı', createdAt },
      });
    }

    const notices = [
      ['Düşük stok kayıtları', 'Bazı demo ürünleri için stok takibi gerekiyor.'],
      ['Sipariş işlemleri', 'Demo siparişlerini durumlarına göre inceleyebilirsiniz.'],
      ['Mağaza simülasyonu', 'Örnek mağazalar harici pazaryerlerine bağlanmaz.'],
    ];
    for (const [title, body] of notices) {
      const found = await tx.notification.findFirst({ where: { userId: user.id, type: 'demo', title } });
      if (!found) await tx.notification.create({ data: { userId: user.id, type: 'demo', title, body } });
    }

    return { workspaceId: workspace.id, plan: plan.slug };
  }, { isolationLevel: 'Serializable', timeout: 120000 });

  console.log('Isolated demo seed verified:', result.plan, result.workspaceId);
} finally {
  await db.$disconnect();
}
