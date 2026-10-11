import { VERIFIED_PROVIDER_GUIDES } from '@magazala/core';
import { db } from './db';

const names: Record<string, string> = {
  'nvidia-nim': 'NVIDIA NIM',
  'huggingface-inference-providers': 'Hugging Face Inference Providers',
  'cloudflare-workers-ai': 'Cloudflare Workers AI',
  'google-gemini': 'Google Gemini Developer API',
  'recraft': 'Recraft API',
};

export async function seedVerifiedProviderGuides(actorUserId: string) {
  const operations = VERIFIED_PROVIDER_GUIDES.map((guide) => db.provider.upsert({
    where: { slug: guide.providerId },
    create: {
      name: names[guide.providerId] ?? guide.providerId,
      slug: guide.providerId,
      officialWebsite: guide.officialWebsite,
      docsUrl: guide.docsUrl,
      keyAcquisitionUrl: guide.keyAcquisitionUrl,
      pricingClassification: guide.pricingClassification,
      lastVerifiedAt: new Date(`${guide.lastVerifiedAt}T00:00:00.000Z`),
      verificationSourceUrl: guide.verificationSourceUrl,
      verificationNote: guide.verificationNote,
      commercialUseNote: guide.commercialUseNote,
      enabled: false,
    },
    update: {
      name: names[guide.providerId] ?? guide.providerId,
      officialWebsite: guide.officialWebsite,
      docsUrl: guide.docsUrl,
      keyAcquisitionUrl: guide.keyAcquisitionUrl,
      pricingClassification: guide.pricingClassification,
      lastVerifiedAt: new Date(`${guide.lastVerifiedAt}T00:00:00.000Z`),
      verificationSourceUrl: guide.verificationSourceUrl,
      verificationNote: guide.verificationNote,
      commercialUseNote: guide.commercialUseNote,
    },
  }));
  await db.$transaction(operations);
  await db.auditLog.create({ data: { actorUserId, action: 'provider.guides.seed', entityType: 'Provider', metadata: { count: operations.length } } });
  return operations.length;
}
