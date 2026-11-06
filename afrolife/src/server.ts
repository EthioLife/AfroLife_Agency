import './env.js';
import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import helmet from 'helmet';
import { z } from 'zod';
import { Phone } from './validators.js';
import { pool, withUser, authenticate, requireRole, HttpError, JWT_SECRET, assertRuntimeDatabaseSafety } from './core.js';
import { loadRuntimeConfig, workspaceModulesForServices } from './runtime-config.js';
import { apiMetricsMiddleware, checkWorkspaceServices, createWorkspaceServiceStatusCache, flushApiMetrics, readPersistedApiMetrics, startApiMetricsPersistence, type ServiceProbe } from './workspace-status.js';
import { createApiRateLimiter } from './rate-limit-store.js';
import { audit, feeSnapshot, loadRules, post, transition } from './domain.js';
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
import { notify } from './notify.js';
import { paymentWebhook } from './webhooks.js';
import { dispatchOnce } from './dispatch.js';
import { dispatchMaintenanceSlaEscalations } from './maintenance-sla.js';
import { dispatchAccountingEvents, enqueueAccountingEvent } from './accounting-outbox.js';
import { sniff } from './files.js';
import { checkPrivateStorage, getFile, putFile } from './storage.js';
import { correlationIdMiddleware, getCorrelationId } from './request-context.js';
import { allowedMiniApps, hasMiniAppAccess, requireAnyMiniAppAccess, requireMiniAppAccess } from './mini-app-access.js';
import { getPublicSubscriptionCatalog, subscriptionRouter } from './subscriptions.js';
import { createIndustryNewsProvider, INDUSTRY_NEWS_REFRESH_INTERVAL_MS, startIndustryNewsRefreshSchedule } from './industry-news.js';
import { assessMigrationReadiness, migrationChecksum } from './migration-checksums.js';

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
  { id: 'insurance', name: 'Insurance ledger', enabled: Boolean(process.env.INSURANCE_SERVICE_URL), url: process.env.INSURANCE_SERVICE_URL, withoutUrl: 'integrated' },
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
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-AfroLife-Edir-Id, X-AfroLife-Correlation-Id');
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
const STAFF = ['global_admin', 'super_admin', 'compliance', 'finance', 'finance_manager'];
const AGENT = ['master_agent', 'field_agent'];
const api = express.Router();
api.use(apiMetricsMiddleware);

// ---- Auth (login with lockout and optional 2FA lives in admin.ts) ----
api.post('/auth/login', createApiRateLimiter('login', Number(process.env.LOGIN_RATE_LIMIT ?? 20)));
api.post('/auth/signup', createApiRateLimiter('signup', 5));
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

api.use(authenticate);
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
  ['/tenants', '/leases', '/lease-signature-documents', '/releases', '/rent-transactions'],
  requirePlatformTenantService('property'),
  requireAnyMiniAppAccess('properties', 'rent'),
);
api.use(['/maintenance'], requirePlatformTenantService('property', 'accounting'), requireAnyMiniAppAccess('properties', 'accounting'));
api.use(['/resident'], requirePlatformTenantService('property'), requireMiniAppAccess('properties'));
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
api.get('/features', h(async (req, res) => {
  let enabledModules = runtimeConfig.enabledModules;
  let platformTenantId: string | null = null;
  if (req.user!.role === 'super_admin' && req.query.platform_tenant_id === undefined) {
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
           $2::text='global_admin' OR EXISTS (
             SELECT 1 FROM platform_tenant_admins a
             WHERE a.tenant_id=t.id AND a.user_id=$3
           )
         )`,
        [selectedPlatformTenantId, req.user!.role, req.user!.id],
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

// ---- Leads (row-level security limits what each agent can see) ----
api.post('/leads', requireRole(...AGENT), h(async (req, res) => {
  const b = z.object({ lead_type: z.enum(['household', 'business', 'worker', 'property']), name: z.string().min(2), phone: Phone }).parse(req.body);
  const row = await withUser(req.user!, async (c) => {
    const protection = await c.query("SELECT value FROM config_rules WHERE key='lead_protection_days'");
    const days = Number(protection.rows[0]?.value ?? 90);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Lead protection rule is invalid');
    const r = await c.query(
      'INSERT INTO leads (lead_type, name, phone, source_agent_id, protected_until) VALUES ($1,$2,$3,$4,now()+make_interval(days => $5)) RETURNING *',
      [b.lead_type, b.name, b.phone, req.user!.id, days],
    );
    await audit(c, req.user!.id, 'lead_created', 'lead', r.rows[0].id, null, { ...b, protected_until: r.rows[0].protected_until });
    return r.rows[0];
  });
  res.status(201).json(row);
}));

api.get('/leads', h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 200')).rows));
}));

api.patch('/leads/:id/status', requireRole(...AGENT), h(async (req, res) => {
  const body = z.object({
    status: z.enum(['qualified', 'lost']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  const lead = await withUser(req.user!, async (c) => {
    const current = (await c.query('SELECT * FROM leads WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!current) throw new HttpError(404, 'Lead not found');
    const allowed = current.status === 'new'
      ? ['qualified', 'lost'].includes(body.status)
      : current.status === 'qualified' && body.status === 'lost';
    if (!allowed) throw new HttpError(409, `A ${current.status} lead cannot be changed to ${body.status}`);
    const updated = (await c.query(
      'UPDATE leads SET status=$2 WHERE id=$1 RETURNING *',
      [current.id, body.status],
    )).rows[0];
    await audit(c, req.user!.id, 'lead_status_changed', 'lead', current.id,
      { status: current.status }, { status: updated.status, reason: body.reason });
    return updated;
  });
  res.json(lead);
}));

api.get('/leads/:id/attribution-history', h(async (req, res) => {
  const events = await withUser(req.user!, async (c) => {
    const lead = await c.query('SELECT id FROM leads WHERE id=$1', [req.params.id]);
    if (!lead.rowCount) throw new HttpError(404, 'Lead not found');
    return (await c.query(
      `SELECT prior_agent_id,new_agent_id,actor_id,event_type,reason,created_at
       FROM lead_attribution_history WHERE lead_id=$1 ORDER BY created_at,id`, [req.params.id],
    )).rows;
  });
  res.json(events);
}));

api.post('/admin/leads/:id/reassign', requireMiniAppAccess('leads'), requireRole('global_admin'), h(async (req, res) => {
  const body = z.object({ target_agent_id: z.string().uuid(), reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  const lead = await withUser(req.user!, async (c) => {
    const current = (await c.query('SELECT * FROM leads WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!current) throw new HttpError(404, 'Lead not found');
    if (!['new','qualified','lost'].includes(current.status)) throw new HttpError(409, 'Converted leads cannot be reassigned');
    const contract = await c.query('SELECT lead_has_non_cancelled_contract($1) AS has_contract', [current.id]);
    if (contract.rows[0].has_contract) throw new HttpError(409, 'A lead with a non-cancelled contract cannot be reassigned');
    const target = await c.query(
      `SELECT a.id FROM agents a JOIN users u ON u.id=a.id
       WHERE a.id=$1 AND u.active AND u.role IN ('master_agent','field_agent')`, [body.target_agent_id],
    );
    if (!target.rowCount) throw new HttpError(422, 'Choose an active master or field agent');
    if (current.source_agent_id === body.target_agent_id) throw new HttpError(409, 'Lead already belongs to this agent');
    const protection = await c.query("SELECT value FROM config_rules WHERE key='lead_protection_days'");
    const days = Number(protection.rows[0]?.value ?? 90);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Lead protection rule is invalid');
    await c.query("SELECT set_config('app.lead_reassignment_reason',$1,true)", [body.reason]);
    const updated = (await c.query(
      'UPDATE leads SET source_agent_id=$2,protected_until=now()+make_interval(days => $3) WHERE id=$1 RETURNING *',
      [current.id, body.target_agent_id, days],
    )).rows[0];
    await audit(c, req.user!.id, 'lead_reassigned', 'lead', current.id,
      { source_agent_id: current.source_agent_id, protected_until: current.protected_until },
      { source_agent_id: updated.source_agent_id, protected_until: updated.protected_until, reason: body.reason });
    return updated;
  });
  res.json(lead);
}));

// ---- Contracts ----
api.post('/leads/:id/contracts', requireRole(...AGENT, 'super_admin', 'global_admin'), h(async (req, res) => {
  const b = z.object({ track: z.enum(['A', 'B']), base_value: z.number().positive() }).parse(req.body);
  const row = await withUser(req.user!, async (c) => {
    const l = (await c.query('SELECT * FROM leads WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!l) throw new HttpError(404, 'Lead not found');
    if (!['new', 'qualified'].includes(l.status)) throw new HttpError(409, `Lead is already ${l.status}`);
    const f = feeSnapshot(b.track, b.base_value, await loadRules(c));
    const r = await c.query(
      `INSERT INTO contracts (contract_no, lead_id, source_agent_id, track, base_value, onboarding_amt, guarantee_amt, monthly_mgmt_amt, employer_fee_amt, other_fee_amt)
       VALUES ('C-' || lpad(nextval('contract_seq')::text, 6, '0'), $1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [l.id, l.source_agent_id, b.track, b.base_value, f.onboarding_amt, f.guarantee_amt, f.monthly_mgmt_amt, f.employer_fee_amt, f.other_fee_amt],
    );
    await c.query("UPDATE leads SET status = 'converted' WHERE id = $1", [l.id]);
    await audit(c, req.user!.id, 'contract_created', 'contract', r.rows[0].id, null, { ...b, ...f });
    return r.rows[0];
  });
  res.status(201).json(row);
}));

api.get('/contracts', h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    `SELECT k.*,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'document_stage',d.document_stage,'mime',d.mime,'size_bytes',d.size_bytes,'uploaded_by',d.uploaded_by,'uploader_role',u.role,'created_at',d.created_at) ORDER BY d.created_at DESC)
                 FROM contract_documents d JOIN users u ON u.id = d.uploaded_by WHERE d.contract_id = k.id), '[]'::jsonb) AS documents,
       (SELECT jsonb_build_object('signed_by',s.signed_by,'signer_name',u.legal_name,'signer_role',s.signer_role,'signed_at',s.signed_at)
        FROM contract_signatures s JOIN users u ON u.id = s.signed_by WHERE s.contract_id = k.id) AS signature
     FROM contracts k ORDER BY k.created_at DESC LIMIT 200`,
  )).rows));
}));

// Agent supplied contract files stay in private storage and are available only within the contract's RLS scope.
api.post('/contracts/:id/documents', requireRole(...AGENT, 'super_admin', 'global_admin', 'corporate_business_manager'), express.raw({ type: () => true, limit: '10mb' }), h(async (req, res) => {
  const { stage } = z.object({ stage: z.enum(['party_signed', 'company_countersigned']) }).parse(req.query);
  const agentUploader = AGENT.includes(req.user!.role);
  if ((stage === 'party_signed' && !agentUploader) || (stage === 'company_countersigned' && !['global_admin', 'super_admin', 'corporate_business_manager'].includes(req.user!.role))) {
    throw new HttpError(403, 'Your role cannot upload this contract document stage');
  }
  const buf = req.body as Buffer;
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw new HttpError(400, 'No file received');
  const mime = sniff(buf);
  if (!mime) throw new HttpError(415, 'Only PDF, JPEG or PNG files are accepted');
  const row = await withUser(req.user!, async (c) => {
    const contract = (await c.query('SELECT id, state FROM contracts WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!contract) throw new HttpError(404, 'Contract not found');
    if (contract.state !== 'signature_pending') throw new HttpError(409, 'Contract documents can be uploaded while awaiting signature');
    if (stage === 'company_countersigned') {
      const partySigned = await c.query(
        "SELECT 1 FROM contract_documents WHERE contract_id=$1 AND document_stage='party_signed' LIMIT 1",
        [contract.id],
      );
      if (!partySigned.rowCount) throw new HttpError(409, 'The agent must upload the party-signed contract first');
    }
    const key = randomUUID();
    const result = await c.query(
      `INSERT INTO contract_documents (contract_id, document_stage, storage_key, sha256, mime, size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, document_stage, mime, size_bytes, created_at`,
      [contract.id, stage, key, createHash('sha256').update(buf).digest('hex'), mime, buf.length, req.user!.id],
    );
    await putFile(key, buf);
    await audit(c, req.user!.id, 'contract_document_uploaded', 'contract', contract.id, null, { document_id: result.rows[0].id, mime, size_bytes: buf.length });
    return result.rows[0];
  });
  res.status(201).json(row);
}));

api.get('/contract-documents/:id/file', h(async (req, res) => {
  const document = await withUser(req.user!, async (c) => (await c.query(
    'SELECT id, contract_id, storage_key, mime FROM contract_documents WHERE id = $1', [req.params.id],
  )).rows[0]);
  if (!document) throw new HttpError(404, 'Contract document not found');
  const file = await getFile(document.storage_key);
  res.set({ 'Content-Type': document.mime, 'Content-Disposition': 'attachment', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' }).send(file);
}));

api.post('/contracts/:id/transition', h(async (req, res) => {
  const { action } = z.object({ action: z.string() }).parse(req.body);
  res.json(await withUser(req.user!, (c) => transition(c, req.user!, String(req.params.id), action, req.body)));
}));

api.post('/contracts/:id/renew', requireRole('super_admin', 'global_admin'), h(async (req, res) => {
  const row = await withUser(req.user!, async (c) => {
    const o = (await c.query("SELECT * FROM contracts WHERE id = $1 AND state = 'active'", [req.params.id])).rows[0];
    if (!o) throw new HttpError(404, 'Active contract not found');
    const r = await c.query(
      `INSERT INTO contracts (contract_no, lead_id, source_agent_id, track, is_renewal, base_value, onboarding_amt, guarantee_amt, monthly_mgmt_amt, employer_fee_amt, other_fee_amt)
       VALUES ('C-' || lpad(nextval('contract_seq')::text, 6, '0'), $1,$2,$3,true,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [o.lead_id, o.source_agent_id, o.track, o.base_value, o.onboarding_amt, o.guarantee_amt, o.monthly_mgmt_amt, o.employer_fee_amt, o.other_fee_amt],
    );
    await audit(c, req.user!.id, 'renewal_created', 'contract', r.rows[0].id, null, { from: o.id });
    return r.rows[0];
  });
  res.status(201).json(row);
}));

// ---- Invoices (staff only) ----
api.get('/invoices', requireMiniAppAccess('commissions'), requireRole(...STAFF), h(async (_req, res) => {
  res.json(await withUser(_req.user!, async (c) => (await c.query('SELECT * FROM invoices ORDER BY due_on DESC LIMIT 200')).rows));
}));

// ---- Commissions (finance approves; super admin pays; nothing is edited in place) ----
api.get('/commissions', h(async (req, res) => {
  const all = STAFF.includes(req.user!.role);
  res.json(await withUser(req.user!, async (c) => (await c.query(
    all ? `SELECT e.*, u.legal_name AS agent_name, k.contract_no
           FROM commission_events e JOIN users u ON u.id=e.agent_id JOIN contracts k ON k.id=e.contract_id
           ORDER BY e.created_at DESC LIMIT 200`
        : `SELECT e.*, u.legal_name AS agent_name, k.contract_no
           FROM commission_events e JOIN users u ON u.id=e.agent_id JOIN contracts k ON k.id=e.contract_id
           WHERE e.agent_id = $1 OR e.agent_id IN (SELECT id FROM agents WHERE parent_id = $1)
           ORDER BY e.created_at DESC LIMIT 200`,
    all ? [] : [req.user!.id],
  )).rows));
}));

api.post('/commissions/:id/approve', requireRole('finance', 'finance_manager'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => {
    const k = (await c.query('SELECT * FROM commission_events WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!k) throw new HttpError(404, 'Commission not found');
    if (k.status !== 'qualified') throw new HttpError(409, `Commission is ${k.status}`);
    if (k.qualified_by === req.user!.id) throw new HttpError(403, 'A different user must approve (four-eyes rule)');
    const r = await c.query("UPDATE commission_events SET status='approved', approved_by=$2 WHERE id=$1 RETURNING *", [k.id, req.user!.id]);
    await audit(c, req.user!.id, 'commission_approved', 'commission', k.id);
    await notify(c, k.agent_id, 'commission_approved', { amount: k.amount });
    return r.rows[0];
  }));
}));

api.post('/commissions/:id/pay', requireRole('super_admin', 'global_admin'), h(async (req, res) => {
  const b = z.object({ reference: z.string().trim().min(3).max(200) }).strict().parse(req.body);
  res.json(await withUser(req.user!, async (c) => {
    const k = (await c.query('SELECT * FROM commission_events WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!k) throw new HttpError(404, 'Commission not found');
    if (k.status !== 'approved') throw new HttpError(409, `Commission is ${k.status}; approve it first`);
    if (!k.approved_by || k.approved_by === req.user!.id) throw new HttpError(409, 'Commission payout requires a different finance approver');
    const amt = Math.round((Number(k.amount) - Number(k.held_amount ?? 0)) * 100) / 100;
    if (amt > 0) await post(c, 'commission', k.id, [['Commission Payable', amt, 0], ['Cash', 0, amt]]);
    if (amt > 0) await enqueueAccountingEvent(c, {
      source_entity_id: k.agent_id,
      entry_date: (await c.query('SELECT current_date::text AS entry_date')).rows[0].entry_date,
      source_reference: `agency-commission-payment:${k.id}`,
      description: `Agency commission payment for contract ${k.contract_id}`,
      lines: [
        { source_account_code: 'Commission Payable', debit: amt.toFixed(2), credit: '0.00' },
        { source_account_code: 'Cash', debit: '0.00', credit: amt.toFixed(2) },
      ],
      maker_id: req.user!.id,
      checker_id: k.approved_by,
      checker_reason: `Commission payment approved by finance; payment reference ${b.reference}`,
    });
    const r = await c.query("UPDATE commission_events SET status='paid', paid_ref=$2 WHERE id=$1 RETURNING *", [k.id, amt > 0 ? b.reference : null]);
    await audit(c, req.user!.id, 'commission_paid', 'commission', k.id, null, { reference: amt > 0 ? b.reference : null, amount: amt, held_amount: k.held_amount ?? 0 });
    await notify(c, k.agent_id, 'commission_paid', { amount: amt });
    return r.rows[0];
  }));
}));

api.post('/commissions/:id/release-held', requireRole('super_admin', 'global_admin'), h(async (req, res) => {
  const b = z.object({ reference: z.string().trim().min(3).max(200) }).strict().parse(req.body);
  res.json(await withUser(req.user!, async (c) => {
    const k = (await c.query('SELECT * FROM commission_events WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!k) throw new HttpError(404, 'Commission not found');
    if (k.held_status !== 'held' || Number(k.held_amount) <= 0) throw new HttpError(409, 'This commission has no held amount to release.');
    if (k.holdback_release_on > new Date().toISOString().slice(0, 10)) throw new HttpError(409, `The held commission is available after ${k.holdback_release_on}.`);
    if (k.status === 'approved' && Number(k.amount) > Number(k.held_amount)) throw new HttpError(409, 'Pay the approved commission installment before releasing the holdback.');
    if (!['approved', 'paid'].includes(k.status)) throw new HttpError(409, `Commission is ${k.status}; approve it first.`);
    if (!k.approved_by || k.approved_by === req.user!.id) throw new HttpError(409, 'Holdback payout requires a different finance approver');
    const amount = Number(k.held_amount);
    await post(c, 'commission_holdback', k.id, [['Commission Held Payable', amount, 0], ['Cash', 0, amount]]);
    await enqueueAccountingEvent(c, {
      source_entity_id: k.agent_id,
      entry_date: (await c.query('SELECT current_date::text AS entry_date')).rows[0].entry_date,
      source_reference: `agency-commission-holdback-payment:${k.id}`,
      description: `Agency commission holdback payment for contract ${k.contract_id}`,
      lines: [
        { source_account_code: 'Commission Held Payable', debit: amount.toFixed(2), credit: '0.00' },
        { source_account_code: 'Cash', debit: '0.00', credit: amount.toFixed(2) },
      ],
      maker_id: req.user!.id,
      checker_id: k.approved_by,
      checker_reason: `Commission holdback release approved by finance; payment reference ${b.reference}`,
    });
    const result = await c.query("UPDATE commission_events SET held_status='released', held_paid_ref=$2, status='paid' WHERE id=$1 RETURNING *", [k.id, b.reference]);
    await audit(c, req.user!.id, 'commission_holdback_released', 'commission', k.id, { held_status: k.held_status, amount }, { held_status: 'released', reference: b.reference });
    await notify(c, k.agent_id, 'commission_paid', { amount });
    return result.rows[0];
  }));
}));

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
