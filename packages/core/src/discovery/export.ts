import type { RequirementDraft } from './types';

export interface RequirementExportInput {
  productVersion: string;
  conversationId: string;
  requirementId: string;
  module: string;
  rawConversation: Array<{ role: string; content: string; createdAt: string }>;
  aiAnalysis: string;
  requirement: RequirementDraft;
  featureCatalogSnapshot: string[];
  confirmedAt: string;
}

function bullets(items: readonly string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- Yok';
}

export function renderRequirementMarkdown(input: RequirementExportInput): string {
  return `# Tasarlayalım — Geliştirme Gereksinimi\n\n` +
    `- Product version: ${input.productVersion}\n` +
    `- Conversation: ${input.conversationId}\n` +
    `- Requirement: ${input.requirementId}\n` +
    `- Module: ${input.module}\n` +
    `- Category: ${input.requirement.category}\n` +
    `- User confirmed at: ${input.confirmedAt}\n\n` +
    `## Başlık\n${input.requirement.title}\n\n` +
    `## Açıklama\n${input.requirement.description}\n\n` +
    `## Onaylanan gereksinimler\n${bullets(input.requirement.confirmedRequirements)}\n\n` +
    `## Kabul kriteri önerileri\n${bullets(input.requirement.acceptanceSuggestions)}\n\n` +
    `## Açık sorular\n${bullets(input.requirement.openQuestions)}\n\n` +
    `## Riskler\n${bullets(input.requirement.risks)}\n\n` +
    `## Bağımlılıklar\n${bullets(input.requirement.dependencies)}\n\n` +
    `## Kapsam dışı\n${bullets(input.requirement.outOfScope)}\n\n` +
    `## Mevcut özellik kataloğu anlık görüntüsü\n${bullets(input.featureCatalogSnapshot)}\n\n` +
    `## AI analizi\n${input.aiAnalysis}\n\n` +
    `## Ham görüşme\n${input.rawConversation.map((m) => `**${m.role} — ${m.createdAt}**\n\n${m.content}`).join('\n\n')}\n`;
}

export function renderRequirementJson(input: RequirementExportInput): string {
  return JSON.stringify(input, null, 2);
}
