import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { seedPlatformSuperAdmin, validatePlatformAdminSeedInput } from '../src/platform-admin-seed.js';

const validInput = {
  actorId: '00000000-0000-4000-8000-000000000001',
  name: 'Test Platform Admin',
  phone: '+251911123456',
  password: 'a-unique-temporary-password',
  reason: 'Provision a second platform administrator',
};

test('validates and normalizes a platform administrator seed request', () => {
  assert.deepEqual(validatePlatformAdminSeedInput({ ...validInput, phone: '0911 123 456', name: ' Test Platform Admin ' }), {
    ...validInput,
    name: 'Test Platform Admin',
    phone: '+251911123456',
  });
});

test('rejects weak passwords, invalid actors, and invalid phone numbers', () => {
  assert.throws(() => validatePlatformAdminSeedInput({ ...validInput, password: 'short' }), /at least 12 characters/);
  assert.throws(() => validatePlatformAdminSeedInput({ ...validInput, actorId: 'not-a-uuid' }), /valid user ID/);
  assert.throws(() => validatePlatformAdminSeedInput({ ...validInput, phone: '123' }), /valid phone number/);
});

test('platform-admin seeding uses the RLS user-creation context and records its actor', async () => {
  const statements: Array<{ sql: string; values?: unknown[] }> = [];
  const pool = {
    connect: async () => ({
      query: async (sql: string, values?: unknown[]) => {
        statements.push({ sql, values });
        if (sql.includes('SELECT role, active, mfa_enabled FROM users')) {
          return { rows: [{ role: 'global_admin', active: true, mfa_enabled: true }], rowCount: 1 };
        }
        if (sql.includes("action = 'platform_super_admin_seeded'")) return { rows: [], rowCount: 0 };
        if (sql.includes('SELECT 1 FROM users WHERE phone')) return { rows: [], rowCount: 0 };
        if (sql.includes('INSERT INTO users')) {
          return { rows: [{ id: values?.[0] }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      },
      release: () => undefined,
    }),
  } as unknown as Pool;

  const userId = await seedPlatformSuperAdmin(pool, validInput);
  const creationContext = statements.find(({ sql }) => sql.includes("set_config('app.user_creation_id'"));
  const insert = statements.find(({ sql }) => sql.includes('INSERT INTO users'));
  assert.ok(creationContext);
  assert.equal(creationContext.values?.[0], userId);
  assert.match(insert?.sql ?? '', /created_by/);
  assert.equal(insert?.values?.[4], validInput.actorId);
});
