export const TEXT_RUNTIME_PROVIDER_SLUGS = [
  'nvidia-nim',
  'google-gemini',
  'cloudflare-workers-ai',
] as const;

export const IMAGE_RUNTIME_PROVIDER_SLUGS = [
  'huggingface-inference-providers',
  'cloudflare-workers-ai',
] as const;

export const MODEL_DISCOVERY_PROVIDER_SLUGS = [
  'nvidia-nim',
  'google-gemini',
  'cloudflare-workers-ai',
] as const;

const textRuntime = new Set<string>(TEXT_RUNTIME_PROVIDER_SLUGS);
const imageRuntime = new Set<string>(IMAGE_RUNTIME_PROVIDER_SLUGS);
const modelDiscovery = new Set<string>(MODEL_DISCOVERY_PROVIDER_SLUGS);

export function supportsTextRuntime(slug: string) {
  return textRuntime.has(slug);
}

export function supportsImageRuntime(slug: string) {
  return imageRuntime.has(slug);
}

export function supportsModelDiscovery(slug: string) {
  return modelDiscovery.has(slug);
}

export function runtimeSupport(slug: string) {
  return {
    text: supportsTextRuntime(slug),
    image: supportsImageRuntime(slug),
    modelDiscovery: supportsModelDiscovery(slug),
  };
}
