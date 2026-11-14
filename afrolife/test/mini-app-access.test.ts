import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Request, Response } from 'express';
import { adminRouter } from '../src/admin.js';
import { hasRoleActivityAccess } from '../src/role-activities.js';
import {
  allowedMiniApps,
  hasMiniAppAccess,
  requireMiniAppAccess,
} from '../src/mini-app-access.js';
import type { AuthUser } from '../src/auth-types.js';

const user = (
  role: string,
  mode: 'role_default' | 'custom' = 'role_default',
  grants: AuthUser['miniAppGrants'] = [],
): AuthUser => ({
  id: '00000000-0000-4000-8000-000000000001',
  role,
  miniAppAccessMode: mode,
  miniAppGrants: grants,
});

test('custom mini-app grants narrow but never elevate role access', () => {
  assert.equal(hasMiniAppAccess(user('finance'), 'accounting'), true);
  assert.equal(hasMiniAppAccess(user('customer'), 'accounting'), false);
  assert.equal(hasMiniAppAccess(user('customer', 'custom', ['accounting']), 'accounting'), true);
  assert.equal(hasMiniAppAccess(user('customer', 'custom', []), 'accounting'), false);
  assert.equal(hasMiniAppAccess(user('finance', 'custom', []), 'accounting'), false);
  assert.equal(hasMiniAppAccess(user('finance', 'custom', ['global-bi']), 'global-bi'), false);
  assert.equal(hasMiniAppAccess(user('global_admin'), 'global-bi'), true);
  assert.equal(hasMiniAppAccess(user('worker', 'custom', ['global-bi']), 'global-bi'), false);
  assert.equal(hasMiniAppAccess(user('super_admin'), 'global-bi'), false);
  assert.equal(hasMiniAppAccess(user('worker'), 'workers'), true);
  assert.equal(hasMiniAppAccess(user('worker', 'custom', []), 'workers'), false);
  assert.equal(hasMiniAppAccess(user('worker', 'custom', ['workers']), 'workers'), true);
});

test('administrator service grants expose only the modules authorized for the selected mode', () => {
  const scopedSuperAdmin = {
    ...user('super_admin'),
    adminRoleModules: ['global-bi', 'accounting'] as AuthUser['adminRoleModules'],
    adminRoleAllTenants: true,
  };
  assert.equal(hasMiniAppAccess(user('super_admin'), 'global-bi'), false);
  assert.equal(hasMiniAppAccess(scopedSuperAdmin, 'global-bi'), true);
  assert.equal(hasMiniAppAccess(scopedSuperAdmin, 'accounting'), true);
  assert.equal(hasMiniAppAccess(scopedSuperAdmin, 'workers'), false);
});

test('lease approvers and executors can reach the property and rent workflow', () => {
  assert.equal(hasMiniAppAccess(user('compliance'), 'rent'), true);
  assert.equal(hasMiniAppAccess(user('corporate_business_manager'), 'rent'), true);
  assert.equal(hasMiniAppAccess(user('field_agent'), 'rent'), false);
});

test('allowed mini-apps intersect role ceiling, deployment modules and user grants', () => {
  assert.deepEqual(
    allowedMiniApps(user('field_agent', 'custom', ['workers', 'requests', 'global-bi']), [
      'workers', 'requests', 'global-bi', 'accounting',
    ]),
    ['workers', 'requests'],
  );
  assert.deepEqual(
    allowedMiniApps(user('customer', 'custom', ['accounting']), ['accounting']),
    ['accounting'],
  );
});

test('worker self-service portal access follows worker identity and custom grants', () => {
  assert.equal(hasMiniAppAccess(user('worker'), 'workers'), true);
  assert.equal(hasMiniAppAccess(user('corporate_business_manager'), 'workers'), true);
  assert.equal(hasMiniAppAccess(user('worker', 'custom', []), 'workers'), false);
  assert.equal(hasMiniAppAccess(user('worker', 'custom', ['workers']), 'workers'), true);
});

test('property-vendor accounts are restricted to the properties mini-app', () => {
  assert.deepEqual(allowedMiniApps(user('property_vendor')), ['properties']);
  assert.equal(hasMiniAppAccess(user('property_vendor'), 'properties'), true);
  assert.equal(hasMiniAppAccess(user('property_vendor', 'custom', []), 'properties'), false);
  assert.equal(hasMiniAppAccess(user('property_vendor', 'custom', ['properties']), 'properties'), true);
  assert.equal(hasMiniAppAccess(user('property_vendor', 'custom', ['workers']), 'workers'), false);
});

test('workforce activity roles include the manager portal and protect worker-only actions', () => {
  assert.equal(hasRoleActivityAccess('corporate_business_manager', 'workforce.workers.view'), true);
  assert.equal(hasRoleActivityAccess('corporate_business_manager', 'workforce.shifts.manage'), true);
  assert.equal(hasRoleActivityAccess('finance_manager', 'workforce.payroll.export'), true);
  assert.equal(hasRoleActivityAccess('worker', 'workforce.payroll.export'), false);
  assert.equal(hasRoleActivityAccess('worker', 'workforce.workers.offboard'), false);
});

test('API middleware denies direct access when a custom assignment excludes the app', () => {
  const req = { user: user('finance', 'custom', []) } as Request;
  const res = {} as Response;
  let denied: unknown;
  requireMiniAppAccess('accounting')(req, res, (error?: unknown) => { denied = error; });
  assert.equal((denied as { status?: number }).status, 403);
});

test('mini-app access administration is exposed only through platform-admin handlers', () => {
  const routes = adminRouter.stack.flatMap((layer) => layer.route ? [{
    path: layer.route.path,
    methods: layer.route.methods,
  }] : []);
  assert.ok(routes.some((route) => route.path === '/users/:id/mini-app-access' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/users/:id/mini-app-access' && route.methods.put));
  assert.ok(routes.some((route) => route.path === '/users/:id/admin-access' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/users/:id/admin-access' && route.methods.put));
  assert.ok(routes.some((route) => route.path === '/auth/access-role' && route.methods.post));
  const accessHandlers = routes.filter((route) => route.path === '/users/:id/mini-app-access');
  assert.equal(accessHandlers.length, 2);
});

test('mini-app assignment storage is RLS-protected and its audit is append-only', async () => {
  const migration = await readFile(new URL('../migrations/080_user_mini_app_access.sql', import.meta.url), 'utf8');
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /user_app_access_profiles_platform_admin_write/);
  assert.match(migration, /user_app_access_grants_platform_admin_write/);
  assert.match(migration, /prevent_user_app_access_audit_mutation/);
  assert.match(migration, /GRANT SELECT, INSERT ON TABLE user_app_access_audit/);
});

test('worker self-service tables and participant access are protected by RLS', async () => {
  const migration = await readFile(new URL('../migrations/094_worker_self_service_portal.sql', import.meta.url), 'utf8');
  const serviceBoundary = await readFile(new URL('../migrations/142_worker_self_service_rls_service_boundary.sql', import.meta.url), 'utf8');
  const staffing = await readFile(new URL('../src/staffing-accounting.ts', import.meta.url), 'utf8');
  assert.match(migration, /workforce_worker_self_read/);
  assert.match(migration, /staffing_engagement_worker_client_read/);
  assert.match(migration, /staffing_work_period_worker_submit/);
  assert.match(migration, /staffing_settlement_worker_read/);
  assert.match(migration, /worker_support_requests_owner_read/);
  assert.match(migration, /worker_support_requests_support_update/);
  assert.match(serviceBoundary, /CREATE OR REPLACE FUNCTION app_worker_owns_phone\(target_phone text\)[\s\S]*SECURITY DEFINER/);
  assert.match(serviceBoundary, /SET row_security = off/);
  assert.match(serviceBoundary, /REVOKE ALL ON FUNCTION app_worker_owns_phone\(text\) FROM PUBLIC/);
  assert.match(serviceBoundary, /app_worker_owns_phone\(w\.phone\)/);
  assert.match(staffing, /staffing-settlements\/mine/);
  assert.match(staffing, /w\.phone=u\.phone AND s\.kind='worker_payment'/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
});
