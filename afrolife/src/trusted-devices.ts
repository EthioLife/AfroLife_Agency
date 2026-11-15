import { createHash, randomBytes } from 'node:crypto';

export const TRUSTED_DEVICE_COOKIE = '__Host-afrolife-trusted-device';
export const TRUSTED_DEVICE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function createTrustedDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashTrustedDeviceToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export function readTrustedDeviceToken(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const matches = cookieHeader.split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${TRUSTED_DEVICE_COOKIE}=`));
  if (matches.length !== 1) return undefined;
  const token = matches[0].slice(TRUSTED_DEVICE_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}

export function trustedDeviceCookie(token: string): string {
  return `${TRUSTED_DEVICE_COOKIE}=${token}; Path=/; Max-Age=${TRUSTED_DEVICE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearTrustedDeviceCookie(): string {
  return `${TRUSTED_DEVICE_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict`;
}
