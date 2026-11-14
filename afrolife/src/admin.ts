import { Router, Request, Response, RequestHandler } from 'express';
import express from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool, withUser, requireRole, HttpError, JWT_SECRET, invalidateUser, invalidateRolePermissions } from './core.js';
import { normalizePhone, normalizePhoneParts } from './phone.js';
import { requiresMfaEnrollment } from './auth-types.js';
import { getFaydaVerificationStatus, getSmsRecoveryStatus } from './auth-integrations.js';
import { Phone } from './validators.js';
import { audit, feeSnapshot } from './domain.js';
import { mfaKeys, openAny, seal, passwordProblem, randomPassword } from './security.js';
import { newSecret, otpauthUri, verifyTotpStep } from './totp.js';
import { BUSINESS_RULES, validateBusinessRuleUpdates } from './business-rules.js';
import { sniff } from './files.js';
import { getFile, putFile } from './storage.js';
import { createApiRateLimiter } from './rate-limit-store.js';
import { sessionIdleTimeoutMinutes, WORKSPACE_MODULES } from './runtime-config.js';
import { ROLE_ACTIVITIES, ROLE_NAMES, getRoleActivity, hasRoleActivityAccess, type RoleName } from './role-activities.js';
import { MINI_APP_LABELS } from './mini-app-access.js';
import {
  EXCLUDED_TENANT_CAPABILITY_ROLES,
  tenantCapabilitiesSchema,
  tenantMigrationEventSchema,
  tenantMigrationStartSchema,
  tenantOperatorRequestSchema,
} from './platform-data-admin.js';
import { getMyTenantDataScopes, getTenantDataScope, requireTenantDataCapability } from './tenant-data-access.js';
import { getKycRequirements, requiredKycDocuments, ConfigScope, validateMarketplaceConfig, loadMarketplaceConfig } from './marketplace-config.js';

const h = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler => (req, res, next) => { fn(req, res).catch(next); };
const STAFF = ['global_admin', 'super_admin', 'compliance', 'finance', 'finance_manager'];
const MFA_STAFF = [...STAFF, 'corporate_business_manager'];
const AGENT_ROLES = ['master_agent', 'field_agent'];
const requireGlobalAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'global_admin') return next(new HttpError(403, 'Global Admin access is required.'));
  return next();
};
const requirePlatformControlPlaneAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'global_admin') {
    return next(new HttpError(403, 'Global System Admin access is required.'));
  }
  return next();
};
const requireSuperAdminPromotionRole: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'super_admin') {
    return next(new HttpError(403, 'Global Admin promotions require a Super Admin.'));
  }
  return next();
};
const PROVISIONABLE_ROLES = ['super_admin', 'corporate_business_manager', 'compliance', 'finance', 'finance_manager', 'master_agent', 'field_agent', 'customer', 'worker', 'property_owner', 'property_vendor'] as const;
const PLATFORM_SERVICE_KEYS = [
  'agency', 'workforce', 'staffing', 'property', 'marketplace', 'accounting', 'insurance',
  'sacco_mfi', 'edir', 'learning', 'privacy', 'operations', 'global_bi',
] as const;
const adminRoleAccessUpdate = z.object({
  roles: z.array(z.object({
    role: z.enum(['global_admin', 'super_admin']),
    modules: z.array(z.enum(WORKSPACE_MODULES)).max(WORKSPACE_MODULES.length),
    all_tenants: z.boolean(),
  }).strict()).max(2),
}).strict().superRefine((body, context) => {
  const roles = body.roles.map((item) => item.role);
  if (new Set(roles).size !== roles.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Administrator roles must not be duplicated' });
  }
  if (body.roles.some((item) => item.role !== 'super_admin' && item.all_tenants)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Cross-tenant scope is only available for Super Admin access' });
  }
  if (body.roles.some((item) => new Set(item.modules).size !== item.modules.length)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Service modules must not be duplicated' });
  }
});
const requireEnterprisePlan: RequestHandler = (req, _res, next) => {
  pool.query(
    `SELECT 1 FROM user_signups
     WHERE user_id = $1 AND status = 'approved' AND payment_status = 'paid'
       AND requested_plan = 'enterprise'`,
    [req.user!.id],
  ).then((result) => {
    if (!result.rowCount) return next(new HttpError(403, 'Team and portfolio insights need an activated Enterprise plan.'));
    next();
  }, next);
};
const MFA_KEYS = mfaKeys(JWT_SECRET); // [0] seals new secrets; all of them can open old ones
const MFA_KEY = MFA_KEYS[0];
const openSecret = (sealed: string) => openAny(sealed, MFA_KEYS);
// Compared against when the phone is unknown, so response time does not reveal which numbers have accounts.
const DUMMY_HASH = bcrypt.hashSync('no-such-user-placeholder', 12);

/** A restricted token can only reach the security step it must complete (see the guard in server.ts). */
async function issue(
  u: { id: string; role: string; must_change_password: boolean; mfa_enabled: boolean },
  replaceSessionId?: string,
  userAgent?: string,
) {
  const accessOptions = await withUser({ id: u.id, role: u.role }, async (client) => {
    const grants = await client.query(
      'SELECT role_name FROM user_admin_role_grants WHERE user_id=$1 ORDER BY role_name',
      [u.id],
    );
    return [...new Set([u.role, ...grants.rows.map((row) => row.role_name as string)])];
  });
  const hasStaffAccess = accessOptions.some((role) => MFA_STAFF.includes(role));
  const hasMfaRequiredAccess = accessOptions.some(requiresMfaEnrollment);
  const rst = u.must_change_password ? 'password'
    : (hasMfaRequiredAccess || (process.env.REQUIRE_MFA_FOR_STAFF === '1' && hasStaffAccess))
      && !u.mfa_enabled ? 'mfa' : null;
  const sessionId = randomUUID();
  await pool.query(
    `DELETE FROM auth_sessions WHERE expires_at < now() - interval '30 days'
       OR revoked_at < now() - interval '30 days'`,
  );
  await pool.query(
    `INSERT INTO auth_sessions (id,user_id,active_role,expires_at,user_agent)
     VALUES ($1,$2,$3,now()+interval '8 hours',$4)`,
    [sessionId, u.id, u.role, userAgent?.slice(0, 512) ?? null],
  );
  if (replaceSessionId) {
    await pool.query(
      'UPDATE auth_sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL',
      [replaceSessionId, u.id],
    );
  }
  return {
    token: jwt.sign({ sub: u.id, sid: sessionId, role: u.role, ...(rst ? { rst } : {}) }, JWT_SECRET, { expiresIn: '8h' }),
    restrict: rst,
    access_options: accessOptions,
  };
}

/** Five failures lock the account for 15 minutes. Once a lock has expired the count starts again at 1 (it used to stay at 5, so a single typo re-locked the account). */
const recordFailure = (id: string) =>
  pool.query(
    `UPDATE users SET
       failed_logins = CASE WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1 ELSE failed_logins + 1 END,
       locked_until  = CASE WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1 ELSE failed_logins + 1 END) >= 5
                            THEN now() + interval '15 minutes' ELSE locked_until END
     WHERE id = $1`, [id]);

// ================= Public: login =================
export const loginRouter = Router();
loginRouter.post('/auth/login', h(async (req, res) => {
  const b = z.object({
    phone: z.string().optional(),
    phone_country_code: z.string().optional(),
    phone_national_number: z.string().optional(),
    password: z.string().min(1).max(200),
    code: z.string().optional(),
  }).parse(req.body);
  const canonicalPhone = b.phone_country_code && b.phone_national_number
    ? normalizePhoneParts(b.phone_country_code, b.phone_national_number)
    : b.phone ? normalizePhone(b.phone) : null;
  if (!canonicalPhone) throw new HttpError(422, 'Enter a valid country calling code and phone number.');
  // Match the canonical form, and the raw text too so accounts saved before normalisation still work.
  const phones = [...new Set([canonicalPhone, b.phone?.trim(), b.phone_national_number?.trim()].filter(Boolean))] as string[];
  const u = (await pool.query('SELECT id, role, active, password_hash, mfa_enabled, mfa_secret, must_change_password, locked_until FROM users WHERE phone = ANY($1::text[]) ORDER BY active DESC LIMIT 1', [phones])).rows[0];
  if (u?.locked_until && new Date(u.locked_until) > new Date()) throw new HttpError(429, 'Too many failed attempts. Try again in 15 minutes.');
  const matches = await bcrypt.compare(b.password, u?.password_hash ?? DUMMY_HASH);
  const ok = Boolean(u?.password_hash) && matches;
  if (!ok || !u.active) {
    if (u) await recordFailure(u.id);
    throw new HttpError(401, 'Invalid credentials or inactive account');
  }
  if (u.mfa_enabled) {
    if (!b.code) return res.json({ mfa_required: true });
    const step = verifyTotpStep(openSecret(u.mfa_secret), b.code);
    if (step === null) { await recordFailure(u.id); throw new HttpError(401, 'Invalid code'); }
    const consumed = await pool.query(
      'UPDATE users SET mfa_last_step = $2 WHERE id = $1 AND mfa_last_step < $2',
      [u.id, step],
    );
    if (!consumed.rowCount) { await recordFailure(u.id); throw new HttpError(401, 'Invalid code'); }
  }
  await pool.query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [u.id]);
  res.json(await issue(u, undefined, req.get('user-agent')));
}));

const recoveryUnavailable = (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(503).json({ error: getSmsRecoveryStatus().message });
};

loginRouter.post('/auth/password-recovery/request', recoveryUnavailable);
loginRouter.post('/auth/password-recovery/complete', recoveryUnavailable);

loginRouter.get('/auth/signup/options', h(async (_req, res) => {
  const [territories, plans, accountOptions, kycOptions] = await Promise.all([
    pool.query(`
      WITH RECURSIVE hierarchy AS (
        SELECT id, parent_id, name, level, name::text AS path
        FROM territories WHERE parent_id IS NULL
        UNION ALL
        SELECT t.id, t.parent_id, t.name, t.level, h.path || ' · ' || t.name
        FROM territories t JOIN hierarchy h ON h.id = t.parent_id
      )
      SELECT id, name, level, path
      FROM hierarchy
      WHERE level IN ('region','city','sub_city','woreda','kebele')
      ORDER BY path
    `),
    pool.query("SELECT key, value FROM config_rules WHERE key IN ('agent_pro_monthly_etb','agent_enterprise_monthly_etb')"),
    pool.query("SELECT config_value FROM marketplace_configuration WHERE scope='users' AND config_key='account_types'"),
    pool.query("SELECT config_value FROM marketplace_configuration WHERE scope='users' AND config_key='kyc_requirements'"),
  ]);
  res.json({
    territories: territories.rows,
    plans: Object.fromEntries(plans.rows.map((rule) => [rule.key, Number(rule.value)])),
    account_types: accountOptions.rows[0]?.config_value ?? [
      { key: 'worker', label: 'Worker', enabled: true }, { key: 'customer', label: 'Buyer / customer', enabled: true },
      { key: 'property_owner', label: 'Seller / property owner', enabled: true }, { key: 'agent', label: 'Agent', enabled: true },
    ],
    kyc_requirements: getKycRequirements(kycOptions.rows[0]?.config_value),
    identity_verification: { fayda: getFaydaVerificationStatus() },
  });
}));

loginRouter.post('/auth/signup', h(async (req, res) => {
  const b = z.object({
    legal_name: z.string().trim().min(2).max(160),
    phone: Phone.optional(),
    phone_country_code: z.string().optional(),
    phone_national_number: z.string().optional(),
    email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
    password: z.string().min(12).max(72),
    password_confirmation: z.string(),
    account_type: z.enum(['worker', 'customer', 'agent', 'property_owner']),
    pension_match_interest: z.boolean().default(false),
    edir_member_interest: z.boolean().default(false),
    edir_life_interest: z.boolean().default(false),
    household_cover_interest: z.boolean().default(false),
    worker_document_consent: z.boolean().default(false),
    date_of_birth: z.string().date().optional(),
    agent_type: z.enum(['master', 'field']).optional(),
    territory_id: z.coerce.number().int().positive().optional(),
    parent_agent_phone: Phone.optional(),
    requested_plan: z.enum(['free', 'pro', 'enterprise']).optional(),
    option_a_enterprise_interest: z.boolean().default(false),
  }).strict().parse(req.body);
  const phone = b.phone_country_code && b.phone_national_number
    ? normalizePhoneParts(b.phone_country_code, b.phone_national_number)
    : b.phone ?? null;
  if (!phone) throw new HttpError(422, 'Enter a valid country calling code and phone number.');
  if (b.account_type === 'worker' && !b.worker_document_consent) {
    throw new HttpError(422, 'Worker applicants must consent to identity and eligibility document review before uploading KYC documents.');
  }
  if (b.account_type !== 'worker' && b.worker_document_consent) {
    throw new HttpError(422, 'Worker document consent is only available for worker applicants.');
  }
  if (b.account_type === 'worker') {
    if (!b.date_of_birth) throw new HttpError(422, 'Worker applicants must provide their date of birth.');
    const configured = await pool.query("SELECT value FROM config_rules WHERE key = 'worker_min_age_years'");
    const minimumAge = Number(configured.rows[0]?.value ?? 18);
    const birth = new Date(`${b.date_of_birth}T00:00:00Z`);
    const today = new Date();
    let age = today.getUTCFullYear() - birth.getUTCFullYear();
    if (today.getUTCMonth() < birth.getUTCMonth()
      || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age -= 1;
    if (birth > today || age < minimumAge) {
      throw new HttpError(422, `Worker applicants must be at least ${minimumAge} years old.`);
    }
  } else if (b.date_of_birth) {
    throw new HttpError(422, 'Date of birth is only collected for worker eligibility review.');
  }
  if (b.password !== b.password_confirmation) throw new HttpError(422, 'Password confirmation does not match.');
  const passwordIssue = passwordProblem(b.password, phone);
  if (passwordIssue) throw new HttpError(422, passwordIssue);

  let parentAgentId: string | null = null;
  if (b.account_type === 'agent') {
    if (!b.agent_type || !b.territory_id || !b.requested_plan) {
      throw new HttpError(422, 'Choose an agent type, territory, and plan.');
    }
    const territory = await pool.query('SELECT 1 FROM territories WHERE id = $1', [b.territory_id]);
    if (!territory.rowCount) throw new HttpError(422, 'Choose a valid territory.');
    if (b.agent_type === 'field') {
      if (!b.parent_agent_phone) throw new HttpError(422, 'A field agent needs a master agent');
      const parent = await pool.query(
        `SELECT a.id, a.territory_id
         FROM agents a JOIN users u ON u.id = a.id
         WHERE u.phone = $1 AND u.role = 'master_agent' AND u.active = true
           AND a.agent_type = 'master'`,
        [b.parent_agent_phone],
      );
      if (!parent.rowCount || Number(parent.rows[0].territory_id) !== b.territory_id) {
        throw new HttpError(422, 'This field agent is not linked to an active master agent in the selected territory.');
      }
      parentAgentId = parent.rows[0].id;
    }
  } else {
    if (b.agent_type || b.territory_id || b.parent_agent_phone) {
      throw new HttpError(422, 'Agent type, territory, and parent agent are only used for agent registrations.');
    }
    if (b.account_type === 'property_owner' && !b.requested_plan) {
      throw new HttpError(422, 'Choose a service plan for the seller/property-owner account.');
    }
    if (b.account_type === 'worker' && b.requested_plan) {
      throw new HttpError(422, 'Workers may request Enterprise Option A service through the worker plan option.');
    }
    if (b.account_type === 'customer' && b.requested_plan) {
      throw new HttpError(422, 'A service plan is only used for agent, worker Enterprise, and seller registrations.');
    }
    if (b.option_a_enterprise_interest && b.account_type !== 'worker') {
      throw new HttpError(422, 'Enterprise Option A staff service is only for worker applicants.');
    }
  }
  if (b.pension_match_interest && b.account_type !== 'worker') {
    throw new HttpError(422, 'The worker pension match is available for worker applicants only.');
  }

  const accountConfig = await pool.query("SELECT config_value FROM marketplace_configuration WHERE scope='users' AND config_key='account_types'");
  const enabledTypes = accountConfig.rows[0]?.config_value as { key: string; enabled: boolean }[] | undefined;
  if (enabledTypes && !enabledTypes.some((item) => item.key === b.account_type && item.enabled)) {
    throw new HttpError(403, 'This account type is currently unavailable for self-registration.');
  }
  const role = b.account_type === 'agent'
    ? b.agent_type === 'master' ? 'master_agent' : 'field_agent'
    : b.account_type;
  const requestedPlan = ['agent', 'property_owner'].includes(b.account_type)
    ? b.requested_plan!
    : b.account_type === 'worker' && b.option_a_enterprise_interest ? 'enterprise' : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query(
      `INSERT INTO users (legal_name, phone, email, role, territory_id, password_hash, must_change_password, active)
       VALUES ($1,$2,$3,$4,$5,$6,false,false)
       RETURNING id`,
      [
        b.legal_name,
        phone,
        b.email || null,
        role,
        b.account_type === 'agent' ? b.territory_id : null,
        await bcrypt.hash(b.password, 12),
      ],
    );
    await client.query(
      `INSERT INTO user_signups
         (user_id, account_type, requested_plan, payment_status, agent_type, territory_id, parent_agent_id,
          pension_match_interest, edir_member_interest, edir_life_interest, household_cover_interest,
          worker_document_consent_at, worker_document_consent_version, date_of_birth)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        user.rows[0].id,
        b.account_type,
        requestedPlan,
        ['agent', 'property_owner'].includes(b.account_type) && requestedPlan !== 'free' ? 'not_configured' : 'not_required',
        b.account_type === 'agent' ? b.agent_type : null,
        b.account_type === 'agent' ? b.territory_id : null,
        parentAgentId,
        b.pension_match_interest,
        b.edir_member_interest,
        b.edir_life_interest,
        b.household_cover_interest,
        b.worker_document_consent ? new Date() : null,
        b.worker_document_consent ? 'worker-document-review-v1' : null,
        b.date_of_birth ?? null,
      ],
    );
    const uploadToken = randomBytes(32).toString('base64url');
    await client.query(
      'INSERT INTO signup_upload_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,now() + interval \'24 hours\')',
      [user.rows[0].id, createHash('sha256').update(uploadToken).digest('hex')],
    );
    await client.query('COMMIT');
    res.status(201).json({ status: 'pending_approval', account_type: b.account_type, upload_token: uploadToken });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

loginRouter.post('/auth/signup/documents', createApiRateLimiter('signup-documents', 10), express.raw({ type: () => true, limit: '10mb' }), h(async (req, res) => {
  const docType = z.enum(['national_id', 'police_clearance']).parse(req.query.doc_type);
  const token = req.get('authorization')?.match(/^Signup ([A-Za-z0-9_-]{40,})$/)?.[1];
  if (!token) throw new HttpError(401, 'A valid sign-up upload token is required.');
  const file = req.body as Buffer;
  if (!Buffer.isBuffer(file) || file.length === 0) throw new HttpError(400, 'Choose a document to upload.');
  const mime = sniff(file);
  if (!mime) throw new HttpError(415, 'Only PDF, JPEG or PNG documents are accepted.');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const row = await pool.query(
    `SELECT u.id, u.role, s.account_type FROM signup_upload_tokens t
     JOIN users u ON u.id = t.user_id
     JOIN user_signups s ON s.user_id = u.id
     WHERE t.token_hash = $1 AND t.expires_at > now() AND s.status = 'pending'`,
    [tokenHash],
  );
  const applicant = row.rows[0];
  if (!applicant) throw new HttpError(401, 'The sign-up upload token is invalid or expired.');
  const requirementsResult = await pool.query("SELECT config_value FROM marketplace_configuration WHERE scope='users' AND config_key='kyc_requirements'");
  const requirements = getKycRequirements(requirementsResult.rows[0]?.config_value);
  if (!requiredKycDocuments(requirements, applicant.account_type).includes(docType)) {
    throw new HttpError(422, 'This document is not required for the selected account type.');
  }
  const id = randomUUID();
  let responseId = id;
  const key = randomUUID();
  const sha256 = createHash('sha256').update(file).digest('hex');
  await withUser({ id: applicant.id, role: applicant.role }, async (c) => {
    const count = await c.query('SELECT count(*)::int AS total FROM user_documents WHERE user_id = $1', [applicant.id]);
    const existing = await c.query('SELECT id, status FROM user_documents WHERE user_id = $1 AND doc_type = $2 FOR UPDATE', [applicant.id, docType]);
    if (existing.rowCount && !['uploaded', 'rejected'].includes(existing.rows[0].status)) {
      throw new HttpError(409, 'A verified KYC document cannot be replaced here. Contact Compliance if it needs correction.');
    }
    if (!existing.rowCount && Number(count.rows[0].total) >= 2) {
      throw new HttpError(422, 'The maximum number of sign-up identity documents has been reached.');
    }
    await putFile(key, file);
    if (existing.rowCount) {
      const old = existing.rows[0];
      responseId = old.id;
      await c.query(
        `UPDATE user_documents
         SET storage_key=$2,sha256=$3,mime=$4,size_bytes=$5,status='uploaded',reviewer_id=NULL,reviewed_at=NULL,review_note=NULL,uploaded_by=$6,created_at=now()
         WHERE id=$1`,
        [old.id, key, sha256, mime, file.length, applicant.id],
      );
      await audit(c, applicant.id, 'signup_kyc_document_replaced', 'user_document', old.id, { status: old.status }, { doc_type: docType, status: 'uploaded' });
    } else {
      await c.query(
        `INSERT INTO user_documents (id,user_id,doc_type,storage_key,sha256,mime,size_bytes,uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$2)`,
        [id, applicant.id, docType, key, sha256, mime, file.length],
      );
      await audit(c, applicant.id, 'signup_kyc_document_uploaded', 'user_document', id, null, { doc_type: docType });
    }
    await c.query("UPDATE users SET kyc_status = 'uploaded' WHERE id = $1", [applicant.id]);
  });
  res.status(201).json({ id: responseId, doc_type: docType, status: 'uploaded' });
}));

loginRouter.get('/auth/signup/documents', h(async (req, res) => {
  const token = req.get('authorization')?.match(/^Signup ([A-Za-z0-9_-]{40,})$/)?.[1];
  if (!token) throw new HttpError(401, 'A valid sign-up upload token is required.');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const applicant = (await pool.query(
    `SELECT u.id, u.role, s.account_type FROM signup_upload_tokens t
     JOIN users u ON u.id=t.user_id JOIN user_signups s ON s.user_id=u.id
     WHERE t.token_hash=$1 AND t.expires_at>now() AND s.status='pending'`, [tokenHash],
  )).rows[0];
  if (!applicant) throw new HttpError(401, 'The sign-up upload token is invalid or expired.');
  const config = (await pool.query("SELECT config_value FROM marketplace_configuration WHERE scope='users' AND config_key='kyc_requirements'")).rows[0]?.config_value;
  const required = requiredKycDocuments(config, applicant.account_type);
  const documents = await withUser({ id: applicant.id, role: applicant.role }, async (c) => (await c.query(
    'SELECT doc_type,status,review_note,reviewed_at FROM user_documents WHERE user_id=$1 ORDER BY doc_type', [applicant.id],
  )).rows);
  res.json({ required, documents });
}));

// ================= Signed-in: own account =================
export const adminRouter = Router();

adminRouter.get('/users/:id/admin-access', requireRole('global_admin'), h(async (req, res) => {
  const userId = z.string().uuid().parse(req.params.id);
  const result = await withUser(req.user!, async (client) => {
    const target = (await client.query('SELECT id,role FROM users WHERE id=$1', [userId])).rows[0];
    if (!target) throw new HttpError(404, 'User not found');
    const grants = (await client.query(
      `SELECT role_name,module_keys,all_tenants FROM user_admin_role_grants
       WHERE user_id=$1 ORDER BY role_name`,
      [userId],
    )).rows;
    return { primaryRole: target.role as string, grants };
  });
  res.json({
    ...result,
    availableModules: WORKSPACE_MODULES.map((id) => ({ id, label: MINI_APP_LABELS[id] })),
  });
}));

adminRouter.put('/users/:id/admin-access', requireRole('global_admin'), h(async (req, res) => {
  const userId = z.string().uuid().parse(req.params.id);
  if (userId === req.user!.id) {
    throw new HttpError(409, 'Use another Global Admin to change your own administrator access.');
  }
  const body = adminRoleAccessUpdate.parse(req.body);
  const grants = body.roles.map((grant) => ({ ...grant, modules: [...grant.modules].sort() }));
  await withUser(req.user!, async (client) => {
    const target = (await client.query('SELECT id,role FROM users WHERE id=$1 FOR UPDATE', [userId])).rows[0];
    if (!target) throw new HttpError(404, 'User not found');
    if (grants.length && !['global_admin', 'super_admin'].includes(target.role)) {
      throw new HttpError(422, 'Only an existing platform administrator can receive an alternate administrator access mode.');
    }
    if (grants.some((grant) => grant.role === 'global_admin' && target.role !== 'global_admin')) {
      throw new HttpError(422, 'Global Admin access must be established through the approved role-promotion workflow.');
    }
    for (const grant of grants) {
      await client.query(
        `INSERT INTO user_admin_role_grants(user_id,role_name,module_keys,all_tenants,granted_by)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(user_id,role_name) DO UPDATE SET
           module_keys=EXCLUDED.module_keys,all_tenants=EXCLUDED.all_tenants,
           granted_by=EXCLUDED.granted_by,updated_at=now()`,
        [userId, grant.role, grant.modules, grant.all_tenants, req.user!.id],
      );
    }
    const retainedRoles = grants.map((grant) => grant.role);
    if (retainedRoles.length) {
      await client.query(
        'DELETE FROM user_admin_role_grants WHERE user_id=$1 AND NOT (role_name=ANY($2::text[]))',
        [userId, retainedRoles],
      );
    } else {
      await client.query('DELETE FROM user_admin_role_grants WHERE user_id=$1', [userId]);
    }
    await client.query('DELETE FROM platform_tenant_admins WHERE user_id=$1 AND role_grant_managed', [userId]);
    if (grants.some((grant) => grant.role === 'super_admin' && grant.all_tenants)) {
      await client.query(
        `INSERT INTO platform_tenant_admins(tenant_id,user_id,assigned_by,role_grant_managed)
         SELECT id,$1,$2,true FROM platform_tenants
         ON CONFLICT(tenant_id,user_id) DO NOTHING`,
        [userId, req.user!.id],
      );
    }
    await audit(client, req.user!.id, 'administrator_access_updated', 'user', userId, null, {
      primary_role: target.role,
      grants,
    });
  });
  invalidateUser(userId);
  res.sendStatus(204);
}));

adminRouter.get('/marketplace/config', h(async (req, res) => {
  res.json(await withUser(req.user!, loadMarketplaceConfig));
}));

adminRouter.patch('/marketplace/config', requireRole('global_admin', 'corporate_business_manager'), h(async (req, res) => {
  const body = z.object({
    values: z.array(z.object({ scope: ConfigScope, key: z.string().trim().min(1).max(80), value: z.unknown() }).strict()).min(1).max(30),
  }).strict().parse(req.body);
  const isPlatformAdmin = req.user!.role === 'global_admin';
  const uniqueKeys = new Set<string>();
  const normalized = body.values.map((item) => {
    const identity = `${item.scope}.${item.key}`;
    if (uniqueKeys.has(identity)) throw new HttpError(422, `Configuration item ${identity} appears more than once.`);
    uniqueKeys.add(identity);
    if (!isPlatformAdmin && !['products', 'services', 'properties', 'rentals'].includes(item.scope)) {
      throw new HttpError(403, 'Business Managers may only configure product, service, property, and rental catalogs.');
    }
    return { ...item, value: validateMarketplaceConfig(item.scope, item.key, item.value) };
  });
  const config = await withUser(req.user!, async (c) => {
    for (const item of normalized) {
      const prior = (await c.query(
        'SELECT config_value,revision FROM marketplace_configuration WHERE scope=$1 AND config_key=$2 FOR UPDATE',
        [item.scope, item.key],
      )).rows[0];
      const upserted = await c.query(
        `INSERT INTO marketplace_configuration(scope,config_key,config_value,updated_by,revision)
         VALUES ($1,$2,$3,$4,1)
         ON CONFLICT (scope,config_key) DO UPDATE SET config_value=EXCLUDED.config_value,
           updated_by=EXCLUDED.updated_by,revision=marketplace_configuration.revision+1
         RETURNING revision`,
        [item.scope, item.key, JSON.stringify(item.value), req.user!.id],
      );
      await audit(c, req.user!.id, 'marketplace_configuration_updated', 'marketplace_configuration', `${item.scope}.${item.key}`,
        { value: prior?.config_value ?? null, revision: prior?.revision ?? 0 },
        { value: item.value, revision: Number(upserted.rows[0].revision) });
    }
    return loadMarketplaceConfig(c);
  });
  res.json(config);
}));

adminRouter.get('/platform/services', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const services = await withUser(req.user!, async (client) => (await client.query(
    `SELECT service_key, display_name, description, available, updated_at
     FROM platform_services ORDER BY display_name`,
  )).rows);
  res.json(services);
}));

adminRouter.patch('/platform/services/:serviceKey', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const serviceKey = z.enum(PLATFORM_SERVICE_KEYS).parse(req.params.serviceKey);
  const body = z.object({
    display_name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(2).max(1000),
    available: z.boolean(),
  }).strict().parse(req.body);
  const service = await withUser(req.user!, async (client) => {
    const updated = await client.query(
      `UPDATE platform_services
       SET display_name=$2, description=$3, available=$4, updated_by=$5, updated_at=now()
       WHERE service_key=$1 RETURNING service_key, display_name, description, available, updated_at`,
      [serviceKey, body.display_name, body.description, body.available, req.user!.id],
    );
    if (!updated.rowCount) throw new HttpError(404, 'Platform service not found.');
    await audit(client, req.user!.id, 'platform_service_updated', 'platform_service', serviceKey, null, body);
    return updated.rows[0];
  });
  res.json(service);
}));

adminRouter.get('/platform/service-packages', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const packages = await withUser(req.user!, async (client) => (await client.query(
    `SELECT p.id, p.package_key, p.display_name, p.description, p.active, p.created_at, p.updated_at,
       COALESCE(array_agg(i.service_key ORDER BY i.service_key)
         FILTER (WHERE i.service_key IS NOT NULL), ARRAY[]::text[]) AS services
     FROM platform_service_packages p
     LEFT JOIN platform_service_package_items i ON i.package_id=p.id
     GROUP BY p.id ORDER BY p.display_name`,
  )).rows);
  res.json(packages);
}));

adminRouter.post('/platform/service-packages', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const body = z.object({
    package_key: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{1,79}$/),
    display_name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(2).max(1000),
    services: z.array(z.enum(PLATFORM_SERVICE_KEYS)).min(1).max(PLATFORM_SERVICE_KEYS.length),
  }).strict().parse(req.body);
  if (new Set(body.services).size !== body.services.length) {
    throw new HttpError(422, 'A service may only appear once in a package.');
  }
  const created = await withUser(req.user!, async (client) => {
    const available = (await client.query(
      'SELECT service_key FROM platform_services WHERE service_key=ANY($1::text[]) AND available',
      [body.services],
    )).rows.map((row) => row.service_key);
    if (available.length !== body.services.length) {
      throw new HttpError(422, 'Packages may include only currently available platform services.');
    }
    const row = (await client.query(
      `INSERT INTO platform_service_packages (package_key,display_name,description,created_by)
       VALUES ($1,$2,$3,$4) RETURNING id,package_key,display_name,description,active`,
      [body.package_key, body.display_name, body.description, req.user!.id],
    )).rows[0];
    for (const service of body.services) {
      await client.query('INSERT INTO platform_service_package_items (package_id,service_key) VALUES ($1,$2)', [row.id, service]);
    }
    await audit(client, req.user!.id, 'platform_service_package_created', 'platform_service_package', row.id, null, body);
    return { ...row, services: body.services };
  });
  res.status(201).json(created);
}));

adminRouter.patch('/platform/service-packages/:packageId', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const packageId = z.string().uuid().parse(req.params.packageId);
  const body = z.object({
    display_name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(2).max(1000),
    active: z.boolean(),
    services: z.array(z.enum(PLATFORM_SERVICE_KEYS)).min(1).max(PLATFORM_SERVICE_KEYS.length),
  }).strict().parse(req.body);
  if (new Set(body.services).size !== body.services.length) {
    throw new HttpError(422, 'A service may only appear once in a package.');
  }
  const updated = await withUser(req.user!, async (client) => {
    const prior = (await client.query(
      'SELECT package_key FROM platform_service_packages WHERE id=$1 FOR UPDATE', [packageId],
    )).rows[0];
    if (!prior) throw new HttpError(404, 'Service package not found.');
    const available = (await client.query(
      'SELECT service_key FROM platform_services WHERE service_key=ANY($1::text[]) AND available',
      [body.services],
    )).rows.map((row) => row.service_key);
    if (available.length !== body.services.length) {
      throw new HttpError(422, 'Packages may include only currently available platform services.');
    }
    await client.query(
      `UPDATE platform_service_packages
       SET display_name=$2,description=$3,active=$4,updated_at=now() WHERE id=$1`,
      [packageId, body.display_name, body.description, body.active],
    );
    await client.query('DELETE FROM platform_service_package_items WHERE package_id=$1', [packageId]);
    for (const service of body.services) {
      await client.query('INSERT INTO platform_service_package_items (package_id,service_key) VALUES ($1,$2)', [packageId, service]);
    }
    await audit(client, req.user!.id, 'platform_service_package_updated', 'platform_service_package', packageId, null, body);
    return { id: packageId, package_key: prior.package_key, ...body };
  });
  res.json(updated);
}));

adminRouter.get('/platform/tenants', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const tenants = await withUser(req.user!, async (client) => (await client.query(
    `SELECT t.id,t.tenant_key,t.display_name,t.status,t.hosting_mode,t.region,
       t.deployment_reference,t.deployment_status,t.config_version,t.created_at,t.updated_at,
       t.deployment_verification_reference,
       COALESCE(jsonb_agg(jsonb_build_object(
         'id',p.id,'package_key',p.package_key,'display_name',p.display_name
       ) ORDER BY p.package_key) FILTER (WHERE p.id IS NOT NULL),'[]'::jsonb) AS packages,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id',u.id,'legal_name',u.legal_name,'phone',u.phone)
         ORDER BY u.legal_name) FROM platform_tenant_admins a JOIN users u ON u.id=a.user_id
         WHERE a.tenant_id=t.id),'[]'::jsonb) AS admins
     FROM platform_tenants t
     LEFT JOIN platform_tenant_packages tp ON tp.tenant_id=t.id
     LEFT JOIN platform_service_packages p ON p.id=tp.package_id
     GROUP BY t.id ORDER BY t.created_at,t.tenant_key`,
  )).rows);
  res.json(tenants);
}));

adminRouter.get('/platform/super-admins', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const admins = await withUser(req.user!, async (client) => (await client.query(
    `SELECT id,legal_name,phone FROM users
     WHERE role='super_admin' AND active ORDER BY legal_name,phone`,
  )).rows);
  res.json(admins);
}));

adminRouter.get('/platform/my-tenants', requireRole('super_admin'), h(async (req, res) => {
  const tenants = await withUser(req.user!, async (client) => (await client.query(
    `SELECT t.id,t.tenant_key,t.display_name,t.status,t.hosting_mode,t.region,
       t.deployment_reference,t.deployment_status,t.config_version,t.updated_at,
       a.assigned_at,
       COALESCE((
         SELECT array_agg(DISTINCT s.service_key ORDER BY s.service_key)
         FROM platform_tenant_packages tp
         JOIN platform_service_packages p ON p.id=tp.package_id AND p.active
         JOIN platform_service_package_items i ON i.package_id=p.id
         JOIN platform_services s ON s.service_key=i.service_key AND s.available
         WHERE tp.tenant_id=t.id
       ),ARRAY[]::text[]) AS available_services,
       COALESCE((
         SELECT c.enabled_services FROM platform_tenant_module_config c
         WHERE c.tenant_id=t.id
       ),(
         SELECT array_agg(DISTINCT s.service_key ORDER BY s.service_key)
         FROM platform_tenant_packages tp
         JOIN platform_service_packages p ON p.id=tp.package_id AND p.active
         JOIN platform_service_package_items i ON i.package_id=p.id
         JOIN platform_services s ON s.service_key=i.service_key AND s.available
         WHERE tp.tenant_id=t.id
       ),ARRAY[]::text[]) AS enabled_services,
       COALESCE(jsonb_agg(DISTINCT jsonb_build_object('package_key',p.package_key,'display_name',p.display_name,
         'services',COALESCE((SELECT jsonb_agg(i.service_key ORDER BY i.service_key)
           FROM platform_service_package_items i WHERE i.package_id=p.id),'[]'::jsonb)))
         FILTER (WHERE p.id IS NOT NULL),'[]'::jsonb) AS configured_packages
     FROM platform_tenant_admins a JOIN platform_tenants t ON t.id=a.tenant_id
     LEFT JOIN platform_tenant_packages tp ON tp.tenant_id=t.id
     LEFT JOIN platform_service_packages p ON p.id=tp.package_id AND p.active
     WHERE a.user_id=$1 GROUP BY t.id,a.assigned_at ORDER BY t.display_name`,
    [req.user!.id],
  )).rows);
  res.json(tenants);
}));

adminRouter.patch('/platform/my-tenants/:tenantId/registration', requireRole('super_admin'), h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const body = z.object({
    deployment_reference: z.string().trim().min(2).max(200).optional(),
    deployment_status: z.enum(['not_registered','registered']).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0).parse(req.body);
  if (body.deployment_reference
    && (/(password|secret|token|credential)/i.test(body.deployment_reference) || body.deployment_reference.includes('://'))) {
    throw new HttpError(422, 'Deployment references must not contain credentials or connection URLs.');
  }
  const updated = await withUser(req.user!, async (client) => {
    const tenant = (await client.query(
      `SELECT t.id,t.status,t.deployment_reference,t.deployment_status
       FROM platform_tenants t JOIN platform_tenant_admins a ON a.tenant_id=t.id
       WHERE t.id=$1 AND a.user_id=$2 FOR UPDATE OF t`,
      [tenantId, req.user!.id],
    )).rows[0];
    if (!tenant) throw new HttpError(404, 'Assigned tenant not found.');
    if (tenant.status === 'active') throw new HttpError(409, 'Active tenant registrations can only be changed by the Global System Admin.');
    const reference = body.deployment_reference ?? tenant.deployment_reference;
    const deploymentStatus = body.deployment_status ?? (body.deployment_reference ? 'registered' : tenant.deployment_status);
    if (deploymentStatus === 'registered' && !reference) {
      throw new HttpError(422, 'A non-secret deployment reference is required for registration.');
    }
    const row = (await client.query(
      `UPDATE platform_tenants
       SET deployment_reference=$2,deployment_status=$3,config_version=config_version+1,updated_at=now()
       WHERE id=$1
       RETURNING id,tenant_key,display_name,deployment_reference,deployment_status,config_version,updated_at`,
      [tenantId, reference ?? null, deploymentStatus],
    )).rows[0];
    await client.query(
      `INSERT INTO platform_tenant_events(tenant_id,actor_id,event_type,event_data)
       VALUES($1,$2,'deployment_registered',$3)`,
      [tenantId, req.user!.id, JSON.stringify({ deployment_status: deploymentStatus })],
    );
    await audit(client, req.user!.id, 'platform_tenant_deployment_registered', 'platform_tenant', tenantId, null, {
      deployment_reference: reference ?? null,
      deployment_status: deploymentStatus,
    });
    return row;
  });
  res.json(updated);
}));

adminRouter.patch('/platform/my-tenants/:tenantId/modules', requireRole('super_admin'), h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const body = z.object({
    services: z.array(z.enum(PLATFORM_SERVICE_KEYS)).max(PLATFORM_SERVICE_KEYS.length),
  }).strict().parse(req.body);
  if (new Set(body.services).size !== body.services.length) {
    throw new HttpError(422, 'A service may only appear once in a tenant configuration.');
  }
  const updated = await withUser(req.user!, async (client) => {
    const tenant = (await client.query(
      `SELECT t.id,t.status FROM platform_tenants t
       JOIN platform_tenant_admins a ON a.tenant_id=t.id
       WHERE t.id=$1 AND a.user_id=$2 FOR UPDATE OF t`,
      [tenantId, req.user!.id],
    )).rows[0];
    if (!tenant) throw new HttpError(404, 'Assigned tenant not found.');
    if (tenant.status !== 'active') throw new HttpError(409, 'Only active assigned tenants can configure module availability.');
    const available = (await client.query(
      `SELECT DISTINCT s.service_key
       FROM platform_tenant_packages tp
       JOIN platform_service_packages p ON p.id=tp.package_id AND p.active
       JOIN platform_service_package_items i ON i.package_id=p.id
       JOIN platform_services s ON s.service_key=i.service_key AND s.available
       WHERE tp.tenant_id=$1`,
      [tenantId],
    )).rows.map((row) => row.service_key as string);
    if (body.services.some((service) => !available.includes(service))) {
      throw new HttpError(422, 'Tenant modules must be selected from the services enabled by the Global System Admin.');
    }
    const row = (await client.query(
      `INSERT INTO platform_tenant_module_config(tenant_id,enabled_services,updated_by)
       VALUES($1,$2,$3)
       ON CONFLICT(tenant_id) DO UPDATE
       SET enabled_services=EXCLUDED.enabled_services,updated_by=EXCLUDED.updated_by,updated_at=now()
       RETURNING tenant_id,enabled_services,updated_at`,
      [tenantId, body.services, req.user!.id],
    )).rows[0];
    await client.query(
      `INSERT INTO platform_tenant_events(tenant_id,actor_id,event_type,event_data)
       VALUES($1,$2,'tenant_modules_updated',$3)`,
      [tenantId, req.user!.id, JSON.stringify({ services: body.services })],
    );
    await audit(client, req.user!.id, 'platform_tenant_modules_updated', 'platform_tenant', tenantId, null, {
      services: body.services,
    });
    return row;
  });
  res.json(updated);
}));

adminRouter.get('/platform/business-tenants', requireRole('global_admin'), h(async (req, res) => {
  const tenants = await withUser(req.user!, async (client) => (await client.query(
    `SELECT t.id,t.tenant_key,t.display_name,t.tenant_type,t.owner_user_id,t.status,t.config_version,t.created_at,t.updated_at,
       owner.legal_name AS owner_name,owner.phone AS owner_phone,owner.role AS owner_role,owner.active AS owner_active,
       owner.kyc_status AS owner_kyc_status,
       COALESCE((SELECT jsonb_agg(jsonb_build_object(
         'user_id',member.user_id,'legal_name',member_user.legal_name,'phone',member_user.phone,
         'role',member.member_role,'status',member.status
       ) ORDER BY member.member_role,member_user.legal_name)
       FROM platform_business_tenant_members member JOIN users member_user ON member_user.id=member.user_id
       WHERE member.tenant_id=t.id),'[]'::jsonb) AS members
     FROM platform_business_tenants t JOIN users owner ON owner.id=t.owner_user_id
     ORDER BY t.tenant_type,t.display_name`)).rows);
  res.json(tenants);
}));

adminRouter.patch('/platform/business-tenants/:tenantId', requireRole('global_admin'), h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const body = z.object({
    status: z.enum(['active','suspended','retired']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  const updated = await withUser(req.user!, async (client) => {
    const current = (await client.query(
      `SELECT tenant.id,tenant.status,tenant.tenant_type,tenant.owner_user_id,owner.active,owner.kyc_status
       FROM platform_business_tenants tenant JOIN users owner ON owner.id=tenant.owner_user_id
       WHERE tenant.id=$1 FOR UPDATE OF tenant`, [tenantId],
    )).rows[0];
    if (!current) throw new HttpError(404, 'Business tenant not found.');
    if (current.status === 'retired') throw new HttpError(409, 'Retired business tenants cannot be reactivated.');
    if (body.status === 'active' && (!current.active || current.kyc_status !== 'verified')) {
      throw new HttpError(409, 'A business tenant owner must be active and KYC verified before tenant activation.');
    }
    if (current.status === body.status) throw new HttpError(409, `Business tenant is already ${body.status}.`);
    const row = (await client.query(
      `UPDATE platform_business_tenants SET status=$2,config_version=config_version+1,updated_at=now()
       WHERE id=$1 RETURNING id,tenant_key,display_name,tenant_type,status,config_version,updated_at`,
      [tenantId,body.status],
    )).rows[0];
    const eventType = body.status === 'active' ? 'tenant_activated' : body.status === 'suspended' ? 'tenant_suspended' : 'tenant_retired';
    await client.query(
      `INSERT INTO platform_business_tenant_events(tenant_id,actor_id,event_type,event_data)
       VALUES($1,$2,$3,$4)`, [tenantId,req.user!.id,eventType,JSON.stringify({ reason: body.reason, previous_status: current.status })],
    );
    await audit(client,req.user!.id,`business_tenant_${body.status}`,'platform_business_tenant',tenantId,
      { status: current.status },{ status: body.status, reason: body.reason });
    return row;
  });
  res.json(updated);
}));

adminRouter.get('/platform/my-business-tenant', requireRole('super_admin','master_agent','field_agent'), h(async (req, res) => {
  const tenants = await withUser(req.user!, async (client) => (await client.query(
    `SELECT tenant.id,tenant.tenant_key,tenant.display_name,tenant.tenant_type,tenant.owner_user_id,
       tenant.status,tenant.config_version,member.member_role,member.status AS member_status
     FROM platform_business_tenant_members member
     JOIN platform_business_tenants tenant ON tenant.id=member.tenant_id
     WHERE member.user_id=$1 AND member.status='active'
     ORDER BY tenant.tenant_type,tenant.display_name`,
    [req.user!.id],
  )).rows);
  res.json(tenants);
}));

adminRouter.post('/platform/tenants/:tenantId/admins', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const { user_id } = z.object({ user_id: z.string().uuid() }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    if (!(await client.query('SELECT 1 FROM platform_tenants WHERE id=$1', [tenantId])).rowCount) {
      throw new HttpError(404, 'Tenant not found.');
    }
    const user = (await client.query('SELECT id,role,active FROM users WHERE id=$1 FOR UPDATE', [user_id])).rows[0];
    if (!user || user.role !== 'super_admin' || !user.active) throw new HttpError(422, 'Choose an active Super Admin account.');
    await client.query(
      'INSERT INTO platform_tenant_admins(tenant_id,user_id,assigned_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [tenantId, user_id, req.user!.id],
    );
    await audit(client, req.user!.id, 'platform_tenant_admin_assigned', 'platform_tenant', tenantId, null, { user_id });
  });
  res.sendStatus(204);
}));

adminRouter.delete('/platform/tenants/:tenantId/admins/:userId', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const userId = z.string().uuid().parse(req.params.userId);
  await withUser(req.user!, async (client) => {
    const removed = await client.query('DELETE FROM platform_tenant_admins WHERE tenant_id=$1 AND user_id=$2', [tenantId, userId]);
    if (!removed.rowCount) throw new HttpError(404, 'Tenant Super Admin assignment not found.');
    await audit(client, req.user!.id, 'platform_tenant_admin_unassigned', 'platform_tenant', tenantId, { user_id: userId }, null);
  });
  res.sendStatus(204);
}));

adminRouter.get('/platform/my-data-capabilities', h(async (req, res) => {
  const scopes = await withUser(req.user!, (client) => getMyTenantDataScopes(client, req.user!.id));
  res.json(scopes);
}));

adminRouter.get('/platform/my-data/:tenantId/workspace', h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const scope = await withUser(req.user!, async (client) => {
    const result = await getTenantDataScope(client, req.user!.id, tenantId);
    if (!result) throw new HttpError(404, 'No active data-administrator assignment exists for this tenant.');
    return result;
  });
  res.json({
    scope: 'tenant',
    tenant: {
      id: scope.tenant_id,
      key: scope.tenant_key,
      name: scope.display_name,
      hosting_mode: scope.hosting_mode,
      region: scope.region,
      deployment_status: scope.deployment_status,
      config_version: scope.config_version,
      updated_at: scope.tenant_updated_at,
    },
    capabilities: scope.capabilities,
    database_access: 'metadata_only',
    database_endpoint: null,
    secrets: null,
    raw_records: null,
    execution: 'not_performed',
  });
}));

adminRouter.get('/platform/my-data/:tenantId/analytics', h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const result = await withUser(req.user!, async (client) => {
    const scope = await getTenantDataScope(client, req.user!.id, tenantId);
    if (!scope) throw new HttpError(404, 'No active data-administrator assignment exists for this tenant.');
    requireTenantDataCapability(scope, 'analytics_admin');
    return scope;
  });
  res.json({
    scope: 'tenant',
    tenant: { id: result.tenant_id, key: result.tenant_key, name: result.display_name },
    grain: '30_minutes',
    bucket_time_zone: 'UTC',
    projector_status: 'not_connected',
    scheduler_status: 'not_configured',
    health: 'unconfirmed',
    message: 'Tenant-local analytics projector is not connected. No tenant analytics are available from the central platform.',
    metrics: [],
    series: [],
  });
}));

adminRouter.get('/platform/my-data/:tenantId/migration-runs', h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const result = await withUser(req.user!, async (client) => {
    const scope = await getTenantDataScope(client, req.user!.id, tenantId);
    if (!scope) throw new HttpError(404, 'No active data-administrator assignment exists for this tenant.');
    requireTenantDataCapability(scope, 'database_admin');
    const [runs, events] = await Promise.all([
      client.query(
        `SELECT id,tenant_id,created_by,source_reference,target_reference,summary,created_at
         FROM platform_tenant_migration_runs
         WHERE tenant_id=$1
         ORDER BY created_at DESC,id DESC LIMIT 100`,
        [tenantId],
      ),
      client.query(
        `SELECT event.id,event.run_id,event.actor_id,
                event.stage,event.manifest_sha256,event.source_record_count,event.staged_record_count,
                event.unresolved_count,event.validation_error_count,event.evidence_reference,
                event.notes,event.created_at
         FROM platform_tenant_migration_events event
         WHERE event.tenant_id=$1
         ORDER BY event.id`,
        [tenantId],
      ),
    ]);
    const eventsByRun = new Map<string, typeof events.rows>();
    for (const event of events.rows) {
      const entries = eventsByRun.get(event.run_id) ?? [];
      entries.push(event);
      eventsByRun.set(event.run_id, entries);
    }
    return runs.rows.map((run) => {
      const runEvents = eventsByRun.get(run.id) ?? [];
      return { ...run, current_stage: runEvents[runEvents.length - 1]?.stage ?? 'invalid', events: runEvents };
    });
  });
  res.json(result);
}));

adminRouter.post('/platform/my-data/:tenantId/migration-runs', h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const body = tenantMigrationStartSchema.parse(req.body);
  const created = await withUser(req.user!, async (client) => {
    const scope = await getTenantDataScope(client, req.user!.id, tenantId);
    if (!scope) throw new HttpError(404, 'No active data-administrator assignment exists for this tenant.');
    requireTenantDataCapability(scope, 'database_admin');
    const run = (await client.query(
      `INSERT INTO platform_tenant_migration_runs
         (tenant_id,created_by,source_reference,target_reference,summary)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id,tenant_id,created_by,source_reference,target_reference,summary,created_at`,
      [tenantId,req.user!.id,body.source_reference,body.target_reference,body.summary],
    )).rows[0];
    const event = (await client.query(
      `INSERT INTO platform_tenant_migration_events
         (run_id,tenant_id,actor_id,stage,manifest_sha256,evidence_reference,notes)
       VALUES($1,$2,$3,'planned',$4,$5,$6)
       RETURNING id,stage,created_at`,
      [run.id,tenantId,req.user!.id,body.manifest_sha256,body.evidence_reference,body.notes],
    )).rows[0];
    await audit(client, req.user!.id, 'platform_tenant_migration_planned',
      'platform_tenant_migration_run', run.id, null, {
        tenant_id: tenantId,
        source_reference: body.source_reference,
        target_reference: body.target_reference,
        manifest_sha256: body.manifest_sha256,
      });
    return { ...run, current_stage: event.stage };
  });
  res.status(201).json(created);
}));

adminRouter.post('/platform/my-data/:tenantId/migration-runs/:runId/events', h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const runId = z.string().uuid().parse(req.params.runId);
  const body = tenantMigrationEventSchema.parse(req.body);
  const created = await withUser(req.user!, async (client) => {
    const scope = await getTenantDataScope(client, req.user!.id, tenantId);
    if (!scope) throw new HttpError(404, 'No active data-administrator assignment exists for this tenant.');
    requireTenantDataCapability(scope, 'database_admin');
    const event = (await client.query(
      `INSERT INTO platform_tenant_migration_events
         (run_id,tenant_id,actor_id,stage,manifest_sha256,source_record_count,staged_record_count,
          unresolved_count,validation_error_count,evidence_reference,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id,stage,created_at`,
      [runId,tenantId,req.user!.id,body.stage,body.manifest_sha256 ?? null,
        body.source_record_count ?? null,body.staged_record_count ?? null,body.unresolved_count,
        body.validation_error_count,body.evidence_reference,body.notes],
    )).rows[0];
    await audit(client, req.user!.id, 'platform_tenant_migration_stage_recorded',
      'platform_tenant_migration_run', runId, null, {
        tenant_id: tenantId,
        stage: event.stage,
        evidence_reference: body.evidence_reference,
        manifest_sha256: body.manifest_sha256 ?? null,
      });
    return event;
  });
  res.status(201).json(created);
}));

adminRouter.post('/platform/my-data/:tenantId/operator-requests', h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const body = tenantOperatorRequestSchema.omit({ tenant_id: true }).strict().parse(req.body);
  const created = await withUser(req.user!, async (client) => {
    const scope = await getTenantDataScope(client, req.user!.id, tenantId);
    if (!scope) throw new HttpError(404, 'No active data-administrator assignment exists for this tenant.');
    requireTenantDataCapability(scope, 'database_admin');
    const row = (await client.query(
      `INSERT INTO platform_tenant_operator_requests
         (tenant_id,actor_id,request_type,summary,evidence_reference)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id,tenant_id,request_type,summary,evidence_reference,created_at`,
      [tenantId, req.user!.id, body.request_type, body.summary, body.evidence_reference ?? null],
    )).rows[0];
    await audit(client, req.user!.id, 'platform_tenant_operator_request_created',
      'platform_tenant_operator_request', row.id, null, {
        tenant_id: row.tenant_id,
        request_type: row.request_type,
        evidence_reference: row.evidence_reference,
      });
    return row;
  });
  res.status(201).json({ ...created, status: 'requested', execution: 'not_performed' });
}));

adminRouter.get('/platform/tenant-capabilities', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const result = await withUser(req.user!, async (client) => {
    const [tenants, grants, requests] = await Promise.all([
      client.query(
        `SELECT id,tenant_key,display_name,status,hosting_mode,region
         FROM platform_tenants ORDER BY display_name`,
      ),
      client.query(
        `SELECT g.tenant_id,g.user_id,u.legal_name,u.role,g.capability,g.assigned_at
         FROM platform_tenant_capability_grants g JOIN users u ON u.id=g.user_id
         ORDER BY g.tenant_id,u.legal_name,g.capability`,
      ),
      client.query(
        `SELECT r.id,r.tenant_id,t.display_name AS tenant_name,r.request_type,r.summary,
                r.evidence_reference,r.created_at,r.actor_id
         FROM platform_tenant_operator_requests r
         JOIN platform_tenants t ON t.id=r.tenant_id
         ORDER BY r.created_at DESC LIMIT 100`,
      ),
    ]);
    return {
      tenants: tenants.rows,
      grants: grants.rows,
      operatorRequests: requests.rows.map((row) => ({ ...row, status: 'requested', execution: 'not_performed' })),
    };
  });
  res.json(result);
}));

adminRouter.get('/platform/tenant-capabilities/:tenantId/eligible-users', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const users = await withUser(req.user!, async (client) => {
    const tenant = (await client.query(
      `SELECT status FROM platform_tenants WHERE id=$1`, [tenantId],
    )).rows[0];
    if (!tenant) throw new HttpError(404, 'Tenant not found.');
    if (tenant.status !== 'active') throw new HttpError(409, 'Only active tenants can receive data-administrator assignments.');
    return (await client.query(
      `SELECT id,legal_name,role FROM users
       WHERE active AND role <> ALL($1::text[])
       ORDER BY legal_name,id LIMIT 500`,
      [EXCLUDED_TENANT_CAPABILITY_ROLES],
    )).rows;
  });
  res.json(users);
}));

adminRouter.put('/platform/tenant-capabilities/:tenantId/:userId', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const userId = z.string().uuid().parse(req.params.userId);
  const body = z.object({ capabilities: tenantCapabilitiesSchema }).strict().parse(req.body);
  const updated = await withUser(req.user!, async (client) => {
    const target = (await client.query(
      `SELECT u.id,u.role,u.active,t.status AS tenant_status
       FROM users u CROSS JOIN platform_tenants t
       WHERE u.id=$1 AND t.id=$2 FOR UPDATE OF u,t`,
      [userId, tenantId],
    )).rows[0];
    if (!target) throw new HttpError(404, 'Tenant or account not found.');
    if (target.tenant_status !== 'active') throw new HttpError(409, 'Only active tenants can receive data-administrator assignments.');
    if (!target.active || EXCLUDED_TENANT_CAPABILITY_ROLES.includes(target.role)) {
      throw new HttpError(422, 'Choose an active eligible account. Super Admin, Master Agent, and Global Admin accounts are excluded.');
    }
    await client.query(
      'DELETE FROM platform_tenant_capability_grants WHERE tenant_id=$1 AND user_id=$2',
      [tenantId, userId],
    );
    for (const capability of body.capabilities) {
      await client.query(
        `INSERT INTO platform_tenant_capability_grants(tenant_id,user_id,capability,assigned_by)
         VALUES($1,$2,$3,$4)`,
        [tenantId, userId, capability, req.user!.id],
      );
    }
    await client.query(
      `INSERT INTO platform_tenant_capability_events(tenant_id,subject_user_id,actor_id,event_type,capabilities)
       VALUES($1,$2,$3,'capabilities_replaced',$4::text[])`,
      [tenantId, userId, req.user!.id, body.capabilities],
    );
    await audit(client, req.user!.id, 'platform_tenant_capabilities_replaced',
      'platform_tenant', tenantId, null, { user_id: userId, capabilities: body.capabilities });
    return { tenant_id: tenantId, user_id: userId, capabilities: body.capabilities };
  });
  res.json(updated);
}));

adminRouter.post('/platform/operator-requests', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const body = tenantOperatorRequestSchema.parse(req.body);
  const created = await withUser(req.user!, async (client) => {
    const tenant = (await client.query(
      'SELECT id,status FROM platform_tenants WHERE id=$1', [body.tenant_id],
    )).rows[0];
    if (!tenant) throw new HttpError(404, 'Tenant not found.');
    if (tenant.status !== 'active') throw new HttpError(409, 'Operational review requests require an active tenant.');
    const row = (await client.query(
      `INSERT INTO platform_tenant_operator_requests
         (tenant_id,actor_id,request_type,summary,evidence_reference)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id,tenant_id,request_type,summary,evidence_reference,created_at`,
      [body.tenant_id, req.user!.id, body.request_type, body.summary, body.evidence_reference ?? null],
    )).rows[0];
    await audit(client, req.user!.id, 'platform_tenant_operator_request_created',
      'platform_tenant_operator_request', row.id, null, {
        tenant_id: row.tenant_id,
        request_type: row.request_type,
        evidence_reference: row.evidence_reference,
      });
    return row;
  });
  res.status(201).json({ ...created, status: 'requested', execution: 'not_performed' });
}));

adminRouter.post('/platform/tenants', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const body = z.object({
    tenant_key: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9-]{1,79}$/),
    display_name: z.string().trim().min(2).max(160),
    hosting_mode: z.enum(['cloud','on_premises']),
    region: z.string().trim().min(2).max(120).optional(),
    deployment_reference: z.string().trim().min(2).max(200).optional(),
    package_id: z.string().uuid(),
  }).strict().parse(req.body);
  if (body.deployment_reference && (/(password|secret|token|credential)/i.test(body.deployment_reference) || body.deployment_reference.includes('://'))) {
    throw new HttpError(422, 'Deployment references must not contain credentials or connection URLs.');
  }
  const tenant = await withUser(req.user!, async (client) => {
    const servicePackage = (await client.query(
      'SELECT id FROM platform_service_packages WHERE id=$1 AND active FOR SHARE', [body.package_id],
    )).rows[0];
    if (!servicePackage) throw new HttpError(422, 'Choose an active service package.');
    const created = (await client.query(
      `INSERT INTO platform_tenants
         (tenant_key,display_name,hosting_mode,region,deployment_reference,created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id,tenant_key,display_name,status,hosting_mode,region,deployment_reference,
         deployment_status,config_version,created_at,updated_at`,
      [body.tenant_key, body.display_name, body.hosting_mode, body.region ?? null,
        body.deployment_reference ?? null, req.user!.id],
    )).rows[0];
    await client.query(
      'INSERT INTO platform_tenant_packages (tenant_id,package_id,assigned_by) VALUES ($1,$2,$3)',
      [created.id, body.package_id, req.user!.id],
    );
    await client.query(
      `INSERT INTO platform_tenant_admins(tenant_id,user_id,assigned_by,role_grant_managed)
       SELECT $1,user_id,$2,true FROM user_admin_role_grants
       WHERE role_name='super_admin' AND all_tenants
       ON CONFLICT(tenant_id,user_id) DO NOTHING`,
      [created.id, req.user!.id],
    );
    await client.query(
      `INSERT INTO platform_tenant_events (tenant_id,actor_id,event_type,event_data)
       VALUES ($1,$2,'tenant_created',$3)`,
      [created.id, req.user!.id, JSON.stringify({
        hosting_mode: body.hosting_mode, package_id: body.package_id,
        deployment_reference: body.deployment_reference ?? null,
      })],
    );
    await audit(client, req.user!.id, 'platform_tenant_created', 'platform_tenant', created.id, null, {
      tenant_key: body.tenant_key, hosting_mode: body.hosting_mode,
    });
    return created;
  });
  res.status(201).json(tenant);
}));

adminRouter.patch('/platform/tenants/:tenantId', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const tenantId = z.string().uuid().parse(req.params.tenantId);
  const body = z.object({
    display_name: z.string().trim().min(2).max(160).optional(),
    status: z.enum(['provisioning','active','suspended','retired']).optional(),
    hosting_mode: z.enum(['cloud','on_premises']).optional(),
    region: z.string().trim().min(2).max(120).nullable().optional(),
    deployment_reference: z.string().trim().min(2).max(200).nullable().optional(),
    deployment_status: z.enum(['not_registered','registered','verified']).optional(),
    deployment_verification_reference: z.string().trim().min(2).max(200).optional(),
    package_id: z.string().uuid().optional(),
  }).strict().refine((value) => Object.keys(value).length > 0);
  const changes = body.parse(req.body);
  if (changes.deployment_reference && (/(password|secret|token|credential)/i.test(changes.deployment_reference) || changes.deployment_reference.includes('://'))) {
    throw new HttpError(422, 'Deployment references must not contain credentials or connection URLs.');
  }
  if (changes.deployment_verification_reference
    && (/(password|secret|token|credential)/i.test(changes.deployment_verification_reference)
      || changes.deployment_verification_reference.includes('://'))) {
    throw new HttpError(422, 'Verification evidence must be a non-secret reference, not a URL or credential.');
  }
  const updated = await withUser(req.user!, async (client) => {
    const prior = (await client.query(
      `SELECT t.* FROM platform_tenants t
       WHERE t.id=$1 AND ($2::text IN ('global_admin','super_admin') OR EXISTS(
         SELECT 1 FROM platform_tenant_admins a WHERE a.tenant_id=t.id AND a.user_id=$3
       )) FOR UPDATE`,
      [tenantId, req.user!.role, req.user!.id],
    )).rows[0];
    if (!prior) throw new HttpError(404, 'Tenant not found.');
    const deploymentChanged = ['hosting_mode', 'region', 'deployment_reference']
      .some((key) => Object.hasOwn(changes, key));
    if (prior.status === 'active' && deploymentChanged && changes.status !== 'suspended') {
      throw new HttpError(409, 'Suspend the tenant before changing its deployment identity.');
    }
    const nextStatus = changes.status ?? prior.status;
    const nextDeploymentStatus = changes.deployment_status
      ?? (deploymentChanged ? (changes.deployment_reference ?? prior.deployment_reference ? 'registered' : 'not_registered') : prior.deployment_status);
    const verificationReference = changes.deployment_verification_reference
      ?? (deploymentChanged || nextDeploymentStatus !== 'verified' ? null : prior.deployment_verification_reference);
    if (nextDeploymentStatus === 'verified' && !verificationReference) {
      throw new HttpError(422, 'Record a non-secret deployment verification evidence reference before verification.');
    }
    if (changes.deployment_verification_reference && nextDeploymentStatus !== 'verified') {
      throw new HttpError(422, 'Verification evidence can only be recorded while marking the deployment verified.');
    }
    if (nextStatus === 'active' && nextDeploymentStatus !== 'verified') {
      throw new HttpError(409, 'Verify the tenant deployment before activating it.');
    }
    if (changes.package_id) {
      const packageRow = (await client.query(
        'SELECT id FROM platform_service_packages WHERE id=$1 AND active', [changes.package_id],
      )).rows[0];
      if (!packageRow) throw new HttpError(422, 'Choose an active service package.');
      await client.query('DELETE FROM platform_tenant_packages WHERE tenant_id=$1', [tenantId]);
      await client.query(
        'INSERT INTO platform_tenant_packages (tenant_id,package_id,assigned_by) VALUES ($1,$2,$3)',
        [tenantId, changes.package_id, req.user!.id],
      );
    }
    if (req.user!.role === 'super_admin') {
      await client.query("SELECT set_config('app.platform_control_plane','true',true)");
    }
    const row = (await client.query(
      `UPDATE platform_tenants SET
         display_name=COALESCE($2,display_name),status=$3,hosting_mode=COALESCE($4,hosting_mode),
         region=CASE WHEN $5 THEN $6 ELSE region END,
         deployment_reference=CASE WHEN $7 THEN $8 ELSE deployment_reference END,
         deployment_status=$9,deployment_verification_reference=$10,
         config_version=config_version+1,updated_at=now()
       WHERE id=$1
       RETURNING id,tenant_key,display_name,status,hosting_mode,region,deployment_reference,
         deployment_status,deployment_verification_reference,config_version,created_at,updated_at`,
      [tenantId, changes.display_name ?? null, nextStatus, changes.hosting_mode ?? null,
        Object.hasOwn(changes, 'region'), changes.region ?? null,
        Object.hasOwn(changes, 'deployment_reference'), changes.deployment_reference ?? null,
        nextDeploymentStatus, verificationReference],
    )).rows[0];
    const eventType = changes.status === 'suspended' ? 'tenant_suspended'
      : changes.status === 'retired' ? 'tenant_retired'
        : changes.status === 'active' ? 'tenant_reactivated'
          : changes.deployment_status === 'verified' ? 'deployment_verified'
            : changes.deployment_reference !== undefined ? 'deployment_registered'
              : changes.package_id ? 'service_package_assigned' : 'tenant_updated';
    await client.query(
      `INSERT INTO platform_tenant_events (tenant_id,actor_id,event_type,event_data)
       VALUES ($1,$2,$3,$4)`,
      [tenantId, req.user!.id, eventType, JSON.stringify(changes)],
    );
    await audit(client, req.user!.id, 'platform_tenant_updated', 'platform_tenant', tenantId,
      { status: prior.status, deployment_status: prior.deployment_status, config_version: prior.config_version }, changes);
    return row;
  });
  res.json(updated);
}));

adminRouter.get('/platform/catalog-products', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const products = await withUser(req.user!, async (client) => (await client.query(
    `SELECT id,product_key,display_name,description,category,status,attributes,created_by,updated_by,created_at,updated_at
     FROM platform_catalog_products ORDER BY created_at DESC,product_key`,
  )).rows);
  res.json(products);
}));

adminRouter.post('/platform/catalog-products', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const body = z.object({
    product_key: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{1,79}$/),
    display_name: z.string().trim().min(2).max(160),
    description: z.string().trim().min(2).max(2000),
    category: z.enum(['catalog','marketplace','service_addon']),
    attributes: z.record(z.string(), z.union([z.string().max(500),z.number().finite(),z.boolean()])).default({}),
  }).strict().parse(req.body);
  const product = await withUser(req.user!, async (client) => {
    const row = (await client.query(
      `INSERT INTO platform_catalog_products
         (product_key,display_name,description,category,attributes,created_by,updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$6)
       RETURNING id,product_key,display_name,description,category,status,attributes,created_by,updated_by,created_at,updated_at`,
      [body.product_key, body.display_name, body.description, body.category,
        JSON.stringify(body.attributes), req.user!.id],
    )).rows[0];
    await client.query(
      `INSERT INTO platform_catalog_product_events (product_id,actor_id,event_type,event_data)
       VALUES ($1,$2,'product_created',$3)`,
      [row.id, req.user!.id, JSON.stringify({ category: body.category })],
    );
    await audit(client, req.user!.id, 'platform_catalog_product_created', 'platform_catalog_product', row.id, null, {
      product_key: body.product_key, category: body.category,
    });
    return row;
  });
  res.status(201).json(product);
}));

adminRouter.patch('/platform/catalog-products/:productId', requirePlatformControlPlaneAdmin, h(async (req, res) => {
  const productId = z.string().uuid().parse(req.params.productId);
  const body = z.object({
    display_name: z.string().trim().min(2).max(160),
    description: z.string().trim().min(2).max(2000),
    status: z.enum(['draft','active','retired']),
    attributes: z.record(z.string(), z.union([z.string().max(500),z.number().finite(),z.boolean()])),
  }).strict().parse(req.body);
  const product = await withUser(req.user!, async (client) => {
    const updated = await client.query(
      `UPDATE platform_catalog_products
       SET display_name=$2,description=$3,status=$4,attributes=$5,updated_by=$6,updated_at=now()
       WHERE id=$1
       RETURNING id,product_key,display_name,description,category,status,attributes,created_by,updated_by,created_at,updated_at`,
      [productId, body.display_name, body.description, body.status, JSON.stringify(body.attributes), req.user!.id],
    );
    if (!updated.rowCount) throw new HttpError(404, 'Catalog product not found.');
    const eventType = body.status === 'active' ? 'product_activated'
      : body.status === 'retired' ? 'product_retired' : 'product_updated';
    await client.query(
      `INSERT INTO platform_catalog_product_events (product_id,actor_id,event_type,event_data)
       VALUES ($1,$2,$3,$4)`,
      [productId, req.user!.id, eventType, JSON.stringify({ status: body.status })],
    );
    await audit(client, req.user!.id, 'platform_catalog_product_updated', 'platform_catalog_product', productId, null, body);
    return updated.rows[0];
  });
  res.json(product);
}));

const requireGlobalSystemAdmin: RequestHandler = (req, _res, next) =>
  req.user?.role === 'global_admin'
    ? next()
    : next(new HttpError(403, 'Only a Global System Admin can configure shared role templates.'));

adminRouter.get('/role-access', requireGlobalSystemAdmin, h(async (req, res) => {
  const configured = await withUser(req.user!, async (c) => (await c.query(
    'SELECT role_name, activity_key, enabled FROM role_activity_permissions ORDER BY role_name, activity_key',
  )).rows);
  const overrides = Object.fromEntries(ROLE_NAMES.map((role) => [role, {} as Record<string, boolean>]));
  for (const row of configured) overrides[row.role_name][row.activity_key] = row.enabled;
  res.json({
    roles: ROLE_NAMES.map((role) => ({ key: role, editable: role !== 'super_admin' })),
    activities: ROLE_ACTIVITIES,
    overrides,
  });
}));

adminRouter.get('/role-access/history', requireGlobalSystemAdmin, h(async (req, res) => {
  const query = z.object({
    role: z.string().min(1).max(80).optional(),
    activity: z.string().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  }).strict().parse(req.query);
  if (query.role && !ROLE_NAMES.includes(query.role as RoleName)) {
    throw new HttpError(422, 'Unknown role.');
  }
  if (query.activity && !getRoleActivity(query.activity)) {
    throw new HttpError(422, 'Unknown role activity.');
  }
  const history = await withUser(req.user!, async (c) => (await c.query(
    `SELECT id, actor_id, role_name, activity_key, previous_enabled, new_enabled, changed_at
     FROM role_activity_permission_audit
     WHERE ($1::text IS NULL OR role_name=$1)
       AND ($2::text IS NULL OR activity_key=$2)
     ORDER BY changed_at DESC, id DESC LIMIT $3`,
    [query.role ?? null, query.activity ?? null, query.limit],
  )).rows);
  res.json({ history });
}));

adminRouter.get('/users/:id/access-history', requireRole('global_admin', 'compliance'), h(async (req, res) => {
  const userId = z.string().uuid().parse(req.params.id);
  const query = z.object({
    at: z.string().datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  }).strict().parse(req.query);
  const result = await withUser(req.user!, async (c) => {
    if (!(await c.query('SELECT 1 FROM users WHERE id=$1', [userId])).rowCount) {
      throw new HttpError(404, 'User not found');
    }
    const history = (await c.query(
      `SELECT id, previous_role, role_after AS current_role, previous_active, current_active,
              actor_id, reason, baseline, changed_at
       FROM user_access_history
       WHERE user_id=$1 AND ($2::timestamptz IS NULL OR changed_at <= $2::timestamptz)
       ORDER BY changed_at DESC, id DESC LIMIT $3`,
      [userId, query.at ?? null, query.limit],
    )).rows;
    if (query.at && !history.length) {
      throw new HttpError(422, 'Access history is unavailable for the requested time.');
    }
    return {
      history,
      state_at_time: query.at && history.length
        ? { role: history[0].current_role, active: history[0].current_active, as_of: query.at }
        : null,
    };
  });
  res.json(result);
}));

const miniAppAccessUpdate = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('role_default'),
    modules: z.array(z.enum(WORKSPACE_MODULES)).max(WORKSPACE_MODULES.length).default([]),
  }).strict(),
  z.object({
    mode: z.literal('custom'),
    modules: z.array(z.enum(WORKSPACE_MODULES)).max(WORKSPACE_MODULES.length),
  }).strict(),
]).superRefine((body, context) => {
  if (new Set(body.modules).size !== body.modules.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Mini-app modules must not be duplicated' });
  }
  if (body.mode === 'role_default' && body.modules.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Role-default access cannot include explicit modules' });
  }
});

adminRouter.get('/users/:id/mini-app-access', requireRole('global_admin'), h(async (req, res) => {
  const userId = z.string().uuid().parse(req.params.id);
  const result = await withUser(req.user!, async (client) => {
    if (!(await client.query('SELECT 1 FROM users WHERE id=$1', [userId])).rowCount) {
      throw new HttpError(404, 'User not found');
    }
    const profile = (await client.query(
      `SELECT mode FROM user_app_access_profiles WHERE user_id=$1`,
      [userId],
    )).rows[0];
    const modules = (await client.query(
      `SELECT module_key FROM user_app_access_grants WHERE user_id=$1 ORDER BY module_key`,
      [userId],
    )).rows.map((row) => row.module_key);
    return { mode: profile?.mode ?? 'role_default', modules };
  });
  res.json({
    ...result,
    availableModules: WORKSPACE_MODULES.map((id) => ({ id, label: MINI_APP_LABELS[id] })),
  });
}));

adminRouter.get('/users/:id/mini-app-access/history', requireRole('global_admin'), h(async (req, res) => {
  const userId = z.string().uuid().parse(req.params.id);
  const limit = z.coerce.number().int().min(1).max(500).default(100).parse(req.query.limit);
  const history = await withUser(req.user!, async (client) => {
    if (!(await client.query('SELECT 1 FROM users WHERE id=$1', [userId])).rowCount) {
      throw new HttpError(404, 'User not found');
    }
    return (await client.query(
      `SELECT actor_id,previous_mode,new_mode,previous_modules,new_modules,changed_at
       FROM user_app_access_audit WHERE target_user_id=$1
       ORDER BY changed_at DESC,id DESC LIMIT $2`,
      [userId, limit],
    )).rows;
  });
  res.json({ history });
}));

adminRouter.put('/users/:id/mini-app-access', requireRole('global_admin'), h(async (req, res) => {
  const userId = z.string().uuid().parse(req.params.id);
  const body = miniAppAccessUpdate.parse(req.body);
  if (userId === req.user!.id) {
    throw new HttpError(409, 'Use another platform administrator to change your own mini-app assignments.');
  }
  const modules = [...body.modules].sort();
  const saved = await withUser(req.user!, async (client) => {
    const target = (await client.query('SELECT id, role FROM users WHERE id=$1 FOR UPDATE', [userId])).rows[0];
    if (!target) throw new HttpError(404, 'User not found');
    if (target.role === 'global_admin' && req.user!.role !== 'global_admin') {
      throw new HttpError(403, 'Only a Global Admin can change a Global Admin mini-app assignment.');
    }
    const previousMode = (await client.query(
      'SELECT mode FROM user_app_access_profiles WHERE user_id=$1 FOR UPDATE',
      [userId],
    )).rows[0]?.mode ?? 'role_default';
    const previousModules = (await client.query(
      'SELECT module_key FROM user_app_access_grants WHERE user_id=$1 ORDER BY module_key',
      [userId],
    )).rows.map((row) => row.module_key as string);

    if (body.mode === 'custom') {
      await client.query(
        `INSERT INTO user_app_access_profiles(user_id,mode,updated_by)
         VALUES($1,'custom',$2)
         ON CONFLICT(user_id) DO UPDATE SET mode='custom',updated_by=EXCLUDED.updated_by,updated_at=now()`,
        [userId, req.user!.id],
      );
      await client.query('DELETE FROM user_app_access_grants WHERE user_id=$1', [userId]);
      for (const module of modules) {
        await client.query(
          'INSERT INTO user_app_access_grants(user_id,module_key,assigned_by) VALUES($1,$2,$3)',
          [userId, module, req.user!.id],
        );
      }
    } else {
      await client.query('DELETE FROM user_app_access_grants WHERE user_id=$1', [userId]);
      await client.query('DELETE FROM user_app_access_profiles WHERE user_id=$1', [userId]);
    }

    await client.query(
      `INSERT INTO user_app_access_audit
         (target_user_id,actor_id,previous_mode,new_mode,previous_modules,new_modules)
       VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
      [userId, req.user!.id, previousMode, body.mode, JSON.stringify(previousModules), JSON.stringify(modules)],
    );
    return { mode: body.mode, modules: body.mode === 'custom' ? modules : [] };
  });
  invalidateUser(userId);
  res.json(saved);
}));

adminRouter.patch('/role-access', requireGlobalSystemAdmin, h(async (req, res) => {
  const body = z.object({
    changes: z.array(z.object({
      role: z.string().min(1).max(80),
      activity: z.string().min(1).max(100),
      enabled: z.boolean(),
    }).strict()).min(1).max(300),
  }).strict().parse(req.body);
  const seen = new Set<string>();
  for (const change of body.changes) {
    if (!ROLE_NAMES.includes(change.role as RoleName) || change.role === 'super_admin') {
      throw new HttpError(422, 'Super Admin access is fixed and cannot be edited here.');
    }
    if (!getRoleActivity(change.activity)) throw new HttpError(422, 'Unknown role activity.');
    const pair = `${change.role}:${change.activity}`;
    if (seen.has(pair)) throw new HttpError(422, 'A role activity may only be changed once per submission.');
    seen.add(pair);
  }

  const changed = await withUser(req.user!, async (c) => {
    let count = 0;
    for (const change of body.changes) {
      const previous = (await c.query(
        'SELECT enabled FROM role_activity_permissions WHERE role_name=$1 AND activity_key=$2 FOR UPDATE',
        [change.role, change.activity],
      )).rows[0]?.enabled as boolean | undefined;
      if (previous === change.enabled) continue;
      await c.query(
        `INSERT INTO role_activity_permissions (role_name, activity_key, enabled, updated_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (role_name, activity_key)
         DO UPDATE SET enabled=EXCLUDED.enabled, updated_by=EXCLUDED.updated_by, updated_at=now()`,
        [change.role, change.activity, change.enabled, req.user!.id],
      );
      await c.query(
        `INSERT INTO role_activity_permission_audit
           (actor_id, role_name, activity_key, previous_enabled, new_enabled)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.user!.id, change.role, change.activity, previous ?? null, change.enabled],
      );
      count += 1;
    }
    return count;
  });
  invalidateRolePermissions();
  res.json({ changed });
}));

adminRouter.get('/auth/me', h(async (req, res) => {
  const r = await pool.query(`
    SELECT u.legal_name, u.role, u.kyc_status, u.mfa_enabled, u.whatsapp_opt_in, u.must_change_password,
           COALESCE(s.requested_plan, 'free') AS service_plan,
           COALESCE(s.payment_status, 'not_configured') AS service_payment_status,
           COALESCE(s.status = 'approved', false) AS service_plan_approved,
           COALESCE(s.status = 'approved' AND s.payment_status = 'paid' AND s.requested_plan IN ('pro','enterprise'), false) AS listing_features_enabled,
           COALESCE(s.status = 'approved' AND s.payment_status = 'paid' AND s.requested_plan = 'enterprise', false) AS enterprise_features_enabled
    FROM users u LEFT JOIN user_signups s ON s.user_id = u.id
    WHERE u.id = $1
  `, [req.user!.id]);
  res.json({
    ...r.rows[0],
    role: req.user!.role,
    primary_role: req.user!.primaryRole,
    access_options: req.user!.accessOptions ?? [req.user!.role],
    active_role_all_tenants: req.user!.adminRoleAllTenants ?? false,
    required_security_step: req.user!.rst ?? null,
    edir_id: req.user!.edir_id,
    session_idle_timeout_minutes: sessionIdleTimeoutMinutes(process.env),
    role_activities: Object.fromEntries(ROLE_ACTIVITIES.map(({ key }) => [
      key,
      hasRoleActivityAccess(req.user!.role, key, req.user!.rolePermissions),
    ])),
  });
}));

adminRouter.post('/auth/access-role', h(async (req, res) => {
  const { role } = z.object({ role: z.enum(['global_admin', 'super_admin']) }).strict().parse(req.body);
  const primaryRole = req.user!.primaryRole ?? req.user!.role;
  const allowed = role === primaryRole || (req.user!.accessOptions ?? []).includes(role);
  if (!allowed) throw new HttpError(403, 'This access mode is not assigned to your account.');
  if (process.env.REQUIRE_MFA_FOR_STAFF === '1' && MFA_STAFF.includes(role)) {
    const account = (await pool.query('SELECT mfa_enabled FROM users WHERE id=$1', [req.user!.id])).rows[0];
    if (!account?.mfa_enabled) throw new HttpError(403, 'Set up multi-factor authentication before using administrator access.');
  }
  await withUser(req.user!, async (client) => {
    const updated = await client.query(
      `UPDATE auth_sessions SET active_role=$3
       WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>now()
       RETURNING id`,
      [req.user!.sessionId, req.user!.id, role],
    );
    if (!updated.rowCount) throw new HttpError(401, 'Your session is no longer active.');
    await audit(client, req.user!.id, 'administrator_access_mode_selected', 'auth_session', req.user!.sessionId!, {
      role: req.user!.role,
    }, { role });
  });
  invalidateUser(req.user!.id);
  res.json({ role });
}));

adminRouter.get('/auth/session', (_req, res) => res.sendStatus(204));

adminRouter.get('/auth/sessions', h(async (req, res) => {
  const sessions = await withUser(req.user!, async (client) => (await client.query(
    `SELECT id,created_at,last_activity_at,expires_at,revoked_at,user_agent
     FROM auth_sessions
     WHERE user_id=$1 AND (expires_at>now() OR revoked_at>now()-interval '30 days')
     ORDER BY created_at DESC LIMIT 100`,
    [req.user!.id],
  )).rows);
  res.json(sessions.map((session) => ({
    ...session,
    current: session.id === req.user!.sessionId,
    active: !session.revoked_at && new Date(session.expires_at) > new Date(),
  })));
}));

adminRouter.delete('/auth/sessions/:sessionId', h(async (req, res) => {
  const sessionId = z.string().uuid().parse(req.params.sessionId);
  await withUser(req.user!, async (client) => {
    const revoked = await client.query(
      `UPDATE auth_sessions SET revoked_at=now()
       WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>now()
       RETURNING id`,
      [sessionId, req.user!.id],
    );
    if (!revoked.rowCount) throw new HttpError(404, 'Active session not found');
    await audit(client, req.user!.id, 'session_revoked', 'auth_session', sessionId);
  });
  res.sendStatus(204);
}));

adminRouter.post('/auth/logout', h(async (req, res) => {
  if (!req.user!.sessionId) throw new HttpError(401, 'Session is invalid; sign in again');
  await pool.query(
    'UPDATE auth_sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL',
    [req.user!.sessionId, req.user!.id],
  );
  res.sendStatus(204);
}));

adminRouter.post('/auth/change-password', h(async (req, res) => {
  const b = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(72) }).parse(req.body); // bcrypt only reads the first 72 bytes
  const u = (await pool.query('SELECT id, role, phone, password_hash, mfa_enabled FROM users WHERE id = $1', [req.user!.id])).rows[0];
  if (!(await bcrypt.compare(b.current, u.password_hash))) throw new HttpError(401, 'Current password is incorrect');
  const bad = passwordProblem(b.next, u.phone);
  if (bad) throw new HttpError(422, bad);
  if (await bcrypt.compare(b.next, u.password_hash)) throw new HttpError(422, 'Choose a password you have not used just now.');
  await withUser(req.user!, async (c) => {
    await c.query('UPDATE users SET password_hash = $2, must_change_password = false WHERE id = $1', [u.id, await bcrypt.hash(b.next, 12)]);
    await audit(c, u.id, 'password_changed', 'user', u.id);
  });
  res.json(await issue({ ...u, must_change_password: false }, req.user!.sessionId, req.get('user-agent')));
}));

adminRouter.post('/auth/mfa/setup', h(async (req, res) => {
  const u = (await pool.query('SELECT phone, mfa_enabled FROM users WHERE id = $1', [req.user!.id])).rows[0];
  if (u.mfa_enabled) throw new HttpError(409, 'Two-factor sign-in is already on. Turn it off first to set it up again.');
  const secret = newSecret();
  await pool.query('UPDATE users SET mfa_secret = $2, mfa_last_step = -1 WHERE id = $1', [req.user!.id, seal(secret, MFA_KEY)]);
  res.json({ secret, uri: otpauthUri(secret, u.phone) });
}));

adminRouter.post('/auth/mfa/enable', h(async (req, res) => {
  const { code } = z.object({ code: z.string() }).parse(req.body);
  const u = (await pool.query('SELECT id, role, mfa_secret, must_change_password FROM users WHERE id = $1', [req.user!.id])).rows[0];
  if (!u.mfa_secret) throw new HttpError(409, 'Start setup first');
  const step = verifyTotpStep(openSecret(u.mfa_secret), code);
  if (step === null) throw new HttpError(422, 'That code is not right. Check the time on your phone and try again.');
  await withUser(req.user!, async (c) => {
    const enabled = await c.query(
      'UPDATE users SET mfa_enabled = true, mfa_last_step = $2 WHERE id = $1 AND mfa_enabled = false AND mfa_secret = $3',
      [u.id, step, u.mfa_secret],
    );
    if (!enabled.rowCount) throw new HttpError(409, 'Two-factor setup changed. Start setup again.');
    await audit(c, u.id, 'mfa_enabled', 'user', u.id);
  });
  res.json(await issue({ ...u, mfa_enabled: true }, req.user!.sessionId, req.get('user-agent')));
}));

adminRouter.post('/auth/mfa/disable', h(async (req, res) => {
  const b = z.object({ password: z.string(), code: z.string() }).parse(req.body);
  const u = (await pool.query('SELECT id, role, password_hash, mfa_secret, mfa_enabled FROM users WHERE id = $1', [req.user!.id])).rows[0];
  if (!u.mfa_enabled) throw new HttpError(409, 'Two-factor sign-in is not on');
  if (requiresMfaEnrollment(u.role)) throw new HttpError(403, 'Two-factor sign-in is required for your role');
  const step = verifyTotpStep(openSecret(u.mfa_secret), b.code);
  if (!(await bcrypt.compare(b.password, u.password_hash)) || step === null) throw new HttpError(401, 'Password or code is incorrect');
  await withUser(req.user!, async (c) => {
    const disabled = await c.query(
      'UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1 AND mfa_enabled = true AND mfa_last_step < $2',
      [u.id, step],
    );
    if (!disabled.rowCount) throw new HttpError(401, 'Password or code is incorrect');
    await audit(c, u.id, 'mfa_disabled', 'user', u.id);
  });
  res.json({ ok: true });
}));

adminRouter.patch('/auth/preferences', h(async (req, res) => {
  const b = z.object({ whatsapp_opt_in: z.boolean() }).parse(req.body);
  await withUser(req.user!, async (c) => {
    await c.query('UPDATE users SET whatsapp_opt_in = $2 WHERE id = $1', [req.user!.id, b.whatsapp_opt_in]);
    await audit(c, req.user!.id, 'whatsapp_consent_' + (b.whatsapp_opt_in ? 'given' : 'withdrawn'), 'user', req.user!.id);
  });
  res.json({ whatsapp_opt_in: b.whatsapp_opt_in });
}));

// ================= Users: create, verify, activate (two different people) =================
adminRouter.get('/users', requireRole('global_admin', 'compliance', 'corporate_business_manager', 'super_admin'), h(async (_req, res) => {
  const users = await withUser(_req.user!, async (c) => (await c.query(
    `SELECT u.id, u.legal_name, u.phone, u.role, u.territory_id, u.kyc_status, u.active, u.mfa_enabled, u.created_at, u.created_by,
            s.account_type AS signup_account_type, s.requested_plan, s.payment_status AS signup_payment_status,
            s.status AS signup_status, s.pension_match_interest, s.edir_member_interest,
            s.edir_life_interest, s.household_cover_interest, s.parent_agent_id, a.service_specialization,
            (SELECT count(*)::int FROM user_documents d WHERE d.user_id = u.id) AS kyc_document_count
     FROM users u LEFT JOIN user_signups s ON s.user_id = u.id LEFT JOIN agents a ON a.id = u.id
     WHERE $1::text IN ('global_admin','compliance')
        OR u.created_by=$2
        OR ($1::text='super_admin' AND u.role='super_admin'
            AND (u.active=false OR (u.active=true AND u.mfa_enabled=true)))
     ORDER BY u.created_at DESC LIMIT 300`,
    [_req.user!.role,_req.user!.id],
  )).rows);
  res.json(users);
}));

const ACCOUNT_ROLE_GROUPS = {
  staff: ['corporate_business_manager', 'compliance', 'finance', 'finance_manager'],
  agents: ['master_agent', 'field_agent'],
  members: ['customer', 'worker', 'property_owner'],
} as const;

function accountRoleGroup(role: string) {
  return Object.entries(ACCOUNT_ROLE_GROUPS).find(([, roles]) => (roles as readonly string[]).includes(role))?.[0];
}

adminRouter.patch('/users/:id/role', requireRole('global_admin', 'super_admin'), h(async (req, res) => {
  const body = z.object({
    role: z.enum([
      'corporate_business_manager', 'compliance', 'finance', 'finance_manager',
      'master_agent', 'field_agent', 'customer', 'worker', 'property_owner',
    ]),
    parent_agent_id: z.string().uuid().optional(),
  }).strict().parse(req.body);
  const userId = z.string().uuid().parse(req.params.id);
  if (userId === req.user!.id) throw new HttpError(403, 'You cannot change your own account role.');

  const result = await withUser(req.user!, async (c) => {
    const target = (await c.query(
      `SELECT id, role, active, created_by, territory_id FROM users
       WHERE id=$1 AND ($2::text='global_admin' OR created_by=$3) FOR UPDATE`,
      [userId, req.user!.role, req.user!.id],
    )).rows[0];
    if (!target) throw new HttpError(404, 'User not found.');
    if (req.user!.role === 'super_admin' && !AGENT_ROLES.includes(body.role)) {
      throw new HttpError(403, 'Super Admins may only assign Master Agent or Field Agent roles.');
    }
    const currentGroup = accountRoleGroup(target.role);
    if (!currentGroup || currentGroup !== accountRoleGroup(body.role)) {
      throw new HttpError(422, 'Role changes must stay within the account’s existing role group.');
    }
    if (target.role === body.role) return { user: target, changed: false };

    if (currentGroup === 'agents') {
      const signup = (await c.query(
        'SELECT account_type, agent_type, territory_id, parent_agent_id FROM user_signups WHERE user_id=$1 FOR UPDATE',
        [userId],
      )).rows[0];
      if (signup && signup.account_type !== 'agent') {
        throw new HttpError(409, 'The account registration type does not match its agent role.');
      }
      const agent = (await c.query(
        'SELECT agent_type, parent_id, territory_id FROM agents WHERE id=$1 FOR UPDATE',
        [userId],
      )).rows[0];
      if (target.active && !agent) throw new HttpError(409, 'The active agent record is missing.');
      if (!signup && !agent) throw new HttpError(409, 'The agent registration record is missing.');

      const territoryId = agent?.territory_id ?? signup?.territory_id ?? target.territory_id;
      let parentAgentId: string | null = null;
      if (body.role === 'field_agent') {
        if (!body.parent_agent_id) throw new HttpError(422, 'Choose an active Master Agent in the same territory.');
        const parent = (await c.query(
          `SELECT a.id FROM agents a JOIN users u ON u.id=a.id
           WHERE a.id=$1 AND a.id<>$2 AND a.agent_type='master' AND u.role='master_agent'
             AND u.active=true AND a.territory_id=$3
             AND ($4::text<>'super_admin' OR u.created_by=$5) FOR SHARE`,
          [body.parent_agent_id, userId, territoryId, req.user!.role, req.user!.id],
        )).rows[0];
        if (!parent) throw new HttpError(422, 'Choose an active Master Agent in the same territory.');
        parentAgentId = parent.id;
      } else {
        const children = await c.query('SELECT 1 FROM agents WHERE parent_id=$1 LIMIT 1', [userId]);
        if (children.rowCount) throw new HttpError(409, 'Reassign this Master Agent’s field agents before changing the role.');
      }

      if (agent) {
        await c.query(
          'UPDATE agents SET agent_type=$2,parent_id=$3 WHERE id=$1',
          [userId, body.role === 'master_agent' ? 'master' : 'field', parentAgentId],
        );
      }
      if (signup) {
        await c.query(
          `UPDATE user_signups SET agent_type=$2,parent_agent_id=$3
           WHERE user_id=$1 AND account_type='agent'`,
          [userId, body.role === 'master_agent' ? 'master' : 'field', parentAgentId],
        );
      }
    } else if (currentGroup === 'members') {
      await c.query(
        `UPDATE user_signups SET account_type=$2
         WHERE user_id=$1 AND account_type IN ('customer','worker','property_owner')`,
        [userId, body.role],
      );
    }

    const updated = (await c.query(
      'UPDATE users SET role=$2 WHERE id=$1 RETURNING id,legal_name,phone,role,territory_id,active,created_by',
      [userId, body.role],
    )).rows[0];
    await audit(c, req.user!.id, 'user_role_updated', 'user', userId, { role: target.role }, { role: body.role });
    return { user: updated, changed: true };
  });
  if (result.changed) invalidateUser(userId);
  res.json(result);
}));

async function lockEligibleSuperAdmins(c: import('pg').PoolClient, userIds: string[]) {
  const uniqueIds = [...new Set(userIds)].sort();
  const rows = (await c.query(
    `SELECT id, role, active, mfa_enabled FROM users
     WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
    [uniqueIds],
  )).rows;
  return new Map(rows.map((user) => [user.id, user]));
}

const isEligibleSuperAdmin = (user?: { active: boolean; role: string; mfa_enabled: boolean }) =>
  user?.active === true && user.role === 'super_admin' && user.mfa_enabled === true;

adminRouter.get('/global-admin-promotions', requireSuperAdminPromotionRole, h(async (_req, res) => {
  const rows = await withUser(_req.user!, async (c) => (await c.query(
    `SELECT r.id, r.status, r.decision_reason, r.created_at, r.decided_at,
            target.id AS target_user_id, target.legal_name AS target_name, target.phone AS target_phone,
            requester.id AS requested_by, requester.legal_name AS requester_name,
            approver.id AS approved_by, approver.legal_name AS approver_name
     FROM global_admin_role_change_requests r
     JOIN users target ON target.id = r.target_user_id
     JOIN users requester ON requester.id = r.requested_by
     LEFT JOIN users approver ON approver.id = r.approved_by
     ORDER BY r.created_at DESC LIMIT 100`,
  )).rows);
  res.json(rows);
}));

adminRouter.post('/global-admin-promotions', requireSuperAdminPromotionRole, h(async (req, res) => {
  const { target_user_id } = z.object({ target_user_id: z.string().uuid() }).strict().parse(req.body);
  const request = await withUser(req.user!, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended('afrolife:global-admin-role-change:v1', 0))");
    if (target_user_id === req.user!.id) throw new HttpError(422, 'A different administrator must nominate the target account');
    const eligible = await lockEligibleSuperAdmins(c, [req.user!.id, target_user_id]);
    if (!isEligibleSuperAdmin(eligible.get(req.user!.id))) {
      throw new HttpError(403, 'Promotion requests require an active, MFA-enabled Super Admin.');
    }
    const target = eligible.get(target_user_id);
    if (!isEligibleSuperAdmin(target)) {
      throw new HttpError(422, 'The target must be an active, MFA-enabled Super Admin');
    }
    const existing = await c.query(
      "SELECT id FROM global_admin_role_change_requests WHERE target_user_id = $1 AND status = 'pending'",
      [target_user_id],
    );
    if (existing.rowCount) throw new HttpError(409, 'A promotion request for this Super Admin is already pending');
    const inserted = (await c.query(
      `INSERT INTO global_admin_role_change_requests (requested_by, target_user_id)
       VALUES ($1,$2) RETURNING id, status, target_user_id, created_at`,
      [req.user!.id, target_user_id],
    )).rows[0];
    await audit(c, req.user!.id, 'global_admin_promotion_requested', 'user', target_user_id,
      { role: 'super_admin' }, { role: 'global_admin', request_id: inserted.id });
    return inserted;
  });
  res.status(201).json(request);
}));

async function decideGlobalAdminPromotion(req: Request, decision: 'approved' | 'rejected', reason: string) {
  const requestId = z.string().uuid().parse(req.params.id);
  const result = await withUser(req.user!, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended('afrolife:global-admin-role-change:v1', 0))");
    const request = (await c.query(
      'SELECT id, requested_by, target_user_id, status FROM global_admin_role_change_requests WHERE id = $1 FOR UPDATE',
      [requestId],
    )).rows[0];
    if (!request) throw new HttpError(404, 'Promotion request not found');
    if (request.status !== 'pending') throw new HttpError(409, 'Promotion request has already been decided');
    if (request.requested_by === req.user!.id || request.target_user_id === req.user!.id) {
      throw new HttpError(403, 'The requester and target cannot decide this promotion');
    }
    const eligible = await lockEligibleSuperAdmins(c, [req.user!.id, request.requested_by, request.target_user_id]);
    if (!isEligibleSuperAdmin(eligible.get(req.user!.id))) {
      throw new HttpError(403, 'Promotion decisions require an active, MFA-enabled Super Admin.');
    }
    if (!isEligibleSuperAdmin(eligible.get(request.requested_by))) {
      throw new HttpError(409, 'The requesting Super Admin is no longer eligible.');
    }
    const target = eligible.get(request.target_user_id);
    if (!isEligibleSuperAdmin(target)) {
      throw new HttpError(409, 'The target no longer meets Global Admin eligibility requirements');
    }
    if (decision === 'approved') {
      await c.query("SELECT set_config('app.access_change_reason',$1,true)", [reason]);
      await c.query("UPDATE users SET role = 'global_admin' WHERE id = $1", [target.id]);
    }
    const updated = (await c.query(
      `UPDATE global_admin_role_change_requests
       SET status = $2, approved_by = $3, decision_reason = $4, decided_at = now()
       WHERE id = $1 RETURNING id, status, target_user_id`,
      [request.id, decision, req.user!.id, reason],
    )).rows[0];
    await audit(c, req.user!.id, `global_admin_promotion_${decision}`, 'user', target.id,
      { role: target.role }, { role: decision === 'approved' ? 'global_admin' : target.role, request_id: request.id, reason });
    return updated;
  });
  if (decision === 'approved') invalidateUser(result.target_user_id);
  return result;
}

adminRouter.post('/global-admin-promotions/:id/approve', requireSuperAdminPromotionRole, h(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  res.json(await decideGlobalAdminPromotion(req, 'approved', reason));
}));

adminRouter.post('/global-admin-promotions/:id/reject', requireSuperAdminPromotionRole, h(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  res.json(await decideGlobalAdminPromotion(req, 'rejected', reason));
}));

adminRouter.get('/business-rules', requireRole('global_admin'), h(async (_req, res) => {
  const result = await pool.query(
    'SELECT key, value FROM config_rules WHERE key = ANY($1::text[]) ORDER BY key',
    [BUSINESS_RULES.map((rule) => rule.key)],
  );
  const values = Object.fromEntries(result.rows.map((row) => [row.key, Number(row.value)]));
  const missing = BUSINESS_RULES.filter((rule) => !Number.isFinite(values[rule.key])).map((rule) => rule.key);
  if (missing.length) throw new Error('Business rules are missing: ' + missing.join(', '));
  res.json(BUSINESS_RULES.map((rule) => ({ ...rule, value: values[rule.key] })));
}));

adminRouter.patch('/business-rules', requireRole('global_admin'), h(async (req, res) => {
  const { values } = z.object({
    values: z.record(z.string(), z.number().finite()),
  }).strict().parse(req.body);

  const result = await withUser(req.user!, async (c) => {
    const stored = await c.query('SELECT key, value FROM config_rules FOR UPDATE');
    const current = Object.fromEntries(stored.rows.map((row) => [row.key, Number(row.value)]));
    const missing = BUSINESS_RULES.filter((rule) => !Number.isFinite(current[rule.key])).map((rule) => rule.key);
    if (missing.length) throw new Error('Business rules are missing: ' + missing.join(', '));
    const errors = validateBusinessRuleUpdates(values, current);
    if (errors.length) throw new HttpError(422, errors.join(' '));

    const oldValues = Object.fromEntries(Object.keys(values).map((key) => [key, current[key]]));
    for (const [key, value] of Object.entries(values)) {
      await c.query('UPDATE config_rules SET value = $2 WHERE key = $1', [key, value]);
    }

    const pricingKeys = new Set(['A_onboarding_pct', 'A_guarantee_pct', 'A_monthly_pct', 'B_employer_pct', 'B_other_pct']);
    let repricedContracts = 0;
    if (Object.keys(values).some((key) => pricingKeys.has(key))) {
      const contracts = await c.query(
        `SELECT id, track, base_value, onboarding_amt, guarantee_amt, monthly_mgmt_amt, employer_fee_amt, other_fee_amt
         FROM contracts WHERE state IN ('draft','compliance_review','approval_pending','signature_pending') FOR UPDATE`,
      );
      const nextRules = { ...current, ...values };
      for (const contract of contracts.rows) {
        const amounts = feeSnapshot(contract.track, Number(contract.base_value), nextRules);
        const oldAmounts = {
          onboarding_amt: Number(contract.onboarding_amt),
          guarantee_amt: Number(contract.guarantee_amt),
          monthly_mgmt_amt: Number(contract.monthly_mgmt_amt),
          employer_fee_amt: Number(contract.employer_fee_amt),
          other_fee_amt: Number(contract.other_fee_amt),
        };
        await c.query(
          `UPDATE contracts
           SET onboarding_amt=$2, guarantee_amt=$3, monthly_mgmt_amt=$4, employer_fee_amt=$5, other_fee_amt=$6
           WHERE id=$1`,
          [contract.id, amounts.onboarding_amt, amounts.guarantee_amt, amounts.monthly_mgmt_amt, amounts.employer_fee_amt, amounts.other_fee_amt],
        );
        await audit(c, req.user!.id, 'contract_repriced', 'contract', contract.id, oldAmounts, amounts);
        repricedContracts++;
      }
    }

    await audit(c, req.user!.id, 'business_rules_updated', 'business_rules', 'config_rules', oldValues, values);
    return {
      rules: BUSINESS_RULES.map((rule) => ({ ...rule, value: Number((values as Record<string, number>)[rule.key] ?? current[rule.key]) })),
      repriced_contracts: repricedContracts,
    };
  });
  res.json(result);
}));

adminRouter.post('/users', requireRole('global_admin','super_admin','master_agent','corporate_business_manager'), h(async (req, res) => {
  const b = z.object({
    legal_name: z.string().min(2), phone: Phone, email: z.string().email().optional(),
    role: z.enum(PROVISIONABLE_ROLES), territory_id: z.number().int().optional(), parent_agent_id: z.string().uuid().optional(),
    requested_plan: z.enum(['free','pro','enterprise']).optional(),
    service_specialization: z.enum(['financial_service', 'growth_partnership', 'workforce_property']).optional(),
    vendor_id: z.string().uuid().optional(),
  }).parse(req.body);
  if (req.user!.role === 'corporate_business_manager' && !['master_agent','field_agent'].includes(b.role)) {
    throw new HttpError(403, 'Business Admins may onboard direct Master Agents and Field Agents only.');
  }
  if (req.user!.role === 'super_admin' && !['master_agent','field_agent'].includes(b.role)) {
    throw new HttpError(403, 'Super Admins may onboard Master Agents and Field Agents only.');
  }
  if (req.user!.role === 'master_agent' && b.role !== 'field_agent') {
    throw new HttpError(403, 'Master Agents may onboard Field Agents only.');
  }
  if (b.role === 'property_vendor' && req.user!.role !== 'global_admin') {
    throw new HttpError(403, 'Only a Global Admin may provision a property-vendor account.');
  }
  if (b.role === 'property_vendor' && !b.vendor_id) {
    throw new HttpError(422, 'Choose the property-vendor business for this portal account.');
  }
  if (b.role !== 'property_vendor' && b.vendor_id) {
    throw new HttpError(422, 'A vendor business can only be selected for a property-vendor account.');
  }
  if (AGENT_ROLES.includes(b.role) && !b.territory_id) throw new HttpError(422, 'Agents need an area');
  if (b.role === 'field_agent' && !b.parent_agent_id) throw new HttpError(422, 'A field agent needs a master agent');
  if (AGENT_ROLES.includes(b.role) && !b.requested_plan) throw new HttpError(422, 'Agents need an approved service plan selection.');
  if (!AGENT_ROLES.includes(b.role) && b.service_specialization) throw new HttpError(422, 'Specialization is only available for agents');
  const temp = randomPassword();
  let uploadToken: string | undefined;
  const user = await withUser(req.user!, async (c) => {
    if (b.role === 'field_agent') {
      const parent = (await c.query(
        `SELECT a.id FROM agents a JOIN users u ON u.id=a.id
         WHERE a.id=$1 AND a.agent_type='master' AND u.role='master_agent' AND u.active=true AND a.territory_id=$2
           AND ($3::text NOT IN ('corporate_business_manager','super_admin') OR u.created_by=$4)
           AND ($3::text <> 'master_agent' OR a.id=$4)`,
        [b.parent_agent_id,b.territory_id,req.user!.role,req.user!.id],
      )).rows[0];
      if (!parent) throw new HttpError(422, 'Choose an active Master Agent in the selected territory.');
    }
    if (b.role === 'property_vendor') {
      const vendor = (await c.query(
        'SELECT id FROM property_vendors WHERE id=$1 AND active FOR UPDATE',
        [b.vendor_id],
      )).rows[0];
      if (!vendor) throw new HttpError(422, 'Choose an active property-vendor business.');
    }
    const r = await c.query(
      `INSERT INTO users (legal_name, phone, email, role, territory_id, password_hash, must_change_password, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING id, legal_name, phone, role, kyc_status, active`,
      [b.legal_name, b.phone, b.email ?? null, b.role, b.territory_id ?? null, await bcrypt.hash(temp, 12), req.user!.id],
    );
    if (AGENT_ROLES.includes(b.role)) {
      await c.query(
        `INSERT INTO user_signups(user_id,account_type,requested_plan,payment_status,agent_type,territory_id,parent_agent_id)
         VALUES($1,'agent',$2,$3,$4,$5,$6)`,
        [r.rows[0].id,b.requested_plan,b.requested_plan==='free'?'not_required':'not_configured',
          b.role==='master_agent'?'master':'field',b.territory_id,b.role==='field_agent'?b.parent_agent_id:null],
      );
    } else if (b.role === 'property_vendor') {
      await c.query(
        `INSERT INTO user_signups(user_id,account_type,payment_status,vendor_id)
         VALUES($1,'property_vendor','not_required',$2)`,
        [r.rows[0].id,b.vendor_id],
      );
    }
    if (AGENT_ROLES.includes(b.role) || b.role === 'property_vendor') {
      uploadToken = randomBytes(32).toString('base64url');
      await c.query(
        `INSERT INTO signup_upload_tokens(user_id,token_hash,expires_at)
         VALUES($1,$2,now()+interval '24 hours')`,
        [r.rows[0].id,createHash('sha256').update(uploadToken).digest('hex')],
      );
    }
    await audit(c, req.user!.id, 'user_created', 'user', r.rows[0].id, null, { role: b.role });
    return r.rows[0];
  });
  res.status(201).json({ user, temp_password: temp, ...(uploadToken ? { signup_upload_token: uploadToken } : {}) }); // shown once; the invitee must change the temporary password and complete any required KYC
}));

// Super Agents administer the network; Master Agents can manage only their own direct field agents.
adminRouter.get('/agents/team', requireRole('super_admin', 'global_admin', 'master_agent'), h(async (req, res) => {
  const team = await withUser(req.user!, async (c) => (await c.query(
    `SELECT u.id, u.legal_name, u.phone, u.role, u.active, u.territory_id,
            a.agent_type, a.parent_id, a.service_specialization,
            (SELECT count(*)::int FROM leads l WHERE l.source_agent_id = a.id) AS lead_count,
            (SELECT count(*)::int FROM contracts k WHERE k.source_agent_id = a.id) AS contract_count,
            (SELECT count(*)::int FROM properties p WHERE p.source_agent_id = a.id) AS property_count
     FROM agents a JOIN users u ON u.id = a.id
     WHERE ($1::boolean OR a.id = $2 OR a.parent_id = $2)
     ORDER BY a.agent_type, u.legal_name`,
    [req.user!.role === 'super_admin' || req.user!.role === 'global_admin', req.user!.id],
  )).rows);
  res.json(team);
}));

adminRouter.patch('/agents/:id/specialization', requireRole('super_admin', 'global_admin', 'master_agent'), h(async (req, res) => {
  const { service_specialization } = z.object({
    service_specialization: z.enum(['financial_service', 'growth_partnership', 'workforce_property']).nullable(),
  }).parse(req.body);
  const result = await withUser(req.user!, async (c) => {
    const agent = (await c.query(
      `SELECT a.id, a.service_specialization, a.parent_id, u.role
       FROM agents a JOIN users u ON u.id = a.id WHERE a.id = $1 FOR UPDATE`,
      [req.params.id],
    )).rows[0];
    if (!agent) throw new HttpError(404, 'Agent not found');
    if (req.user!.role === 'master_agent' && agent.parent_id !== req.user!.id) throw new HttpError(403, 'Master Agents can update only their own field agents');
    const updated = (await c.query(
      'UPDATE agents SET service_specialization = $2 WHERE id = $1 RETURNING id, service_specialization',
      [agent.id, service_specialization],
    )).rows[0];
    await audit(c, req.user!.id, 'agent_specialization_updated', 'agent', agent.id,
      { service_specialization: agent.service_specialization }, { service_specialization });
    return updated;
  });
  res.json(result);
}));

adminRouter.post('/users/:id/kyc', requireRole('compliance'), h(async (req, res) => {
  const { decision, reason } = z.object({
    decision: z.enum(['verified', 'rejected']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  if (req.params.id === req.user!.id) throw new HttpError(403, 'You cannot verify yourself');
  res.json(await withUser(req.user!, async (c) => {
    const signup = (await c.query('SELECT account_type FROM user_signups WHERE user_id = $1', [req.params.id])).rows[0];
    if (signup) {
      const reviewedByActor = await c.query(
        'SELECT 1 FROM user_documents WHERE user_id=$1 AND reviewer_id=$2 LIMIT 1',
        [req.params.id, req.user!.id],
      );
      if (reviewedByActor.rowCount) throw new HttpError(403, 'Final KYC approval must be completed by someone other than the document reviewer.');
    }
    if (decision === 'verified') {
      if (signup) {
        const config = (await c.query(
          "SELECT config_value FROM marketplace_configuration WHERE scope='users' AND config_key='kyc_requirements'",
        )).rows[0]?.config_value;
        const requiredTypes = requiredKycDocuments(config, signup.account_type);
        const verified = (await c.query(
          "SELECT doc_type FROM user_documents WHERE user_id = $1 AND status = 'verified'",
          [req.params.id],
        )).rows.map((document) => document.doc_type);
        const missing = requiredTypes.filter((type) => !verified.includes(type));
        if (missing.length) throw new HttpError(409, `Required KYC documents are not verified: ${missing.join(', ')}.`);
      }
    }
    const r = await c.query("UPDATE users SET kyc_status = $2 WHERE id = $1 AND kyc_status IN ('uploaded','under_review') RETURNING id, kyc_status", [req.params.id, decision]);
    if (!r.rowCount) throw new HttpError(409, 'User not found or already reviewed');
    await c.query(
      `UPDATE user_signups
       SET status = CASE WHEN $2 = 'rejected' THEN 'rejected' ELSE status END,
           kyc_reviewed_by=$3, kyc_reviewed_at=now(), kyc_review_reason=$4
       WHERE user_id = $1`,
      [req.params.id, decision, req.user!.id, reason],
    );
    if (decision === 'rejected') await c.query('DELETE FROM signup_upload_tokens WHERE user_id = $1', [req.params.id]);
    await audit(c, req.user!.id, 'kyc_' + decision, 'user', String(req.params.id), null, { reason });
    return r.rows[0];
  }));
}));

adminRouter.get('/users/:id/documents', requireRole('global_admin', 'compliance'), h(async (req, res) => {
  const documents = await withUser(req.user!, async (c) => (await c.query(
    'SELECT id, doc_type, mime, size_bytes, status, reviewer_id, reviewed_at, review_note, created_at FROM user_documents WHERE user_id = $1 ORDER BY created_at',
    [req.params.id],
  )).rows);
  res.json(documents);
}));

adminRouter.get('/users/:id/documents/:documentId/file', requireRole('global_admin', 'compliance'), h(async (req, res) => {
  const document = await withUser(req.user!, async (c) => (await c.query(
    'SELECT id, storage_key, mime FROM user_documents WHERE id = $1 AND user_id = $2',
    [req.params.documentId, req.params.id],
  )).rows[0]);
  if (!document) throw new HttpError(404, 'KYC document not found.');
  const file = await getFile(document.storage_key);
  res.set({
    'Content-Type': document.mime,
    'Content-Disposition': 'attachment',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  }).send(file);
}));

adminRouter.post('/users/:id/documents/:documentId/review', requireRole('compliance'), h(async (req, res) => {
  if (req.params.id === req.user!.id) throw new HttpError(403, 'You cannot review your own KYC documents.');
  const { decision, note } = z.object({
    decision: z.enum(['verified', 'rejected']),
    note: z.string().trim().min(10).max(1000).optional(),
  }).strict().parse(req.body);
  if (decision === 'rejected' && !note) throw new HttpError(422, 'Give the applicant a reason and tell them what needs to change (at least 10 characters).');
  const document = await withUser(req.user!, async (c) => {
    const found = (await c.query(
      "SELECT id, doc_type, status, uploaded_by, review_note FROM user_documents WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [req.params.documentId, req.params.id],
    )).rows[0];
    if (!found) throw new HttpError(404, 'KYC document not found.');
    if (found.uploaded_by === req.user!.id) throw new HttpError(403, 'A different compliance officer must review this document.');
    if (found.status !== 'uploaded') throw new HttpError(409, 'This KYC document has already been reviewed.');
    const updated = (await c.query(
      'UPDATE user_documents SET status = $2, reviewer_id = $3, reviewed_at = now(), review_note = $4 WHERE id = $1 RETURNING id, doc_type, status, review_note',
      [found.id, decision, req.user!.id, decision === 'rejected' ? note : null],
    )).rows[0];
    await audit(c, req.user!.id, 'signup_kyc_document_' + decision, 'user_document', found.id, { status: found.status }, { status: decision });
    return updated;
  });
  res.json(document);
}));

adminRouter.post('/users/:id/activate', requireRole('global_admin', 'super_admin'), h(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body ?? {});
  res.json(await withUser(req.user!, async (c) => {
    const target = (await c.query('SELECT id, role, active, created_by FROM users WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!target) throw new HttpError(404, 'User not found');
    if (req.user!.role === 'super_admin' && target.role !== 'super_admin') {
      throw new HttpError(403, 'Super Admins may activate only another Super Admin account');
    }
    if (target.role === 'global_admin' && req.user!.role !== 'global_admin') {
      throw new HttpError(403, 'Only a different Global Admin can activate a Global Admin account');
    }
    if (target.created_by === req.user!.id) throw new HttpError(403, 'A different platform administrator must activate an account you created');
    if (target.active) throw new HttpError(409, 'Account is already active');
    // The database refuses activation of non-staff accounts that are not KYC-verified.
    const signup = (await c.query(
      'SELECT * FROM user_signups WHERE user_id = $1 FOR UPDATE',
      [req.params.id],
    )).rows[0];
    if (signup?.status === 'rejected') throw new HttpError(409, 'Rejected sign-up requests cannot be activated');
    if (signup && !signup.kyc_reviewed_by) {
      throw new HttpError(409, 'KYC must be formally reviewed before account activation.');
    }
    if (signup && signup.kyc_reviewed_by === req.user!.id) {
      throw new HttpError(403, 'A different platform administrator must activate an account after KYC approval.');
    }
    if (signup?.account_type === 'agent') {
      await c.query(
        `INSERT INTO agents (id, agent_type, parent_id, territory_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO NOTHING`,
        [req.params.id, signup.agent_type, signup.parent_agent_id, signup.territory_id],
      );
    }
    if (signup?.account_type === 'property_vendor') {
      const vendor = (await c.query(
        'SELECT id,tenant_system_id FROM property_vendors WHERE id=$1 AND active FOR UPDATE',
        [signup.vendor_id],
      )).rows[0];
      if (!vendor) throw new HttpError(409, 'The property-vendor business is no longer active.');
      await c.query(
        `INSERT INTO property_vendor_memberships(vendor_id,user_id,created_by,tenant_system_id)
         VALUES($1,$2,$3,$4)`,
        [vendor.id, req.params.id, req.user!.id, vendor.tenant_system_id],
      );
    }
    await c.query("SELECT set_config('app.access_change_reason',$1,true)", [reason]);
    const r = await c.query('UPDATE users SET active = true WHERE id = $1 RETURNING id, active', [req.params.id]);
    if (!r.rowCount) throw new HttpError(404, 'User not found');
    if (signup) {
      await c.query('DELETE FROM signup_upload_tokens WHERE user_id = $1', [req.params.id]);
      await c.query(
        `UPDATE user_signups
         SET status = 'approved', reviewed_by = $2, reviewed_at = now(), activation_reviewed_by=$2, activation_reviewed_at=now(), activation_review_reason=$3
         WHERE user_id = $1`,
        [req.params.id, req.user!.id, reason],
      );
    }
    await audit(c, req.user!.id, 'user_activated', 'user', String(req.params.id), null, { reason });
    return r.rows[0];
  }));
}));

adminRouter.post('/users/:id/deactivate', requireRole('global_admin'), h(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(10).max(1000).optional() }).strict().parse(req.body ?? {});
  if (req.params.id === req.user!.id) throw new HttpError(409, 'You cannot deactivate yourself');
  res.json(await withUser(req.user!, async (c) => {
    const target = (await c.query('SELECT role FROM users WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!target) throw new HttpError(404, 'User not found');
    if (target.role === 'global_admin' && req.user!.role !== 'global_admin') {
      throw new HttpError(403, 'Only a Global Admin can deactivate a Global Admin account');
    }
    await c.query("SELECT set_config('app.access_change_reason',$1,true)", [reason ?? 'Account deactivated through the authorized Super Admin workflow']);
    const r = await c.query('UPDATE users SET active = false WHERE id = $1 RETURNING id, active', [req.params.id]);
    if (!r.rowCount) throw new HttpError(404, 'User not found');
    await audit(c, req.user!.id, 'user_deactivated', 'user', String(req.params.id));
    return r.rows[0];
  }));
  invalidateUser(String(req.params.id)); // takes effect immediately on this server, within AUTH_CACHE_MS elsewhere
}));

/** Lost phone: clears 2FA so the user can enrol again; required roles are restricted at next sign-in. */
adminRouter.post('/users/:id/mfa/reset', requireRole('global_admin'), h(async (req, res) => {
  if (req.params.id === req.user!.id) throw new HttpError(403, 'Ask another Super Admin to reset your two-factor sign-in');
  const out = await withUser(req.user!, async (c) => {
    const target = (await c.query('SELECT role FROM users WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!target) throw new HttpError(404, 'User not found');
    if (target.role === 'global_admin' && req.user!.role !== 'global_admin') {
      throw new HttpError(403, 'Only a Global Admin can reset a Global Admin authenticator');
    }
    const r = await c.query('UPDATE users SET mfa_enabled = false, mfa_secret = NULL, mfa_last_step = -1 WHERE id = $1 RETURNING id, role', [req.params.id]);
    if (!r.rowCount) throw new HttpError(404, 'User not found');
    await c.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [req.params.id]);
    await audit(c, req.user!.id, 'mfa_reset', 'user', String(req.params.id));
    return { ok: true };
  });
  invalidateUser(String(req.params.id));
  res.json(out);
}));

adminRouter.post('/users/:id/reset-password', requireRole('global_admin'), h(async (req, res) => {
  if (req.params.id === req.user!.id) throw new HttpError(403, 'Ask another Super Admin to reset your password');
  const temp = randomPassword();
  await withUser(req.user!, async (c) => {
    const target = (await c.query('SELECT role FROM users WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!target) throw new HttpError(404, 'User not found');
    if (target.role === 'global_admin' && req.user!.role !== 'global_admin') {
      throw new HttpError(403, 'Only a Global Admin can reset a Global Admin password');
    }
    const r = await c.query('UPDATE users SET password_hash = $2, must_change_password = true, failed_logins = 0, locked_until = NULL WHERE id = $1', [req.params.id, await bcrypt.hash(temp, 12)]);
    if (!r.rowCount) throw new HttpError(404, 'User not found');
    await c.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [req.params.id]);
    await audit(c, req.user!.id, 'password_reset', 'user', String(req.params.id));
  });
  invalidateUser(String(req.params.id));
  res.json({ temp_password: temp });
}));

// ================= Reports =================
adminRouter.get('/reports/summary', requireRole('global_admin', 'finance', 'finance_manager'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => {
    const q = async (sql: string) => (await c.query(sql)).rows;
    const [leads, contracts, ledger, comms, pending, disputes, maint, overdue, agents, workers] = await Promise.all([
      q('SELECT status, count(*)::int AS n FROM leads GROUP BY status'),
      q('SELECT state, track, count(*)::int AS n, coalesce(sum(base_value),0)::float AS base FROM contracts GROUP BY state, track'),
      q('SELECT account, sum(debit)::float AS d, sum(credit)::float AS c FROM ledger_entries GROUP BY account'),
      q('SELECT status, count(*)::int AS n, coalesce(sum(amount),0)::float AS amount FROM commission_events GROUP BY status'),
      q("SELECT count(*)::int AS n, coalesce(sum(amount),0)::float AS amount FROM invoices WHERE status = 'pending'"),
      q("SELECT count(*)::int AS n FROM disputes WHERE status <> 'resolved'"),
      q("SELECT count(*)::int AS n FROM maintenance_requests WHERE status IN ('open','assigned','in_progress')"),
      q("SELECT count(*)::int AS n, coalesce(sum(amount),0)::float AS amount FROM rent_charges WHERE status = 'due' AND due_on < current_date"),
      q(`SELECT a.id, u.legal_name,
           (SELECT count(*)::int FROM leads l WHERE l.source_agent_id = a.id) AS leads,
           (SELECT count(*)::int FROM leads l WHERE l.source_agent_id = a.id AND l.status = 'converted') AS converted,
           (SELECT coalesce(sum(amount),0)::float FROM commission_events k WHERE k.agent_id = a.id AND k.status <> 'reversed') AS commission
         FROM agents a JOIN users u ON u.id = a.id ORDER BY commission DESC, leads DESC LIMIT 50`),
      q("SELECT verification AS status, count(*)::int AS n FROM workers GROUP BY verification"),
    ]);
    const acc = (a: string) => { const r = ledger.find((x) => x.account === a); return { d: r?.d ?? 0, c: r?.c ?? 0 }; };
    const revenue = acc('Service Revenue').c - acc('Service Revenue').d - (acc('Refunds').d - acc('Refunds').c);
    const commissionExpense = acc('Commission Expense').d - acc('Commission Expense').c;
    return {
      leads, contracts, comms, workers, agents,
      money: {
        revenue, commission_expense: commissionExpense, net_revenue: revenue - commissionExpense,
        guarantee_held: acc('Guarantee Liability').c - acc('Guarantee Liability').d,
        commission_payable: (acc('Commission Payable').c + acc('Commission Held Payable').c) - (acc('Commission Payable').d + acc('Commission Held Payable').d),
        cash: acc('Cash').d - acc('Cash').c,
      },
      pending_invoices: pending[0], open_disputes: disputes[0].n, open_maintenance: maint[0].n, overdue_rent: overdue[0],
    };
  }));
}));

/** Paid Enterprise accounts receive their row-level scoped portfolio numbers. */
adminRouter.get('/reports/me', requireRole('master_agent', 'field_agent', 'property_owner'), requireEnterprisePlan, h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => {
    const q = async (sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows;
    const [leads, comms, contracts, workers, props] = await Promise.all([
      q('SELECT status, count(*)::int AS n FROM leads GROUP BY status'),
      q('SELECT status, count(*)::int AS n, coalesce(sum(amount),0)::float AS amount FROM commission_events WHERE agent_id = $1 OR agent_id IN (SELECT id FROM agents WHERE parent_id = $1) GROUP BY status', [req.user!.id]),
      q("SELECT count(*)::int AS n FROM contracts WHERE state = 'active'"),
      q('SELECT count(*)::int AS n FROM workers'),
      q('SELECT count(*)::int AS n FROM properties'),
    ]);
    return { leads, comms, active_contracts: contracts[0].n, workers: workers[0].n, properties: props[0].n };
  }));
}));
