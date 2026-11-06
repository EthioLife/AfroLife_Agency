import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { enabledWorkspaceModules, loadRuntimeConfig, privateObjectStorageConfig, sessionIdleTimeoutMinutes, WORKSPACE_MODULES } from '../src/runtime-config.js';

const safeProductionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://afrolife_app:runtime-secret@db.example.net:5432/afrolife?sslmode=verify-full',
  JWT_SECRET: 'j'.repeat(48),
  MFA_ENC_KEY: 'm'.repeat(48),
  REQUIRE_MFA_FOR_STAFF: '1',
  CORS_ORIGINS: 'https://afrolife.internal,https://localhost',
  FILE_STORAGE_DIR: '/var/lib/afrolife/private-files',
  TRUST_PROXY: '1',
  MFI_SERVICE_URL: 'http://127.0.0.1:3300',
  MFI_GATEWAY_SECRET: 'm'.repeat(48),
  INSURANCE_SERVICE_URL: 'http://127.0.0.1:3100',
  INSURANCE_GATEWAY_SECRET: 'i'.repeat(48),
  INSURANCE_SERVICE_CUTOVER_READY: '1',
  WORKER_MANAGEMENT_SERVICE_URL: 'http://127.0.0.1:3400',
  WORKER_MANAGEMENT_GATEWAY_SECRET: 'w'.repeat(48),
  WORKER_MANAGEMENT_SERVICE_CUTOVER_READY: '1',
  STAFFING_SERVICE_URL: 'http://127.0.0.1:3401',
  STAFFING_GATEWAY_SECRET: 's'.repeat(48),
  STAFFING_SERVICE_CUTOVER_READY: '1',
  PROPERTY_MANAGEMENT_SERVICE_URL: 'http://127.0.0.1:3402',
  PROPERTY_MANAGEMENT_GATEWAY_SECRET: 'p'.repeat(48),
  PROPERTY_MANAGEMENT_SERVICE_CUTOVER_READY: '1',
  MARKETPLACE_SERVICE_URL: 'http://127.0.0.1:3403',
  MARKETPLACE_GATEWAY_SECRET: 'a'.repeat(48),
  MARKETPLACE_SERVICE_CUTOVER_READY: '1',
};

test('production configuration disables the MFI pilot unless explicitly enabled', () => {
  const config = loadRuntimeConfig(safeProductionEnvironment);
  assert.equal(config.isProduction, true);
  assert.equal(config.mfiPilotEnabled, false);
  assert.equal(config.legacyImmediateLeasesEnabled, false);
  assert.throws(
    () => loadRuntimeConfig({ ...safeProductionEnvironment, MFI_PILOT_ENABLED: 'yes' }),
    /MFI_PILOT_ENABLED must be 0 or 1/,
  );
  assert.equal(loadRuntimeConfig({ ...safeProductionEnvironment, MFI_PILOT_ENABLED: '0' }).mfiPilotEnabled, false);
  assert.equal(loadRuntimeConfig({ ...safeProductionEnvironment, MFI_PILOT_ENABLED: '1' }).mfiPilotEnabled, true);
});

test('workspace module visibility is an optional validated deployment allowlist', () => {
  assert.deepEqual(enabledWorkspaceModules({}), [...WORKSPACE_MODULES]);
  assert.deepEqual(enabledWorkspaceModules({ AFROLIFE_ENABLED_MODULES: 'leads,rent' }), ['leads', 'rent']);
  assert.deepEqual(
    loadRuntimeConfig({ ...safeProductionEnvironment, AFROLIFE_ENABLED_MODULES: 'leads,rent' }).enabledModules,
    ['leads', 'rent'],
  );
  assert.deepEqual(enabledWorkspaceModules({ AFROLIFE_ENABLED_MODULES: 'global-bi' }), ['global-bi']);
  assert.throws(() => enabledWorkspaceModules({ AFROLIFE_ENABLED_MODULES: 'leads,unknown' }), /unknown module/);
  assert.throws(() => enabledWorkspaceModules({ AFROLIFE_ENABLED_MODULES: 'leads,leads' }), /duplicate modules/);
});

test('Global BI gateway requires an explicitly ready, unique service configuration', () => {
  assert.throws(
    () => loadRuntimeConfig({
      ...safeProductionEnvironment,
      GLOBAL_BI_SERVICE_URL: 'http://127.0.0.1:3310',
    }),
    /GLOBAL_BI_SERVICE_CUTOVER_READY=1/,
  );
  const configured = loadRuntimeConfig({
    ...safeProductionEnvironment,
    GLOBAL_BI_SERVICE_URL: 'http://127.0.0.1:3310',
    GLOBAL_BI_GATEWAY_SECRET: 'b'.repeat(48),
    GLOBAL_BI_SERVICE_CUTOVER_READY: '1',
  });
  assert.ok(configured.enabledModules.includes('global-bi'));
  assert.throws(
    () => loadRuntimeConfig({
      ...safeProductionEnvironment,
      GLOBAL_BI_SERVICE_URL: 'http://127.0.0.1:3310',
      GLOBAL_BI_GATEWAY_SECRET: 'a'.repeat(48),
      GLOBAL_BI_SERVICE_CUTOVER_READY: '1',
    }),
    /must be unique across enabled service gateways/,
  );
  assert.throws(
    () => loadRuntimeConfig({
      ...safeProductionEnvironment,
      GLOBAL_BI_SERVICE_CUTOVER_READY: '1',
    }),
    /GLOBAL_BI_SERVICE_URL is required/,
  );
});

test('private service port defaults do not overlap between MFI and Accounting instances', () => {
  const accountingServer = readFileSync(new URL('../services/accounting/server.ts', import.meta.url), 'utf8');
  const mfiServer = readFileSync(new URL('../services/sacco-mfi/server.ts', import.meta.url), 'utf8');
  const accountingEnv = readFileSync(new URL('../deploy/accounting-service.env.example', import.meta.url), 'utf8');
  const subscriberAccountingEnv = readFileSync(new URL('../deploy/accounting-subscriber-service.env.example', import.meta.url), 'utf8');
  const defaultPort = (source: string) => Number(source.match(/process\.env\.PORT\s*\?\?\s*(\d+)/)?.[1]);
  const envPort = (source: string) => Number(source.match(/^PORT=(\d+)$/m)?.[1]);
  const mfiPort = defaultPort(mfiServer);
  const accountingPort = defaultPort(accountingServer);
  const subscriberPort = envPort(subscriberAccountingEnv);

  assert.equal(envPort(accountingEnv), accountingPort);
  assert.deepEqual([mfiPort, accountingPort, subscriberPort], [3300, 3301, 3302]);
  assert.equal(new Set([mfiPort, accountingPort, subscriberPort]).size, 3);
});

test('production blocks legacy immediate lease activation unless explicitly enabled', () => {
  assert.equal(loadRuntimeConfig(safeProductionEnvironment).legacyImmediateLeasesEnabled, false);
  assert.equal(loadRuntimeConfig({
    ...safeProductionEnvironment,
    LEGACY_IMMEDIATE_LEASES_ENABLED: '1',
  }).legacyImmediateLeasesEnabled, true);
  assert.equal(loadRuntimeConfig({
    ...safeProductionEnvironment,
    LEGACY_IMMEDIATE_LEASES_ENABLED: '0',
  }).legacyImmediateLeasesEnabled, false);
  assert.throws(
    () => loadRuntimeConfig({ ...safeProductionEnvironment, LEGACY_IMMEDIATE_LEASES_ENABLED: 'yes' }),
    /LEGACY_IMMEDIATE_LEASES_ENABLED must be 0 or 1/,
  );
  assert.equal(loadRuntimeConfig({ NODE_ENV: 'test' }).legacyImmediateLeasesEnabled, true);
});

test('production requires separate financial service gateways and blocks in-process fallbacks', () => {
  assert.throws(
    () => loadRuntimeConfig({ ...safeProductionEnvironment, MFI_PILOT_ENABLED: '1', MFI_SERVICE_URL: undefined }),
    /MFI_SERVICE_URL must be configured/,
  );
  assert.throws(
    () => loadRuntimeConfig({ ...safeProductionEnvironment, MFI_PILOT_ENABLED: '1', MFI_GATEWAY_SECRET: 'short' }),
    /MFI_GATEWAY_SECRET must be a unique/,
  );
  assert.throws(
    () => loadRuntimeConfig({ ...safeProductionEnvironment, INSURANCE_SERVICE_CUTOVER_READY: '0' }),
    /INSURANCE_SERVICE_CUTOVER_READY=1 is required/,
  );
  assert.throws(
    () => loadRuntimeConfig({ ...safeProductionEnvironment, INSURANCE_GATEWAY_SECRET: undefined }),
    /INSURANCE_GATEWAY_SECRET must be a unique/,
  );
  const withoutInsurance = loadRuntimeConfig({
    ...safeProductionEnvironment,
    INSURANCE_SERVICE_URL: undefined,
    INSURANCE_GATEWAY_SECRET: undefined,
    INSURANCE_SERVICE_CUTOVER_READY: '0',
  });
  assert.equal(withoutInsurance.isProduction, true);
  assert.equal(withoutInsurance.enabledModules.includes('insurance'), false);
  const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /api\.use\('\/insurance\/ledger', process\.env\.INSURANCE_SERVICE_URL[\s\S]*?runtimeConfig\.isProduction[\s\S]*?res\.status\(503\)[\s\S]*?createInsuranceLedgerRouter\(withUser\)/);
});

test('production configuration requires separate strong JWT and MFA secrets', () => {
  assert.throws(() => loadRuntimeConfig({ ...safeProductionEnvironment, MFA_ENC_KEY: undefined }), /MFA_ENC_KEY/);
  assert.throws(() => loadRuntimeConfig({ ...safeProductionEnvironment, MFA_ENC_KEY: safeProductionEnvironment.JWT_SECRET }), /must be different/);
  assert.throws(() => loadRuntimeConfig({ ...safeProductionEnvironment, JWT_SECRET: 'REPLACE_WITH_A_RANDOM_SECRET_1234567890' }), /JWT_SECRET/);
  assert.throws(() => loadRuntimeConfig({ ...safeProductionEnvironment, REQUIRE_MFA_FOR_STAFF: '0' }), /REQUIRE_MFA_FOR_STAFF=1/);
});

test('production configuration requires TLS for remote PostgreSQL and private storage', () => {
  assert.throws(
    () => loadRuntimeConfig({ ...safeProductionEnvironment, DATABASE_URL: 'postgres://app:secret@db.example.net:5432/afrolife' }),
    /sslmode=verify-full/,
  );
  assert.throws(
    () => loadRuntimeConfig({ ...safeProductionEnvironment, FILE_STORAGE_DIR: 'public/uploads' }),
    /absolute, persistent/,
  );
  assert.throws(
    () => loadRuntimeConfig({ ...safeProductionEnvironment, FILE_STORAGE_DIR: resolve('public', 'uploads') }),
    /public web directory/,
  );
});

test('production permits required TLS on AletCloud private database endpoints only', () => {
  const privateDatabase = {
    ...safeProductionEnvironment,
    DATABASE_URL: 'postgresql://runtime:runtime-password@uat-db-rw.db-978.svc.cluster.local:5432/afrolife?sslmode=require&uselibpqcompat=true',
  };
  assert.equal(loadRuntimeConfig(privateDatabase).isProduction, true);
  assert.throws(
    () => loadRuntimeConfig({
      ...privateDatabase,
      DATABASE_URL: 'postgresql://runtime:runtime-password@db.example.net:5432/afrolife?sslmode=require&uselibpqcompat=true',
    }),
    /sslmode=verify-full/,
  );
  assert.throws(
    () => loadRuntimeConfig({
      ...privateDatabase,
      DATABASE_URL: 'postgresql://runtime:runtime-password@uat-db-rw.db-978.svc.cluster.local:5432/afrolife?sslmode=require',
    }),
    /sslmode=verify-full/,
  );
});

test('production accepts complete private S3 storage and rejects incomplete or insecure configuration', () => {
  const objectStorageEnvironment = {
    ...safeProductionEnvironment,
    FILE_STORAGE_DIR: undefined,
    S3_BUCKET: 't978-afrolife-private-files',
    S3_ENDPOINT: 'https://s3.aletcloud.com',
    AWS_REGION: 'et-addis-1',
    AWS_ACCESS_KEY_ID: 'test-access-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret-key',
  };
  assert.doesNotThrow(() => loadRuntimeConfig(objectStorageEnvironment));
  assert.equal(privateObjectStorageConfig(objectStorageEnvironment)?.bucket, 't978-afrolife-private-files');
  assert.throws(
    () => loadRuntimeConfig({ ...objectStorageEnvironment, AWS_SECRET_ACCESS_KEY: undefined }),
    /requires a bucket, endpoint, access key, and secret key/,
  );
  assert.throws(
    () => loadRuntimeConfig({ ...objectStorageEnvironment, S3_ENDPOINT: 'http://s3.aletcloud.com' }),
    /must use HTTPS in production/,
  );
});

test('production configuration rejects unsafe origins and proxy trust', () => {
  assert.throws(() => loadRuntimeConfig({ ...safeProductionEnvironment, CORS_ORIGINS: '*' }), /exact HTTPS origins/);
  assert.throws(() => loadRuntimeConfig({ ...safeProductionEnvironment, CORS_ORIGINS: 'https://agency.example.org' }), /non-placeholder HTTPS origins/);
  assert.throws(() => loadRuntimeConfig({ ...safeProductionEnvironment, TRUST_PROXY: 'true' }), /actual trusted proxy/);
  assert.throws(() => loadRuntimeConfig({ ...safeProductionEnvironment, LOGIN_RATE_LIMIT: '0' }), /between 1 and 1000/);
});

test('Insurance service routing requires explicit cutover readiness when enabled', () => {
  const serviceUrl = 'https://insurance.internal';
  assert.throws(
    () => loadRuntimeConfig({
      ...safeProductionEnvironment,
      INSURANCE_SERVICE_URL: serviceUrl,
      INSURANCE_SERVICE_CUTOVER_READY: undefined,
    }),
    /INSURANCE_SERVICE_CUTOVER_READY=1/,
  );
  assert.doesNotThrow(() => loadRuntimeConfig({
    ...safeProductionEnvironment,
    INSURANCE_SERVICE_URL: undefined,
    INSURANCE_GATEWAY_SECRET: undefined,
    INSURANCE_SERVICE_CUTOVER_READY: '0',
  }));
  assert.throws(
    () => loadRuntimeConfig({ ...safeProductionEnvironment, INSURANCE_SERVICE_URL: serviceUrl, INSURANCE_SERVICE_CUTOVER_READY: 'yes' }),
    /must be 0 or 1/,
  );
  assert.doesNotThrow(() => loadRuntimeConfig({
    ...safeProductionEnvironment,
    INSURANCE_SERVICE_URL: serviceUrl,
    INSURANCE_SERVICE_CUTOVER_READY: '1',
  }));
});

test('production environment templates keep Insurance unset until cutover is approved', () => {
  for (const template of ['../.env.production.example', '../.env.production.windows.example']) {
    const contents = readFileSync(new URL(template, import.meta.url), 'utf8');
    assert.match(contents, /^INSURANCE_SERVICE_URL=\s*$/m);
    assert.match(contents, /^INSURANCE_GATEWAY_SECRET=\s*$/m);
    assert.match(contents, /^INSURANCE_SERVICE_CUTOVER_READY=0$/m);
  }
});

test('Agency service gateways require explicit cutover readiness and service credentials', () => {
  const agencyServices = [
    ['WORKER_MANAGEMENT_SERVICE_URL', 'WORKER_MANAGEMENT_GATEWAY_SECRET', 'WORKER_MANAGEMENT_SERVICE_CUTOVER_READY'],
    ['STAFFING_SERVICE_URL', 'STAFFING_GATEWAY_SECRET', 'STAFFING_SERVICE_CUTOVER_READY'],
    ['PROPERTY_MANAGEMENT_SERVICE_URL', 'PROPERTY_MANAGEMENT_GATEWAY_SECRET', 'PROPERTY_MANAGEMENT_SERVICE_CUTOVER_READY'],
    ['MARKETPLACE_SERVICE_URL', 'MARKETPLACE_GATEWAY_SECRET', 'MARKETPLACE_SERVICE_CUTOVER_READY'],
  ] as const;

  for (const [url, secret, readiness] of agencyServices) {
    assert.throws(
      () => loadRuntimeConfig({ ...safeProductionEnvironment, [readiness]: undefined }),
      new RegExp(`${readiness}=1 is required`),
    );
    assert.throws(
      () => loadRuntimeConfig({ ...safeProductionEnvironment, [url]: undefined }),
      new RegExp(`${url} is required when ${readiness} is enabled`),
    );
    assert.throws(
      () => loadRuntimeConfig({ ...safeProductionEnvironment, [readiness]: 'yes' }),
      new RegExp(`${readiness} must be 0 or 1`),
    );
    assert.throws(
      () => loadRuntimeConfig({ ...safeProductionEnvironment, [secret]: 'short' }),
      new RegExp(`${secret} must be a unique`),
    );
    const collidingSecret = agencyServices.find((candidate) => candidate[1] !== secret)?.[1];
    assert.ok(collidingSecret);
    assert.throws(
      () => loadRuntimeConfig({ ...safeProductionEnvironment, [secret]: safeProductionEnvironment[collidingSecret] }),
      /must be unique across enabled service gateways/,
    );
    assert.throws(
      () => loadRuntimeConfig({ ...safeProductionEnvironment, [url]: 'http://agency-service.internal:3400' }),
      new RegExp(`${url} must be an HTTPS origin`),
    );
  }

  for (const [url, secret, readiness] of agencyServices) {
    const legacyEnvironment = { ...safeProductionEnvironment };
    delete legacyEnvironment[url];
    delete legacyEnvironment[secret];
    delete legacyEnvironment[readiness];
    assert.doesNotThrow(() => loadRuntimeConfig(legacyEnvironment));
  }

  const legacyProductionEnvironment = { ...safeProductionEnvironment };
  for (const [url, secret, readiness] of agencyServices) {
    legacyProductionEnvironment[url] = '';
    legacyProductionEnvironment[secret] = '';
    legacyProductionEnvironment[readiness] = '0';
  }
  assert.doesNotThrow(() => loadRuntimeConfig(legacyProductionEnvironment));
});

test('development retains existing pilot behavior unless explicitly disabled', () => {
  assert.equal(loadRuntimeConfig({ NODE_ENV: 'development' }).mfiPilotEnabled, true);
  assert.equal(loadRuntimeConfig({ NODE_ENV: 'development', MFI_PILOT_ENABLED: '0' }).mfiPilotEnabled, false);
});

test('session inactivity timeout is configurable within safe bounds', () => {
  assert.equal(sessionIdleTimeoutMinutes({}), 30);
  assert.equal(sessionIdleTimeoutMinutes({ SESSION_IDLE_TIMEOUT_MINUTES: '45' }), 45);
  assert.throws(() => sessionIdleTimeoutMinutes({ SESSION_IDLE_TIMEOUT_MINUTES: '4' }), /between 5 and 480/);
  assert.throws(() => sessionIdleTimeoutMinutes({ SESSION_IDLE_TIMEOUT_MINUTES: '481' }), /between 5 and 480/);
  assert.throws(() => sessionIdleTimeoutMinutes({ SESSION_IDLE_TIMEOUT_MINUTES: '30.5' }), /between 5 and 480/);
});
