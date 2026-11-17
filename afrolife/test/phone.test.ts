import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, normalizePhoneParts } from '../src/phone.js';

test('every common way of writing the same Ethiopian mobile gives one canonical number', () => {
  for (const x of ['+251911234567', '251911234567', '0911234567', '911234567', '+251 911 234 567', '0911-234-567', '00251911234567', ' (091) 123 4567 '.replace(/[()]/g, '')]) {
    assert.equal(normalizePhone(x), '+251911234567', x);
  }
});
test('Safaricom Ethiopia (07) and Addis landlines (011) are accepted', () => {
  assert.equal(normalizePhone('0712345678'), '+251712345678');
  assert.equal(normalizePhone('0111234567'), '+251111234567');
});
test('wrong lengths and impossible prefixes are rejected', () => {
  for (const x of ['', '12345', '+2519112345678', '0611234567', '0811234567', '+251011234567', 'abcdefghij']) assert.equal(normalizePhone(x), null, x);
});
test('numbers from other countries pass through in E.164 form', () => {
  assert.equal(normalizePhone('+1 415 555 0132'), '+14155550132');
  assert.equal(normalizePhone('+971 50 123 4567'), '+971501234567');
});
test('country code and national number normalize consistently, including legacy Ethiopian leading zeroes', () => {
  assert.equal(normalizePhoneParts('+251', '0911 234 567'), '+251911234567');
  assert.equal(normalizePhoneParts('+251', '911234567'), '+251911234567');
  assert.equal(normalizePhoneParts('+1', '(415) 555-0132'), '+14155550132');
  assert.equal(normalizePhoneParts('+971', '50 123 4567'), '+971501234567');
  assert.equal(normalizePhoneParts('+251', '0611234567'), null);
  assert.equal(normalizePhoneParts('+9999', '12345678'), null);
  assert.equal(normalizePhoneParts('+1', '+14155550132'), null);
});
