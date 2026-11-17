import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import { normalizePhone } from './phone.js';
import { WORKSPACE_MODULES } from './runtime-config.js';

const BOOTSTRAP_ACTION = 'initial_afrosherik_admin_bootstrap';
const CONFIRMATION = 'create-afrosherik-platform-admins';
const IDENTITIES = [
  { name: 'Dawit Asrade', phone: '+251951076113', passwordVariable: 'INITIAL_DAWIT_ADMIN_PASSWORD' },
  { name: 'Yalemwork Antenh', phone: '+251966302995', passwordVariable: 'INITIAL_YALEMWORK_ADMIN_PASSWORD' },
] as const;

export type InitialPlatformAdminBootstrapConfig = {
  tenantKey: string;
  passwords: [string, string];
  reason: string;
};

export function validateInitialPlatformAdminBootstrapConfig(
  env: Record<string, string | undefined>,
): InitialPlatformAdminBootstrapConfig {
  if (env.AFROLIFE_DEPLOYMENT_ENV !== 'development') {
    throw new Error('AFROLIFE_DEPLOYMENT_ENV must be exactly development for this one-time bootstrap.');
  }
  if (env.ALETCLOUD_APP_NAME !== 'afrolife-development') {
    throw new Error('ALETCLOUD_APP_NAME must identify the afrolife-development application.');
  }
  if (env.ALLOW_INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP !== '1'
    || env.INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP_CONFIRM !== CONFIRMATION) {
    throw new Error('The explicit one-time AfroSherik administrator bootstrap confirmation is required.');
  }
  const tenantKey = env.INITIAL_AFROSHERIK_TENANT_KEY?.trim() ?? '';
  if (!/^[a-z][a-z0-9-]{1,79}$/.test(tenantKey)) {
    throw new Error('INITIAL_AFROSHERIK_TENANT_KEY must be a valid platform tenant key.');
  }
  const passwords = IDENTITIES.map(({ passwordVariable }) => env[passwordVariable] ?? '') as [string, string];
  for (const password of passwords) {
    if (password.length < 16 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('Each initial administrator password must be at least 16 characters and at most 72 UTF-8 bytes.');
    }
  }
  if (passwords[0] === passwords[1]) {
    throw new Error('Each administrator must have a different initial password.');
  }
  const reason = env.INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP_REASON?.trim() ?? '';
  if (reason.length < 10 || reason.length > 1000) {
    throw new Error('INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP_REASON must be between 10 and 1000 characters.');
  }
  return { tenantKey, passwords, reason };
}

export async function bootstrapInitialAfroSherikAdmins(
  pool: Pool,
  config: InitialPlatformAdminBootstrapConfig,
): Promise<{ created: number; tenantId: string } | null> {
  let passwordHashes: string[];
  try {
    passwordHashes = await Promise.all(config.passwords.map((password) => bcrypt.hash(password, 12)));
  } finally {
    config.passwords[0] = '';
    config.passwords[1] = '';
  }
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    transactionStarted = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('afrolife:initial-afrosherik-admin-bootstrap:v1', 0))");
    const alreadyBootstrapped = await client.query(
      'SELECT 1 FROM audit_logs WHERE action=$1 LIMIT 1',
      [BOOTSTRAP_ACTION],
    );
    if (alreadyBootstrapped.rowCount) {
      await client.query('COMMIT');
      transactionStarted = false;
      return null;
    }

    await client.query(
      "SELECT set_config('app.role','global_admin',true), set_config('app.access_change_reason',$1,true)",
      [config.reason],
    );
    const tenant = (await client.query<{ id: string; display_name: string; status: string }>(
      `SELECT id,display_name,status FROM platform_tenants
       WHERE tenant_key=$1 FOR UPDATE`,
      [config.tenantKey],
    )).rows[0];
    if (!tenant || tenant.display_name.trim().toLowerCase() !== 'afrosherik' || tenant.status === 'retired') {
      throw new Error('The configured tenant key must identify the existing, non-retired AfroSherik platform tenant.');
    }

    const existingGlobalAdmin = await client.query(
      "SELECT 1 FROM users WHERE role='global_admin' LIMIT 1",
    );
    if (existingGlobalAdmin.rowCount) {
      throw new Error('A Global Admin already exists; use the standard account and promotion workflows instead.');
    }

    const results: Array<{ id: string }> = [];
    for (const [index, identity] of IDENTITIES.entries()) {
      const phone = normalizePhone(identity.phone);
      if (!phone) throw new Error('A configured initial administrator phone number is invalid.');
      const existing = await client.query(
        'SELECT 1 FROM users WHERE phone=$1 FOR UPDATE',
        [phone],
      );
      if (existing.rowCount) {
        throw new Error(`An account already uses the configured phone number for ${identity.name}; no account was changed.`);
      }

      const account = (await client.query<{ id: string }>(
        `INSERT INTO users (legal_name,phone,role,kyc_status,active,password_hash,must_change_password)
         VALUES ($1,$2,'global_admin','verified',true,$3,true)
         RETURNING id`,
        [identity.name, phone, passwordHashes[index]],
      )).rows[0];
      results.push({ id: account.id });
    }

    await client.query("SELECT set_config('app.user_id',$1,true)", [results[0].id]);
    for (const account of results) {
      await client.query(
        `INSERT INTO user_admin_role_grants(user_id,role_name,module_keys,all_tenants,granted_by)
         VALUES($1,'super_admin',$2,false,$3)
         ON CONFLICT(user_id,role_name) DO UPDATE SET
           module_keys=EXCLUDED.module_keys,all_tenants=false,
           granted_by=EXCLUDED.granted_by,updated_at=now()`,
        [account.id, [...WORKSPACE_MODULES], results[0].id],
      );
      await client.query(
        `INSERT INTO platform_tenant_admins(tenant_id,user_id,assigned_by,role_grant_managed)
         VALUES($1,$2,$3,true)
         ON CONFLICT(tenant_id,user_id) DO UPDATE SET
           assigned_by=EXCLUDED.assigned_by,role_grant_managed=true`,
        [tenant.id, account.id, results[0].id],
      );
      await client.query(
        `UPDATE auth_sessions SET revoked_at=now()
         WHERE user_id=$1 AND revoked_at IS NULL`,
        [account.id],
      );
      await client.query(
        `INSERT INTO audit_logs(actor_id,action,entity,entity_id,old_value,new_value)
         VALUES($1,$2,'user',$3,$4,$5)`,
        [
          results[0].id,
          BOOTSTRAP_ACTION,
          account.id,
          null,
          JSON.stringify({
            roles: ['global_admin', 'super_admin'],
            super_admin_scope: 'AfroSherik',
            modules: [...WORKSPACE_MODULES],
            all_tenants: false,
            must_change_password: true,
            mfa_enrollment_required: true,
            bootstrap_actor: 'controlled deployment bootstrap, not an interactive administrator',
            reason: config.reason,
          }),
        ],
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    return {
      created: results.length,
      tenantId: tenant.id,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Initial AfroSherik administrator bootstrap failed and rollback also failed.');
      }
    }
    throw error;
  } finally {
    passwordHashes.fill('');
    client.release();
  }
}
