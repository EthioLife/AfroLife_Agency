import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateInitialPlatformAdminBootstrapConfig } from '../src/initial-platform-admin-bootstrap.js';

const validEnvironment = {
  AFROLIFE_DEPLOYMENT_ENV: 'development',
  ALETCLOUD_APP_NAME: 'afrolife-development',
  ALLOW_INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP: '1',
  INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP_CONFIRM: 'create-afrosherik-platform-admins',
  INITIAL_AFROSHERIK_TENANT_KEY: 'afrosherik',
  INITIAL_DAWIT_ADMIN_PASSWORD: 'distinct-temporary-secret-one',
  INITIAL_YALEMWORK_ADMIN_PASSWORD: 'distinct-temporary-secret-two',
  INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP_REASON: 'Provision the requested initial AfroSherik administrators.',
};

test('validates the explicitly scoped development AfroSherik bootstrap', () => {
  assert.deepEqual(validateInitialPlatformAdminBootstrapConfig(validEnvironment), {
    tenantKey: 'afrosherik',
    passwords: ['distinct-temporary-secret-one', 'distinct-temporary-secret-two'],
    reason: validEnvironment.INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP_REASON,
  });
});

test('rejects production or unconfirmed bootstrap attempts', () => {
  assert.throws(() => validateInitialPlatformAdminBootstrapConfig({
    ...validEnvironment,
    AFROLIFE_DEPLOYMENT_ENV: 'production',
  }), /exactly development/);
  assert.throws(() => validateInitialPlatformAdminBootstrapConfig({
    ...validEnvironment,
    ALETCLOUD_APP_NAME: 'another-app',
  }), /afrolife-development/);
  assert.throws(() => validateInitialPlatformAdminBootstrapConfig({
    ...validEnvironment,
    INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP_CONFIRM: '',
  }), /explicit one-time/);
});

test('requires separate strong passwords and a valid AfroSherik tenant key', () => {
  assert.throws(() => validateInitialPlatformAdminBootstrapConfig({
    ...validEnvironment,
    INITIAL_YALEMWORK_ADMIN_PASSWORD: validEnvironment.INITIAL_DAWIT_ADMIN_PASSWORD,
  }), /different initial password/);
  assert.throws(() => validateInitialPlatformAdminBootstrapConfig({
    ...validEnvironment,
    INITIAL_DAWIT_ADMIN_PASSWORD: 'short',
  }), /at least 16 characters/);
  assert.throws(() => validateInitialPlatformAdminBootstrapConfig({
    ...validEnvironment,
    INITIAL_AFROSHERIK_TENANT_KEY: 'not a tenant key',
  }), /valid platform tenant key/);
});

test('bootstrap source scopes Super Admin access to the existing AfroSherik tenant and forces secure first sign-in', async () => {
  const source = await readFile(new URL('../src/initial-platform-admin-bootstrap.ts', import.meta.url), 'utf8');
  assert.match(source, /display_name\.trim\(\)\.toLowerCase\(\) !== 'afrosherik'/);
  assert.match(source, /SELECT 1 FROM users WHERE role='global_admin' LIMIT 1/);
  assert.match(source, /'global_admin','verified',true,\$3,true/);
  assert.match(source, /VALUES\(\$1,'super_admin',\$2,false,\$3\)/);
  assert.match(source, /mfa_enrollment_required: true/);
  assert.match(source, /must_change_password: true/);
  assert.match(source, /hash\(password, 12\)/);
  assert.doesNotMatch(source, /password:\s*['"`]/);
});
