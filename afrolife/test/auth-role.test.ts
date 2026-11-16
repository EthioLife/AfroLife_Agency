import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { canAccessAdminPortal, isPlatformAdminRole, requiresMfaEnrollment, requiresMfaForRoles } from '../src/auth-types.js';
import { adminRouter, loginRouter } from '../src/admin.js';
import { requireRole } from '../src/core.js';
import {
  getFaydaVerificationStatus,
  getSmsRecoveryStatus,
  getWebAuthnConfiguration,
  getWebAuthnStatus,
  getWhatsAppRecoveryStatus,
} from '../src/auth-integrations.js';
import { learningRouter } from '../src/learning.js';
import { getRoleActivity, hasRoleActivityAccess, isRoleActivityOverrides, ROLE_ACTIVITIES, ROLE_NAMES } from '../src/role-activities.js';
import {
  clearTrustedDeviceCookie,
  createTrustedDeviceToken,
  hashTrustedDeviceToken,
  readTrustedDeviceToken,
  TRUSTED_DEVICE_COOKIE,
  TRUSTED_DEVICE_MAX_AGE_SECONDS,
  trustedDeviceCookie,
} from '../src/trusted-devices.js';

test('trusted-device cookies use opaque tokens and strict host-only security flags', () => {
  const token = createTrustedDeviceToken();
  const cookie = trustedDeviceCookie(token);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(hashTrustedDeviceToken(token).length, 32);
  assert.equal(readTrustedDeviceToken(`${TRUSTED_DEVICE_COOKIE}=${token}`), token);
  assert.equal(readTrustedDeviceToken(`${TRUSTED_DEVICE_COOKIE}=bad; ${TRUSTED_DEVICE_COOKIE}=${token}`), undefined);
  assert.equal(readTrustedDeviceToken(`${TRUSTED_DEVICE_COOKIE}=invalid!`), undefined);
  assert.ok(cookie.includes(`Max-Age=${TRUSTED_DEVICE_MAX_AGE_SECONDS}`));
  assert.match(cookie, /; Path=\/; .*HttpOnly; Secure; SameSite=Strict$/);
  assert.match(clearTrustedDeviceCookie(), /Max-Age=0; Expires=/);
  assert.doesNotMatch(cookie, /Domain=/i);
});

test('trusted-device migration stores only token hashes and enforces row security', async () => {
  const migration = await readFile(new URL('../migrations/140_auth_trusted_devices.sql', import.meta.url), 'utf8');
  assert.match(migration, /token_hash bytea NOT NULL UNIQUE CHECK \(octet_length\(token_hash\) = 32\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /user_id = app_user_id\(\)/);
  assert.match(migration, /app_role\(\) IN \('global_admin','super_admin'\)/);
  assert.doesNotMatch(migration, /\btoken\s+text\b/i);
  const routes = adminRouter.stack.flatMap((layer) => layer.route ? [layer.route] : []);
  assert.ok(routes.some((route) => route.path === '/auth/trusted-devices' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/auth/trusted-devices/:deviceId' && route.methods.delete));
});

test('Global Admin and Super Admin share platform-administration classification', () => {
  assert.equal(isPlatformAdminRole('global_admin'), true);
  assert.equal(isPlatformAdminRole('super_admin'), true);
  assert.equal(isPlatformAdminRole('finance'), false);
});

test('Global Admin may use Super Admin routes, but not vice versa', () => {
  const allow = (role: string, ...needed: string[]) => {
    let denied: unknown;
    const middleware = requireRole(...needed);
    middleware({ user: { role } } as any, {} as any, (error?: unknown) => { denied = error; });
    return denied;
  };

  assert.equal(allow('global_admin', 'super_admin'), undefined);
  assert.equal((allow('super_admin', 'global_admin') as { status?: number })?.status, 403);
  assert.equal(allow('global_admin', 'global_admin'), undefined);
  assert.equal(allow('super_admin', 'super_admin'), undefined);
  assert.equal((allow('finance', 'global_admin') as { status?: number })?.status, 403);
  assert.equal((allow('finance', 'super_admin') as { status?: number })?.status, 403);
});

test('administrative roles always require MFA while regular accounts remain optional', () => {
  for (const role of ['global_admin', 'super_admin', 'compliance', 'finance', 'finance_manager', 'corporate_business_manager']) {
    assert.equal(requiresMfaEnrollment(role), true, `${role} must enroll in MFA`);
  }
  for (const role of ['customer', 'worker', 'property_owner', 'master_agent', 'field_agent']) {
    assert.equal(requiresMfaEnrollment(role), false, `${role} keeps optional MFA`);
  }
  assert.equal(requiresMfaForRoles(['customer', 'worker']), false);
  assert.equal(requiresMfaForRoles(['customer', 'super_admin']), true);
});

test('accounts with an administrative role grant cannot disable mandatory MFA', async () => {
  const source = await readFile(new URL('../src/admin.ts', import.meta.url), 'utf8');
  assert.match(source, /SELECT role_name FROM user_admin_role_grants WHERE user_id=\$1/);
  assert.match(source, /requiresMfaForRoles\(\[u\.role, \.\.\.grants\.rows\.map/);
  assert.match(source, /mfa_required: requiresMfaForRoles\(req\.user!\.accessOptions/);
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /state\.user\.mfa_required \?\? REQUIRED_MFA_ROLES\.has\(state\.user\.role\)/);
});

test('Admin/Staff portal access requires an assigned staff or administrator role', () => {
  assert.equal(canAccessAdminPortal(['customer']), false);
  assert.equal(canAccessAdminPortal(['customer', 'global_admin']), true);
  assert.equal(canAccessAdminPortal(['corporate_business_manager']), true);
  assert.equal(canAccessAdminPortal(['worker', 'field_agent']), false);
});

test('SMS recovery and Fayda remain unavailable even when feature flags are requested', () => {
  assert.equal(getSmsRecoveryStatus({ SMS_RECOVERY_ENABLED: '1' }).enabled, false);
  assert.equal(getSmsRecoveryStatus({ SMS_RECOVERY_ENABLED: '1' }).status, 'unavailable');
  assert.equal(getWhatsAppRecoveryStatus({ WHATSAPP_RECOVERY_ENABLED: '1' }).enabled, false);
  assert.equal(getFaydaVerificationStatus({ FAYDA_VERIFICATION_ENABLED: '1' }).enabled, false);
  assert.equal(getFaydaVerificationStatus({ FAYDA_VERIFICATION_ENABLED: '1' }).status, 'unavailable');
  assert.equal(getFaydaVerificationStatus({ FAYDA_VERIFICATION_ENABLED: '0' }).status, 'disabled');
});

test('WebAuthn registration is disabled by default and requires an explicit secure matching origin', () => {
  assert.equal(getWebAuthnConfiguration({}), null);
  assert.equal(getWebAuthnStatus({}).enabled, false);
  assert.equal(getWebAuthnConfiguration({ WEBAUTHN_ORIGIN: 'http://example.com', WEBAUTHN_RP_ID: 'example.com' }), null);
  assert.equal(getWebAuthnConfiguration({ WEBAUTHN_ORIGIN: 'https://app.example.com', WEBAUTHN_RP_ID: 'other.com' }), null);
  assert.equal(getWebAuthnConfiguration({ WEBAUTHN_ORIGIN: 'https://app.example.com', WEBAUTHN_RP_ID: 'example.com' }), null);
  assert.equal(getWebAuthnConfiguration({ WEBAUTHN_ORIGIN: 'https://app.example.com/login', WEBAUTHN_RP_ID: 'app.example.com' }), null);
  assert.deepEqual(getWebAuthnConfiguration({
    WEBAUTHN_ORIGIN: 'https://app.example.com',
    WEBAUTHN_RP_ID: 'app.example.com',
    WEBAUTHN_RP_NAME: 'AfroSherik',
  }), { origin: 'https://app.example.com', rpID: 'app.example.com', rpName: 'AfroSherik' });
  assert.equal(getWebAuthnConfiguration({ WEBAUTHN_ORIGIN: 'http://localhost:3010', WEBAUTHN_RP_ID: 'localhost' })?.origin,
    'http://localhost:3010');
});

test('public auth keeps international phone selection and clearly labels unavailable recovery, Fayda, and passkeys', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  for (const id of ['login-form', 'recovery-form', 'signup-form']) {
    const form = html.match(new RegExp(`<form id="${id}"[\\s\\S]*?<\\/form>`))?.[0];
    assert.ok(form, `missing ${id}`);
    assert.match(form, /name="phone_country_code"[^>]*value="\+251"/);
    assert.match(form, /list="phone-calling-codes"/);
  }
  assert.match(html, /WhatsApp recovery is available only after delivery is configured/);
  assert.match(html, /Fayda verification is unavailable[^<]*manual|Use secure document review instead; this is not live Fayda verification/);
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /passkey\.disabled = !passkeyState\.enabled \|\| !browserSupportsPasskeys/);
  assert.match(app, /Passkey registration is unavailable until secure server-side WebAuthn verification is configured/);
  assert.match(app, /navigator\.credentials\.create/);
  assert.match(app, /serializePasskeyRegistration\(credential\)/);
});

test('passkey endpoints verify session-bound WebAuthn challenges and never return credential material', async () => {
  const routes = adminRouter.stack.flatMap((layer) => layer.route ? [layer.route] : []);
  for (const [path, method] of [
    ['/auth/passkeys', 'get'],
    ['/auth/passkeys/registration/options', 'post'],
    ['/auth/passkeys/registration/verify', 'post'],
    ['/auth/passkeys/:id', 'delete'],
  ] as const) {
    assert.ok(routes.some((route) => route.path === path && route.methods[method]), `missing ${method} ${path}`);
  }
  const source = await readFile(new URL('../src/admin.ts', import.meta.url), 'utf8');
  assert.match(source, /expectedChallenge: challenge\.challenge/);
  assert.match(source, /expectedOrigin: config\.origin/);
  assert.match(source, /expectedRPID: config\.rpID/);
  assert.match(source, /requireUserVerification: true/);
  assert.match(source, /authenticatorAttachment: 'platform'/);
  assert.match(source, /residentKey: 'required'/);
  assert.match(source, /session_id=\$2 AND consumed_at IS NULL AND expires_at>now\(\)/);
  const migrationName = '149_auth_passkeys.sql';
  const migrations = await readdir(new URL('../migrations/', import.meta.url));
  const migrationNumber = migrationName.match(/^\d+/)?.[0];
  assert.ok(migrationNumber);
  assert.equal(migrations.filter((name) => name.startsWith(`${migrationNumber}_`)).length, 1);
  const migration = await readFile(new URL(`../migrations/${migrationName}`, import.meta.url), 'utf8');
  assert.match(migration, /auth_passkey_credentials ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /auth_passkey_credentials_self/);
  assert.match(migration, /auth_passkey_registration_challenges ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /session_id uuid NOT NULL REFERENCES auth_sessions\(id\) ON DELETE CASCADE/);
  assert.match(migration, /expires_at <= created_at \+ interval '5 minutes'/);
  assert.doesNotMatch(source.match(/adminRouter\.get\('\/auth\/passkeys'[\s\S]*?\n\}\)\);/)?.[0] ?? '', /credential_id|public_key/);
});

test('password recovery migration stores only hash material and limits challenges', async () => {
  const migration = await readFile(new URL('../migrations/106_auth_password_recovery_challenges.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE auth_password_recovery_challenges/);
  assert.match(migration, /code_hash bytea NOT NULL CHECK \(octet_length\(code_hash\) = 32\)/);
  assert.match(migration, /failed_attempts integer NOT NULL DEFAULT 0 CHECK \(failed_attempts BETWEEN 0 AND 5\)/);
  assert.match(migration, /expires_at <= created_at \+ interval '5 minutes'/);
  assert.ok(migration.includes("phone ~ '^\\+[1-9][0-9]{7,14}$'"));
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth_password_recovery_challenges TO "\{\{role\}\}"/);
  assert.doesNotMatch(migration, /\b(?:otp|code|token)\s+text\b/i);
});

test('password recovery endpoints return no-store 503 without revealing accounts when WhatsApp is unavailable', async () => {
  const invoke = (path: string, body: Record<string, string>) => new Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
  }>((resolve, reject) => {
    const route = loginRouter.stack.find((layer) => layer.route?.path === path)?.route;
    assert.ok(route, `missing route ${path}`);
    const response = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      setHeader(name: string, value: string) { this.headers[name.toLowerCase()] = value; return this; },
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; resolve(this); return this; },
    };
    let index = 0;
    const next = (error?: unknown) => {
      if (error) return reject(error);
      const layer = route.stack[index++];
      if (layer) layer.handle({ body } as never, response as never, next);
      else reject(new Error('route ended without a response'));
    };
    next();
  });
  const request = await invoke('/auth/password-recovery/request', {
    phone_country_code: '+251',
    phone_national_number: '708076113',
  });
  const complete = await invoke('/auth/password-recovery/complete', {
    phone_country_code: '+251',
    phone_national_number: '708076113',
    code: '123456',
    next: 'A new password',
  });
  assert.equal(request.statusCode, 503);
  assert.equal(request.headers['cache-control'], 'no-store');
  assert.deepEqual(complete.body, request.body);
  assert.match((request.body as { error: string }).error, /delivery is not configured/);
  assert.doesNotMatch(JSON.stringify([request.body, complete.body]), /\b\d{6}\b|reset.?token/i);
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

test('Global Admin promotions require distinct active MFA-enabled Super Admins', async () => {
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
    const promotionRoute = path.startsWith('/global-admin-promotions');
    for (const role of (promotionRoute ? ['super_admin'] : ['global_admin', 'super_admin'])) {
      let denied: unknown;
      route.middleware[0]({ user: { role } }, {}, (error?: unknown) => { denied = error; });
      assert.equal(denied, undefined, `${role} should be allowed on ${path}`);
    }
    for (const role of (promotionRoute
      ? ['global_admin', 'corporate_business_manager', 'compliance', 'finance', 'customer']
      : ['corporate_business_manager', 'compliance', 'finance', 'customer'])) {
      let denied: unknown;
      route.middleware[0]({ user: { role } }, {}, (error?: unknown) => { denied = error; });
      assert.equal((denied as { status?: number })?.status, 403, `${role} must be denied on ${path}`);
    }
  }

  const source = await readFile(new URL('../src/admin.ts', import.meta.url), 'utf8');
  assert.match(source, /requested_by === req\.user!\.id \|\| request\.target_user_id === req\.user!\.id/);
  assert.match(source, /isEligibleSuperAdmin\(eligible\.get\(req\.user!\.id\)\)/);
  assert.match(source, /isEligibleSuperAdmin\(eligible\.get\(request\.requested_by\)\)/);
  assert.match(source, /isEligibleSuperAdmin\(target\)/);
  assert.match(source, /user\?\.active === true && user\.role === 'super_admin' && user\.mfa_enabled === true/);
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /state\.user\.role === 'super_admin' \? safeGet\('\/global-admin-promotions'/);
  assert.match(app, /if \(state\.user\.role === 'super_admin'\) wrap\.append\(renderGlobalAdminPromotions\(\)\)/);
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
  assert.equal(hasRoleActivityAccess('field_agent', 'property.tenancy.manage'), false);
  assert.equal(hasRoleActivityAccess('field_agent', 'rent.payments.submit'), false);

  assert.equal(hasRoleActivityAccess('master_agent', 'workforce.workers.register', { 'workforce.workers.register': false }), false);
  assert.equal(hasRoleActivityAccess('worker', 'workforce.documents.view', { 'workforce.documents.view': true }), true);
  assert.equal(hasRoleActivityAccess('customer', viewLearning, { [viewLearning]: false }), false);
  assert.equal(hasRoleActivityAccess('field_agent', 'property.tenancy.manage', { 'property.tenancy.manage': true }), false);
  assert.equal(hasRoleActivityAccess('field_agent', 'rent.payments.submit', { 'rent.payments.submit': true }), false);

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
  const fieldAgentRestrictionMigration = await readFile(new URL('../migrations/146_field_agent_tenant_finance_activity_restriction.sql', import.meta.url), 'utf8');
  const migration = `${defaultsMigration}\n${lifecycleMigration}\n${propertyOwnerMaintenanceMigration}\n${workforceDefaultsMigration}\n${maintenanceReviewMigration}\n${propertyVendorLearningMigration}\n${fieldAgentRestrictionMigration}`;
  const seededDefaults = new Set(
    [...migration.matchAll(/\(\s*'([a-z_]+)'\s*,\s*'([a-z_.]+)'\s*,\s*true\s*\)/g)]
      .map((match) => `${match[1]}:${match[2]}`),
  );
  seededDefaults.delete('field_agent:property.tenancy.manage');
  seededDefaults.delete('field_agent:rent.payments.submit');
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
