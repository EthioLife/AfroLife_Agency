import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leaseMoneyToCents } from '../src/lease-renewals.js';

test('lease money is converted to cents without floating-point arithmetic', () => {
  assert.equal(leaseMoneyToCents('0.01'), 1n);
  assert.equal(leaseMoneyToCents('1000000000.09'), 100000000009n);
  assert.throws(() => leaseMoneyToCents('1.001'), RangeError);
});

test('lease closeout requires a versioned independent inspection and approved deposit disposition', async () => {
  const migration = await readFile(
    new URL('../migrations/116_property_lease_move_out.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /lease_move_out_one_pending_idx/);
  assert.match(migration, /reviewed_by<>submitted_by/);
  assert.match(migration, /A reviewed move-out inspection matching the lease end date is required/);
  assert.match(migration, /Proposed deposit deductions exceed the reconciled deposit/);
  assert.match(migration, /lease_move_out_evidence_immutable/);
  assert.match(migration, /lease_move_out_inspection_read/);
  assert.match(migration, /property\.owner_user_id=app_user_id\(\)/);
  const ops = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(ops, /\/leases\/:id\/move-out-inspections/);
  assert.match(ops, /\/move-out-inspections\/:inspectionId\/decision/);
  assert.match(ops, /\/move-out-inspections\/:inspectionId\/evidence/);
  assert.match(ops, /approved move-out deposit disposition/);
  assert.match(ops, /independently approved refundable balance/);
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /Submit move-out inspection/);
  assert.match(app, /Approve move-out inspection/);
  assert.match(app, /End lease after move-out review/);
  assert.match(app, /Upload move-out evidence/);
});

test('lease closeout puts units into audited turnover before they can become vacant', async () => {
  const migration = await readFile(
    new URL('../migrations/117_property_unit_turnover.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /'vacant','occupied','maintenance','turnover'/);
  assert.match(migration, /property_unit_turnover_events/);
  assert.match(migration, /property_unit_turnover_events_insert/);
  assert.match(migration, /app\.unit_turnover_completion_note/);
  assert.match(migration, /app\.unit_turnover_lease_id/);
  assert.match(migration, /A reviewed move-out inspection is required to place an occupied unit into turnover/);
  const ops = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(ops, /UPDATE property_units SET occupancy='turnover'/);
  const propertyRouter = await readFile(new URL('../services/property-management/router.ts', import.meta.url), 'utf8');
  assert.match(propertyRouter, /turnover-complete/);
  assert.match(propertyRouter, /This unit is not awaiting turnover completion/);
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /Complete turnover/);
  assert.match(app, /Unit turnover completed/);
});
