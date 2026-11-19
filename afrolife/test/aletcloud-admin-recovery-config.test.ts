import test from 'node:test';
import assert from 'node:assert/strict';
import { getAletCloudAdminRecoveryConfig } from '../src/aletcloud-admin-recovery-config.js';

test('ignores empty recovery environment placeholders', () => {
  assert.equal(getAletCloudAdminRecoveryConfig({
    ALETCLOUD_ADMIN_RECOVERY_ENABLED: '',
    ALETCLOUD_ADMIN_RECOVERY_PHONE: '',
    ALETCLOUD_ADMIN_RECOVERY_NAME: '',
    ALETCLOUD_ADMIN_RECOVERY_PASSWORD: '',
    ALETCLOUD_ADMIN_RECOVERY_CONFIRM: '',
  }), undefined);
});

test('rejects partial recovery configuration', () => {
  assert.throws(
    () => getAletCloudAdminRecoveryConfig({
      ALETCLOUD_ADMIN_RECOVERY_ENABLED: '1',
    }),
    /Valid one-time Super Admin recovery settings are required/,
  );
});

test('normalizes and returns a valid one-time recovery configuration', () => {
  assert.deepEqual(getAletCloudAdminRecoveryConfig({
    ALETCLOUD_ADMIN_RECOVERY_ENABLED: '1',
    ALETCLOUD_ADMIN_RECOVERY_CONFIRM: 'rotate-super-admin',
    ALETCLOUD_ADMIN_RECOVERY_PHONE: '0911 234 567',
    ALETCLOUD_ADMIN_RECOVERY_NAME: '  Recovery Admin  ',
    ALETCLOUD_ADMIN_RECOVERY_PASSWORD: 'a-secure-password',
  }), {
    phone: '+251911234567',
    name: 'Recovery Admin',
    password: 'a-secure-password',
  });
});
