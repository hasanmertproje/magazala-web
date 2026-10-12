export type ResearchMode = 'IDEA' | 'RESEARCH';
export type EvidenceKind = 'DIRECT' | 'ESTIMATE' | 'INFERRED';

export interface ResearchSource {
  url: string;
  title: string;
  retrievedAt: string;
  evidenceKind: EvidenceKind;
  confidence: number;
}

export interface OpportunityEvidence {
  demand: number | null;
  momentum: number | null;
  competition: number | null;
  productionFit: number | null;
  marginEstimate: number | null;
  designPotential: number | null;
  seasonality: number | null;
  ipRisk: number | null;
  evidenceConfidence: number;
}

export interface ProductOpportunity {
  title: string;
  rationale: string;
  evidence: OpportunityEvidence;
  sources: ResearchSource[];
  risks: string[];
}
