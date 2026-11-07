import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('property operating tenant migration backfills legacy data and enforces row isolation', async () => {
  const migration = await readFile(
    new URL('../migrations/118_property_operating_tenant_scope.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /legacy-property-operations/);
  assert.match(migration, /all_existing_property_records_to_one_legacy_tenant/);
  for (const table of ['properties', 'tenants', 'leases', 'maintenance_requests', 'rent_transactions', 'property_vendors']) {
    assert.match(migration, new RegExp(`ALTER TABLE ${table} ADD COLUMN tenant_system_id`));
    assert.match(migration, new RegExp(`CREATE POLICY .* ON ${table} AS RESTRICTIVE`));
  }
  assert.match(migration, /CREATE POLICY property_units_operating_tenant_scope/);
  assert.match(migration, /CREATE POLICY property_rental_applications_operating_tenant_scope/);
  assert.match(migration, /CREATE POLICY lease_move_out_inspections_operating_tenant_scope/);
  assert.match(migration, /CREATE POLICY property_vendor_bills_operating_tenant_scope/);
  assert.doesNotMatch(migration, /ALTER TABLE property_tenant_account_links FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /assign_property_operating_tenant_member/);
  assert.match(migration, /provision_property_operating_tenant/);
  assert.match(migration, /support_grant_approved/);
  assert.match(migration, /requested_expiry>now\(\)\+interval '8 hours'/);

  const core = await readFile(new URL('../src/core.ts', import.meta.url), 'utf8');
  assert.match(core, /app\.property_tenant_system_id/);
  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /x-afrolife-property-tenant-id/);
  assert.match(server, /x-afrolife-property-tenant-purpose/);
  assert.match(server, /app_property_tenant_system_id\(\) AS id/);
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /x-afrolife-property-tenant-id/);
  assert.match(app, /property\/tenant-systems\/mine/);
});
