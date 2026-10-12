import type { ProviderAdapter, ProviderRequestContext, TextGenerationRequest, TextGenerationResult } from './index';

export class OpenAICompatibleTextAdapter implements ProviderAdapter {
  constructor(
    readonly id: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async testConnection(signal?: AbortSignal): Promise<{ ok: boolean; detail: string }> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal,
    });
    return { ok: response.ok, detail: response.ok ? 'Connection successful' : `HTTP ${response.status}` };
  }

  async generateText(_ctx: ProviderRequestContext, request: TextGenerationRequest, signal?: AbortSignal): Promise<TextGenerationResult> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens,
      }),
      signal,
    });
    if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: unknown;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new Error('PROVIDER_EMPTY_RESPONSE');
    return { text, model: payload.model ?? request.model, rawUsage: payload.usage };
  }
}
