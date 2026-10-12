import type { DiscoveryAnalysis, RequirementDraft } from './types';

function cleanList(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeRequirementDraft(draft: RequirementDraft): RequirementDraft {
  const title = draft.title.trim();
  const module = draft.module.trim();
  const description = draft.description.trim();
  if (!title) throw new Error('REQUIREMENT_TITLE_REQUIRED');
  if (!module) throw new Error('REQUIREMENT_MODULE_REQUIRED');
  if (!description) throw new Error('REQUIREMENT_DESCRIPTION_REQUIRED');
  return {
    ...draft,
    title,
    module,
    description,
    confirmedRequirements: cleanList(draft.confirmedRequirements),
    acceptanceSuggestions: cleanList(draft.acceptanceSuggestions),
    openQuestions: cleanList(draft.openQuestions),
    risks: cleanList(draft.risks),
    dependencies: cleanList(draft.dependencies),
    outOfScope: cleanList(draft.outOfScope),
  };
}

export function normalizeDiscoveryAnalysis(input: DiscoveryAnalysis): DiscoveryAnalysis {
  return {
    understoodNeed: input.understoodNeed.trim(),
    proposedBehavior: input.proposedBehavior.trim(),
    requirements: input.requirements.map(normalizeRequirementDraft),
    openQuestions: cleanList(input.openQuestions),
    contradictions: cleanList(input.contradictions),
  };
}
