import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

/** Key for encrypting 2FA secrets at rest, derived from the server secret. */
export const keyFrom = (secret: string) => createHash('sha256').update(secret + ':mfa').digest();

/**
 * Keys for MFA secrets, newest first (new data is sealed with the first; any can open old data).
 * Set MFA_ENC_KEY (32+ chars) so rotating JWT_SECRET no longer makes every stored 2FA secret unreadable.
 * The JWT-derived key stays as a fallback so existing users keep working until their secrets are re-sealed.
 */
export function mfaKeys(jwtSecret: string, encKey = process.env.MFA_ENC_KEY): Buffer[] {
  const legacy = keyFrom(jwtSecret);
  if (!encKey) return [legacy];
  if (encKey.length < 32) throw new Error('MFA_ENC_KEY must be 32+ characters');
  return [Buffer.from(hkdfSync('sha256', encKey, 'afrolife-mfa', 'mfa-secret-v1', 32)), legacy];
}

export function openAny(sealed: string, keys: Buffer[]): string {
  for (const k of keys) { try { return open(sealed, k); } catch { /* try the next key */ } }
  throw new Error('MFA secret cannot be decrypted with any configured key');
}

export function seal(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function open(sealed: string, key: Buffer): string {
  const [iv, tag, enc] = sealed.split('.').map((x) => Buffer.from(x, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

/** HMAC over "timestamp.body" so a captured request cannot be replayed later. */
export const sign = (body: string | Buffer, ts: string, secret: string) =>
  createHmac('sha256', secret).update(ts + '.').update(body).digest('hex');

export function verifySignature(body: Buffer, ts: string | undefined, sig: string | undefined, secret: string, nowMs = Date.now(), toleranceMs = 300_000): boolean {
  if (!ts || !sig || !/^\d+$/.test(ts) || Math.abs(nowMs - Number(ts)) > toleranceMs) return false;
  const a = Buffer.from(sign(body, ts, secret), 'hex');
  const b = Buffer.from(sig, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function passwordProblem(pw: string, phone: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (/^\d+$/.test(pw)) return 'Add letters; digits alone are too easy to guess.';
  const tail = phone.replace(/\D/g, '').slice(-7);
  if (tail && pw.replace(/\D/g, '').includes(tail)) return 'Do not use your phone number in your password.';
  return null;
}

export function randomPassword(len = 12): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no look-alike characters
  const limit = 256 - (256 % A.length); // reject bytes above this so every character is equally likely
  let out = '';
  while (out.length < len) for (const b of randomBytes(len)) if (b < limit && out.length < len) out += A[b % A.length];
  return out;
}
