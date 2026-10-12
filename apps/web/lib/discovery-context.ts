import { TASARLAYALIM_AI_SYSTEM_PROMPT } from '@magazala/core';
import { db } from './db';

const PRODUCT_STATE = `Magazala mevcut ürün durumu:\n- ACTIVE: AI Design Studio, Product Intelligence, Projects, Assets, Tasarlayalım AI özellik keşfi, Bilgilendirme.\n- BETA: Products, internal SKU/barcode, Import/Export, Automation foundation.\n- PREVIEW: Stores, Trendyol connector boundary, Inventory, Shelves/Warehouse, Orders.\nPreview alanlarını çalışıyormuş gibi sunma; Beta alanlarda davranışların hâlâ geliştirilebileceğini belirt.`;

export async function buildDiscoverySystemPrompt(workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: { package: { include: { features: { include: { feature: true } } } }, overrides: { include: { feature: true } } },
  });
  const packageFeatures = workspace?.package?.features.filter((entry) => entry.enabled).map((entry) => entry.feature.key) ?? [];
  const overrides = workspace?.overrides.map((entry) => `${entry.feature.key}:${entry.enabled ? 'enabled' : 'disabled'}`) ?? [];
  const accessContext = packageFeatures.length || overrides.length
    ? `\nWorkspace erişim bağlamı: ${[...packageFeatures, ...overrides].join(', ')}.`
    : '\nWorkspace için henüz ayrıntılı feature entitlement kataloğu tanımlanmamış; erişim konusunda varsayım yapma.';
  return `${TASARLAYALIM_AI_SYSTEM_PROMPT}\n\n${PRODUCT_STATE}${accessContext}`;
}
