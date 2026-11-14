import './env.js';
import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import helmet from 'helmet';
import { z } from 'zod';
import { pool, withUser, authenticate, requireRole, HttpError, JWT_SECRET, assertRuntimeDatabaseSafety } from './core.js';
import { loadRuntimeConfig, workspaceModulesForServices } from './runtime-config.js';
import { apiMetricsMiddleware, checkWorkspaceServices, createWorkspaceServiceStatusCache, flushApiMetrics, readPersistedApiMetrics, startApiMetricsPersistence, type ServiceProbe } from './workspace-status.js';
import { createApiRateLimiter } from './rate-limit-store.js';
import { audit } from './domain.js';
import { supply } from './supply.js';
import { createMfiRouter } from './mfi.js';
import { createInsuranceLedgerRouter } from './insurance-ledger.js';
import { createInsuranceRequestsRouter } from './insurance-requests.js';
import { createInsuranceBrokerageSandboxRouter, isInsuranceBrokerageSandboxEnabled } from './insurance-brokerage-sandbox.js';
import { createAccountingServiceGateway, createInsuranceRequestsServiceGateway, createInsuranceServiceGateway, createMfiServiceGateway, createPublicServiceGateway, createServiceGateway } from './insurance-service-gateway.js';
import { loginRouter, adminRouter } from './admin.js';
import { ops } from './ops.js';
import { learningRouter } from './learning.js';
import { privacy } from './privacy.js';
import { paymentWebhook } from './webhooks.js';
import { dispatchOnce } from './dispatch.js';
import { dispatchMaintenanceSlaEscalations } from './maintenance-sla.js';
import { dispatchAccountingEvents } from './accounting-outbox.js';
import { checkPrivateStorage } from './storage.js';
import { correlationIdMiddleware, getCorrelationId } from './request-context.js';
import { allowedMiniApps, hasMiniAppAccess, requireAnyMiniAppAccess, requireMiniAppAccess } from './mini-app-access.js';
import { getPublicSubscriptionCatalog, subscriptionRouter } from './subscriptions.js';
import { createIndustryNewsProvider, INDUSTRY_NEWS_REFRESH_INTERVAL_MS, startIndustryNewsRefreshSchedule } from './industry-news.js';
import { assessMigrationReadiness, migrationChecksum } from './migration-checksums.js';
import { createAgencyOperationsRouter } from './agency-operations.js';

const app = express();
app.use(correlationIdMiddleware);
if (JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be set (32+ chars)');
const runtimeConfig = loadRuntimeConfig(process.env);
const getWorkspaceServiceStatus = createWorkspaceServiceStatusCache();
const workspaceServiceProbes = (): ServiceProbe[] => [
  { id: 'core', name: 'AfroLife core', enabled: true, withoutUrl: 'integrated' },
  {
    id: 'workforce-management',
    name: 'Workforce Management',
    enabled: true,
    url: process.env.WORKFORCE_MANAGEMENT_SERVICE_URL ?? process.env.WORKER_MANAGEMENT_SERVICE_URL,
    withoutUrl: 'integrated',
  },
  { id: 'staffing', name: 'Staffing', enabled: true, url: process.env.STAFFING_SERVICE_URL, withoutUrl: 'integrated' },
  { id: 'property-management', name: 'Property Management', enabled: true, url: process.env.PROPERTY_MANAGEMENT_SERVICE_URL, withoutUrl: 'integrated' },
  { id: 'marketplace', name: 'Marketplace', enabled: true, url: process.env.MARKETPLACE_SERVICE_URL, withoutUrl: 'integrated' },
  { id: 'edir', name: 'AfroLife Edir', enabled: Boolean(process.env.EDIR_SERVICE_URL), url: process.env.EDIR_SERVICE_URL, withoutUrl: 'disabled' },
  { id: 'accounting-internal', name: 'Internal Accounting & Finance', enabled: Boolean(process.env.ACCOUNTING_SERVICE_URL), url: process.env.ACCOUNTING_SERVICE_URL, withoutUrl: 'disabled' },
  { id: 'accounting-subscriber', name: 'Subscriber Accounting & Finance', enabled: Boolean(process.env.ACCOUNTING_SUBSCRIBER_SERVICE_URL), url: process.env.ACCOUNTING_SUBSCRIBER_SERVICE_URL, withoutUrl: 'disabled' },
  { id: 'global-bi', name: 'Global BI', enabled: Boolean(process.env.GLOBAL_BI_SERVICE_URL), url: process.env.GLOBAL_BI_SERVICE_URL, withoutUrl: 'disabled' },
  { id: 'insurance', name: 'Insurance ledger', enabled: Boolean(process.env.INSURANCE_SERVICE_URL), url: process.env.INSURANCE_SERVICE_URL, withoutUrl: runtimeConfig.isProduction ? 'disabled' : 'integrated' },
  { id: 'mfi', name: 'SACCO / MFI', enabled: runtimeConfig.mfiPilotEnabled, url: process.env.MFI_SERVICE_URL, withoutUrl: 'disabled' },
];
const migrationDirectory = new URL('../migrations/', import.meta.url);
const expectedMigrations = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => ({
    name,
    checksum: migrationChecksum(readFileSync(new URL(name, migrationDirectory), 'utf8')),
  }));
const corsOrigins = new Set((process.env.CORS_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean));
// Behind a load balancer / reverse proxy every request looks like the same IP unless this is set, which makes the login rate limit hit everyone at once.
// TRUST_PROXY=1 (number of proxy hops) or a subnet list; leave unset when the API is exposed directly.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
// In development over http://localhost, the default "upgrade-insecure-requests" rule breaks asset loading in some browsers.
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: {
  'connect-src': ["'self'", ...corsOrigins],
  ...(process.env.NODE_ENV === 'production' ? {} : { 'upgrade-insecure-requests': null }),
} } }));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && corsOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-AfroLife-Edir-Id, X-AfroLife-Correlation-Id, X-AfroLife-Property-Tenant-Id, X-AfroLife-Property-Tenant-Purpose');
    res.setHeader('Access-Control-Expose-Headers', 'X-AfroLife-Correlation-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin && !corsOrigins.has(origin) ? 403 : 204);
  next();
});
if (!process.env.PAYMENT_WEBHOOK_SECRET) console.warn('PAYMENT_WEBHOOK_SECRET is not set: /webhooks/payments is disabled');
if (process.env.PAYMENT_WEBHOOK_SECRET) app.post('/webhooks/payments', express.raw({ type: 'application/json', limit: '100kb' }), paymentWebhook(process.env.PAYMENT_WEBHOOK_SECRET));
app.use(express.json({ limit: '100kb' }));
app.get('/healthz', (_req, res, next) => {
  pool.query('SELECT 1').then(
    () => res.json({ ok: true, database: 'connected' }),
    next,
  );
}); // compatibility probe for database connectivity; use /readyz for full readiness
app.get('/livez', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true });
});
app.get('/readyz', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const checks: Record<string, unknown> = {
    database: 'unavailable',
    migrations: {
      current: false,
      applied: 0,
      expected: expectedMigrations.length,
      checksumMismatches: 0,
      checksumsUnverified: 0,
      unexpectedMigrations: 0,
    },
    private_storage: 'unavailable',
    services: [],
  };
  let ready = true;
  try {
    await pool.query('SELECT 1');
    checks.database = 'connected';
  } catch {
    ready = false;
  }
  try {
    const appliedRows = await pool.query<{ name: string; checksum: string | null }>(
      'SELECT name, checksum FROM schema_migrations',
    );
    const migrationReadiness = assessMigrationReadiness(expectedMigrations, appliedRows.rows);
    checks.migrations = migrationReadiness;
    if (!migrationReadiness.current) ready = false;
  } catch {
    checks.migrations = {
      current: false,
      applied: 0,
      expected: expectedMigrations.length,
      checksumMismatches: 0,
      checksumsUnverified: 0,
      unexpectedMigrations: 0,
    };
    ready = false;
  }
  try {
    await checkPrivateStorage();
    checks.private_storage = 'available';
  } catch (error) {
    console.error(
      'Private storage readiness check failed:',
      error instanceof Error ? error.message : 'Unknown storage error',
    );
    ready = false;
  }
  const services = await checkWorkspaceServices(workspaceServiceProbes());
  checks.services = services.map(({ id, status, latency_ms }) => ({ id, status, latency_ms }));
  if (services.some((service) => service.status === 'unavailable')) ready = false;
  res.status(ready ? 200 : 503).json({ ok: ready, checks });
});
// Resolve assets from source during development or from the project root after compilation.
const staticDirs = ['../../public', '../public', '../../web']
  .map((dir) => fileURLToPath(new URL(dir, import.meta.url)))
  .filter((dir) => existsSync(dir));
if (!staticDirs.length) throw new Error('Web assets were not found; expected a public/ or web/ directory');
for (const dir of staticDirs) app.use(express.static(dir));

const h = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler => (req, res, next) => { fn(req, res).catch(next); };
const industryNewsProvider = createIndustryNewsProvider();
const stopIndustryNewsRefresh = startIndustryNewsRefreshSchedule(industryNewsProvider);
app.get('/api/public/industry-news', h(async (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(await industryNewsProvider.getLatest());
}));
const AGENT = ['master_agent', 'field_agent'];
const api = express.Router();
api.use(apiMetricsMiddleware);

// ---- Auth (lockout, mandatory administrative MFA, and recovery boundary live in admin.ts) ----
api.post('/auth/login', createApiRateLimiter('login', Number(process.env.LOGIN_RATE_LIMIT ?? 20)));
api.post('/auth/signup', createApiRateLimiter('signup', 5));
api.post('/auth/password-recovery/request', createApiRateLimiter('password-recovery', 5));
api.post('/auth/password-recovery/complete', createApiRateLimiter('password-recovery-complete', 5));
api.use(loginRouter);
api.post('/edir/public/registration-applications', createApiRateLimiter('edir-registration', 5));
api.post('/edir/public/registration-applications', process.env.EDIR_SERVICE_URL
  ? createPublicServiceGateway({
    baseUrl: process.env.EDIR_SERVICE_URL,
    secret: process.env.EDIR_GATEWAY_SECRET ?? '',
    servicePath: '/api/v1/edir',
    serviceName: 'AfroLife Edir registration',
    allowInternalHttpHost: process.env.EDIR_PUBLIC_GATEWAY_HTTP_HOST,
  })
  : (_req, res) => res.status(503).json({ error: 'AfroLife Edir service is not configured' }));
api.post(
  '/edir/public/registration-applications/:applicationId/documents/:documentType',
  createApiRateLimiter('edir-registration-documents', 10),
  express.raw({ type: () => true, limit: '10mb' }),
  process.env.EDIR_SERVICE_URL
    ? createPublicServiceGateway({
      baseUrl: process.env.EDIR_SERVICE_URL,
      secret: process.env.EDIR_GATEWAY_SECRET ?? '',
      servicePath: '/api/v1/edir',
      serviceName: 'AfroLife Edir document upload',
      allowInternalHttpHost: process.env.EDIR_PUBLIC_GATEWAY_HTTP_HOST,
    })
    : (_req, res) => res.status(503).json({ error: 'AfroLife Edir service is not configured' }),
);

api.get('/subscriptions/catalog', (_req, res) => {
  res.json(getPublicSubscriptionCatalog());
});

const agencyDomainGateway = (
  serviceName: string,
  urlKey: string,
  secretKey: string,
  legacyUrlKey?: string,
  legacySecretKey?: string,
): RequestHandler => {
  const baseUrl = process.env[urlKey] ?? (legacyUrlKey ? process.env[legacyUrlKey] : undefined);
  if (baseUrl) {
    return createServiceGateway({
      baseUrl,
      secret: process.env[secretKey] ?? (legacySecretKey ? process.env[legacySecretKey] : undefined) ?? '',
      servicePath: '/api/v1',
      serviceName,
      includeBaseUrl: true,
    });
  }
  return (_req, _res, next) => next();
};

const workerManagementGateway = agencyDomainGateway(
  'Workforce Management service',
  'WORKFORCE_MANAGEMENT_SERVICE_URL',
  'WORKFORCE_MANAGEMENT_GATEWAY_SECRET',
  'WORKER_MANAGEMENT_SERVICE_URL',
  'WORKER_MANAGEMENT_GATEWAY_SECRET',
);

async function getPlatformTenantServices(client: PoolClient, tenantId: string): Promise<string[]> {
  const services = await client.query(
    `SELECT DISTINCT s.service_key
     FROM platform_tenants t
     JOIN platform_tenant_packages tp ON tp.tenant_id=t.id
     JOIN platform_service_packages p ON p.id=tp.package_id AND p.active
     JOIN platform_service_package_items i ON i.package_id=p.id
     JOIN platform_services s ON s.service_key=i.service_key AND s.available
     WHERE t.id=$1 AND t.status='active'
       AND (
         NOT EXISTS (SELECT 1 FROM platform_tenant_module_config c WHERE c.tenant_id=t.id)
         OR s.service_key=ANY(COALESCE((
           SELECT c.enabled_services FROM platform_tenant_module_config c WHERE c.tenant_id=t.id
         ),ARRAY[]::text[]))
       )`,
    [tenantId],
  );
  return services.rows.map((row) => row.service_key as string);
}

const requirePlatformTenantService = (...serviceKeys: string[]): RequestHandler => (req, _res, next) => {
  if (req.user!.role !== 'super_admin') return next();
  const tenantId = z.string().uuid().safeParse(req.get('x-afrolife-platform-tenant-id'));
  if (!tenantId.success) {
    return next(new HttpError(403, 'Select an assigned, active platform tenant before accessing this service.'));
  }
  withUser(req.user!, async (client) => {
    const permitted = await client.query(
      `SELECT 1 FROM platform_tenants t
       WHERE t.id=$1 AND t.status='active'
         AND EXISTS (
           SELECT 1 FROM platform_tenant_admins a
           WHERE a.tenant_id=t.id AND a.user_id=$2
         )
       LIMIT 1`,
      [tenantId.data, req.user!.id],
    );
    const enabledServices = permitted.rowCount
      ? await getPlatformTenantServices(client, tenantId.data)
      : [];
    if (!serviceKeys.some((serviceKey) => enabledServices.includes(serviceKey))) {
      throw new HttpError(403, 'The selected platform tenant is not active, assigned, or entitled to this service.');
    }
  }).then(() => next(), next);
};

const requirePropertyTenantContext: RequestHandler = (req, _res, next) => {
  const requested = z.string().uuid().safeParse(req.get('x-afrolife-property-tenant-id'));
  if (req.get('x-afrolife-property-tenant-id') && !requested.success) {
    return next(new HttpError(400, 'Invalid property tenant context'));
  }
  withUser(req.user!, async (client) => {
    let tenantSystemId: string;
    if (req.user!.role === 'global_admin') {
      if (!requested.success) {
        throw new HttpError(403, 'Global Admin property access requires an approved, selected tenant support grant.');
      }
      const purpose = z.string().trim().min(10).max(1000).safeParse(
        req.get('x-afrolife-property-tenant-purpose'),
      );
      if (!purpose.success) {
        throw new HttpError(403, 'Provide the approved purpose in x-afrolife-property-tenant-purpose.');
      }
      const grant = (await client.query(
        `SELECT 1 FROM property_operating_tenant_support_grants
         WHERE tenant_system_id=$1 AND user_id=$2 AND purpose=$3
           AND status='active' AND expires_at>now()`,
        [requested.data,req.user!.id,purpose.data],
      )).rowCount;
      if (!grant) {
        throw new HttpError(403, 'No active, approved support grant matches this tenant and purpose.');
      }
      tenantSystemId = requested.data;
      req.user!.propertyTenantPurpose = purpose.data;
      await client.query(
        "SELECT set_config('app.property_tenant_purpose',$1,true)",
        [purpose.data],
      );
    } else {
    const memberships = await client.query(
      `SELECT tenant_system_id
       FROM property_operating_tenant_members
       WHERE user_id=$1 AND status='active'
         AND ($2::uuid IS NULL OR tenant_system_id=$2)
       ORDER BY tenant_system_id
       LIMIT 2`,
      [req.user!.id, requested.success ? requested.data : null],
    );
    if (memberships.rows.length === 0) {
      throw new HttpError(403, 'You are not an active member of the requested property tenant.');
    }
    if (!requested.success && memberships.rows.length > 1) {
      throw new HttpError(400, 'Select a property tenant using x-afrolife-property-tenant-id.');
    }
      tenantSystemId = memberships.rows[0].tenant_system_id as string;
    }
    req.user!.propertyTenantSystemId = tenantSystemId;
    await client.query(
      "SELECT set_config('app.property_tenant_system_id',$1,true)",
      [tenantSystemId],
    );
    const active = (await client.query(
      'SELECT app_property_tenant_system_id() AS id',
    )).rows[0]?.id;
    if (active !== tenantSystemId) {
      throw new HttpError(403, 'The requested property tenant is not active or available to this account.');
    }
    if (req.user!.role === 'global_admin') {
      await audit(client, req.user!.id, 'property_tenant_support_accessed', 'property_operating_tenant',
        tenantSystemId, null, {
          purpose: req.get('x-afrolife-property-tenant-purpose'),
          method: req.method,
          path: req.path,
        });
    }
  }).then(() => next(), next);
};

api.use(authenticate);
api.get('/property/tenant-systems', requireRole('global_admin'), h(async (_req, res) => {
  res.json(await withUser(_req.user!, async (client) => (await client.query(
    `SELECT id,tenant_key,legal_name,jurisdiction,timezone,currency,status,created_at,updated_at
     FROM property_operating_tenants
     ORDER BY legal_name,id`,
  )).rows));
}));
api.get('/property/tenant-systems/mine', h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT tenant.id,tenant.tenant_key,tenant.legal_name,tenant.jurisdiction,tenant.timezone,tenant.currency,
       tenant.status,member.tenant_role
     FROM property_operating_tenant_members member
     JOIN property_operating_tenants tenant ON tenant.id=member.tenant_system_id
     WHERE member.user_id=$1 AND member.status='active'
     ORDER BY tenant.legal_name,tenant.id`,
    [req.user!.id],
  )).rows));
}));
api.post('/property/tenant-systems', requireRole('global_admin'), h(async (req, res) => {
  const body = z.object({
    tenant_key: z.string().trim().regex(/^[a-z][a-z0-9-]{2,79}$/),
    legal_name: z.string().trim().min(2).max(200),
    initial_admin: z.string().uuid(),
    jurisdiction: z.string().trim().min(2).max(120),
    timezone: z.string().trim().min(2).max(80),
    currency: z.string().trim().regex(/^[A-Z]{3}$/),
  }).strict().parse(req.body);
  const tenantSystemId = await withUser(req.user!, async (client) => (
    await client.query(
      'SELECT provision_property_operating_tenant($1,$2,$3,$4,$5,$6) AS id',
      [body.tenant_key,body.legal_name,body.initial_admin,body.jurisdiction,body.timezone,body.currency],
    )
  )).then((result) => result.rows[0].id as string);
  res.status(201).json({ id: tenantSystemId, tenant_key: body.tenant_key });
}));
api.post('/property/tenant-systems/:id/members', requirePropertyTenantContext, h(async (req, res) => {
  const tenantSystemId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    user_id: z.string().uuid(),
    tenant_role: z.enum([
      'tenant_admin','tenant_accountant','master_agent','field_agent',
      'owner','resident','vendor',
    ]),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT assign_property_operating_tenant_member($1,$2,$3)',
      [tenantSystemId,body.user_id,body.tenant_role],
    );
  });
  res.status(204).end();
}));
api.post('/property/tenant-systems/:id/members/:userId/status', requirePropertyTenantContext, h(async (req, res) => {
  const tenantSystemId = z.string().uuid().parse(req.params.id);
  const targetUserId = z.string().uuid().parse(req.params.userId);
  const body = z.object({
    status: z.enum(['active','suspended','ended']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT set_property_operating_tenant_member_status($1,$2,$3,$4)',
      [tenantSystemId,targetUserId,body.status,body.reason],
    );
  });
  res.status(204).end();
}));
api.get('/property/tenant-systems/:id/agent-scopes', requirePropertyTenantContext, h(async (req, res) => {
  const tenantSystemId = z.string().uuid().parse(req.params.id);
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT scope.tenant_system_id,scope.property_id,property.address,scope.user_id,user_row.legal_name,
       scope.tenant_role,scope.status,scope.effective_from,scope.effective_to,scope.assigned_by,scope.assigned_at
     FROM property_agent_scopes scope
     JOIN properties property ON property.id=scope.property_id
     JOIN users user_row ON user_row.id=scope.user_id
     WHERE scope.tenant_system_id=$1
     ORDER BY property.address,user_row.legal_name,scope.user_id`,
    [tenantSystemId],
  )).rows));
}));
api.get('/property/tenant-systems/:id/agent-candidates', requirePropertyTenantContext, h(async (req, res) => {
  const tenantSystemId = z.string().uuid().parse(req.params.id);
  const propertyId = req.query.property_id === undefined
    ? null
    : z.string().uuid().parse(req.query.property_id);
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT * FROM list_property_agent_candidates($1,$2)
     ORDER BY legal_name,user_id`,
    [tenantSystemId,propertyId],
  )).rows));
}));
api.post('/property/tenant-systems/:id/agent-scopes', requirePropertyTenantContext, h(async (req, res) => {
  const tenantSystemId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    property_id: z.string().uuid(),
    user_id: z.string().uuid(),
    tenant_role: z.enum(['master_agent','field_agent']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT assign_property_agent_scope($1,$2,$3,$4,$5)',
      [tenantSystemId,body.property_id,body.user_id,body.tenant_role,body.reason],
    );
  });
  res.status(204).end();
}));
api.post('/property/tenant-systems/:id/agent-scopes/:propertyId/:userId/status', requirePropertyTenantContext, h(async (req, res) => {
  const tenantSystemId = z.string().uuid().parse(req.params.id);
  const propertyId = z.string().uuid().parse(req.params.propertyId);
  const userId = z.string().uuid().parse(req.params.userId);
  const body = z.object({
    status: z.enum(['suspended','ended']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT set_property_agent_scope_status($1,$2,$3,$4,$5)',
      [tenantSystemId,propertyId,userId,body.status,body.reason],
    );
  });
  res.status(204).end();
}));
api.post('/property/tenant-systems/:id/status', requireRole('global_admin'), h(async (req, res) => {
  const tenantSystemId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    status: z.enum(['active','suspended','offboarding','closed']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT set_property_operating_tenant_status($1,$2,$3)',
      [tenantSystemId,body.status,body.reason],
    );
  });
  res.status(204).end();
}));
api.get('/property/tenant-offboarding-exports', requireRole('global_admin'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT request.id,request.tenant_system_id,tenant.legal_name AS tenant_name,
       tenant.status AS tenant_status,request.artifact_reference,request.sha256,
       request.size_bytes,request.record_count,request.notes,request.requested_by,
       requester.legal_name AS requested_by_name,request.requested_at,
       decision.decision,decision.actor_id AS decided_by,
       reviewer.legal_name AS decided_by_name,decision.reason AS decision_reason,
       decision.created_at AS decided_at
     FROM property_tenant_export_requests request
     JOIN property_operating_tenants tenant ON tenant.id=request.tenant_system_id
     JOIN users requester ON requester.id=request.requested_by
     LEFT JOIN LATERAL (
       SELECT event.decision,event.actor_id,event.reason,event.created_at
       FROM property_tenant_export_events event
       WHERE event.export_request_id=request.id
       ORDER BY event.id DESC LIMIT 1
     ) decision ON true
     LEFT JOIN users reviewer ON reviewer.id=decision.actor_id
     ORDER BY request.request_sequence DESC`,
  )).rows));
}));
api.post('/property/tenant-systems/:id/offboarding-exports', requireRole('global_admin'), h(async (req, res) => {
  const tenantSystemId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    artifact_reference: z.string().trim().min(2).max(200)
      .refine((value) => !value.includes('://') && !/(password|secret|token|credential)/i.test(value)),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    size_bytes: z.number().safe().int().positive(),
    record_count: z.number().safe().int().nonnegative(),
    notes: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  const exportId = await withUser(req.user!, async (client) => (
    await client.query(
      'SELECT request_property_tenant_export($1,$2,$3,$4,$5,$6) AS id',
      [tenantSystemId,body.artifact_reference,body.sha256,body.size_bytes,body.record_count,body.notes],
    )
  )).then((result) => result.rows[0].id as string);
  res.status(201).json({ id: exportId, status: 'pending' });
}));
api.post('/property/tenant-systems/:id/offboarding-exports/:exportId/decision', requireRole('global_admin'), h(async (req, res) => {
  const tenantSystemId = z.string().uuid().parse(req.params.id);
  const exportId = z.string().uuid().parse(req.params.exportId);
  const body = z.object({
    decision: z.enum(['verified','rejected']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT decide_property_tenant_export($1,$2,$3,$4)',
      [tenantSystemId,exportId,body.decision,body.reason],
    );
  });
  res.status(204).end();
}));
api.post('/property/tenant-support-grants', requireRole('global_admin'), h(async (req, res) => {
  const body = z.object({
    tenant_system_id: z.string().uuid(),
    purpose: z.string().trim().min(10).max(1000),
    expires_at: z.string().datetime({ offset: true }),
  }).strict().parse(req.body);
  const grantId = await withUser(req.user!, async (client) => (
    await client.query(
      'SELECT request_property_tenant_support_grant($1,$2,$3,$4::timestamptz) AS id',
      [body.tenant_system_id,req.user!.id,body.purpose,body.expires_at],
    )
  )).then((result) => result.rows[0].id as string);
  res.status(201).json({ id: grantId, status: 'pending' });
}));
api.get('/property/tenant-support-grants/mine', requireRole('global_admin'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT grant_row.id,grant_row.tenant_system_id,tenant.legal_name AS tenant_name,
       grant_row.purpose,grant_row.expires_at
     FROM property_operating_tenant_support_grants grant_row
     JOIN property_operating_tenants tenant ON tenant.id=grant_row.tenant_system_id
     WHERE grant_row.user_id=$1 AND grant_row.status='active' AND grant_row.expires_at>now()
     ORDER BY grant_row.expires_at,grant_row.id`,
    [req.user!.id],
  )).rows));
}));
api.get('/property/tenant-support-grants/pending', requireRole('global_admin'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT id,tenant_system_id,user_id,purpose,requested_by,requested_at,expires_at
     FROM property_operating_tenant_support_grants
     WHERE status='pending' AND expires_at>now()
     ORDER BY requested_at,id LIMIT 100`,
  )).rows));
}));
api.post('/property/tenant-support-grants/:id/decision', requireRole('global_admin'), h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const body = z.object({
    approve: z.boolean(),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT decide_property_tenant_support_grant($1,$2,$3)',
      [id,body.approve,body.reason],
    );
  });
  res.status(204).end();
}));
api.post('/property/tenant-support-grants/:id/revoke', requireRole('global_admin'), h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const body = z.object({ reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query('SELECT revoke_property_tenant_support_grant($1,$2)', [id,body.reason]);
  });
  res.status(204).end();
}));
api.use(
  ['/properties', '/property/arc-requests', '/property/associations',
    '/property/association-report',
    '/property/association-assessments', '/property/association-receipts',
    '/property/association-violations',
    '/tenants', '/leases', '/lease-signature-documents',
    '/rent-transactions', '/charges', '/maintenance', '/resident', '/owner', '/rent',
    '/finance/property-chart-of-accounts-template', '/finance/property-period-close',
    '/property-vendors', '/property-vendor-bills', '/property-vendor-payments'],
  requirePropertyTenantContext,
);
api.post('/maintenance/:id/evidence', express.raw({ type: () => true, limit: '10mb' }));
api.post('/maintenance/vendor/:id/evidence', express.raw({ type: () => true, limit: '10mb' }));
api.post('/maintenance/vendor/:id/invoice', express.raw({ type: () => true, limit: '10mb' }));
api.use(['/workers', '/documents'], requirePlatformTenantService('workforce'), requireMiniAppAccess('workers'));
api.use('/workforce', requirePlatformTenantService('workforce'), requireMiniAppAccess('workers'));
api.use('/worker-support', requirePlatformTenantService('workforce', 'staffing'), requireMiniAppAccess('workers'));
api.use(['/requests', '/matches'], requirePlatformTenantService('staffing'), requireMiniAppAccess('requests'));
api.use('/staffing-engagements', requirePlatformTenantService('staffing', 'workforce'), (req, res, next) => {
  const partyAcceptance = req.method === 'POST'
    && /\/staffing-engagements\/[^/]+\/accept(?:\?|$)/.test(req.originalUrl)
    && ['customer', 'worker'].includes(req.user!.role);
  const workerSelfService = req.user!.role === 'worker'
    && ((req.method === 'GET' && /\/staffing-engagements\/mine(?:\?|$)/.test(req.originalUrl))
      || (req.method === 'POST' && /\/staffing-engagements\/[^/]+\/work-periods(?:\?|$)/.test(req.originalUrl)));
  if (workerSelfService || (partyAcceptance && req.user!.role === 'worker')) {
    return requireMiniAppAccess('workers')(req, res, next);
  }
  if (partyAcceptance) return next();
  return requireAnyMiniAppAccess('requests', 'accounting')(req, res, next);
});
api.use(
  ['/staffing-work-periods', '/staffing-settlements'],
  requirePlatformTenantService('staffing', 'workforce', 'accounting'),
  requireAnyMiniAppAccess('requests', 'accounting', 'workers'),
);
api.use(['/properties'], requirePlatformTenantService('property'), requireMiniAppAccess('properties'));
api.use(['/property/arc-requests'], requirePlatformTenantService('property'), requireMiniAppAccess('properties'));
api.use(
  ['/property/associations', '/property/association-report', '/property/association-assessments',
    '/property/association-receipts', '/property/association-violations'],
  requirePlatformTenantService('property'),
  requireAnyMiniAppAccess('properties', 'rent', 'accounting'),
);
api.use(
  ['/property-vendors', '/property-vendor-bills', '/property-vendor-payments'],
  requirePlatformTenantService('property'),
  requireAnyMiniAppAccess('properties', 'rent', 'accounting'),
);
api.use('/marketplace', requirePlatformTenantService('marketplace'), requireMiniAppAccess('marketplace'));
api.use('/accounting', requirePlatformTenantService('accounting'), (req, _res, next) => {
  void (async () => {
    if (!hasMiniAppAccess(req.user!, 'accounting')) throw new HttpError(403, 'Accounting & Finance is not assigned to your account');
    if (['global_admin','super_admin','finance','finance_manager','compliance','corporate_business_manager'].includes(req.user!.role)) return;
    const subscribed = await withUser(req.user!, async (client) => Boolean((await client.query(
      `SELECT 1 FROM platform_service_subscriptions
       WHERE user_id=$1 AND service_key='accounting' AND status='active' AND active_until>now()
       LIMIT 1`, [req.user!.id],
    )).rowCount));
    if (!subscribed) throw new HttpError(403, 'An active Accounting & Finance subscription is required');
  })().then(() => next(), next);
});
api.use('/edir', requirePlatformTenantService('edir'), requireMiniAppAccess('edir'));
api.use('/insurance', requirePlatformTenantService('insurance'), requireMiniAppAccess('insurance'));
api.use('/mfi', requirePlatformTenantService('sacco_mfi'), requireMiniAppAccess('mfi'));
api.use(
  ['/leads', '/contracts', '/contract-documents', '/commissions', '/agents', '/invoices'],
  requirePlatformTenantService('agency'),
);
api.use(['/leads'], requireMiniAppAccess('leads'));
api.use(['/contracts', '/contract-documents'], requireMiniAppAccess('contracts'));
api.use(['/commissions', '/invoices'], requireMiniAppAccess('commissions'));
api.use('/agents', requireMiniAppAccess('agents'));
api.use('/learning', requirePlatformTenantService('learning'), requireMiniAppAccess('learning'));
api.use('/privacy', requirePlatformTenantService('privacy'), requireMiniAppAccess('privacy'));
api.use('/rent', requirePlatformTenantService('property'), requireMiniAppAccess('rent'));
api.use('/global-bi', requirePlatformTenantService('global_bi'), requireMiniAppAccess('global-bi'));
api.use(
  ['/tenants', '/leases', '/lease-signature-documents', '/releases', '/rent-transactions', '/charges',
    '/finance/property-chart-of-accounts-template', '/finance/property-period-close'],
  requirePlatformTenantService('property'),
  requireAnyMiniAppAccess('properties', 'rent'),
);
api.use(['/maintenance'], requirePlatformTenantService('property', 'accounting'), requireAnyMiniAppAccess('properties', 'accounting'));
api.use(['/resident', '/owner'], requirePlatformTenantService('property'), requireMiniAppAccess('properties'));
api.use((req, _res, next) => {
  const organizationId = req.get('x-afrolife-edir-id');
  if (organizationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
    return next(new HttpError(400, 'Invalid Edir organization context'));
  }
  req.user!.edir_id = organizationId ?? '00000000-0000-4000-8000-000000000002';
  next();
});
// A token issued before a required security step (new password, 2FA setup) can only reach that step.
api.use((req, _res, next) => {
  const r = req.user!.rst;
  if (!r) return next();
  const ok = req.path === '/auth/me' || req.path === '/auth/session'
    || (r === 'password' ? req.path === '/auth/change-password' : req.path.startsWith('/auth/mfa'));
  next(ok ? undefined : new HttpError(403, 'Complete the required security step first'));
});
api.use((req, _res, next) => {
  if (req.user!.role !== 'global_admin') return next();
  withUser(req.user!, async (client) => {
    await audit(client, req.user!.id, 'global_admin_api_access', 'api_route',
      `${req.method} ${req.path}`, null, { user_agent: req.get('user-agent') ?? null });
  }).then(() => next(), next);
});
api.use('/subscriptions', subscriptionRouter);
api.use('/leads', requirePlatformTenantService('agency'));
api.get('/features', h(async (req, res) => {
  let enabledModules = runtimeConfig.enabledModules;
  let platformTenantId: string | null = null;
  if (req.user!.role === 'super_admin' && req.query.platform_tenant_id === undefined
    && !req.user!.adminRoleAllTenants) {
    enabledModules = [];
  }
  if (req.query.platform_tenant_id !== undefined) {
    if (!['global_admin', 'super_admin'].includes(req.user!.role)) {
      throw new HttpError(403, 'Only Super Admins and Global Admins may select a platform tenant context.');
    }
    const selectedPlatformTenantId = z.string().uuid().parse(req.query.platform_tenant_id);
    platformTenantId = selectedPlatformTenantId;
    const tenant = await withUser(req.user!, async (client) => {
      const permitted = await client.query(
        `SELECT t.id,t.status FROM platform_tenants t
         WHERE t.id=$1 AND (
           $2::text='global_admin' OR $4::boolean OR EXISTS (
             SELECT 1 FROM platform_tenant_admins a
             WHERE a.tenant_id=t.id AND a.user_id=$3
           )
         )`,
        [selectedPlatformTenantId, req.user!.role, req.user!.id, req.user!.adminRoleAllTenants ?? false],
      );
      if (!permitted.rowCount) throw new HttpError(403, 'This platform tenant is not assigned to your account.');
      return {
        status: permitted.rows[0].status as string,
        services: await getPlatformTenantServices(client, selectedPlatformTenantId),
      };
    });
    enabledModules = tenant.status === 'active'
      ? workspaceModulesForServices(enabledModules, tenant.services)
      : [];
  }
  const subscriberRole = ['customer','property_owner'].includes(req.user!.role);
  const accountingServiceAvailable = subscriberRole
    ? Boolean(process.env.ACCOUNTING_SUBSCRIBER_SERVICE_URL)
    : Boolean(process.env.ACCOUNTING_SERVICE_URL);
  let allowedModules = allowedMiniApps(req.user!, enabledModules.filter((module) =>
    (module !== 'global-bi' || Boolean(process.env.GLOBAL_BI_SERVICE_URL))
    && (module !== 'accounting' || accountingServiceAvailable)));
  if (subscriberRole) {
    const subscribed = await withUser(req.user!, async (client) => Boolean((await client.query(
      `SELECT 1 FROM platform_service_subscriptions
       WHERE user_id=$1 AND service_key='accounting' AND status='active' AND active_until>now()
       LIMIT 1`, [req.user!.id],
    )).rowCount));
    if (!subscribed) allowedModules = allowedModules.filter((module) => module !== 'accounting');
  }
  res.json({
  mfiPilotEnabled: runtimeConfig.mfiPilotEnabled,
  edirEnabled: Boolean(process.env.EDIR_SERVICE_URL),
  accountingEnabled: accountingServiceAvailable,
  globalBiEnabled: Boolean(process.env.GLOBAL_BI_SERVICE_URL),
  insuranceBrokerageSandboxEnabled: isInsuranceBrokerageSandboxEnabled(),
  enabledModules,
  allowedModules,
  platformTenantId,
  });
}));
api.get('/system/status', h(async (_req, res) => {
  res.json(await getWorkspaceServiceStatus(workspaceServiceProbes()));
}));
api.get('/system/metrics', requireRole('global_admin'), h(async (req, res) => {
  await flushApiMetrics().catch((error) => console.error('API metrics flush before read failed', error instanceof Error ? error.message : error));
  res.json(await withUser(req.user!, readPersistedApiMetrics));
}));
api.use('/workforce', workerManagementGateway);
api.use(adminRouter);
api.use(privacy);
api.use(ops);
api.use(learningRouter);
const staffingGateway = agencyDomainGateway(
  'Staffing service', 'STAFFING_SERVICE_URL', 'STAFFING_GATEWAY_SECRET',
);
const propertyManagementGateway = agencyDomainGateway(
  'Property Management service', 'PROPERTY_MANAGEMENT_SERVICE_URL', 'PROPERTY_MANAGEMENT_GATEWAY_SECRET',
);
const marketplaceGateway = agencyDomainGateway(
  'Marketplace service', 'MARKETPLACE_SERVICE_URL', 'MARKETPLACE_GATEWAY_SECRET',
);

api.post('/workers/:id/documents/upload', express.raw({ type: () => true, limit: '10mb' }));
api.post('/properties/:id/photos/upload', express.raw({ type: () => true, limit: '100mb' }));
api.post('/marketplace/listings/:id/media/upload', express.raw({ type: () => true, limit: '100mb' }));
api.use(['/workers', '/documents'], workerManagementGateway);
api.use(['/requests', '/matches', '/staffing-engagements', '/staffing-work-periods', '/staffing-settlements', '/worker-support'], staffingGateway);
api.use('/properties', propertyManagementGateway);
api.use('/marketplace', marketplaceGateway);
api.use(supply);
const internalAccountingGateway = process.env.ACCOUNTING_SERVICE_URL
  ? createAccountingServiceGateway({
      baseUrl: process.env.ACCOUNTING_SERVICE_URL,
      secret: process.env.ACCOUNTING_GATEWAY_SECRET ?? '',
      allowInternalHttpHost: process.env.ACCOUNTING_SERVICE_HTTP_HOST,
    })
  : null;
const subscriberAccountingGateway = process.env.ACCOUNTING_SUBSCRIBER_SERVICE_URL
  ? createAccountingServiceGateway({ baseUrl: process.env.ACCOUNTING_SUBSCRIBER_SERVICE_URL, secret: process.env.ACCOUNTING_SUBSCRIBER_GATEWAY_SECRET ?? '' })
  : null;
api.use('/accounting', (req, res, next) => {
  const subscriber = ['customer','property_owner'].includes(req.user?.role ?? '');
  const gateway = subscriber ? subscriberAccountingGateway : internalAccountingGateway;
  if (!gateway) return res.status(503).json({ error: subscriber
    ? 'Subscriber Accounting service is not configured'
    : 'Internal Accounting service is not configured' });
  return gateway(req, res, next);
});
api.use('/global-bi', process.env.GLOBAL_BI_SERVICE_URL
  ? createServiceGateway({
    baseUrl: process.env.GLOBAL_BI_SERVICE_URL,
    secret: process.env.GLOBAL_BI_GATEWAY_SECRET ?? '',
    servicePath: '/api/v1/global-bi',
    serviceName: 'Global BI',
    includeBaseUrl: true,
  })
  : (_req, res) => res.status(503).json({ error: 'Global BI projection service is not configured' }));
api.use('/insurance/requests', process.env.INSURANCE_SERVICE_URL
  ? createInsuranceRequestsServiceGateway({
    baseUrl: process.env.INSURANCE_SERVICE_URL,
    secret: process.env.INSURANCE_GATEWAY_SECRET ?? '',
  })
  : runtimeConfig.isProduction
    ? (_req, res) => res.status(503).json({ error: 'Separate Insurance service is not configured' })
    : createInsuranceRequestsRouter(withUser));
api.use('/insurance/brokerage', process.env.INSURANCE_SERVICE_URL
  ? createServiceGateway({
    baseUrl: process.env.INSURANCE_SERVICE_URL,
    secret: process.env.INSURANCE_GATEWAY_SECRET ?? '',
    servicePath: '/api/v1/insurance/brokerage',
    serviceName: 'Insurance brokerage service',
  })
  : (_req, res) => res.status(503).json({ error: 'Separate Insurance brokerage service is not configured' }));
api.use('/insurance/brokerage-sandbox', createInsuranceBrokerageSandboxRouter(withUser));
// Parse private Edir uploads before the signed service gateway so the raw
// bytes and their content type can be forwarded and signed without JSON wrapping.
api.post('/edir/credit/documents/:documentType', express.raw({ type: () => true, limit: '10mb' }));
// MFI document uploads use the same raw-body signature contract when routed to
// the standalone service; the in-process router can consume the parsed Buffer.
api.post('/mfi/institutions/:institutionId/members/:memberId/documents/:documentType',
  express.raw({ type: () => true, limit: '10mb' }));
api.use('/edir', process.env.EDIR_SERVICE_URL
  ? createServiceGateway({
    baseUrl: process.env.EDIR_SERVICE_URL,
    secret: process.env.EDIR_GATEWAY_SECRET ?? '',
    servicePath: '/api/v1/edir',
    serviceName: 'AfroLife Edir service',
  })
  : (_req, res) => res.status(503).json({ error: 'AfroLife Edir service is not configured' }));
api.use('/insurance/ledger', process.env.INSURANCE_SERVICE_URL
  ? createInsuranceServiceGateway({
    baseUrl: process.env.INSURANCE_SERVICE_URL,
    secret: process.env.INSURANCE_GATEWAY_SECRET ?? '',
  })
  : runtimeConfig.isProduction
    ? (_req, res) => res.status(503).json({ error: 'Separate Insurance service is not configured' })
    : createInsuranceLedgerRouter(withUser));
if (runtimeConfig.mfiPilotEnabled) {
  if (runtimeConfig.isProduction) console.warn('SACCO/MFI pilot is enabled; do not use for public deposits or regulated lending');
  api.use('/mfi', process.env.MFI_SERVICE_URL
    ? createMfiServiceGateway({
      baseUrl: process.env.MFI_SERVICE_URL,
      secret: process.env.MFI_GATEWAY_SECRET ?? '',
    })
    : createMfiRouter(withUser));
}

api.use(createAgencyOperationsRouter());

app.use('/api/v1', api);

// ---- Errors: translate validation and database rule violations into clear responses ----
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const correlationId = getCorrelationId(req);
  const reply = (status: number, body: Record<string, unknown>) =>
    res.status(status).json({ ...body, correlation_id: correlationId });
  if (err instanceof HttpError) return reply(err.status, { error: err.message });
  if (err instanceof z.ZodError) return reply(400, { error: 'Invalid input', details: err.flatten() });
  if (err?.code === '22P02') return reply(400, { error: 'Invalid id or value' }); // e.g. a malformed UUID in the URL
  if (err?.code === '23505') return reply(409, { error: 'Duplicate record (e.g. phone already used, or commission already exists)' });
  if (err?.code === '23P01') return reply(409, { error: err.message });
  if (err?.code === 'P0001' || err?.code === '23514') return reply(422, { error: err.message });
  console.error('API request failed [' + correlationId + ']', err);
  return reply(500, { error: 'Internal error' });
});

// Outbox: deliver queued WhatsApp/SMS/email through a signed webhook (e.g. a Make.com scenario) when configured.
let dispatching = false; // a slow run must not overlap the next tick
if (process.env.NOTIFY_WEBHOOK_URL && process.env.NOTIFY_WEBHOOK_SECRET) {
  setInterval(async () => {
    if (dispatching) return;
    dispatching = true;
    try { await dispatchOnce(pool, process.env.NOTIFY_WEBHOOK_URL!, process.env.NOTIFY_WEBHOOK_SECRET!); }
    catch (e: any) { console.error('dispatch failed', e.message); }
    finally { dispatching = false; }
  }, 30_000).unref();
}

let maintenanceSlaDispatching = false;
setInterval(async () => {
  if (maintenanceSlaDispatching) return;
  maintenanceSlaDispatching = true;
  try {
    await dispatchMaintenanceSlaEscalations(pool);
  } catch (error) {
    console.error('maintenance SLA escalation dispatch failed', error instanceof Error ? error.message : error);
  } finally {
    maintenanceSlaDispatching = false;
  }
}, 60_000).unref();

// Deliver finalized, independently reconciled rent transactions to the separately deployed Accounting service.
let accountingDispatching = false;
if (process.env.ACCOUNTING_SERVICE_URL && process.env.ACCOUNTING_INGEST_SECRET) {
  setInterval(async () => {
    if (accountingDispatching) return;
    accountingDispatching = true;
    try {
      await dispatchAccountingEvents(pool, process.env.ACCOUNTING_SERVICE_URL!, process.env.ACCOUNTING_INGEST_SECRET!, 'afrolife_core');
    } catch (error) {
      console.error('accounting outbox dispatch failed', error instanceof Error ? error.message : error);
    } finally { accountingDispatching = false; }
  }, 5_000).unref();
}

const onListening = () => console.log(`API listening; industry news refreshes every ${INDUSTRY_NEWS_REFRESH_INTERVAL_MS / 60_000} minutes`);
const port = Number(process.env.PORT ?? 3010);
if (runtimeConfig.isProduction) await assertRuntimeDatabaseSafety();
const server = process.env.HOST
  ? app.listen(port, process.env.HOST, onListening)
  : app.listen(port, onListening);
const apiMetricsTimer = startApiMetricsPersistence();

// Let in-flight requests (and their transactions) finish when the platform restarts the container.
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.once(sig, () => {
    stopIndustryNewsRefresh();
    clearInterval(apiMetricsTimer);
    server.close(() => flushApiMetrics()
      .catch((error) => console.error('Final API metrics flush failed', error instanceof Error ? error.message : error))
      .finally(() => pool.end().finally(() => process.exit(0))));
  });
}
