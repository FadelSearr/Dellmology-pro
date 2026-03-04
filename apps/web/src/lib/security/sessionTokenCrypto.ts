import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1';

export function isEncryptedSessionToken(value: string): boolean {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

export function encryptSessionToken(token: string): string {
  const key = getKeyMaterial();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptSessionToken(value: string): string {
  if (!isEncryptedSessionToken(value)) {
    return value;
  }

  const [, version, ivB64, tagB64, encryptedB64] = value.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Invalid encrypted token format');
  }

  const key = getKeyMaterial();
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const encrypted = Buffer.from(encryptedB64, 'base64url');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function computeShortLivedExpiry(providedExpiry: Date | null): Date {
  const closeWib = nextMarketCloseWib();
  if (!providedExpiry || Number.isNaN(providedExpiry.getTime())) {
    return closeWib;
  }
  return providedExpiry.getTime() < closeWib.getTime() ? providedExpiry : closeWib;
}

function nextMarketCloseWib(): Date {
  const now = new Date();
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const nowWibMs = now.getTime() + wibOffsetMs;
  const nowWib = new Date(nowWibMs);

  const y = nowWib.getUTCFullYear();
  const m = nowWib.getUTCMonth();
  const d = nowWib.getUTCDate();

  let closeWib = new Date(Date.UTC(y, m, d, 16, 0, 0));
  if (nowWib > closeWib) {
    closeWib = new Date(Date.UTC(y, m, d + 1, 16, 0, 0));
  }

  return new Date(closeWib.getTime() - wibOffsetMs);
}

function getKeyMaterial(): Buffer {
  const secret =
    process.env.SESSION_TOKEN_AES_KEY ||
    process.env.SESSION_TOKEN_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error('Missing encryption key: set SESSION_TOKEN_AES_KEY (or SESSION_TOKEN_ENCRYPTION_KEY)');
  }

  return createHash('sha256').update(secret).digest();
}
