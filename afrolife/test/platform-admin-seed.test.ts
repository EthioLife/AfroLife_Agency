import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlatformAdminSeedInput } from '../src/platform-admin-seed.js';

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
