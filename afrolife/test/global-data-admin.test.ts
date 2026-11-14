import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adminRouter } from '../src/admin.js';
import {
  EXCLUDED_TENANT_CAPABILITY_ROLES,
  tenantCapabilitiesSchema,
  tenantOperatorRequestSchema,
} from '../src/platform-data-admin.js';
import { getMyTenantDataScopes, getTenantDataScope, requireTenantDataCapability } from '../src/tenant-data-access.js';

const routes = adminRouter.stack.flatMap((layer) => layer.route ? [{
  path: layer.route.path,
  methods: layer.route.methods,
  middleware: layer.route.stack.map((entry) => entry.handle),
  names: layer.route.stack.map((entry) => entry.handle.name),
}] : []);

test('tenant data capability and operator request endpoints are Global Admin-only', () => {
  const protectedPaths = [
    ['/platform/tenant-capabilities', 'get'],
    ['/platform/tenant-capabilities/:tenantId/eligible-users', 'get'],
    ['/platform/tenant-capabilities/:tenantId/:userId', 'put'],
    ['/platform/operator-requests', 'post'],
  ] as const;
  for (const [path, method] of protectedPaths) {
    const route = routes.find((entry) => entry.path === path && entry.methods[method]);
    assert.ok(route, `missing route ${method.toUpperCase()} ${path}`);
    assert.equal(route.names[0], 'requirePlatformControlPlaneAdmin');
    for (const role of ['super_admin', 'master_agent', 'analytics_admin', 'database_admin', 'finance']) {
      let denied: unknown;
      route.middleware[0]({ user: { role } }, {}, (error?: unknown) => { denied = error; });
      assert.equal((denied as { status?: number })?.status, 403, `${role} must not use ${path}`);
    }
    let allowed: unknown;
    route.middleware[0]({ user: { role: 'global_admin' } }, {}, (error?: unknown) => { allowed = error; });
    assert.equal(allowed, undefined);
  }
});

test('capability allowlist and operator request schema reject escalation and executable input', () => {
  assert.deepEqual(EXCLUDED_TENANT_CAPABILITY_ROLES, ['global_admin', 'super_admin', 'master_agent']);
  assert.deepEqual(tenantCapabilitiesSchema.parse(['database_admin', 'analytics_admin']), ['database_admin', 'analytics_admin']);
  assert.deepEqual(tenantCapabilitiesSchema.parse([]), []);
  assert.throws(() => tenantCapabilitiesSchema.parse(['global_admin']));
  assert.throws(() => tenantCapabilitiesSchema.parse(['database_admin', 'database_admin']), /unique/);
  const request = {
    tenant_id: '00000000-0000-4000-8000-000000000001',
    request_type: 'migration_review',
    summary: 'Review the upcoming tenant migration release.',
  };
  assert.deepEqual(tenantOperatorRequestSchema.parse(request), request);
  assert.throws(() => tenantOperatorRequestSchema.omit({ tenant_id: true }).strict().parse({
    request_type: 'migration_review',
    summary: 'Review the upcoming tenant migration release.',
    tenant_id: request.tenant_id,
  }), /Unrecognized key/);
  assert.throws(() => tenantOperatorRequestSchema.parse({ ...request, summary: 'DROP TABLE users' }), /SQL/);
  assert.throws(() => tenantOperatorRequestSchema.parse({ ...request, evidence_reference: 'postgres://user:secret@db' }), /non-secret/);
  assert.throws(() => tenantOperatorRequestSchema.parse({ ...request, unexpected: 'forged tenant context' }));
});

test('tenant capability migration is forced-RLS, append-only audited and excludes privileged roles', async () => {
  const migration = await readFile(new URL('../migrations/094_global_data_admin_control_plane.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE platform_tenant_capability_grants/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /current_setting\('app\.role',true\)='global_admin'/);
  assert.match(migration, /u\.role NOT IN \('super_admin','master_agent','global_admin'\)/);
  assert.match(migration, /u\.active/);
  assert.match(migration, /t\.status='active'/);
  assert.match(migration, /platform_tenant_capability_events_immutable/);
  assert.match(migration, /platform_tenant_capability_grant_audit/);
  assert.match(migration, /AFTER INSERT OR DELETE ON platform_tenant_capability_grants/);
  assert.match(migration, /platform_tenant_operator_requests_immutable/);
  assert.match(migration, /GRANT SELECT,INSERT ON platform_tenant_operator_requests/);
  assert.doesNotMatch(migration, /database_url|connection_string|password text|secret text|tenant_database/i);
  const source = await readFile(new URL('../src/admin.ts', import.meta.url), 'utf8');
  assert.match(source, /SELECT u\.id,u\.role,u\.active,t\.status AS tenant_status[\s\S]*?WHERE u\.id=\$1 AND t\.id=\$2/);
  assert.match(migration, /Only Global Admin may manage tenant capability grants/);
  assert.match(source, /execution: 'not_performed'/);
});

test('Global BI tenant and central database boundaries are explicit', async () => {
  const source = await readFile(new URL('../src/mini-app-access.ts', import.meta.url), 'utf8');
  assert.match(source, /case 'global-bi':\s*return user\.role === 'global_admin'/);
  const service = await readFile(new URL('../services/global-bi/access-control.ts', import.meta.url), 'utf8');
  assert.match(service, /if \(!\['global_admin', 'super_admin'\]\.includes\(role\)\)/);
  const router = await readFile(new URL('../services/global-bi/router.ts', import.meta.url), 'utf8');
  assert.match(router, /summarizeProjectionStatus/);
  const status = await readFile(new URL('../services/global-bi/projection-status.ts', import.meta.url), 'utf8');
  assert.match(status, /projectorConfiguration: 'not_configured'/);
  assert.match(status, /schedulerConfiguration: 'not_configured'/);
  assert.match(status, /tenantProjectorHealth: 'unconfirmed'/);
});

test('self-service tenant data routes are authenticated and capability-scoped to exact tenant', async () => {
  const paths = [
    ['/platform/my-data-capabilities', 'get'],
    ['/platform/my-data/:tenantId/workspace', 'get'],
    ['/platform/my-data/:tenantId/analytics', 'get'],
    ['/platform/my-data/:tenantId/operator-requests', 'post'],
  ] as const;
  for (const [path, method] of paths) {
    assert.ok(routes.some((route) => route.path === path && route.methods[method]), `missing ${method} ${path}`);
  }
  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /api\.use\(authenticate\);[\s\S]*?api\.use\(adminRouter\);/);
  const adminSource = await readFile(new URL('../src/admin.ts', import.meta.url), 'utf8');
  assert.match(adminSource, /getTenantDataScope\(client, req\.user!\.id, tenantId\)/);
  assert.match(adminSource, /requireTenantDataCapability\(scope, 'analytics_admin'\)/);
  assert.match(adminSource, /requireTenantDataCapability\(scope, 'database_admin'\)/);
  const assignedTenant = '00000000-0000-4000-8000-000000000001';
  const otherTenant = '00000000-0000-4000-8000-000000000002';
  const userId = '00000000-0000-4000-8000-000000000003';
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (values?.[1] === assignedTenant) return { rows: [{
        tenant_id: assignedTenant,
        tenant_key: 'tenant-a',
        display_name: 'Tenant A',
        hosting_mode: 'cloud',
        region: 'Addis Ababa',
        deployment_status: 'active',
        config_version: 2,
        tenant_updated_at: new Date('2026-10-20T12:00:00Z'),
        capabilities: ['analytics_admin'],
      }] };
      return { rows: [] };
    },
  } as unknown as import('pg').PoolClient;

  const ownScope = await getTenantDataScope(client, userId, assignedTenant);
  assert.equal(ownScope?.tenant_id, assignedTenant);
  assert.deepEqual(calls[0].values, [userId, assignedTenant, EXCLUDED_TENANT_CAPABILITY_ROLES]);
  assert.match(calls[0].sql, /g\.user_id=\$1 AND g\.tenant_id=\$2/);
  assert.match(calls[0].sql, /t\.status='active'/);
  assert.match(calls[0].sql, /u\.active AND u\.role <> ALL/);
  assert.equal(await getTenantDataScope(client, userId, otherTenant), null, 'forged tenant must have no scope');
  assert.throws(() => requireTenantDataCapability(ownScope!, 'database_admin'), /database admin capability is required/);
  assert.doesNotThrow(() => requireTenantDataCapability(ownScope!, 'analytics_admin'));

  const migration = await readFile(new URL('../migrations/095_platform_tenant_data_self_read.sql', import.meta.url), 'utf8');
  assert.match(migration, /FOR SELECT\s+USING\s*\(\s*user_id = app_user_id\(\)\s+OR current_setting\('app\.role',true\) = 'global_admin'/);
  assert.match(migration, /platform_tenant_operator_requests_assigned_database_admin_create/);
  assert.match(migration, /actor_id = app_user_id\(\)[\s\S]*?g\.tenant_id=platform_tenant_operator_requests\.tenant_id[\s\S]*?g\.capability='database_admin'/);

  const selfCalls: Array<{ sql: string; values?: unknown[] }> = [];
  const selfClient = {
    query: async (sql: string, values?: unknown[]) => {
      selfCalls.push({ sql, values });
      return { rows: [{ tenant_id: assignedTenant, capabilities: ['analytics_admin'] }] };
    },
  } as unknown as import('pg').PoolClient;
  const selfScopes = await getMyTenantDataScopes(selfClient, userId);
  assert.equal(selfScopes.length, 1);
  assert.deepEqual(selfCalls[0].values, [userId, EXCLUDED_TENANT_CAPABILITY_ROLES]);
  assert.match(selfCalls[0].sql, /WHERE g\.user_id=\$1/);
  assert.match(selfCalls[0].sql, /t\.status='active'/);
});

test('tenant data admin UI is assignment-gated and never renders global analytics', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../public/tenant-data-admin.js', import.meta.url), 'utf8');
  assert.match(app, /state\.myDataCapabilities = Array\.isArray\(selfCapabilities\) \? selfCapabilities : \[\]/);
  assert.match(app, /\$\(\'#tenant-data-admin-tab\'\)\.hidden = state\.myDataCapabilities\.length === 0/);
  assert.match(app, /\/platform\/my-data\/\$\{encodeURIComponent\(assigned\.tenant_id\)\}\/analytics/);
  assert.match(ui, /Only this selected tenant is in scope/);
  assert.match(ui, /No tenant analytics are available from the central platform/);
  assert.match(ui, /Global BI and other tenants are not available here/);
  assert.match(ui, /Execution: not performed/);
});
