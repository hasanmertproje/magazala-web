export const TEXT_RUNTIME_PROVIDER_SLUGS = [
  'nvidia-nim',
  'google-gemini',
  'cloudflare-workers-ai',
] as const;

export const TEXT_TO_IMAGE_RUNTIME_PROVIDER_SLUGS = [
  'huggingface-inference-providers',
  'cloudflare-workers-ai',
] as const;

export const IMAGE_TO_IMAGE_RUNTIME_PROVIDER_SLUGS = [
  'huggingface-inference-providers',
] as const;

export const MODEL_DISCOVERY_PROVIDER_SLUGS = [
  'nvidia-nim',
  'google-gemini',
  'cloudflare-workers-ai',
] as const;

const textRuntime = new Set<string>(TEXT_RUNTIME_PROVIDER_SLUGS);
const textToImageRuntime = new Set<string>(TEXT_TO_IMAGE_RUNTIME_PROVIDER_SLUGS);
const imageToImageRuntime = new Set<string>(IMAGE_TO_IMAGE_RUNTIME_PROVIDER_SLUGS);
const modelDiscovery = new Set<string>(MODEL_DISCOVERY_PROVIDER_SLUGS);

export function supportsTextRuntime(slug: string) {
  return textRuntime.has(slug);
}

export function supportsTextToImageRuntime(slug: string) {
  return textToImageRuntime.has(slug);
}

export function supportsImageToImageRuntime(slug: string) {
  return imageToImageRuntime.has(slug);
}

// Backward-compatible UI helper: currently means text-to-image generation support.
export function supportsImageRuntime(slug: string) {
  return supportsTextToImageRuntime(slug);
}

export function supportsModelDiscovery(slug: string) {
  return modelDiscovery.has(slug);
}

export function runtimeSupport(slug: string) {
  return {
    text: supportsTextRuntime(slug),
    textToImage: supportsTextToImageRuntime(slug),
    imageToImage: supportsImageToImageRuntime(slug),
    image: supportsTextToImageRuntime(slug) || supportsImageToImageRuntime(slug),
    modelDiscovery: supportsModelDiscovery(slug),
  };
}
