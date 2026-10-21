import { randomUUID } from 'node:crypto';
import { TASARLAYALIM_AI_SYSTEM_PROMPT } from '@magazala/core';
import { db } from './db';
import { assertDemoExternalOperationAllowed } from './demo-mode';
import { revealProviderSecret } from './provider-credentials';
import { supportsTextRuntime } from './provider-runtime';

export type TextChatMessage = { role: 'user' | 'assistant'; content: string };

type ProviderCallResult = {
  text: string;
  inputUnits?: number;
  outputUnits?: number;
};

type TextOperation =
  | 'discovery.chat'
  | 'discovery.analysis'
  | 'product_intelligence.idea'
  | 'product_intelligence.research_synthesis';

type GenerateTextInput = {
  workspaceId: string;
  userId: string;
  operation: TextOperation;
  messages: TextChatMessage[];
  systemPrompt?: string;
  jsonMode?: boolean;
};

type Candidate = Awaited<ReturnType<typeof loadCandidates>>[number];

function operationSettings(operation: TextOperation) {
  if (operation === 'discovery.analysis' || operation === 'product_intelligence.research_synthesis') {
    return { temperature: 0.1, maxTokens: 2600 };
  }
  if (operation === 'product_intelligence.idea') {
    return { temperature: 0.55, maxTokens: 2600 };
  }
  return { temperature: 0.35, maxTokens: 1400 };
}

async function loadCandidates() {
  const models = await db.aIModel.findMany({
    where: {
      enabled: true,
      capabilities: { some: { capability: 'text_generation' } },
      provider: { enabled: true, credentials: { some: { enabled: true } } },
    },
    include: {
      capabilities: true,
      provider: {
        include: {
          credentials: { where: { enabled: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
        },
      },
    },
  });
  return models
    .filter((model) => supportsTextRuntime(model.provider.slug))
    .sort((a, b) =>
      a.provider.priority - b.provider.priority ||
      a.provider.fallbackPriority - b.provider.fallbackPriority ||
      (a.latencyMsP50 ?? Number.MAX_SAFE_INTEGER) - (b.latencyMsP50 ?? Number.MAX_SAFE_INTEGER),
    );
}

async function invokeNvidia(candidate: Candidate, secret: string, input: GenerateTextInput): Promise<ProviderCallResult> {
  const settings = operationSettings(input.operation);
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      model: candidate.externalModelId,
      messages: [
        { role: 'system', content: input.systemPrompt ?? TASARLAYALIM_AI_SYSTEM_PROMPT },
        ...input.messages,
      ],
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: false,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`NVIDIA_HTTP_${response.status}`);
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('NVIDIA_EMPTY_RESPONSE');
  return { text, inputUnits: payload.usage?.prompt_tokens, outputUnits: payload.usage?.completion_tokens };
}

async function invokeGemini(candidate: Candidate, secret: string, input: GenerateTextInput): Promise<ProviderCallResult> {
  const settings = operationSettings(input.operation);
  const model = candidate.externalModelId.replace(/^models\//, '');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': secret, 'Content-Type': 'application/json', Accept: 'application/json', 'x-goog-api-client': 'magazala/0.4.0' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemPrompt ?? TASARLAYALIM_AI_SYSTEM_PROMPT }] },
      contents: input.messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        temperature: settings.temperature,
        maxOutputTokens: settings.maxTokens,
        ...(input.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!text) throw new Error('GEMINI_EMPTY_RESPONSE');
  return { text, inputUnits: payload.usageMetadata?.promptTokenCount, outputUnits: payload.usageMetadata?.candidatesTokenCount };
}

function cloudflareAccountId() {
  const value = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (!value || !/^[a-f0-9]{32}$/i.test(value)) throw new Error('CLOUDFLARE_ACCOUNT_ID_REQUIRED');
  return value;
}

function cloudflareModelId(candidate: Candidate) {
  const value = candidate.externalModelId.trim();
  if (!/^@cf\/[A-Za-z0-9._/-]+$/.test(value)) throw new Error('CLOUDFLARE_MODEL_ID_INVALID');
  return value;
}

async function invokeCloudflare(candidate: Candidate, secret: string, input: GenerateTextInput): Promise<ProviderCallResult> {
  const settings = operationSettings(input.operation);
  const accountId = cloudflareAccountId();
  const modelId = cloudflareModelId(candidate);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: input.systemPrompt ?? TASARLAYALIM_AI_SYSTEM_PROMPT },
        ...input.messages,
      ],
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: false,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`CLOUDFLARE_HTTP_${response.status}`);
  const payload = await response.json() as {
    result?: {
      response?: string;
      output_text?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number };
    } | string;
    response?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number };
  };
  const result = payload.result;
  const resultObject = typeof result === 'object' && result !== null ? result : undefined;
  const text = (
    (typeof result === 'string' ? result : undefined) ??
    resultObject?.response ??
    resultObject?.output_text ??
    resultObject?.choices?.[0]?.message?.content ??
    payload.response
  )?.trim();
  if (!text) throw new Error('CLOUDFLARE_EMPTY_RESPONSE');
  const usage = resultObject?.usage ?? payload.usage;
  return {
    text,
    inputUnits: usage?.prompt_tokens ?? usage?.input_tokens,
    outputUnits: usage?.completion_tokens ?? usage?.output_tokens,
  };
}

async function invokeCandidate(candidate: Candidate, secret: string, input: GenerateTextInput) {
  if (candidate.provider.slug === 'nvidia-nim') return invokeNvidia(candidate, secret, input);
  if (candidate.provider.slug === 'google-gemini') return invokeGemini(candidate, secret, input);
  if (candidate.provider.slug === 'cloudflare-workers-ai') return invokeCloudflare(candidate, secret, input);
  throw new Error('PROVIDER_TEXT_ADAPTER_NOT_SUPPORTED');
}

function safeErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return 'AI_PROVIDER_ERROR';
  return error.message.replace(/[^A-Z0-9_\-]/gi, '_').slice(0, 120) || 'AI_PROVIDER_ERROR';
}

export async function generateProviderBackedText(input: GenerateTextInput) {
  // Defense in depth: do not load or decrypt provider credentials for demo workspaces.
  const workspace = await db.workspace.findUnique({ where: { id: input.workspaceId }, select: { slug: true } });
  if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');
  assertDemoExternalOperationAllowed(workspace);
  const candidates = await loadCandidates();
  if (candidates.length === 0) throw new Error('AI_MODEL_NOT_CONFIGURED');

  let attemptedSupportedAdapter = false;
  for (const candidate of candidates) {
    const credential = candidate.provider.credentials[0];
    if (!credential) continue;
    if (!supportsTextRuntime(candidate.provider.slug)) continue;
    attemptedSupportedAdapter = true;

    const requestId = randomUUID();
    const startedAt = new Date();
    const startedMs = Date.now();
    try {
      const secret = await revealProviderSecret(credential.encryptedValue);
      const result = await invokeCandidate(candidate, secret, input);
      const finishedAt = new Date();
      const latencyMs = Date.now() - startedMs;
      await db.$transaction([
        db.usageLedger.create({ data: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          providerId: candidate.providerId,
          modelId: candidate.id,
          operation: input.operation,
          requestId,
          startedAt,
          finishedAt,
          success: true,
          inputUnits: result.inputUnits,
          outputUnits: result.outputUnits,
          latencyMs,
        } }),
        db.providerCredential.update({ where: { id: credential.id }, data: { lastSuccessAt: finishedAt, lastErrorCode: null } }),
      ]);
      return { ...result, providerId: candidate.providerId, modelId: candidate.id, requestId, latencyMs };
    } catch (error) {
      const finishedAt = new Date();
      const code = safeErrorCode(error);
      await db.$transaction([
        db.usageLedger.create({ data: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          providerId: candidate.providerId,
          modelId: candidate.id,
          operation: input.operation,
          requestId,
          startedAt,
          finishedAt,
          success: false,
          latencyMs: Date.now() - startedMs,
        } }),
        db.providerCredential.update({ where: { id: credential.id }, data: { lastErrorAt: finishedAt, lastErrorCode: code } }),
      ]);
    }
  }

  if (!attemptedSupportedAdapter) throw new Error('AI_TEXT_ADAPTER_NOT_CONFIGURED');
  throw new Error('AI_PROVIDER_UNAVAILABLE');
}
