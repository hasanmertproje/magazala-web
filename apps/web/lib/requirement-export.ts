import { renderRequirementJson, renderRequirementMarkdown, type RequirementDraft } from '@magazala/core';
import { db } from './db';

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function productVersion() {
  const explicit = process.env.APP_VERSION?.trim();
  if (explicit) return explicit;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.RAILWAY_GIT_COMMIT_SHA?.trim() || process.env.GIT_COMMIT_SHA?.trim();
  return sha ? `git:${sha.slice(0, 12)}` : 'build-version-not-exposed';
}

export async function buildRequirementExport(requirementId: string) {
  const requirement = await db.requirement.findUnique({
    where: { id: requirementId },
    include: {
      conversation: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
      workspace: { select: { id: true, name: true, slug: true } },
      clarifications: { include: { author: { select: { email: true, displayName: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!requirement) throw new Error('REQUIREMENT_NOT_FOUND');

  const features = await db.feature.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }] });
  const draft: RequirementDraft = {
    title: requirement.title,
    module: requirement.module,
    category: requirement.category,
    description: requirement.description,
    confirmedRequirements: jsonStringArray(requirement.confirmedRequirements),
    acceptanceSuggestions: jsonStringArray(requirement.acceptanceSuggestions),
    openQuestions: jsonStringArray(requirement.openQuestions),
    risks: jsonStringArray(requirement.risks),
    dependencies: jsonStringArray(requirement.dependencies),
    outOfScope: jsonStringArray(requirement.outOfScope),
  };

  const aiAnalysis = requirement.conversation.aiInterpretation
    ? JSON.stringify(requirement.conversation.aiInterpretation, null, 2)
    : 'AI analizi kaydı bulunmuyor.';
  const clarificationThread = requirement.clarifications.map((message) => ({
    role: message.authorRole,
    author: message.author?.displayName ?? message.author?.email ?? (message.authorRole === 'ADMIN' ? 'Admin' : 'Kullanıcı'),
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  }));

  const input = {
    productVersion: productVersion(),
    conversationId: requirement.conversationId,
    requirementId: requirement.id,
    module: requirement.module,
    rawConversation: requirement.conversation.messages.map((message) => ({ role: message.role, content: message.content, createdAt: message.createdAt.toISOString() })),
    aiAnalysis,
    requirement: draft,
    featureCatalogSnapshot: features.map((feature) => `${feature.key} | ${feature.label} | ${feature.module} | ${feature.status}`),
    confirmedAt: requirement.userConfirmedAt?.toISOString() ?? 'not-confirmed',
  };

  const baseMarkdown = renderRequirementMarkdown(input);
  const clarificationMarkdown = clarificationThread.length
    ? `\n\n## Admin ↔ User Clarification Thread\n${clarificationThread.map((message) => `\n### ${message.role} · ${message.author} · ${message.createdAt}\n${message.content}`).join('\n')}`
    : '\n\n## Admin ↔ User Clarification Thread\nNo clarification messages.';
  const baseJson = JSON.parse(renderRequirementJson(input)) as Record<string, unknown>;

  return {
    requirement,
    input: { ...input, clarificationThread },
    markdown: `${baseMarkdown}${clarificationMarkdown}`,
    json: JSON.stringify({ ...baseJson, clarificationThread }, null, 2),
  };
}
