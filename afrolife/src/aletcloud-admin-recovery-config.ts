import { normalizePhone } from './phone.js';

export interface AletCloudAdminRecoveryConfig {
  phone: string;
  name?: string;
  password: string;
}

export function getAletCloudAdminRecoveryConfig(
  env: NodeJS.ProcessEnv,
): AletCloudAdminRecoveryConfig | undefined {
  const enabled = env.ALETCLOUD_ADMIN_RECOVERY_ENABLED;
  const phoneInput = env.ALETCLOUD_ADMIN_RECOVERY_PHONE?.trim();
  const name = env.ALETCLOUD_ADMIN_RECOVERY_NAME?.trim() || undefined;
  const password = env.ALETCLOUD_ADMIN_RECOVERY_PASSWORD;
  const confirm = env.ALETCLOUD_ADMIN_RECOVERY_CONFIRM;
  const isConfigured = [enabled, phoneInput, name, password, confirm]
    .some((value) => value !== undefined && value.trim().length > 0);

  if (!isConfigured) return undefined;

  const phone = normalizePhone(phoneInput ?? '');
  if (
    enabled !== '1'
    || confirm !== 'rotate-super-admin'
    || !phone
    || (name !== undefined && name.length < 2)
    || !password
    || password.length < 16
    || Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new Error('Valid one-time Super Admin recovery settings are required.');
  }

  return { phone, name, password };
}
