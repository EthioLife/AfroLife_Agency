import test from 'node:test';
import assert from 'node:assert/strict';
import { createAletCloudMigrationEnvironment } from '../src/aletcloud-migration-environment.js';

const source = {
  ALETCLOUD_BOOTSTRAP_DATABASE_URL: 'owner-url',
  ALETCLOUD_BOOTSTRAP_MIGRATIONS_ONLY: '1',
  SEED_ADMIN_NAME: 'Initial Admin',
  SEED_ADMIN_PHONE: '+251911234567',
  SEED_ADMIN_PASSWORD: 'one-time-password',
};

test('passes one-time admin seed values to normal migrations for the property migration guard', () => {
  const migrationEnvironment = createAletCloudMigrationEnvironment(source, 'owner-url', false);

  assert.equal(migrationEnvironment.SEED_ADMIN_NAME, source.SEED_ADMIN_NAME);
  assert.equal(migrationEnvironment.SEED_ADMIN_PHONE, source.SEED_ADMIN_PHONE);
  assert.equal(migrationEnvironment.SEED_ADMIN_PASSWORD, source.SEED_ADMIN_PASSWORD);
  assert.equal(migrationEnvironment.AFROLIFE_SEED_ADMIN_BEFORE_PROPERTY_TENANT_MIGRATION, '1');
  assert.equal(migrationEnvironment.MIGRATION_DATABASE_URL, 'owner-url');
  assert.equal(migrationEnvironment.ALETCLOUD_BOOTSTRAP_DATABASE_URL, undefined);
  assert.equal(migrationEnvironment.ALETCLOUD_BOOTSTRAP_MIGRATIONS_ONLY, undefined);
});

test('does not pass admin seed credentials to migrations-only runs', () => {
  const migrationEnvironment = createAletCloudMigrationEnvironment(source, 'owner-url', true);

  assert.equal(migrationEnvironment.SEED_ADMIN_NAME, undefined);
  assert.equal(migrationEnvironment.SEED_ADMIN_PHONE, undefined);
  assert.equal(migrationEnvironment.SEED_ADMIN_PASSWORD, undefined);
  assert.equal(migrationEnvironment.AFROLIFE_SEED_ADMIN_BEFORE_PROPERTY_TENANT_MIGRATION, undefined);
  assert.equal(migrationEnvironment.MIGRATION_DATABASE_URL, 'owner-url');
});
