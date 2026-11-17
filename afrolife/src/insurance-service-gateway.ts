import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { HttpError } from './http-error.js';
import { getCorrelationId } from './request-context.js';
import { isRoleActivityOverrides, type RoleActivityOverrides } from './role-activities.js';

export interface InsuranceServiceAssertion {
  userId: string;
  role: string;
  legalName?: string;
  phone?: string;
  email?: string | null;
  kycStatus?: string;
  organizationId?: string;
  rolePermissions?: RoleActivityOverrides;
  propertyTenantSystemId?: string;
  propertyTenantPurpose?: string;
  issuedAt: number;
}

function requestBodyHash(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
}

function signature(secret: string, assertion: string, method: string, path: string, bodyHash: string, idempotencyKey?: string | null): string {
  const canonical = `${assertion}\n${method}\n${path}\n${bodyHash}`;
  return createHmac('sha256', secret)
    .update(idempotencyKey ? `${canonical}\nidempotency-key:${idempotencyKey}` : canonical)
    .digest('hex');
}

export function verifyServiceAssertion(
  secret: string,
  assertion: string,
  suppliedSignature: string,
  method: string,
  path: string,
  body: unknown,
  now = Date.now(),
  idempotencyKey?: string | null,
): InsuranceServiceAssertion | null {
  if (secret.length < 32 || !/^[\da-f]{64}$/i.test(suppliedSignature)) return null;
  if (idempotencyKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) return null;
  const expected = signature(secret, assertion, method, path, requestBodyHash(body), idempotencyKey);
  const actual = Buffer.from(suppliedSignature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) return null;

  let decoded: InsuranceServiceAssertion;
  try {
    decoded = JSON.parse(Buffer.from(assertion, 'base64url').toString('utf8')) as InsuranceServiceAssertion;
  } catch {
    return null;
  }
  if (!decoded.userId || !decoded.role
    || (decoded.legalName !== undefined && typeof decoded.legalName !== 'string')
    || (decoded.phone !== undefined && typeof decoded.phone !== 'string')
    || (decoded.email !== undefined && decoded.email !== null && typeof decoded.email !== 'string')
    || (decoded.kycStatus !== undefined && !['uploaded', 'under_review', 'verified', 'rejected'].includes(decoded.kycStatus))
    || (decoded.organizationId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.organizationId))
    || (decoded.rolePermissions !== undefined && !isRoleActivityOverrides(decoded.rolePermissions))
    || (decoded.propertyTenantSystemId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.propertyTenantSystemId))
    || (decoded.propertyTenantPurpose !== undefined && (typeof decoded.propertyTenantPurpose !== 'string'
      || decoded.propertyTenantPurpose.trim().length < 10 || decoded.propertyTenantPurpose.length > 1000))
    || !Number.isSafeInteger(decoded.issuedAt)
    || Math.abs(now - decoded.issuedAt) > 60_000) return null;
  return decoded;
}

export const verifyInsuranceServiceAssertion = verifyServiceAssertion;

export function createServiceGateway(options: {
  baseUrl: string;
  secret: string;
  servicePath: string;
  serviceName: string;
  includeBaseUrl?: boolean;
  allowInternalHttpHost?: string;
}): RequestHandler {
  if (options.secret.length < 32) {
    throw new Error(`Gateway secret must contain at least 32 characters for ${options.serviceName}`);
  }
  if (!/^\/api\/v1(?:\/|$)/.test(options.servicePath) || options.servicePath.includes('..')
    || /[?#]/.test(options.servicePath)) {
    throw new Error(`Invalid service API path for ${options.serviceName}`);
  }
  const serviceUrl = new URL(options.baseUrl);
  if (serviceUrl.pathname !== '/' || serviceUrl.search || serviceUrl.hash
    || serviceUrl.username || serviceUrl.password) {
    throw new Error(`Service URL for ${options.serviceName} must be an origin without a path, query, credentials, or fragment`);
  }
  const internalHttpAllowed =
    options.allowInternalHttpHost === 'afrolife-local-accounting' &&
    serviceUrl.hostname === 'afrolife-local-accounting' &&
    serviceUrl.protocol === 'http:';
  if (serviceUrl.protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '::1'].includes(serviceUrl.hostname) &&
    !internalHttpAllowed) {
    throw new Error(`Service URL for ${options.serviceName} must use HTTPS outside localhost`);
  }

  return (req, res, next) => {
    const servicePath = options.servicePath.replace(/\/+$/, '');
    let mountedPath = options.includeBaseUrl ? req.baseUrl : '';
    if (mountedPath === servicePath) {
      mountedPath = '';
    } else if (mountedPath.startsWith(`${servicePath}/`)) {
      mountedPath = mountedPath.slice(servicePath.length);
    }
    const path = `${servicePath}${mountedPath}${req.url}`;
    const idempotencyKey = req.get('idempotency-key') ?? null;
    if (idempotencyKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      next(new HttpError(400, 'Idempotency-Key must be a UUID'));
      return;
    }
    const issuedAt = Date.now();
    const assertion = Buffer.from(JSON.stringify({
      userId: req.user!.id,
      role: req.user!.role,
      ...(req.user!.legal_name ? { legalName: req.user!.legal_name } : {}),
      ...(req.user!.phone ? { phone: req.user!.phone } : {}),
      ...(req.user!.email !== undefined ? { email: req.user!.email } : {}),
      ...(req.user!.kyc_status ? { kycStatus: req.user!.kyc_status } : {}),
      ...(req.get('x-afrolife-edir-id') ? { organizationId: req.get('x-afrolife-edir-id') } : {}),
      ...(req.user!.rolePermissions ? { rolePermissions: req.user!.rolePermissions } : {}),
      ...(req.user!.propertyTenantSystemId ? { propertyTenantSystemId: req.user!.propertyTenantSystemId } : {}),
      ...(req.user!.propertyTenantPurpose ? { propertyTenantPurpose: req.user!.propertyTenantPurpose } : {}),
      issuedAt,
    })).toString('base64url');
    const bodyHash = requestBodyHash(req.body);
    const signed = signature(options.secret, assertion, req.method, path, bodyHash, idempotencyKey);
    const rawBody = Buffer.isBuffer(req.body);
    const headers = new Headers({
      'x-afrolife-identity': assertion,
      'x-afrolife-signature': signed,
      'x-afrolife-correlation-id': getCorrelationId(req),
      'content-type': rawBody ? (req.get('content-type') ?? 'application/octet-stream') : 'application/json',
    });
    if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);
    const body = req.method === 'GET' || req.method === 'HEAD' || req.body === undefined
      ? undefined
      : rawBody ? new Uint8Array(req.body as Buffer) : JSON.stringify(req.body);
    fetch(new URL(path, serviceUrl), {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    }).then(async (upstream) => {
      const responseBody = await upstream.arrayBuffer();
      res.status(upstream.status);
      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('content-type', contentType);
      res.send(Buffer.from(responseBody));
    }).catch((error: unknown) => {
      console.error(options.serviceName + ' request failed [' + getCorrelationId(req) + ']', error);
      next(new HttpError(502, `${options.serviceName} is unavailable`));
    });
  };
}

export function createInsuranceServiceGateway(options: { baseUrl: string; secret: string }): RequestHandler {
  return createServiceGateway({
    ...options,
    servicePath: '/api/v1/insurance/ledger',
    serviceName: 'Insurance ledger service',
  });
}

export function createAccountingServiceGateway(options: {
  baseUrl: string;
  secret: string;
  allowInternalHttpHost?: string;
}): RequestHandler {
  return createServiceGateway({
    ...options,
    servicePath: '/api/v1/accounting',
    serviceName: 'Accounting service',
  });
}

export function createInsuranceRequestsServiceGateway(options: { baseUrl: string; secret: string }): RequestHandler {
  return createServiceGateway({
    ...options,
    servicePath: '/api/v1/insurance/requests',
    serviceName: 'Insurance request service',
  });
}

export function createMfiServiceGateway(options: { baseUrl: string; secret: string }): RequestHandler {
  return createServiceGateway({
    ...options,
    servicePath: '/api/v1/mfi',
    serviceName: 'SACCO/MFI service',
  });
}

export function createPublicServiceGateway(options: {
  baseUrl: string;
  secret: string;
  servicePath: string;
  serviceName: string;
  allowInternalHttpHost?: string;
}): RequestHandler {
  if (options.secret.length < 32) throw new Error(`Gateway secret must contain at least 32 characters for ${options.serviceName}`);
  const serviceUrl = new URL(options.baseUrl);
  const internalHttpAllowed =
    options.allowInternalHttpHost === 'afrolife-local-edir' &&
    serviceUrl.hostname === 'afrolife-local-edir' &&
    serviceUrl.protocol === 'http:';
  if (serviceUrl.pathname !== '/' || serviceUrl.search || serviceUrl.hash || serviceUrl.username || serviceUrl.password
    || (serviceUrl.protocol !== 'https:' && !['localhost','127.0.0.1','::1'].includes(serviceUrl.hostname) && !internalHttpAllowed)) {
    throw new Error(`Invalid service origin for ${options.serviceName}`);
  }
  return (req, res, next) => {
    const path = `${options.servicePath}/public/registration-applications${req.params.applicationId
      ? `/${encodeURIComponent(req.params.applicationId)}/documents/${encodeURIComponent(req.params.documentType ?? '')}`
      : ''}`;
    const issuedAt = Date.now();
    const assertion = Buffer.from(JSON.stringify({
      userId: '00000000-0000-4000-8000-000000000000', role: 'public', issuedAt,
    })).toString('base64url');
    const bodyHash = requestBodyHash(req.body);
    const signed = signature(options.secret, assertion, req.method, path, bodyHash);
    fetch(new URL(path, serviceUrl), {
      method: 'POST',
      headers: {
        'x-afrolife-identity': assertion,
        'x-afrolife-signature': signed,
        'x-afrolife-correlation-id': getCorrelationId(req),
        'content-type': req.get('content-type') ?? 'application/json',
        ...(req.params.applicationId && req.get('authorization')
          ? { authorization: req.get('authorization')! }
          : {}),
      },
      body: Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : JSON.stringify(req.body),
      signal: AbortSignal.timeout(10_000),
    }).then(async (upstream) => {
      const responseBody = await upstream.arrayBuffer();
      res.status(upstream.status);
      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('content-type', contentType);
      res.send(Buffer.from(responseBody));
    }).catch((error: unknown) => {
      console.error(options.serviceName + ' request failed [' + getCorrelationId(req) + ']', error);
      next(new HttpError(502, `${options.serviceName} is unavailable`));
    });
  };
}
