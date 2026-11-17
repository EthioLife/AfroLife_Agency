import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { decryptInspectionDraft, encryptInspectionDraft } from '../public/offline-inspection-queue.js';

const userId = '7425c853-5353-4f66-9c2c-f0914b014126';
const otherUserId = '7425c853-5353-4f66-9c2c-f0914b014127';
const draft = {
  tenant_system_id: '4125c853-5353-4f66-9c2c-f0914b014128',
  lease_id: '5125c853-5353-4f66-9c2c-f0914b014129',
  client_submission_id: '6125c853-5353-4f66-9c2c-f0914b014130',
  enqueued_at: '2026-11-09T10:00:00.000Z',
  payload: {
    actual_vacated_on: '2026-11-08',
    inspected_on: '2026-11-09',
    condition_notes: 'Kitchen wall needs a documented repair review.',
    keys_returned: true,
    deposit_deduction: '125.00',
    deduction_reason: 'Documented broken window replacement.',
  },
};

test('offline inspection drafts are encrypted, integrity-protected, and user-bound', async () => {
  const key = await webcrypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const record = await encryptInspectionDraft(userId, [draft], key, webcrypto);
  const ciphertext = Buffer.from(record.ciphertext);
  assert.equal(ciphertext.includes(Buffer.from(draft.payload.condition_notes)), false);
  assert.deepEqual(await decryptInspectionDraft(userId, record, key, webcrypto), [draft]);
  await assert.rejects(decryptInspectionDraft(otherUserId, record, key, webcrypto), /could not be verified/);

  const tampered = { ...record, ciphertext: record.ciphertext.slice(0) };
  new Uint8Array(tampered.ciphertext)[0] ^= 1;
  await assert.rejects(decryptInspectionDraft(userId, tampered, key, webcrypto), /could not be verified/);
});

test('offline inspection encryption refuses malformed or excessive drafts', async () => {
  const key = await webcrypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  await assert.rejects(encryptInspectionDraft(userId, [{ ...draft, tenant_system_id: 'not-a-uuid' }], key, webcrypto), /draft is invalid/);
  await assert.rejects(encryptInspectionDraft(userId, Array(26).fill(draft), key, webcrypto), /limited to 25 drafts/);
});
