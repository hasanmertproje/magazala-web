import { decryptCredential, encryptCredential, importCredentialKey, maskCredential, type EncryptedSecret } from '@magazala/core';

async function credentialKey() {
  const encoded = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!encoded) throw new Error('CREDENTIAL_ENCRYPTION_KEY_NOT_CONFIGURED');
  return importCredentialKey(encoded);
}

export async function protectProviderSecret(secret: string) {
  const key = await credentialKey();
  const payload = await encryptCredential(secret, key);
  return { encryptedValue: JSON.stringify(payload), maskedHint: maskCredential(secret) };
}

export async function revealProviderSecret(encryptedValue: string) {
  const key = await credentialKey();
  let payload: EncryptedSecret;
  try { payload = JSON.parse(encryptedValue) as EncryptedSecret; } catch { throw new Error('INVALID_ENCRYPTED_CREDENTIAL'); }
  return decryptCredential(payload, key);
}
