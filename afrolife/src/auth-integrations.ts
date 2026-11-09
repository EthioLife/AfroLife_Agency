export interface SmsRecoveryProvider {
  sendRecoveryCode(phone: string, code: string): Promise<void>;
}

export interface FaydaVerificationAdapter {
  verifyIdentity(input: unknown): Promise<unknown>;
}

export interface WebAuthnConfiguration {
  rpID: string;
  origin: string;
  rpName: string;
}

const smsRecoveryProvider: SmsRecoveryProvider | null = null;
const faydaVerificationAdapter: FaydaVerificationAdapter | null = null;

export function getWebAuthnConfiguration(env: NodeJS.ProcessEnv = process.env): WebAuthnConfiguration | null {
  const rpID = env.WEBAUTHN_RP_ID?.trim().toLowerCase();
  const origin = env.WEBAUTHN_ORIGIN?.trim();
  if (!rpID || !origin) return null;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  const localhost = url.hostname === 'localhost' || url.hostname.endsWith('.localhost');
  if ((url.protocol !== 'https:' && !(localhost && url.protocol === 'http:'))
    || url.origin !== origin
    || url.pathname !== '/'
    || url.search
    || url.hash
    || url.username
    || url.password
    || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(rpID)
    || url.hostname !== rpID) {
    return null;
  }

  const rpName = env.WEBAUTHN_RP_NAME?.trim() || 'AfroSherik';
  if (rpName.length > 120 || /[\u0000-\u001f\u007f]/.test(rpName)) return null;
  return { rpID, origin, rpName };
}

export function getWebAuthnStatus(env: NodeJS.ProcessEnv = process.env) {
  const enabled = getWebAuthnConfiguration(env) !== null;
  return {
    enabled,
    status: enabled ? 'available' : 'unavailable',
    message: enabled
      ? 'Your device handles biometric or PIN verification; AfroSherik does not receive biometric data.'
      : 'Passkey registration is unavailable until secure server-side WebAuthn verification is configured. AfroSherik does not collect biometric data.',
  };
}

export function getSmsRecoveryStatus(env: NodeJS.ProcessEnv = process.env) {
  const enabled = env.SMS_RECOVERY_ENABLED === '1' && smsRecoveryProvider !== null;
  return {
    enabled,
    status: enabled ? 'available' : 'unavailable',
    message: 'SMS password recovery is unavailable because delivery is not configured. No code was sent. Contact AfroLife support to recover your account.',
  };
}

export function getFaydaVerificationStatus(env: NodeJS.ProcessEnv = process.env) {
  const requested = env.FAYDA_VERIFICATION_ENABLED === '1';
  const enabled = requested && faydaVerificationAdapter !== null;
  return {
    enabled,
    status: enabled ? 'available' : requested ? 'unavailable' : 'disabled',
    message: 'Fayda verification is unavailable until AfroLife receives approved access and configures a verified integration.',
  };
}
