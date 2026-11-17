// RFC 6238 time-based one-time passwords (Google Authenticator compatible).
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function b32encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function b32decode(s: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('Invalid base32');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; value &= (1 << bits) - 1; }
  }
  return Buffer.from(out);
}

export const newSecret = () => b32encode(randomBytes(20));

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const o = h[19] & 15;
  const code = (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 10 ** digits;
  return String(code).padStart(digits, '0');
}

export const totp = (secretB32: string, nowMs = Date.now(), digits = 6) => hotp(b32decode(secretB32), Math.floor(nowMs / 30_000), digits);

/** Accepts the current code and one step either side (clock drift). */
export function verifyTotp(secretB32: string, code: string, nowMs = Date.now()): boolean {
  return verifyTotpStep(secretB32, code, nowMs) !== null;
}

/** Returns the matched time step so callers can atomically reject code replay. */
export function verifyTotpStep(secretB32: string, code: string, nowMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = b32decode(secretB32);
  const step = Math.floor(nowMs / 30_000);
  let matchedStep: number | null = null;
  for (const d of [-1, 0, 1]) {
    const candidate = step + d;
    if (candidate < 0) continue;
    const a = Buffer.from(hotp(secret, candidate));
    if (timingSafeEqual(a, Buffer.from(code)) && (matchedStep === null || candidate > matchedStep)) matchedStep = candidate;
  }
  return matchedStep;
}

export const otpauthUri = (secret: string, account: string, issuer = process.env.MFA_ISSUER ?? 'AfroSherik') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
