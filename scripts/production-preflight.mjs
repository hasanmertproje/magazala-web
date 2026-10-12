const failures = [];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) failures.push(`${name} is required`);
  return value ?? '';
}

const databaseUrl = required('DATABASE_URL');
const appUrl = required('APP_URL');
const sessionSecret = required('SESSION_SECRET');
const encryptionKey = required('CREDENTIAL_ENCRYPTION_KEY');
required('S3_ENDPOINT');
required('S3_BUCKET');
required('S3_ACCESS_KEY');
required('S3_SECRET_KEY');

if (sessionSecret && sessionSecret.length < 32) failures.push('SESSION_SECRET must be at least 32 characters');
if (encryptionKey) {
  try {
    if (Buffer.from(encryptionKey, 'base64').byteLength !== 32) failures.push('CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes');
  } catch {
    failures.push('CREDENTIAL_ENCRYPTION_KEY must be valid base64');
  }
}
if (databaseUrl && !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) failures.push('DATABASE_URL must be a PostgreSQL URL');
if (appUrl) {
  try {
    const parsed = new URL(appUrl);
    const allowHttp = process.env.PREFLIGHT_ALLOW_HTTP === 'true' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !allowHttp) failures.push('APP_URL must use HTTPS outside local/test environments');
  } catch {
    failures.push('APP_URL must be a valid absolute URL');
  }
}

const result = {
  ok: failures.length === 0,
  requiredInfrastructure: {
    database: Boolean(databaseUrl),
    applicationUrl: Boolean(appUrl),
    sessionSecret: Boolean(sessionSecret),
    credentialEncryption: Boolean(encryptionKey),
    objectStorage: ['S3_ENDPOINT','S3_BUCKET','S3_ACCESS_KEY','S3_SECRET_KEY'].every((name) => Boolean(process.env[name]?.trim())),
  },
  optionalCapabilities: {
    sourceBackedResearch: Boolean(process.env.SEARXNG_BASE_URL?.trim()),
    cloudflareModelDiscovery: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim()),
  },
  failures,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
