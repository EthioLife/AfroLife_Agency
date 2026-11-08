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
