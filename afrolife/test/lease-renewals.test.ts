import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeLeaseMoney, validateLeaseRenewalTerm } from '../src/lease-renewals.js';

test('lease renewal terms start after the current lease and end on the calendar anniversary', () => {
  assert.deepEqual(validateLeaseRenewalTerm({
    currentEndDate: '2027-01-31',
    proposedStartDate: '2027-02-01',
    months: 12,
    today: '2026-11-07',
  }), {
    startDate: '2027-02-01',
    endDate: '2028-01-31',
  });
});

test('lease renewal terms reject overlapping, past, malformed, and out-of-range dates', () => {
  for (const input of [
    { currentEndDate: '2027-01-31', proposedStartDate: '2027-01-31', months: 12, today: '2026-11-07' },
    { currentEndDate: '2027-01-31', proposedStartDate: '2027-01-01', months: 12, today: '2026-11-07' },
    { currentEndDate: '2027-01-31', proposedStartDate: '2027-02-01', months: 0, today: '2026-11-07' },
    { currentEndDate: '2027-02-30', proposedStartDate: '2027-03-01', months: 12, today: '2026-11-07' },
  ]) {
    assert.throws(() => validateLeaseRenewalTerm(input), RangeError);
  }
});

test('lease renewal amounts preserve exact cents without floating-point rounding', () => {
  assert.equal(normalizeLeaseMoney('001250.5'), '1250.50');
  assert.equal(normalizeLeaseMoney('0', true), '0.00');
  assert.throws(() => normalizeLeaseMoney('0'), RangeError);
  assert.throws(() => normalizeLeaseMoney('10.999'), RangeError);
  assert.throws(() => normalizeLeaseMoney('1000000000000'), RangeError);
});

test('renewal persistence requires approval, resident response, and append-only history', async () => {
  const migration = await readFile(
    new URL('../migrations/115_lease_renewal_offers.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /lease_renewal_offer_open_lease_idx/);
  assert.match(migration, /approved_by <> created_by/);
  assert.match(migration, /Only a linked resident may respond/);
  assert.match(migration, /status='expired'/);
  assert.match(migration, /lease_renewal_offer_events_immutable/);
  assert.match(migration, /lease_renewal_offer_read/);
  const ops = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(ops, /\/leases\/:id\/renewal-offers/);
  assert.match(ops, /\/resident\/leases\/:leaseId\/renewal-offers\/:offerId\/respond/);
  assert.match(ops, /\/leases\/renewal-offers\/:offerId\/convert/);
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /Prepare renewal terms for independent approval/);
  assert.match(app, /Accept renewal terms/);
  assert.match(app, /Create renewal lease draft/);
});
