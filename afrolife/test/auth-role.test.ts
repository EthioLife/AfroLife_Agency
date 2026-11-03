import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isPlatformAdminRole } from '../src/auth-types.js';
import { adminRouter } from '../src/admin.js';
import { learningRouter } from '../src/learning.js';
import { getRoleActivity, hasRoleActivityAccess, isRoleActivityOverrides, ROLE_ACTIVITIES, ROLE_NAMES } from '../src/role-activities.js';

test('Global Admin and Super Admin share platform-administration classification', () => {
  assert.equal(isPlatformAdminRole('global_admin'), true);
  assert.equal(isPlatformAdminRole('super_admin'), true);
  assert.equal(isPlatformAdminRole('finance'), false);
});

test('Global Admin role migration preserves separate promotion and operational roles', async () => {
  const migration = await readFile(new URL('../migrations/027_global_admin_role.sql', import.meta.url), 'utf8');
  assert.match(migration, /'global_admin','super_admin'/);
  assert.match(migration, /CREATE TABLE global_admin_role_change_requests/);
  assert.match(migration, /approved_by <> requested_by/);
  assert.match(migration, /approved_by <> target_user_id/);
});

test('Global Admin promotion table is accessible to the restricted runtime under admin-only RLS', async () => {
  const migration = await readFile(new URL('../migrations/035_global_admin_runtime_access.sql', import.meta.url), 'utf8');
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /USING \(app_role\(\) = 'super_admin'\)/);
  assert.match(migration, /WITH CHECK \(app_role\(\) = 'super_admin'\)/);
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE ON TABLE global_admin_role_change_requests TO "\{\{role\}\}"/);
});

test('Global Admin promotion routes accept platform-admin roles while the handler enforces eligibility', async () => {
  const routes = adminRouter.stack.flatMap((layer) => layer.route ? [{
    path: layer.route.path,
    methods: layer.route.methods,
    middleware: layer.route.stack.map((entry) => entry.handle),
  }] : []);
  const protectedRoutes = [
    ['/global-admin-promotions', 'get'],
    ['/global-admin-promotions', 'post'],
    ['/global-admin-promotions/:id/approve', 'post'],
    ['/global-admin-promotions/:id/reject', 'post'],
    ['/users/:id/activate', 'post'],
  ] as const;

  for (const [path, method] of protectedRoutes) {
    const route = routes.find((entry) => entry.path === path && entry.methods[method]);
    assert.ok(route, `missing ${method.toUpperCase()} ${path}`);
    for (const role of ['global_admin', 'super_admin']) {
      let denied: unknown;
      route.middleware[0]({ user: { role } }, {}, (error?: unknown) => { denied = error; });
      assert.equal(denied, undefined, `${role} should be allowed on ${path}`);
    }
    for (const role of ['corporate_business_manager', 'compliance', 'finance', 'customer']) {
      let denied: unknown;
      route.middleware[0]({ user: { role } }, {}, (error?: unknown) => { denied = error; });
      assert.equal((denied as { status?: number })?.status, 403, `${role} must be denied on ${path}`);
    }
  }

  const source = await readFile(new URL('../src/admin.ts', import.meta.url), 'utf8');
  assert.match(source, /requested_by === req\.user!\.id \|\| request\.target_user_id === req\.user!\.id/);
  assert.match(source, /isEligiblePlatformAdmin\(eligible\.get\(req\.user!\.id\)\)/);
  assert.match(source, /isEligibleSuperAdmin\(target\)/);
  assert.match(source, /user\?\.active === true && \['super_admin', 'global_admin'\]\.includes\(user\.role\) && user\.mfa_enabled === true/);
});

test('a Super Admin may activate a different Super Admin but not other roles', async () => {
  const routes = adminRouter.stack.flatMap((layer) => layer.route ? [{
    path: layer.route.path,
    methods: layer.route.methods,
    middleware: layer.route.stack.map((entry) => entry.handle),
  }] : []);
  const route = routes.find((entry) => entry.path === '/users/:id/activate' && entry.methods.post);
  assert.ok(route, 'missing account activation route');
  const source = await readFile(new URL('../src/admin.ts', import.meta.url), 'utf8');
  assert.match(source, /req\.user!\.role === 'super_admin' && target\.role !== 'super_admin'/);
  assert.match(source, /target\.created_by === req\.user!\.id/);
  assert.match(source, /\$1::text='super_admin' AND u\.role='super_admin'[\s\S]*?u\.active=false/);

  for (const role of ['global_admin', 'super_admin']) {
    let denied: unknown;
    route.middleware[0]({ user: { role } }, {}, (error?: unknown) => { denied = error; });
    assert.equal(denied, undefined, `${role} should be allowed to reach activation checks`);
  }
  for (const role of ['corporate_business_manager', 'compliance', 'finance', 'customer']) {
    let denied: unknown;
    route.middleware[0]({ user: { role } }, {}, (error?: unknown) => { denied = error; });
    assert.equal((denied as { status?: number })?.status, 403, `${role} must be denied`);
  }
});

test('role activity catalog grants default access and respects explicit overrides', () => {
  const viewLearning = 'learning.content.view';
  const manageLearning = 'learning.content.manage';
  const reconcileRent = 'rent.transactions.reconcile';

  assert.equal(hasRoleActivityAccess('customer', viewLearning), true);
  assert.equal(hasRoleActivityAccess('customer', manageLearning), false);
  assert.equal(hasRoleActivityAccess('global_admin', reconcileRent), true);
  assert.equal(hasRoleActivityAccess('master_agent', 'workforce.workers.register'), true);
  assert.equal(hasRoleActivityAccess('worker', 'workforce.workers.register'), false);

  assert.equal(hasRoleActivityAccess('master_agent', 'workforce.workers.register', { 'workforce.workers.register': false }), false);
  assert.equal(hasRoleActivityAccess('worker', 'workforce.documents.view', { 'workforce.documents.view': true }), true);
  assert.equal(hasRoleActivityAccess('customer', viewLearning, { [viewLearning]: false }), false);

  const definition = getRoleActivity(reconcileRent);
  assert.ok(definition);
  assert.equal(definition?.sensitive, true);
  assert.equal(definition?.label, 'Reconcile transactions to the ledger');
});

test('role activity overrides are validated before use and the catalog stays complete', () => {
  assert.equal(isRoleActivityOverrides({ 'learning.content.view': true }), true);
  assert.equal(isRoleActivityOverrides({ 'learning.content.view': 'yes' }), false);
  assert.equal(isRoleActivityOverrides({ 'not.a.real.activity': true }), false);
  assert.ok(ROLE_ACTIVITIES.some((activity) => activity.key === 'learning.content.view'));
  assert.ok(ROLE_ACTIVITIES.some((activity) => activity.key === 'learning.content.manage'));
  assert.ok(ROLE_ACTIVITIES.some((activity) => activity.key === 'rent.transactions.void'));
});

test('admin and learning routers expose the role-access and content-management endpoints', () => {
  const adminRoutes = adminRouter.stack.flatMap((layer) => (layer.route ? [layer.route.path] : []));
  const learningRoutes = learningRouter.stack.flatMap((layer) => (layer.route ? [layer.route.path] : []));

  assert.ok(adminRoutes.includes('/role-access'));
  assert.ok(learningRoutes.includes('/learning/content'));
  assert.ok(learningRoutes.some((route) => route === '/learning/content/:id'));
});

test('role activity migration hardens the SQL policy layer for service permissions', async () => {
  const migration = await readFile(new URL('../migrations/056_role_activity_access.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE role_activity_permissions/);
  assert.match(migration, /ALTER TABLE role_activity_permissions ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /CREATE POLICY role_activity_permissions_super_admin/);
  assert.match(migration, /CREATE POLICY learning_content_audience_read/);
  assert.match(migration, /CREATE POLICY rent_transactions_activity_reconcile/);
  assert.match(migration, /CREATE TABLE learning_content/);
});

test('SQL role activity defaults match the application catalog and preserve override precedence', async () => {
  const defaultsMigration = await readFile(new URL('../migrations/057_role_activity_defaults.sql', import.meta.url), 'utf8');
  const lifecycleMigration = await readFile(new URL('../migrations/060_lease_lifecycle.sql', import.meta.url), 'utf8');
  const propertyOwnerMaintenanceMigration = await readFile(new URL('../migrations/076_property_owner_maintenance_access.sql', import.meta.url), 'utf8');
  const workforceDefaultsMigration = await readFile(new URL('../migrations/095_workforce_workflows.sql', import.meta.url), 'utf8');
  const maintenanceReviewMigration = await readFile(new URL('../migrations/100_maintenance_completion_review.sql', import.meta.url), 'utf8');
  const propertyVendorLearningMigration = await readFile(new URL('../migrations/111_property_vendor_learning_access.sql', import.meta.url), 'utf8');
  const migration = `${defaultsMigration}\n${lifecycleMigration}\n${propertyOwnerMaintenanceMigration}\n${workforceDefaultsMigration}\n${maintenanceReviewMigration}\n${propertyVendorLearningMigration}`;
  const seededDefaults = new Set(
    [...migration.matchAll(/\(\s*'([a-z_]+)'\s*,\s*'([a-z_.]+)'\s*,\s*true\s*\)/g)]
      .map((match) => `${match[1]}:${match[2]}`),
  );
  let expectedDefaults = 0;
  for (const role of ROLE_NAMES) {
    for (const activity of ROLE_ACTIVITIES) {
      if (!hasRoleActivityAccess(role, activity.key)) continue;
      expectedDefaults += 1;
      assert.ok(seededDefaults.has(`${role}:${activity.key}`), `missing SQL default for ${role}:${activity.key}`);
    }
  }
  assert.equal(seededDefaults.size, expectedDefaults, 'SQL defaults must not grant activities absent from the application catalog');
  assert.match(migration, /CREATE TABLE role_activity_defaults/);
  assert.match(migration, /GRANT SELECT ON TABLE role_activity_defaults TO "\{\{role\}\}"/);
  assert.match(migration, /app\.role_permissions/);
  assert.ok(migration.indexOf('app.role_permissions') < migration.indexOf('FROM role_activity_defaults'));
  assert.match(migration, /CREATE OR REPLACE FUNCTION app_has_permission/);
});
