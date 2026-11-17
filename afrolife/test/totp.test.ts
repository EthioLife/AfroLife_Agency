import test from 'node:test';
import assert from 'node:assert/strict';
import { b32encode, b32decode, hotp, totp, verifyTotp, newSecret, otpauthUri } from '../src/totp.js';

// RFC 6238 test vectors (SHA-1, secret "12345678901234567890"), last 6 digits of the 8-digit values.
const SECRET = b32encode(Buffer.from('12345678901234567890'));
test('base32 round-trips and matches the known encoding', () => {
  assert.equal(SECRET, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.equal(b32decode(SECRET).toString(), '12345678901234567890');
  const s = newSecret(); assert.equal(b32encode(b32decode(s)), s);
});

test('matches the RFC 6238 vectors', () => {
  const v: [number, string][] = [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']];
  for (const [t, code] of v) assert.equal(totp(SECRET, t * 1000), code);
});

test('verify allows one step of clock drift and rejects the rest', () => {
  const now = 1234567890_000;
  assert.equal(verifyTotp(SECRET, '005924', now), true);
  assert.equal(verifyTotp(SECRET, '005924', now + 30_000), true);
  assert.equal(verifyTotp(SECRET, '005924', now + 90_000), false);
  assert.equal(verifyTotp(SECRET, '12345', now), false);
  assert.equal(verifyTotp(SECRET, 'abcdef', now), false);
});

test('hotp is zero-padded', () => assert.equal(hotp(b32decode(SECRET), 1234567890 / 30 | 0).length, 6));
test('otpauth URI defaults to the AfroSherik issuer', () => assert.match(otpauthUri('ABC', '+251911'), /^otpauth:\/\/totp\/AfroSherik:%2B251911\?secret=ABC&issuer=AfroSherik$/));
