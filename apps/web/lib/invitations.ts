import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;

export function createInvitationToken() {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isStructurallyValidInvitationToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return false;
  try {
    return Buffer.from(token, 'base64url').byteLength === TOKEN_BYTES;
  } catch {
    return false;
  }
}

export function invitationTokenHashMatches(token: string, storedHash: string) {
  if (!isStructurallyValidInvitationToken(token) || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  const actual = Buffer.from(hashInvitationToken(token), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}
