export type RequirementCategory =
  | 'BUG'
  | 'FEATURE_REQUEST'
  | 'CHANGE_REQUEST'
  | 'WORKFLOW_REQUIREMENT'
  | 'INTEGRATION'
  | 'UI_UX'
  | 'DATA_REQUIREMENT'
  | 'AUTOMATION'
  | 'QUESTION';

export type RequirementStatus =
  | 'NEW'
  | 'NEEDS_REVIEW'
  | 'NEEDS_CLARIFICATION'
  | 'ACCEPTED'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'BETA'
  | 'RELEASED'
  | 'REJECTED'
  | 'MERGED';

export interface RequirementDraft {
  title: string;
  module: string;
  category: RequirementCategory;
  description: string;
  confirmedRequirements: string[];
  acceptanceSuggestions: string[];
  openQuestions: string[];
  risks: string[];
  dependencies: string[];
  outOfScope: string[];
}

export interface DiscoveryAnalysis {
  understoodNeed: string;
  proposedBehavior: string;
  requirements: RequirementDraft[];
  openQuestions: string[];
  contradictions: string[];
}
