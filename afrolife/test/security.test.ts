import test from 'node:test';
import assert from 'node:assert/strict';
import { keyFrom, seal, open, sign, verifySignature, passwordProblem, randomPassword, mfaKeys, openAny } from '../src/security.js';

test('sealed secrets round-trip and cannot be tampered with', () => {
  const k = keyFrom('a'.repeat(32));
  const s = seal('JBSWY3DPEHPK3PXP', k);
  assert.equal(open(s, k), 'JBSWY3DPEHPK3PXP');
  assert.notEqual(seal('x', k), seal('x', k)); // fresh IV each time
  assert.throws(() => open(s, keyFrom('b'.repeat(32)))); // wrong key
  const parts = s.split('.'); parts[2] = Buffer.from('tampered').toString('base64');
  assert.throws(() => open(parts.join('.'), k));
});

test('webhook signatures: valid, wrong secret, tampered body, stale timestamp', () => {
  const body = Buffer.from('{"amount":27000}'), now = 1_800_000_000_000, ts = String(now);
  const sig = sign(body, ts, 'secret');
  assert.equal(verifySignature(body, ts, sig, 'secret', now), true);
  assert.equal(verifySignature(body, ts, sig, 'other', now), false);
  assert.equal(verifySignature(Buffer.from('{"amount":1}'), ts, sig, 'secret', now), false);
  assert.equal(verifySignature(body, ts, sig, 'secret', now + 10 * 60_000), false); // replay after 10 minutes
  assert.equal(verifySignature(body, undefined, sig, 'secret', now), false);
  assert.equal(verifySignature(body, ts, 'zz', 'secret', now), false);
});

test('password policy', () => {
  assert.match(passwordProblem('short1', '+251911234567')!, /8 characters/);
  assert.equal(passwordProblem('Abcdefg8', '+251911234567'), null);
  assert.match(passwordProblem('Abcdef7', '+251911234567')!, /8 characters/);
  assert.match(passwordProblem('1234567890123', '+251911234567')!, /digits alone/);
  assert.match(passwordProblem('abc1234567xyz', '+251911234567')!, /phone/);
  assert.equal(passwordProblem('correct-horse-battery', '+251911234567'), null);
});

test('generated passwords satisfy the policy', () => {
  for (let i = 0; i < 50; i++) assert.equal(passwordProblem(randomPassword(), '+251911234567'), null);
});

test('rotating JWT_SECRET does not strand 2FA secrets once MFA_ENC_KEY is set', () => {
  const before = mfaKeys('j'.repeat(32));                              // today: key derived from the JWT secret
  const oldSealed = seal('JBSWY3DPEHPK3PXP', before[0]);
  const after = mfaKeys('z'.repeat(32), 'e'.repeat(40));                // new JWT secret + dedicated key
  assert.throws(() => openAny(oldSealed, after));                       // the old secret was sealed under the old JWT secret
  const withLegacy = [...after, ...before];                             // (operators keep the old key until re-sealed)
  assert.equal(openAny(oldSealed, withLegacy), 'JBSWY3DPEHPK3PXP');
  const fresh = seal('NEWSECRET', after[0]);
  assert.equal(openAny(fresh, mfaKeys('q'.repeat(32), 'e'.repeat(40))), 'NEWSECRET'); // survives another JWT rotation
  assert.throws(() => mfaKeys('j'.repeat(32), 'short'), /32\+/);
});

test('random passwords use every character class roughly evenly (no modulo bias)', () => {
  const counts = new Map<string, number>();
  for (let i = 0; i < 4000; i++) for (const ch of randomPassword(12)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const vals = [...counts.values()];
  assert.equal(counts.size, 57);
  assert.ok(Math.max(...vals) / Math.min(...vals) < 1.25);
});
