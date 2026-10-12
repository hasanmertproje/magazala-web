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
  let detected: string | null = null;
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) detected = 'image/png';
  else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) detected = 'image/jpeg';
  else if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') detected = 'image/webp';
  if (!detected) throw new Error('UNSUPPORTED_IMAGE_OUTPUT');
  if (declared && ['image/png','image/jpeg','image/webp'].includes(declared) && declared !== detected) throw new Error('IMAGE_MIME_MISMATCH');
  return detected;
}

function pngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return width > 0 && height > 0 ? { width, height } : null;
}

function jpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    const isSof = [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker);
    if (isSof && length >= 7) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}

export function detectImageDimensions(bytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/png') return pngDimensions(bytes);
  if (mimeType === 'image/jpeg') return jpegDimensions(bytes);
  return null;
}

async function storePrivateImage(input: { workspaceId: string; category: 'generations'|'references'; recordId: string; bytes: Uint8Array; mimeType: string; metadata?: Record<string,string> }) {
  const { client: s3, bucket } = getClient();
  const checksum = createHash('sha256').update(input.bytes).digest('hex');
  const extension = extensionForMime(input.mimeType);
  const storageKey = `workspaces/${input.workspaceId}/${input.category}/${input.recordId}/${checksum}.${extension}`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: input.bytes, ContentType: input.mimeType, Metadata: { checksum, ...input.metadata } }));
  return { storageKey, checksum, sizeBytes: input.bytes.byteLength };
}

export async function storeGeneratedImage(input: { workspaceId: string; generationId: string; bytes: Uint8Array; mimeType: string }) {
  return storePrivateImage({ workspaceId: input.workspaceId, category: 'generations', recordId: input.generationId, bytes: input.bytes, mimeType: input.mimeType, metadata: { generation: input.generationId } });
}

export async function storeReferenceImage(input: { workspaceId: string; referenceId: string; bytes: Uint8Array; mimeType: string }) {
  return storePrivateImage({ workspaceId: input.workspaceId, category: 'references', recordId: input.referenceId, bytes: input.bytes, mimeType: input.mimeType, metadata: { reference: input.referenceId } });
}

export async function readPrivateObject(storageKey: string) {
  const { client: s3, bucket } = getClient();
  const output = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
  if (!output.Body) throw new Error('ASSET_CONTENT_NOT_FOUND');
  const bytes = await output.Body.transformToByteArray();
  return { bytes, contentType: output.ContentType || 'application/octet-stream', contentLength: output.ContentLength };
}
