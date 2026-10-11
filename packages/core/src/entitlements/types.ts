export type FeatureKey =
  | 'ai.design.generate'
  | 'ai.design.reference'
  | 'ai.design.vector'
  | 'ai.design.print'
  | 'ai.design.batch'
  | 'product_intelligence.basic'
  | 'product_intelligence.web_research'
  | 'product_intelligence.competitor'
  | 'commerce.products'
  | 'commerce.import_export'
  | 'commerce.barcode'
  | 'inventory.basic'
  | 'inventory.multiwarehouse'
  | 'stores.trendyol'
  | 'automation.workflows'
  | 'tasarlayalim_ai.discovery';

export interface Entitlement {
  feature: FeatureKey;
  enabled: boolean;
  limit?: number | null;
  validUntil?: Date | null;
}

export interface UsageSnapshot {
  feature: FeatureKey;
  used: number;
}
