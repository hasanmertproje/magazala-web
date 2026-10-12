export interface EncryptedSecret {
  version: 1;
  algorithm: 'AES-GCM';
  iv: string;
  ciphertext: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(input: string): Uint8Array {
  const binary = atob(input);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function importCredentialKey(base64Key: string): Promise<CryptoKey> {
  const bytes = base64ToBytes(base64Key);
  if (bytes.byteLength !== 32) throw new Error('CREDENTIAL_KEY_MUST_BE_32_BYTES');
  return crypto.subtle.importKey('raw', copyToArrayBuffer(bytes), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptCredential(plaintext: string, key: CryptoKey): Promise<EncryptedSecret> {
  if (!plaintext) throw new Error('EMPTY_CREDENTIAL');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: copyToArrayBuffer(iv) },
    key,
    copyToArrayBuffer(new TextEncoder().encode(plaintext)),
  );
  return {
    version: 1,
    algorithm: 'AES-GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptCredential(payload: EncryptedSecret, key: CryptoKey): Promise<string> {
  if (payload.version !== 1 || payload.algorithm !== 'AES-GCM') throw new Error('UNSUPPORTED_CREDENTIAL_FORMAT');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: copyToArrayBuffer(base64ToBytes(payload.iv)) },
    key,
    copyToArrayBuffer(base64ToBytes(payload.ciphertext)),
  );
  return new TextDecoder().decode(plaintext);
}

export function maskCredential(secret: string): string {
  if (secret.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(12, secret.length - 4))}${secret.slice(-4)}`;
}
