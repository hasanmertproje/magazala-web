import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';

let client: S3Client | null = null;

function storageConfig() {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() || 'us-east-1';
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error('OBJECT_STORAGE_NOT_CONFIGURED');
  return { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false' };
}

function getClient() {
  const config = storageConfig();
  if (!client) client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return { client, bucket: config.bucket };
}

function extensionForMime(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

export function detectImageMime(bytes: Uint8Array, declared?: string) {
  const supported = new Set(['image/png','image/jpeg','image/webp']);
  if (declared && supported.has(declared)) return declared;
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'image/webp';
  throw new Error('UNSUPPORTED_IMAGE_OUTPUT');
}

export async function storeGeneratedImage(input: { workspaceId: string; generationId: string; bytes: Uint8Array; mimeType: string }) {
  const { client: s3, bucket } = getClient();
  const checksum = createHash('sha256').update(input.bytes).digest('hex');
  const extension = extensionForMime(input.mimeType);
  const storageKey = `workspaces/${input.workspaceId}/generations/${input.generationId}/${checksum}.${extension}`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: input.bytes, ContentType: input.mimeType, Metadata: { checksum, generation: input.generationId } }));
  return { storageKey, checksum, sizeBytes: input.bytes.byteLength };
}

export async function readPrivateObject(storageKey: string) {
  const { client: s3, bucket } = getClient();
  const output = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
  if (!output.Body) throw new Error('ASSET_CONTENT_NOT_FOUND');
  const bytes = await output.Body.transformToByteArray();
  return { bytes, contentType: output.ContentType || 'application/octet-stream', contentLength: output.ContentLength };
}
