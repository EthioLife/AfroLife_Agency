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
  assert.match(migration, /set_property_operating_tenant_member_status/);
  assert.match(migration, /provision_property_operating_tenant/);
  assert.match(migration, /app_is_property_tenant_admin/);
  assert.doesNotMatch(migration, /ALTER TABLE property_operating_tenant_members FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /support_grant_approved/);
  assert.match(migration, /requested_expiry>now\(\)\+interval '8 hours'/);
  assert.match(migration, /properties_tenant_address_territory_unique/);
  assert.match(migration, /Create an active administrator account before applying property tenant isolation/);
  assert.match(migration, /maintenance_requests_field_agent_assigned_only/);
  assert.match(migration, /maintenance\.assigned_to=app_user_id\(\)::text/);
  assert.match(migration, /Vendor bill, vendor, and maintenance request must belong to the active property tenant/);
  assert.match(migration, /UPDATE OF maintenance_request_id,vendor_id,tenant_system_id ON property_vendor_bills/);

  const platformRoleGuard = await readFile(
    new URL('../migrations/119_property_platform_role_membership_guard.sql', import.meta.url),
    'utf8',
  );
  assert.match(platformRoleGuard, /initial_admin=actor OR NOT EXISTS/);
  assert.match(platformRoleGuard, /id=initial_admin AND active=true AND role<>'global_admin'/);
  assert.match(platformRoleGuard, /id=target_user AND active=true AND role<>'global_admin'/);
  assert.match(platformRoleGuard, /Global Admin access requires an approved support grant/);
  assert.match(platformRoleGuard, /app_role\(\)<>'global_admin'/);
  assert.match(platformRoleGuard, /app_role\(\)='global_admin'[\s\S]*property_operating_tenant_support_grants/);

  const agentScopeMigration = await readFile(
    new URL('../migrations/120_property_agent_scope_and_maintenance_assignees.sql', import.meta.url),
    'utf8',
  );
  assert.match(agentScopeMigration, /CREATE TABLE property_agent_scopes/);
  assert.match(agentScopeMigration, /app_property_tenant_role_matches/);
  assert.match(agentScopeMigration, /WHEN 'field_agent' THEN target_auth_role='field_agent'/);
  assert.match(agentScopeMigration, /app_property_tenant_role_matches\(member\.tenant_role,user_row\.role\)/);
  assert.match(agentScopeMigration, /CREATE OR REPLACE FUNCTION assign_property_agent_scope/);
  assert.match(agentScopeMigration, /CREATE OR REPLACE FUNCTION set_property_agent_scope_status/);
  assert.match(agentScopeMigration, /NEW\.assigned_to_user_id/);
  assert.match(agentScopeMigration, /app_property_tenant_role_matches\(member\.tenant_role,user_row\.role\)/);
  assert.match(agentScopeMigration, /Maintenance assignee must be an active agent assigned to this property in the same tenant/);
  assert.match(agentScopeMigration, /Field agents cannot create maintenance requests; a supervisor must assign work/);
  assert.match(agentScopeMigration, /CREATE OR REPLACE FUNCTION guard_property_field_agent_maintenance_update/);
  assert.match(agentScopeMigration, /to_jsonb\(NEW\)-allowed_changes/);
  assert.match(agentScopeMigration, /property_field_agent_maintenance_update_guard/);
  assert.match(agentScopeMigration, /maintenance_requests_field_agent_assigned_only/);
  assert.match(agentScopeMigration, /maintenance_requests_scoped_field_agent_read/);
  assert.match(agentScopeMigration, /maintenance_requests_scoped_field_agent_update/);
  assert.match(agentScopeMigration, /maintenance_evidence_scoped_field_agent_read/);
  assert.match(agentScopeMigration, /maintenance_evidence_scoped_field_agent_insert/);
  assert.match(agentScopeMigration, /property_agent_scope_events_immutable/);

  const hierarchyMigration = await readFile(
    new URL('../migrations/121_property_master_agent_delegation.sql', import.meta.url),
    'utf8',
  );
  assert.match(hierarchyMigration, /CREATE OR REPLACE FUNCTION app_property_agent_can_manage/);
  assert.match(hierarchyMigration, /app_role\(\)='master_agent'/);
  assert.match(hierarchyMigration, /CREATE POLICY properties_master_agent_scope_read/);
  assert.match(hierarchyMigration, /CREATE POLICY property_units_master_agent_scope_read/);
  assert.match(hierarchyMigration, /Master agents may assign only field agents to properties in their active scope/);
  assert.match(hierarchyMigration, /Master agents may change only field-agent scopes in their active property assignment/);
  assert.match(hierarchyMigration, /CREATE OR REPLACE FUNCTION list_property_agent_candidates/);

  const exportMigration = await readFile(
    new URL('../migrations/122_property_tenant_export_closeout.sql', import.meta.url),
    'utf8',
  );
  assert.match(exportMigration, /CREATE TABLE property_tenant_export_requests/);
  assert.match(exportMigration, /CREATE TABLE property_tenant_export_events/);
  assert.match(exportMigration, /CREATE OR REPLACE FUNCTION request_property_tenant_export/);
  assert.match(exportMigration, /CREATE OR REPLACE FUNCTION decide_property_tenant_export/);
  assert.match(exportMigration, /Tenant offboarding requires an independently verified export/);

  const core = await readFile(new URL('../src/core.ts', import.meta.url), 'utf8');
  assert.match(core, /app\.property_tenant_system_id/);
  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /x-afrolife-property-tenant-id/);
  assert.match(server, /x-afrolife-property-tenant-purpose/);
  assert.match(server, /app_property_tenant_system_id\(\) AS id/);
  assert.match(server, /'\/property-vendors', '\/property-vendor-bills', '\/property-vendor-payments'/);
  assert.match(server, /requireAnyMiniAppAccess\('properties', 'rent', 'accounting'\)/);
  assert.match(server, /property\/tenant-support-grants\/mine/);
  assert.match(server, /property\/tenant-systems\/:id\/agent-scopes/);
  assert.match(server, /property\/tenant-systems\/:id\/agent-candidates/);
  assert.match(server, /list_property_agent_candidates\(\$1,\$2\)/);
  assert.match(server, /property\/tenant-offboarding-exports/);
  assert.match(server, /request_property_tenant_export\(\$1,\$2,\$3,\$4,\$5,\$6\)/);
  assert.match(server, /decide_property_tenant_export\(\$1,\$2,\$3,\$4\)/);
  assert.match(server, /api\.get\('\/property\/tenant-systems', requireRole\('global_admin'\)/);
  assert.match(server, /api\.post\('\/property\/tenant-systems\/:id\/members\/:userId\/status'/);
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /x-afrolife-property-tenant-id/);
  assert.match(app, /x-afrolife-property-tenant-purpose/);
  assert.match(app, /property\/tenant-systems\/mine/);
  assert.match(app, /property-tenant-support-decision/);
  assert.match(app, /property-tenant-support-request/);
  assert.match(app, /property-agent-scope/);
  assert.match(app, /propertyAgentScopes/);
  assert.match(app, /property-tenant-export-request/);
  assert.match(app, /property-tenant-export-decision/);
  assert.match(app, /property-tenant-status/);

  const operations = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(operations, /assigned_to: z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(operations, /Assign this agent to the property before routing maintenance work/);
  assert.match(operations, /Field agents may only update their assigned work status and completion notes/);
  assert.match(operations, /Field agents can only work on maintenance assigned to them/);
  assert.match(operations, /CASE WHEN app_role\(\)='field_agent' THEN NULL ELSE m\.cost END AS cost/);
  const vendorPortal = await readFile(new URL('../src/property-vendor-portal.ts', import.meta.url), 'utf8');
  assert.match(vendorPortal, /req\.user!\.role === 'field_agent'[\s\S]*\['assigned','in_progress','rework_required'\]/);

  const propertyRouter = await readFile(new URL('../services/property-management/router.ts', import.meta.url), 'utf8');
  assert.match(propertyRouter, /const salePrice = fieldAgent \? 'NULL::numeric AS sale_price'/);
  assert.match(propertyRouter, /const unitRent = fieldAgent \? 'NULL::numeric'/);
});
