import { createHmac } from 'node:crypto';
import { db } from './db';

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 10;

function bucketKey(identifier: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET_NOT_CONFIGURED');
  return createHmac('sha256', secret)
    .update('login-throttle:v1:' + identifier.trim().toLowerCase())
    .digest('hex');
}

/**
 * Atomic PostgreSQL upsert ensures multiple app replicas share the same limit.
 * This records attempts, not successful credential proofs. Success clears the bucket.
 * Never store plaintext emails, IP addresses, or passwords in the throttle table.
 */
export async function reserveLoginAttempt(identifier: string) {
  const key = bucketKey(identifier);
  const attempts = await db.$queryRaw<Array<{ attempts: number }>>`
    INSERT INTO "LoginAttemptBucket" ("key", "attempts", "windowStart", "updatedAt")
    VALUES (${key}, 1, NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE
        WHEN "LoginAttemptBucket"."windowStart" < NOW() - INTERVAL '15 minutes'
        THEN 1 ELSE "LoginAttemptBucket"."attempts" + 1 END,
      "windowStart" = CASE
        WHEN "LoginAttemptBucket"."windowStart" < NOW() - INTERVAL '15 minutes'
        THEN NOW() ELSE "LoginAttemptBucket"."windowStart" END,
      "updatedAt" = NOW()
    RETURNING "attempts";
  `;
  return { allowed: (attempts[0]?.attempts ?? MAX_ATTEMPTS + 1) <= MAX_ATTEMPTS, retryMinutes: WINDOW_MINUTES };
}

export async function clearLoginAttempts(identifier: string) {
  await db.loginAttemptBucket.deleteMany({ where: { key: bucketKey(identifier) } });
}
