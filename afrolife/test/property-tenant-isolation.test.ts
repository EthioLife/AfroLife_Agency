import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('property operating tenant migration backfills legacy data and enforces row isolation', async () => {
  const migration = await readFile(
    new URL('../migrations/118_property_operating_tenant_scope.sql', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    migration,
    /REFERENCESproperty_operating_tenants|SETNOT NULL|tenant_system_idSET NOT NULL|ISNOT NULL|target_userIS DISTINCT|ELSENULL/,
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
  assert.match(agentScopeMigration, /MIGRATION_STAGE: agent scopes backfilled/);
  assert.match(agentScopeMigration, /MIGRATION_STAGE: maintenance assignees backfilled/);
  assert.match(agentScopeMigration, /MIGRATION_STAGE: vendor RLS restored/);
  assert.match(agentScopeMigration, /MIGRATION_STAGE: agent-scope policies created/);
  const backfillStart = agentScopeMigration.indexOf('INSERT INTO property_agent_scopes(');
  const backfillEnd = agentScopeMigration.indexOf('CREATE OR REPLACE FUNCTION app_property_tenant_role_matches');
  const backfill = agentScopeMigration.slice(backfillStart, backfillEnd);
  for (const table of ['maintenance_requests', 'property_vendor_memberships', 'property_vendors']) {
    assert.match(agentScopeMigration, new RegExp(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`));
    assert.match(backfill, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(backfill, new RegExp(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.ok(backfillStart >= 0 && backfillEnd > backfillStart);
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

  const lifecycleValidationMigration = await readFile(
    new URL('../migrations/127_property_tenant_lifecycle_reason_validation.sql', import.meta.url),
    'utf8',
  );
  assert.match(lifecycleValidationMigration, /change_reason IS NULL OR length\(trim\(change_reason\)\) NOT BETWEEN 10 AND 1000/);
  assert.match(lifecycleValidationMigration, /next_status IS NULL OR next_status NOT IN/);
  assert.match(lifecycleValidationMigration, /Tenant offboarding requires an independently verified export/);
  assert.match(lifecycleValidationMigration, /jsonb_build_object\('from_status',previous_status,'to_status',next_status,'reason',trim\(change_reason\)\)/);
  assert.match(lifecycleValidationMigration, /CREATE OR REPLACE FUNCTION decide_property_tenant_export/);
  assert.match(lifecycleValidationMigration, /decision_reason IS NULL OR length\(trim\(decision_reason\)\) NOT BETWEEN 10 AND 1000/);
  assert.match(lifecycleValidationMigration, /FROM property_operating_tenants tenant[\s\S]*WHERE tenant\.id=target_tenant[\s\S]*FOR UPDATE/);
  assert.match(lifecycleValidationMigration, /Export review must be for an active or suspended tenant/);

  const membershipSupportHardening = await readFile(
    new URL('../migrations/135_property_tenant_membership_and_support_reason_guards.sql', import.meta.url),
    'utf8',
  );
  const assignmentFunction = membershipSupportHardening.slice(
    membershipSupportHardening.indexOf('CREATE OR REPLACE FUNCTION assign_property_operating_tenant_member'),
    membershipSupportHardening.indexOf('CREATE OR REPLACE FUNCTION set_property_operating_tenant_member_status'),
  );
  assert.match(assignmentFunction, /app_role\(\) IS DISTINCT FROM 'global_admin'[\s\S]*target_role='tenant_admin'/);
  assert.match(assignmentFunction, /app_property_tenant_system_id\(\) IS DISTINCT FROM target_tenant/);
  assert.match(assignmentFunction, /app_has_permission\('property\.tenancy\.manage'\) IS NOT TRUE/);
  assert.match(assignmentFunction, /app_property_tenant_role_matches\(target_role,role\)/);

  const memberStatusFunction = membershipSupportHardening.slice(
    membershipSupportHardening.indexOf('CREATE OR REPLACE FUNCTION set_property_operating_tenant_member_status'),
    membershipSupportHardening.indexOf('CREATE OR REPLACE FUNCTION decide_property_tenant_support_grant'),
  );
  assert.match(memberStatusFunction, /change_reason IS NULL OR length\(trim\(change_reason\)\) NOT BETWEEN 10 AND 1000/);
  assert.match(memberStatusFunction, /next_status IS NULL OR next_status NOT IN/);

  const supportDecisionFunction = membershipSupportHardening.slice(
    membershipSupportHardening.indexOf('CREATE OR REPLACE FUNCTION decide_property_tenant_support_grant'),
    membershipSupportHardening.indexOf('CREATE OR REPLACE FUNCTION revoke_property_tenant_support_grant'),
  );
  assert.match(supportDecisionFunction, /decision_reason IS NULL OR length\(trim\(decision_reason\)\) NOT BETWEEN 10 AND 1000/);
  assert.match(supportDecisionFunction, /approve IS NULL/);
  assert.match(supportDecisionFunction, /app_role\(\) IS DISTINCT FROM 'global_admin'/);

  const supportRevocationFunction = membershipSupportHardening.slice(
    membershipSupportHardening.indexOf('CREATE OR REPLACE FUNCTION revoke_property_tenant_support_grant'),
    membershipSupportHardening.indexOf('REVOKE ALL ON FUNCTION assign_property_operating_tenant_member'),
  );
  assert.match(supportRevocationFunction, /revocation_reason IS NULL[\s\S]*length\(trim\(revocation_reason\)\) NOT BETWEEN 10 AND 1000/);
  assert.match(supportRevocationFunction, /app_role\(\) IS DISTINCT FROM 'global_admin'/);
  assert.match(membershipSupportHardening, /REVOKE ALL ON FUNCTION set_property_operating_tenant_member_status\(uuid,uuid,text,text\) FROM PUBLIC/);
  assert.match(membershipSupportHardening, /GRANT EXECUTE ON FUNCTION revoke_property_tenant_support_grant\(uuid,text\) TO "\{\{role\}\}"/);

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

test('association amenity reservations enforce tenant scope, independent approval, cancellation, and conflict safety', async () => {
  const migration = await readFile(
    new URL('../migrations/136_property_association_amenity_reservations.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE property_association_amenity_reservations/);
  assert.match(migration, /CREATE TABLE property_association_amenity_reservation_events/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /property_association_amenity_reservations_scoped_read/);
  assert.match(migration, /app_property_association_can_view\(tenant_system_id,property_id\)/);
  assert.match(migration, /member\.tenant_role IN \('owner','resident'\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION guard_property_association_amenity_reservation_update/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION create_property_association_amenity_reservation/);
  assert.match(migration, /newer\.policy_version>policy\.policy_version/);
  assert.match(migration, /DROP POLICY IF EXISTS property_associations_scoped_read/);
  assert.match(migration, /app_property_agent_can_manage\(\s*association_property\.tenant_system_id/);
  assert.match(migration, /DROP POLICY IF EXISTS property_association_amenity_policies_scoped_read/);
  assert.match(migration, /ends_at-starts_at<=interval '24 hours'/);
  assert.match(migration, /target_starts_at>now\(\)\+interval '8760 hours'/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION decide_property_association_amenity_reservation/);
  assert.match(migration, /reservation\.starts_at<=now\(\)/);
  assert.match(migration, /reservation\.requester_user_id=actor/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended/);
  assert.match(migration, /existing\.starts_at<reservation\.ends_at/);
  assert.match(migration, /existing\.ends_at>reservation\.starts_at/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION cancel_property_association_amenity_reservation/);
  assert.match(migration, /reservation\.requester_user_id<>actor[\s\S]*app_property_agent_can_manage/);
  assert.match(migration, /FROM PUBLIC/);
  assert.match(migration, /reservation_events_immutable/);

  const operations = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(operations, /ops\.post\('\/property\/associations\/:id\/amenity-reservations'/);
  assert.match(operations, /ops\.post\('\/property\/amenity-reservations\/:id\/decision'/);
  assert.match(operations, /ops\.post\('\/property\/amenity-reservations\/:id\/cancel'/);
  assert.match(operations, /starts_at: z\.string\(\)\.datetime\(\{ offset: true \}\)/);
  assert.match(operations, /amenity_reservations: amenityReservations\.rows/);

  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /property-amenity-reservation/);
  assert.match(app, /timeZone: 'UTC'/);
  assert.match(app, /Maximum 24 hours; up to 365 days ahead/);
  assert.match(app, /property-amenity-reservation-decision/);
  assert.match(app, /property-amenity-reservation-cancel/);

  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /err\?\.code === '23P01'\) return reply\(409/);
});

test('resident maintenance completion feedback is tenant-scoped, immutable, and non-blocking', async () => {
  const migration = await readFile(
    new URL('../migrations/137_property_resident_maintenance_feedback.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE maintenance_resident_feedback/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /tenant_system_id=app_property_tenant_system_id\(\)/);
  assert.match(migration, /maintenance\.resident_user_id=app_user_id\(\)/);
  assert.match(migration, /maintenance\.status='completed'/);
  assert.match(migration, /UNIQUE \(maintenance_request_id,completion_event_id\)/);
  assert.match(migration, /UNIQUE \(submitted_by,idempotency_key\)/);
  assert.match(migration, /maintenance_resident_feedback_immutable/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION submit_maintenance_resident_feedback/);
  assert.match(migration, /event\.to_status='completed'/);
  assert.match(migration, /previous\.payload_hash<>target_payload_hash/);
  assert.match(migration, /FROM PUBLIC/);
  const submitFunction = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION submit_maintenance_resident_feedback'),
  );
  assert.ok(submitFunction.indexOf('FOR UPDATE') < submitFunction.indexOf('SELECT * INTO previous'));
  assert.doesNotMatch(submitFunction, /UPDATE maintenance_requests|UPDATE maintenance_resident_feedback/);

  const operations = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(operations, /ops\.post\('\/resident\/maintenance\/:id\/feedback'/);
  assert.match(operations, /submit_maintenance_resident_feedback\(\$1,\$2,\$3,\$4,\$5\)/);
  assert.match(operations, /maintenance_resident_feedback_submitted/);
  assert.match(operations, /latest_completion_event_id/);
  assert.match(operations, /AS resident_feedback/);

  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /resident-maintenance-feedback/);
  assert.match(app, /Confirm completion/);
  assert.match(app, /Report a remaining issue/);
  assert.match(app, /does not reopen work or change charges/);

  const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(serviceWorker, /afrolife-shell-v46/);
});
