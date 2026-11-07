export interface SmsRecoveryProvider {
  sendRecoveryCode(phone: string, code: string): Promise<void>;
}

export interface FaydaVerificationAdapter {
  verifyIdentity(input: unknown): Promise<unknown>;
}

const smsRecoveryProvider: SmsRecoveryProvider | null = null;
const faydaVerificationAdapter: FaydaVerificationAdapter | null = null;

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
