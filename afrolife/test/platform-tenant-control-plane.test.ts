import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adminRouter } from '../src/admin.js';
import { workspaceModulesForServices } from '../src/runtime-config.js';
import { tenantMigrationEventSchema, tenantMigrationStartSchema } from '../src/platform-data-admin.js';

const routes = adminRouter.stack.flatMap((layer) => (layer.route
  ? [{
    path: layer.route.path,
    methods: layer.route.methods,
    handlers: layer.route.stack.map((entry) => entry.handle.name),
    middleware: layer.route.stack.map((entry) => entry.handle),
  }]
  : []));

test('shared platform control-plane endpoints allow only Global System Admin', () => {
  const paths = [
    '/platform/services',
    '/platform/services/:serviceKey',
    '/platform/service-packages',
    '/platform/service-packages/:packageId',
    '/platform/tenants',
    '/platform/tenants/:tenantId',
    '/platform/tenants/:tenantId/admins',
    '/platform/tenants/:tenantId/admins/:userId',
    '/platform/catalog-products',
    '/platform/catalog-products/:productId',
    '/platform/super-admins',
  ];
  for (const path of paths) {
    const route = routes.find((entry) => entry.path === path);
    assert.ok(route, `missing control-plane route ${path}`);
    assert.equal(route.handlers[0], 'requirePlatformControlPlaneAdmin', `${path} must enforce the explicit platform roles`);
    for (const role of ['global_admin']) {
      let denied: unknown;
      route.middleware[0]({ user: { role } }, {}, (error?: unknown) => { denied = error; });
      assert.equal(denied, undefined, `${role} should be allowed on ${path}`);
    }
    for (const role of ['super_admin', 'corporate_business_manager', 'compliance', 'finance', 'customer']) {
      let denied: unknown;
      route.middleware[0]({ user: { role } }, {}, (error?: unknown) => { denied = error; });
      assert.equal((denied as { status?: number })?.status, 403, `${role} must be denied on ${path}`);
    }
  }
});

test('Super Admin receives only assigned entity module configuration endpoints', () => {
  const route = routes.find((entry) => entry.path === '/platform/my-tenants/:tenantId/modules');
  assert.ok(route, 'missing scoped tenant module configuration route');
  assert.equal(route.handlers[0], '', 'the route must begin with role-scoped middleware');
  const registration = routes.find((entry) => entry.path === '/platform/my-tenants/:tenantId/registration');
  assert.ok(registration, 'missing scoped deployment registration route');
  assert.equal(registration.handlers[0], '', 'the route must begin with role-scoped middleware');
});

test('tenant package services restrict the caller deployment modules without elevation', () => {
  const baseModules = ['leads', 'workers', 'requests', 'learning', 'properties', 'marketplace', 'accounting', 'global-bi'] as const;
  assert.deepEqual(
    workspaceModulesForServices(baseModules, ['agency', 'accounting']),
    ['leads', 'accounting'],
  );
  assert.deepEqual(workspaceModulesForServices(baseModules, []), []);
});

test('tenant control-plane migration stores deployment references, never database credentials', async () => {
  const migration = await readFile(
    new URL('../migrations/070_platform_tenant_control_plane.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE platform_tenants/);
  assert.match(migration, /deployment_reference text/);
  assert.match(migration, /deployment_verification_reference text/);
  assert.doesNotMatch(migration, /database_url|connection_string|password text|secret text/i);
  assert.match(migration, /CHECK \(status <> 'active' OR deployment_status = 'verified'\)/);
  assert.match(migration, /CREATE TABLE platform_tenant_events/);
  assert.match(migration, /CREATE TABLE platform_catalog_product_events/);
  assert.match(migration, /platform_tenant_events_immutable/);
  assert.match(migration, /platform_catalog_product_events_immutable/);
  assert.match(migration, /current_setting\('app\.role', true\) = 'global_admin'/);
});

test('Super Admin configuration stays scoped to assigned tenant modules', async () => {
  const migration = await readFile(
    new URL('../migrations/089_scoped_super_admin_modules.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /platform_services_global_admin/);
  assert.match(migration, /current_setting\('app\.role',true\)='global_admin'/);
  assert.match(migration, /current_setting\('app\.role',true\)='super_admin' AND EXISTS/);
  assert.match(migration, /platform_tenant_module_config/);
  assert.match(migration, /enabled_services text\[\]/);
  for (const policy of [
    'platform_packages_assigned_read',
    'platform_package_items_assigned_read',
    'platform_tenants_assigned_read',
    'platform_tenants_assigned_registration_update',
    'platform_tenant_packages_assigned_read',
    'platform_tenant_events_assigned_insert',
  ]) {
    assert.match(migration, new RegExp(`DROP POLICY IF EXISTS ${policy}`));
  }
  assert.match(migration, /platform_tenant_admins_write ON platform_tenant_admins FOR ALL[\s\S]*?app\.role',true\)='global_admin'/);
  assert.doesNotMatch(migration, /app\.platform_control_plane/);
  assert.match(migration, /platform_services_assigned_read/);
  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /platform_tenant_admins a[\s\S]*?a\.user_id=\$3/);
  assert.match(server, /JOIN platform_tenant_packages tp[\s\S]*?p\.active[\s\S]*?t\.status='active'/);
  assert.match(server, /platform_tenant_module_config[\s\S]*?enabled_services/);
  assert.match(server, /req\.user!\.role === 'super_admin' && req\.query\.platform_tenant_id === undefined/);
});

test('global catalog explicitly excludes regulated financial-product definitions', async () => {
  const migration = await readFile(
    new URL('../migrations/070_platform_tenant_control_plane.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /category IN \('catalog','marketplace','service_addon'\)/);
  assert.doesNotMatch(migration, /category IN \([^)]*(insurance|credit|loan|interest_rate|premium)/i);
});

test('staged tenant migration records require non-secret evidence and guard cutover transitions', async () => {
  const hash = 'a'.repeat(64);
  const start = {
    source_reference: 'approved-source-2026-11',
    target_reference: 'approved-target-2026-11',
    summary: 'Move approved property records to the new tenant deployment.',
    manifest_sha256: hash,
    evidence_reference: 'change-ticket-123',
    notes: 'Approved migration plan and dry-run baseline.',
  };
  assert.equal(tenantMigrationStartSchema.safeParse(start).success, true);
  assert.equal(tenantMigrationStartSchema.safeParse({
    ...start,
    target_reference: start.source_reference,
  }).success, false);
  assert.equal(tenantMigrationStartSchema.safeParse({
    ...start,
    source_reference: 'postgresql://db.example',
  }).success, false);
  assert.equal(tenantMigrationStartSchema.safeParse({
    ...start,
    notes: 'password=do-not-store',
  }).success, false);

  const reconciliation = {
    stage: 'reconciled',
    manifest_sha256: hash,
    source_record_count: 100,
    staged_record_count: 100,
    unresolved_count: 2,
    validation_error_count: 0,
    evidence_reference: 'reconciliation-report-123',
    notes: 'Two rows still require operator review before cutover.',
  };
  assert.equal(tenantMigrationEventSchema.safeParse(reconciliation).success, true);
  assert.equal(tenantMigrationEventSchema.safeParse({
    ...reconciliation,
    source_record_count: -1,
  }).success, false);
  assert.equal(tenantMigrationEventSchema.safeParse({
    ...reconciliation,
    stage: 'cutover_completed',
    manifest_sha256: undefined,
  }).success, false);

  const migration = await readFile(
    new URL('../migrations/126_platform_tenant_migration_evidence.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE platform_tenant_migration_runs/);
  assert.match(migration, /CREATE TABLE platform_tenant_migration_events/);
  assert.match(migration, /guard_platform_tenant_migration_run/);
  assert.match(migration, /guard_platform_tenant_migration_event/);
  assert.match(migration, /Another property-data migration is still active/);
  assert.match(migration, /previous_unresolved=0 AND previous_errors=0/);
  assert.match(migration, /NEW\.actor_id IS DISTINCT FROM run_creator/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /platform_tenant_migration_events_immutable/);

  const admin = await readFile(new URL('../src/admin.ts', import.meta.url), 'utf8');
  assert.match(admin, /platform\/my-data\/:tenantId\/migration-runs/);
  assert.match(admin, /platform\/my-data\/:tenantId\/migration-runs\/:runId\/events/);
  assert.match(admin, /requireTenantDataCapability\(scope, 'database_admin'\)/);
  const workspace = await readFile(new URL('../public/tenant-data-admin.js', import.meta.url), 'utf8');
  assert.match(workspace, /Evidence tracking only: AfroLife does not connect to, move, or modify tenant data/);
  assert.match(workspace, /Resolve dry-run issues and reconcile all records before independent cutover approval/);
});

test('property change requests keep submissions, decisions, and inspections tenant-scoped', async () => {
  const migration = await readFile(
    new URL('../migrations/128_property_arc_requests.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /FOREIGN KEY \(tenant_system_id,property_id\)\s+REFERENCES properties\(tenant_system_id,id\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION submit_property_arc_request/);
  assert.match(migration, /Only an owner or resident with an active relationship to this property may submit a request/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION decide_property_arc_request/);
  assert.match(migration, /requester=actor OR previous_status<>'pending_review'/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION record_property_arc_inspection/);
  assert.match(migration, /app_property_arc_can_inspect/);
  assert.match(migration, /CREATE POLICY property_arc_requests_scoped_read/);
  assert.match(migration, /CREATE POLICY property_arc_events_scoped_read/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /property_arc_events_immutable/);
  assert.match(migration, /evidence_reference !~\* ':\/\/\|password\|secret\|token\|credential'/);

  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /'\/property\/arc-requests'/);
  assert.match(server, /requirePropertyTenantContext/);
  const operations = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(operations, /ops\.get\('\/property\/arc-requests'/);
  assert.match(operations, /submit_property_arc_request\(\$1,\$2,\$3,\$4,\$5\)/);
  assert.match(operations, /decide_property_arc_request\(\$1,\$2,\$3\)/);
  assert.match(operations, /record_property_arc_inspection\(\$1,\$2,\$3\)/);
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /property-arc-request/);
  assert.match(app, /property-arc-decision/);
  assert.match(app, /property-arc-inspection/);
  assert.match(app, /card\(request\.address, request\.summary, request\.status\.replaceAll\('_', ' '\)\)/);
  assert.match(app, /node\('span', request\.request_type\.replaceAll\('_', ' '\)\)/);
  assert.match(app, /node\('span', event\.event_type\.replaceAll\('_', ' '\)\)/);
  assert.match(app, /new Option\(label, value\)/);
  assert.match(app, /does not determine legal compliance, replace permits or other approvals, or claim to establish board quorum/);

  const translations = await readFile(new URL('../public/i18n.js', import.meta.url), 'utf8');
  assert.match(translations, /const propertyArcRows = \[/);
  assert.match(translations, /for \(const \[column, locale\] of Object\.keys\(localeNames\)\.entries\(\)\)/);
  for (const message of [
    'Property change requests',
    'Submit change request',
    'No change requests are recorded for this account or assigned property scope.',
    'Document the reason for this property change decision (at least 10 characters).',
    'Property change request approved and recorded.',
    'Inspection findings recorded in the request history.',
  ]) {
    assert.ok(translations.includes(`['${message}'`), `Missing ARC translation: ${message}`);
  }
});

test('association assessments and receipt decisions stay tenant-scoped and evidence-only', async () => {
  const migration = await readFile(
    new URL('../migrations/129_property_association_assessments.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /FOREIGN KEY \(tenant_system_id,association_id,property_id\)\s+REFERENCES property_association_properties/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION create_property_association\(/);
  assert.match(migration, /member\.tenant_role='tenant_admin'/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION create_property_association_assessment\(/);
  assert.match(migration, /app_property_association_can_manage\(tenant_id\)/);
  assert.match(migration, /SELECT property\.owner_user_id INTO owner_id/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION record_property_association_receipt\(/);
  assert.match(migration, /receipt\.status IN \('pending','reconciled'\)/);
  assert.match(migration, /Receipt references cannot exceed the remaining assessment balance/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION decide_property_association_receipt\(/);
  assert.match(migration, /receipt\.recorded_by=actor OR receipt\.status<>'pending'/);
  assert.match(migration, /reviewed_by<>recorded_by/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION app_property_association_event_can_insert\(/);
  assert.match(migration, /assessment\.owner_user_id=target_actor/);
  assert.match(migration, /receipt\.recorded_by=target_actor/);
  assert.match(migration, /receipt\.reviewed_by=target_actor/);
  assert.match(migration, /app_property_association_event_can_insert\(\s*tenant_system_id,association_id,actor_id,event_type,entity_id,details\s*\)/);
  assert.match(migration, /property_association_events_immutable/);
  assert.match(migration, /details->>'owner_user_id'=app_user_id\(\)::text/);
  assert.match(migration, /CREATE POLICY property_association_assessments_scoped_read/);
  assert.match(migration, /CREATE POLICY property_association_receipts_scoped_read/);
  assert.match(migration, /CREATE POLICY property_association_events_scoped_read/);
  assert.equal((migration.match(/FORCE ROW LEVEL SECURITY/g) ?? []).length, 5);
  assert.match(migration, /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC,"\{\{role\}\}"/);
  assert.doesNotMatch(migration, /INSERT INTO ledger_entries|initiate_payment|payment_processor/i);

  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /'\/property\/associations'/);
  assert.match(server, /'\/property\/association-assessments'/);
  assert.match(server, /'\/property\/association-receipts'/);
  const operations = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(operations, /ops\.get\('\/property\/associations'/);
  assert.match(operations, /ops\.post\('\/property\/associations'/);
  assert.match(operations, /create_property_association\(\$1,\$2::uuid\[\]\)/);
  assert.match(operations, /create_property_association_assessment\(\$1,\$2,\$3,\$4,\$5,\$6,\$7\)/);
  assert.match(operations, /record_property_association_receipt\(\$1,\$2,\$3,\$4\)/);
  assert.match(operations, /decide_property_association_receipt\(\$1,\$2,\$3\)/);
  assert.match(operations, /END AS status,[\s\S]*?AS reconciled_amount/);
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /renderPropertyAssociations\(\)/);
  assert.match(app, /property-assessment-create/);
  assert.match(app, /property-assessment-receipt/);
  assert.match(app, /property-association-receipt-decision/);
  assert.match(app, /assessment\.status\)/);
  assert.match(app, /does not calculate penalties, post ledger entries, initiate payments, or send legal notices/);

  const translations = await readFile(new URL('../public/i18n.js', import.meta.url), 'utf8');
  assert.match(translations, /const propertyAssociationRows = \[/);
  for (const message of [
    'Association assessments',
    'Create association',
    'Record assessment',
    'Submit receipt for reconciliation',
    'Confirm reconciliation',
    'Association receipt reconciled and recorded.',
  ]) {
    assert.ok(translations.includes(`['${message}'`), `Missing association translation: ${message}`);
  }
});

test('association violations require evidence, owner response, and independent human closure', async () => {
  const migration = await readFile(
    new URL('../migrations/130_property_association_violation_evidence.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /FOREIGN KEY \(tenant_system_id,association_id,property_id\)\s+REFERENCES property_association_properties/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION record_property_association_violation\(/);
  assert.match(migration, /app_property_arc_can_inspect\(tenant_id,target_property\)/);
  assert.match(migration, /evidence_reference !~\* ':\/\/\|password\|secret\|token\|credential'/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION submit_property_association_violation_response\(/);
  assert.match(migration, /violation\.owner_user_id<>actor[\s\S]*violation\.status<>'pending_review'/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION decide_property_association_violation\(/);
  assert.match(migration, /actor=violation\.owner_user_id[\s\S]*actor=violation\.reported_by/);
  assert.match(migration, /app_property_agent_can_manage\(tenant_id,violation\.property_id\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION guard_property_association_violation_update\(/);
  assert.match(migration, /Violation reports are immutable; responses and decisions must be appended/);
  assert.match(migration, /property_association_violation_events_immutable/);
  assert.match(migration, /CREATE POLICY property_association_violations_scoped_read/);
  assert.match(migration, /CREATE POLICY property_association_violation_events_scoped_read/);
  assert.match(migration, /CREATE POLICY property_association_violation_events_command_insert/);
  assert.match(migration, /REVOKE ALL ON TABLE property_association_violations,property_association_violation_events\s+FROM PUBLIC,"\{\{role\}\}"/);
  assert.doesNotMatch(migration, /\bfine\b|\bpenalty\b|send_notice|dispatch_notice|legal_compliance/i);

  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /'\/property\/association-violations'/);
  const operations = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(operations, /ops\.post\('\/property\/associations\/:id\/violations'/);
  assert.match(operations, /record_property_association_violation\(\$1,\$2,\$3,\$4,\$5,\$6,\$7\)/);
  assert.match(operations, /ops\.post\('\/property\/association-violations\/:id\/response'/);
  assert.match(operations, /submit_property_association_violation_response\(\$1,\$2,\$3\)/);
  assert.match(operations, /ops\.post\('\/property\/association-violations\/:id\/decision'/);
  assert.match(operations, /decide_property_association_violation\(\$1,\$2,\$3\)/);

  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /property-association-violation'/);
  assert.match(app, /property-association-violation-response/);
  assert.match(app, /property-association-violation-decision/);
  assert.match(app, /'Submit response or resolution evidence'/);
  assert.match(app, /'Verify resolution'/);

  const translations = await readFile(new URL('../public/i18n.js', import.meta.url), 'utf8');
  assert.match(translations, /'Record evidence-based observation'/);
  assert.match(translations, /'Owner response submitted for independent human review\.'/);
  assert.match(translations, /'Resolution evidence verified and recorded\.'/);
});

test('association amenity policies are tenant-scoped, admin-authored, and append-only references', async () => {
  const migration = await readFile(
    new URL('../migrations/131_property_association_amenity_policies.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /FOREIGN KEY \(tenant_system_id,association_id,property_id\)\s+REFERENCES property_association_properties/);
  assert.match(migration, /CREATE TRIGGER property_association_amenity_policies_immutable/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION record_property_association_amenity_policy\(/);
  assert.match(migration, /member\.tenant_role='tenant_admin'/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /lower\(policy\.amenity_name\)=lower\(trim\(target_amenity_name\)\)/);
  assert.match(migration, /CREATE POLICY property_association_amenity_policies_scoped_read/);
  assert.match(migration, /CREATE POLICY property_association_amenity_policies_command_insert/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE property_association_amenity_policies FROM PUBLIC,"\{\{role\}\}"/);
  assert.doesNotMatch(migration, /GRANT (INSERT|UPDATE|DELETE|ALL) ON TABLE property_association_amenity_policies TO "\{\{role\}\}"/);

  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /'\/property\/associations'/);
  const operations = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(operations, /property_association_amenity_policies policy/);
  assert.match(operations, /ops\.post\('\/property\/associations\/:id\/amenity-policies'/);
  assert.match(operations, /record_property_association_amenity_policy\(\$1,\$2,\$3,\$4,\$5\)/);
  assert.match(operations, /status: z\.enum\(\['active','retired'\]\)/);

  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /property-association-amenity-policy/);
  assert.match(app, /These versioned rules are reference text only; bookings and availability conflicts are not automated\./);
  const translations = await readFile(new URL('../public/i18n.js', import.meta.url), 'utf8');
  for (const message of [
    'Association calendar and amenity policies',
    'Calendar and use rules',
    'Record policy version',
    'Association amenity policy version recorded.',
  ]) {
    assert.ok(translations.includes(`['${message}'`), `Missing amenity policy translation: ${message}`);
  }
});

test('recurring association dues cycles create idempotent property assessments without ledger posting', async () => {
  const migration = await readFile(
    new URL('../migrations/132_property_association_dues_cycles.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /cadence_months integer NOT NULL CHECK \(cadence_months IN \(1,3,12\)\)/);
  assert.match(migration, /anchor_period_start date NOT NULL CHECK \(extract\(day FROM anchor_period_start\)=1\)/);
  assert.match(migration, /CREATE TRIGGER property_association_dues_policies_immutable/);
  assert.match(migration, /CREATE TRIGGER property_association_dues_cycles_immutable/);
  assert.match(migration, /CREATE TRIGGER property_association_dues_cycle_items_immutable/);
  assert.match(migration, /UNIQUE \(tenant_system_id,association_id,period_start\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION record_property_association_dues_policy\(/);
  assert.match(migration, /member\.tenant_role='tenant_admin'/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION run_property_association_dues_cycle\(/);
  assert.match(migration, /app_property_association_can_manage\(tenant_id\)/);
  assert.match(migration, /policy_month_delta%policy\.cadence_months<>0/);
  assert.match(migration, /IF FOUND THEN[\s\S]*?RETURN QUERY SELECT new_cycle_id,generated_count,true/);
  assert.match(migration, /existing_due_on<>target_due_on/);
  assert.match(migration, /different due date/);
  assert.match(migration, /property\.owner_user_id/);
  assert.match(migration, /member\.tenant_role='owner'/);
  assert.match(migration, /INSERT INTO property_association_assessments/);
  assert.match(migration, /INSERT INTO property_association_dues_cycle_items/);
  assert.match(migration, /CREATE POLICY property_association_dues_policies_scoped_read/);
  assert.match(migration, /CREATE POLICY property_association_dues_cycles_scoped_read/);
  assert.match(migration, /CREATE POLICY property_association_dues_cycle_items_scoped_read/);
  assert.doesNotMatch(migration, /INSERT INTO ledger_entries|initiate_payment|payment_processor/i);

  const operations = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(operations, /property_association_dues_policies policy/);
  assert.match(operations, /property_association_dues_cycles cycle/);
  assert.match(operations, /ops\.post\('\/property\/associations\/:id\/dues-policies'/);
  assert.match(operations, /record_property_association_dues_policy\(\$1,\$2,\$3,\$4,\$5,\$6,\$7\)/);
  assert.match(operations, /ops\.post\('\/property\/associations\/:id\/dues-cycles'/);
  assert.match(operations, /run_property_association_dues_cycle\(\$1,\$2,\$3\)/);
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /property-association-dues-policy/);
  assert.match(app, /property-association-dues-cycle/);
  assert.match(app, /do not post ledger entries or collect payments/);
  const translations = await readFile(new URL('../public/i18n.js', import.meta.url), 'utf8');
  for (const message of [
    'Recurring dues cycle policies',
    'Create recurring dues policy version',
    'Run dues cycle',
    'Association dues cycle completed.',
    'This association dues cycle already existed; no duplicate assessments were created.',
    'Recurring dues are manually triggered and create assessments only. They do not post ledger entries or collect payments.',
  ]) {
    assert.ok(translations.includes(`['${message}'`), `Missing dues cycle translation: ${message}`);
  }
});

test('association activity reports are bounded, tenant-authorized, audited, and evidence-only', async () => {
  const migration = await readFile(
    new URL('../migrations/133_property_association_report_index.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /ON property_association_assessments\(tenant_system_id,period_start,association_id,property_id\)/);

  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /'\/property\/association-report'/);
  const operations = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(operations, /ops\.get\('\/property\/association-report'/);
  assert.match(operations, /period_start: z\.string\(\)\.date\(\),\s*period_end: z\.string\(\)\.date\(\)/);
  assert.match(operations, /rangeDays\s*>\s*365/);
  assert.match(operations, /app_property_association_can_manage\(tenant\.id\) AS can_generate_report/);
  assert.match(operations, /assessment\.period_start BETWEEN \$1::date AND \$2::date/);
  assert.match(operations, /receipt\.status='reconciled'/);
  assert.match(operations, /receipt\.status='pending'/);
  assert.match(operations, /LIMIT 1001/);
  assert.match(operations, /resultReport\.summary\.property_count\s*>\s*1000/);
  assert.match(operations, /property_association_report_generated/);
  const reportRoute = operations.slice(
    operations.indexOf("ops.get('/property/association-report'"),
    operations.indexOf("ops.post('/property/associations'"),
  );
  assert.doesNotMatch(reportRoute, /deliver_report_securely|send_mail|payment_processor/i);

  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /property-association-report/);
  assert.match(app, /propertyAssociationReport/);
  assert.match(app, /state\.propertyTenantContextId = tenantSystemId \|\| null;\s*state\.propertyAssociationReport = null;/);
  assert.match(app, /if \(state\.propertyTenantContextId !== reportTenantId\) return;/);
  const translations = await readFile(new URL('../public/i18n.js', import.meta.url), 'utf8');
  for (const message of [
    'Association activity report',
    'Generate a scoped assessment report for a date range. Receipt references are evidence only, not ledger or settlement balances.',
    'Reconciled receipt references',
    'Pending receipt references',
    'Association activity report generated for the authorized tenant context.',
  ]) {
    assert.ok(translations.includes(`['${message}'`), `Missing report translation: ${message}`);
  }
});

test('offline move-out inspection drafts are encrypted, tenant-scoped, and idempotent on sync', async () => {
  const migration = await readFile(
    new URL('../migrations/134_property_move_out_inspection_idempotency.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /ADD COLUMN client_submission_id uuid/);
  assert.match(migration, /UNIQUE INDEX lease_move_out_inspection_client_submission_idx/);
  assert.match(migration, /ON lease_move_out_inspections\(lease_id,submitted_by,client_submission_id\)/);

  const operations = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  const routeStart = operations.indexOf("ops.post('/leases/:id/move-out-inspections'");
  const routeEnd = operations.indexOf("ops.post('/leases/:id/move-out-inspections/:inspectionId/decision'", routeStart);
  const route = operations.slice(routeStart, routeEnd);
  assert.match(route, /client_submission_id: z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(route, /WHERE lease_id=\$1 AND submitted_by=\$2 AND client_submission_id=\$3/);
  assert.match(route, /sameSubmission/);
  assert.match(route, /This inspection submission identifier was already used for different data/);
  assert.match(route, /result\.duplicate \? 200 : 201/);

  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /enqueueMoveOutInspectionDraft/);
  assert.match(app, /syncPropertyMoveOutInspectionDrafts/);
  assert.match(app, /draft\.tenant_system_id === state\.propertyTenantContextId/);
  assert.match(app, /client_submission_id: draft\.client_submission_id/);
  assert.match(app, /removeMoveOutInspectionDraft/);
  assert.match(app, /Evidence files must be uploaded separately/);

  const queue = await readFile(new URL('../public/offline-inspection-queue.js', import.meta.url), 'utf8');
  assert.match(queue, /AES-GCM/);
  assert.match(queue, /indexedDB\.open/);
  assert.match(queue, /additionalData: new TextEncoder\(\)\.encode\(userId\)/);
  assert.doesNotMatch(queue, /localStorage/);
});
