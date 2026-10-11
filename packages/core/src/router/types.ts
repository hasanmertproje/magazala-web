import type { ProviderCapability, ProviderModel, ProviderRuntimeState } from '../providers/types';

export type QualityProfile = 'FAST' | 'BALANCED' | 'BEST_QUALITY' | 'VECTOR_PREFERRED' | 'PRINT_PREFERRED' | 'MANUAL';

export interface RouteRequest {
  operation: string;
  qualityProfile: QualityProfile;
  requiredCapabilities: readonly ProviderCapability[];
  preferredCapabilities?: readonly ProviderCapability[];
  benchmarkCategory?: string;
  manualModelId?: string;
  requireCommercialUse?: boolean;
}

export interface RouteCandidate {
  model: ProviderModel;
  runtime: ProviderRuntimeState;
}

export interface ScoredCandidate extends RouteCandidate {
  score: number;
  reasons: string[];
}

export interface RouteDecision {
  selected: ScoredCandidate;
  alternatives: ScoredCandidate[];
}
