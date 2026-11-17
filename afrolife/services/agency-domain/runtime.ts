import '../../src/env.js';
import express from 'express';
import { z } from 'zod';
import type { Router } from 'express';
import { assertAgencyDomainDatabaseReady, type AgencyDomain } from '../../src/domain-database-readiness.js';
import { getCorrelationId, correlationIdMiddleware } from '../../src/request-context.js';
import { verifyServiceAssertion } from '../../src/insurance-service-gateway.js';

type SupplyDomain = AgencyDomain;

const serviceConfig: Record<SupplyDomain, { name: string; secrets: string[]; databases: string[] }> = {
  'workforce-management': {
    name: 'Workforce Management',
    secrets: ['WORKFORCE_MANAGEMENT_GATEWAY_SECRET', 'WORKER_MANAGEMENT_GATEWAY_SECRET'],
    databases: ['WORKFORCE_MANAGEMENT_DATABASE_URL', 'WORKER_MANAGEMENT_DATABASE_URL'],
  },
  staffing: {
    name: 'Staffing',
    secrets: ['STAFFING_GATEWAY_SECRET'],
    databases: ['STAFFING_DATABASE_URL'],
  },
  'property-management': {
    name: 'Property Management',
    secrets: ['PROPERTY_MANAGEMENT_GATEWAY_SECRET'],
    databases: ['PROPERTY_MANAGEMENT_DATABASE_URL'],
  },
  marketplace: {
    name: 'Marketplace',
    secrets: ['MARKETPLACE_GATEWAY_SECRET'],
    databases: ['MARKETPLACE_DATABASE_URL'],
  },
};

export async function startAgencyDomainService(
  domain: SupplyDomain,
  defaultPort: number,
  loadRouter: () => Promise<Router>,
): Promise<void> {
  const config = serviceConfig[domain];
  const secret = config.secrets.map((key) => process.env[key]).find(Boolean) ?? '';
  if (secret.length < 32) {
    throw new Error(`${config.secrets.join(' or ')} must contain at least 32 characters for the ${config.name} service`);
  }
  const databaseUrl = config.databases.map((key) => process.env[key]).find(Boolean);
  if (!databaseUrl) {
    throw new Error(`${config.databases.join(' or ')} must be configured for the ${config.name} service`);
  }
  process.env.DATABASE_URL = databaseUrl;
  const { assertRuntimeDatabaseSafety, HttpError, pool } = await import('../../src/core.js');
  const serviceRouter = await loadRouter();
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(express.json({ limit: '100kb' }));
  app.get('/healthz', async (_req, res, next) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, service: domain, database: 'connected' });
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/v1/workers/:id/documents/upload', express.raw({ type: () => true, limit: '10mb' }));
  app.post('/api/v1/properties/:id/photos/upload', express.raw({ type: () => true, limit: '100mb' }));
  app.post('/api/v1/marketplace/listings/:id/media/upload', express.raw({ type: () => true, limit: '100mb' }));
  app.use('/api/v1', (req, res, next) => {
    const assertion = req.get('x-afrolife-identity') ?? '';
    const signature = req.get('x-afrolife-signature') ?? '';
    const idempotencyKey = req.get('idempotency-key') ?? null;
    const user = verifyServiceAssertion(secret, assertion, signature, req.method, req.originalUrl, req.body, Date.now(), idempotencyKey);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired gateway identity assertion' });
      return;
    }
    req.user = {
      id: user.userId,
      role: user.role,
      legal_name: user.legalName,
      phone: user.phone,
      email: user.email,
      kyc_status: user.kycStatus,
      rolePermissions: user.rolePermissions,
      edir_id: user.organizationId,
      propertyTenantSystemId: user.propertyTenantSystemId,
      propertyTenantPurpose: user.propertyTenantPurpose,
    };
    next();
  }, serviceRouter);
  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const correlationId = getCorrelationId(req);
    const reply = (status: number, body: Record<string, unknown>) =>
      res.status(status).json({ ...body, correlation_id: correlationId });
    if (error instanceof HttpError) return reply(error.status, { error: error.message });
    if (error instanceof z.ZodError) return reply(400, { error: 'Invalid input', details: error.flatten() });
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = error.code;
      if (code === '22P02') return reply(400, { error: 'Invalid id or value' });
      if (code === '23505') return reply(409, { error: 'Duplicate record' });
      if (code === 'P0001' || code === '23514') {
        return reply(422, { error: error instanceof Error ? error.message : 'Invalid domain transition' });
      }
    }

    console.error(config.name + ' service request failed [' + correlationId + ']', error);
    return reply(500, { error: 'Internal error' });
  });

  await assertRuntimeDatabaseSafety();
  await assertAgencyDomainDatabaseReady(domain, pool);
  const port = Number(process.env.PORT ?? defaultPort);
  const server = app.listen(port, process.env.HOST ?? '127.0.0.1', () => {
    console.log(`${config.name} service listening on ${port}`);
  });
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => server.close(() => pool.end().finally(() => process.exit(0))));
  }
}
