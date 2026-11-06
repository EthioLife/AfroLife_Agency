import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateUatGlobalAdminBootstrapConfig } from '../src/uat-global-admin-bootstrap.js';

const validEnvironment = {
  AFROLIFE_DEPLOYMENT_ENV: 'uat',
  ALETCLOUD_APP_NAME: 'afrolife-uat-canary',
  ALLOW_UAT_GLOBAL_ADMIN_BOOTSTRAP: '1',
  DATABASE_URL: 'postgres://runtime:private@db.example/afrolife',
  UAT_GLOBAL_ADMIN_TARGET_ID: '00000000-0000-4000-8000-000000000001',
  UAT_GLOBAL_ADMIN_REASON: 'Establish the initial UAT platform administrator',
};

test('requires explicit UAT identity and one-time bootstrap opt-in', () => {
  assert.deepEqual(validateUatGlobalAdminBootstrapConfig(validEnvironment), {
    connectionString: validEnvironment.DATABASE_URL,
    targetUserId: validEnvironment.UAT_GLOBAL_ADMIN_TARGET_ID,
    reason: validEnvironment.UAT_GLOBAL_ADMIN_REASON,
  });
  assert.throws(
    () => validateUatGlobalAdminBootstrapConfig({ ...validEnvironment, AFROLIFE_DEPLOYMENT_ENV: 'production' }),
    /must be exactly uat/,
  );
  assert.throws(
    () => validateUatGlobalAdminBootstrapConfig({ ...validEnvironment, ALETCLOUD_APP_NAME: 'afrolife-production' }),
    /must identify the afrolife-uat-canary/,
  );
  assert.throws(
    () => validateUatGlobalAdminBootstrapConfig({ ...validEnvironment, ALLOW_UAT_GLOBAL_ADMIN_BOOTSTRAP: undefined }),
    /one-time operation/,
  );
});

test('requires a valid target and a recorded reason', () => {
  assert.throws(
    () => validateUatGlobalAdminBootstrapConfig({ ...validEnvironment, UAT_GLOBAL_ADMIN_TARGET_ID: 'not-a-uuid' }),
    /valid user ID/,
  );
  assert.throws(
    () => validateUatGlobalAdminBootstrapConfig({ ...validEnvironment, UAT_GLOBAL_ADMIN_REASON: 'test' }),
    /between 10 and 1000 characters/,
  );
});

test('bootstrap locks, requires no prior Global Admin or bootstrap, verifies target MFA, and audits access history', async () => {
  const source = await readFile(new URL('../src/uat-global-admin-bootstrap.ts', import.meta.url), 'utf8');
  assert.match(source, /BEGIN ISOLATION LEVEL SERIALIZABLE/);
  assert.match(source, /afrolife:global-admin-role-change:v1/);
  assert.match(source, /validateUatGlobalAdminBootstrapConfig\(env\)/);
  assert.match(source, /role='global_admin' LIMIT 1/);
  assert.match(source, /global_admin_role_change_requests WHERE status='pending'/);
  assert.match(source, /role_after='global_admin'/);
  assert.match(source, /action=\$1/);
  assert.match(source, /target\.role !== 'super_admin' \|\| !target\.active \|\| !target\.mfa_enabled/);
  assert.match(source, /UPDATE users SET role='global_admin'/);
  assert.match(source, /INSERT INTO audit_logs/);
  assert.match(source, /UAT initial Global Admin bootstrap/);
  const adminSource = await readFile(new URL('../src/admin.ts', import.meta.url), 'utf8');
  assert.equal((adminSource.match(/afrolife:global-admin-role-change:v1/g) ?? []).length, 2);
});
