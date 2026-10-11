import { z } from 'zod';

export const requirementCategorySchema = z.enum([
  'BUG',
  'FEATURE_REQUEST',
  'CHANGE_REQUEST',
  'WORKFLOW_REQUIREMENT',
  'INTEGRATION',
  'UI_UX',
  'DATA_REQUIREMENT',
  'AUTOMATION',
  'QUESTION',
]);

export const discoveryRequirementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  module: z.string().trim().min(2).max(100),
  category: requirementCategorySchema,
  userPriority: z.string().trim().max(40).nullable().optional(),
  aiPrioritySuggestion: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().min(8).max(5000),
  confirmedRequirements: z.array(z.string().trim().min(1).max(1000)).max(40),
  acceptanceSuggestions: z.array(z.string().trim().min(1).max(1000)).max(40),
  openQuestions: z.array(z.string().trim().min(1).max(1000)).max(30),
  risks: z.array(z.string().trim().min(1).max(1000)).max(30),
  dependencies: z.array(z.string().trim().min(1).max(1000)).max(30),
  outOfScope: z.array(z.string().trim().min(1).max(1000)).max(30),
});

export const discoveryAnalysisSchema = z.object({
  summary: z.string().trim().min(10).max(6000),
  requirements: z.array(discoveryRequirementSchema).min(1).max(12),
  overallOpenQuestions: z.array(z.string().trim().min(1).max(1000)).max(30).default([]),
});

export type DiscoveryAnalysisPayload = z.infer<typeof discoveryAnalysisSchema>;

export function parseDiscoveryAnalysis(value: unknown): DiscoveryAnalysisPayload {
  return discoveryAnalysisSchema.parse(value);
}

export function parseDiscoveryAnalysisText(text: string): DiscoveryAnalysisPayload {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return parseDiscoveryAnalysis(JSON.parse(cleaned));
}
