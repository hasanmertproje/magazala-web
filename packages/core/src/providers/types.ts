export type PricingClassification =
  | 'FREE_ENDPOINT'
  | 'FREE_CREDIT'
  | 'FREE_TIER'
  | 'TRIAL'
  | 'PAID'
  | 'SELF_HOSTED'
  | 'UNKNOWN_NEEDS_REVERIFY';

export type ProviderCapability =
  | 'text_generation'
  | 'reasoning'
  | 'vision_input'
  | 'text_to_image'
  | 'image_to_image'
  | 'image_edit'
  | 'inpainting'
  | 'outpainting'
  | 'reference_images'
  | 'native_vector'
  | 'vectorization'
  | 'transparent_background'
  | 'high_resolution'
  | 'text_rendering'
  | 'embeddings'
  | 'reranking'
  | 'web_search'
  | 'moderation';

export type ProviderHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'auth_error'
  | 'unavailable'
  | 'disabled';

export interface ProviderModel {
  id: string;
  providerId: string;
  name: string;
  version?: string;
  enabled: boolean;
  capabilities: readonly ProviderCapability[];
  benchmark: Partial<Record<string, number>>;
  costScore: number | null;
  latencyMsP50: number | null;
  failureRate: number | null;
  commercialUseAllowed: boolean | null;
}

export interface ProviderRuntimeState {
  providerId: string;
  health: ProviderHealthStatus;
  quotaRemaining: number | null;
  adminPriority: number;
  fallbackPriority: number;
}

export interface ProviderGuide {
  providerId: string;
  pricingClassification: PricingClassification;
  officialWebsite: string;
  docsUrl: string;
  keyAcquisitionUrl: string;
  lastVerifiedAt: string;
  verificationSourceUrl: string;
  verificationNote: string;
  commercialUseNote: string;
}
