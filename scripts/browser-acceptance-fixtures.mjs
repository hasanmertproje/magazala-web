import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

if (process.env.CI !== 'true'
  || !process.env.DATABASE_URL?.includes('@localhost:5432/')) {
  throw new Error('BROWSER_FIXTURES_ALLOWED_ONLY_IN_LOCAL_CI_DATABASE');
}

const db = new PrismaClient();
const email = 'ci-workspace@example.invalid';
try {
  const admin = await db.user.findUnique({ where: { email: 'ci-runtime@example.com' },
    include: { memberships: true } });
  if (!admin?.isSuperAdmin || !admin.memberships.length) {
    throw new Error('CI_SUPERADMIN_SETUP_REQUIRED');
  }
  const workspaceId = admin.memberships[0].workspaceId;
  const user = await db.user.upsert({
    where: { email },
    create: { email, passwordHash: await hash('CiWorkspacePassword123!', 10),
      displayName: 'CI Workspace User', isSuperAdmin: false },
    update: { isSuperAdmin: false },
  });
  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    create: { workspaceId, userId: user.id, role: 'USER' },
    update: { role: 'USER' },
  });
  const isolated = await db.workspace.upsert({
    where: { slug: 'ci-e2e-other-tenant' },
    create: { name: 'CI Other Tenant', slug: 'ci-e2e-other-tenant' },
    update: {},
  });
  await db.commerceOrder.upsert({
    where: { workspaceId_orderNumber: { workspaceId, orderNumber: 'CI-E2E-VISIBLE-ORDER' } },
    create: { workspaceId, orderNumber: 'CI-E2E-VISIBLE-ORDER', totalMinor: 22000, source: 'MANUAL', status: 'NEW' },
    update: {},
  });
  await db.commerceOrder.upsert({
    where: { workspaceId_orderNumber: { workspaceId: isolated.id, orderNumber: 'CI-E2E-HIDDEN-ORDER' } },
    create: { workspaceId: isolated.id, orderNumber: 'CI-E2E-HIDDEN-ORDER', totalMinor: 9999999, source: 'MANUAL', status: 'NEW' },
    update: {},
  });
  // More than one page of historical records; they must remain navigable.
  await db.commerceOrder.createMany({
    data:Array.from({length:55},(_,i)=>({
      workspaceId,orderNumber:'CI-E2E-OLD-'+String(i+1).padStart(3,'0'),
      totalMinor:10000+i,status:'DELIVERED',source:'MANUAL',
      createdAt:new Date(Date.now()-(20+i)*86400000),
    })),
    skipDuplicates:true,
  });
  const warehouse=await db.warehouse.upsert({
    where:{workspaceId_code:{workspaceId,code:'CI-E2E'}},
    create:{workspaceId,code:'CI-E2E',name:'CI E2E Depo'},
    update:{},
  });
  for(const [sku,name,quantity] of [
    ['CI-E2E-LOW','CI E2E Düşük Stok',1],
    ['CI-E2E-OK','CI E2E Sağlıklı Stok',9],
  ]){
    const product=await db.product.upsert({
      where:{workspaceId_internalSku:{workspaceId,internalSku:sku}},
      create:{workspaceId,internalSku:sku,name},
      update:{},
    });
    await db.stockBalance.upsert({
      where:{warehouseId_productId:{warehouseId:warehouse.id,productId:product.id}},
      create:{workspaceId,warehouseId:warehouse.id,productId:product.id,quantity},
      update:{quantity},
    });
  }
  // Exercise product paging beyond the first 50 and avoid synthetic customer data.
  await db.product.createMany({
    data:Array.from({length:505},(_,i)=>({
      workspaceId,internalSku:'CI-E2E-CATALOG-'+String(i+1).padStart(3,'0'),
      name:'CI Katalog Ürünü '+String(i+1).padStart(3,'0'),status:'DRAFT',
    })),
    skipDuplicates:true,
  });
  await db.product.upsert({
    where:{workspaceId_internalSku:{workspaceId:isolated.id,internalSku:'CI-HIDDEN-PRODUCT'}},
    create:{workspaceId:isolated.id,internalSku:'CI-HIDDEN-PRODUCT',name:'CI Gizli Ürün'},
    update:{},
  });
  // Source records are MOCK-only; none can connect or call a live marketplace.
  await db.storeConnector.createMany({
    data:Array.from({length:34},(_,i)=>({
      workspaceId,name:'CI-STORE-MOCK-'+String(i+1).padStart(3,'0'),
      provider:'demo',mode:'MOCK',enabled:false,
    })),
  });
  console.log('CI browser fixtures created (two roles, two isolated tenants, paginated catalog and connectors).');
} finally {
  await db.$disconnect();
}
