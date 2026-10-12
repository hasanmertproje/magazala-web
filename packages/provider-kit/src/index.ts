export interface ProviderRequestContext {
  requestId: string;
  workspaceId: string;
  userId: string;
}

export interface TextGenerationRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface TextGenerationResult {
  text: string;
  model: string;
  rawUsage?: unknown;
}

export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  references?: Array<{ mimeType: string; bytes: Uint8Array }>;
}

export interface ImageGenerationResult {
  mimeType: string;
  bytes: Uint8Array;
  model: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderAdapter {
  id: string;
  testConnection(signal?: AbortSignal): Promise<{ ok: boolean; detail: string }>;
  generateText?(ctx: ProviderRequestContext, request: TextGenerationRequest, signal?: AbortSignal): Promise<TextGenerationResult>;
  generateImage?(ctx: ProviderRequestContext, request: ImageGenerationRequest, signal?: AbortSignal): Promise<ImageGenerationResult>;
}
