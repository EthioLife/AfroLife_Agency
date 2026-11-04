import type { Pool } from 'pg';

export type UatGlobalAdminBootstrapConfig = {
  connectionString: string;
  targetUserId: string;
  reason: string;
};

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOOTSTRAP_ACTION = 'uat_global_admin_bootstrap';

export function validateUatGlobalAdminBootstrapConfig(env: Record<string, string | undefined>): UatGlobalAdminBootstrapConfig {
  if (env.AFROLIFE_DEPLOYMENT_ENV !== 'uat') {
    throw new Error('AFROLIFE_DEPLOYMENT_ENV must be exactly uat for the initial Global Admin bootstrap');
  }
  if (env.ALETCLOUD_APP_NAME !== 'afrolife-uat-canary') {
    throw new Error('ALETCLOUD_APP_NAME must identify the afrolife-uat-canary application');
  }
  if (env.ALLOW_UAT_GLOBAL_ADMIN_BOOTSTRAP !== '1') {
    throw new Error('ALLOW_UAT_GLOBAL_ADMIN_BOOTSTRAP=1 is required for this one-time operation');
  }
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is required for the initial Global Admin bootstrap');
  const targetUserId = env.UAT_GLOBAL_ADMIN_TARGET_ID?.trim() ?? '';
  if (!USER_ID_PATTERN.test(targetUserId)) {
    throw new Error('UAT_GLOBAL_ADMIN_TARGET_ID must be a valid user ID');
  }
  const reason = env.UAT_GLOBAL_ADMIN_REASON?.trim() ?? '';
  if (reason.length < 10 || reason.length > 1000) {
    throw new Error('UAT_GLOBAL_ADMIN_REASON must be between 10 and 1000 characters');
  }
  return { connectionString, targetUserId, reason };
}

export async function bootstrapInitialUatGlobalAdmin(
  pool: Pool,
  env: Record<string, string | undefined>,
): Promise<string> {
  const config = validateUatGlobalAdminBootstrapConfig(env);
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    transactionStarted = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('afrolife:global-admin-role-change:v1', 0))");
    const historyReason = `UAT initial Global Admin bootstrap: ${config.reason}`;
    await client.query(
      "SELECT set_config('app.role','global_admin',true), set_config('app.user_id',$1,true), set_config('app.access_change_reason',$2,true)",
      [config.targetUserId, historyReason],
    );

    const targetResult = await client.query<{ id: string; role: string; active: boolean; mfa_enabled: boolean }>(
      'SELECT id,role,active,mfa_enabled FROM users WHERE id=$1 FOR UPDATE',
      [config.targetUserId],
    );
    const target = targetResult.rows[0];
    if (!target || target.role !== 'super_admin' || !target.active || !target.mfa_enabled) {
      throw new Error('The target must be an existing active, MFA-enabled Super Admin');
    }

    const existingGlobalAdmin = await client.query(
      "SELECT 1 FROM users WHERE role='global_admin' LIMIT 1",
    );
    if (existingGlobalAdmin.rowCount) {
      throw new Error('A Global Admin account already exists; use the standard promotion workflow');
    }

    const pendingPromotion = await client.query(
      "SELECT 1 FROM global_admin_role_change_requests WHERE status='pending' LIMIT 1",
    );
    if (pendingPromotion.rowCount) {
      throw new Error('A standard Global Admin promotion is already pending; complete that approval workflow');
    }

    const priorBootstrap = await client.query(
      `SELECT 1 FROM user_access_history
       WHERE role_after='global_admin' AND reason LIKE 'UAT initial Global Admin bootstrap:%'
       UNION ALL
       SELECT 1 FROM audit_logs WHERE action=$1
       LIMIT 1`,
      [BOOTSTRAP_ACTION],
    );
    if (priorBootstrap.rowCount) throw new Error('The one-time UAT Global Admin bootstrap has already been used');

    const updated = await client.query<{ id: string }>(
      `UPDATE users SET role='global_admin'
       WHERE id=$1 AND role='super_admin' AND active=true AND mfa_enabled=true
       RETURNING id`,
      [config.targetUserId],
    );
    if (!updated.rowCount) throw new Error('The target account changed before the Global Admin bootstrap could complete');

    await client.query(
      `INSERT INTO audit_logs(actor_id,action,entity,entity_id,old_value,new_value)
       VALUES($1,$2,'user',$3,$4,$5)`,
      [
        config.targetUserId,
        BOOTSTRAP_ACTION,
        config.targetUserId,
        JSON.stringify({ role: 'super_admin' }),
        JSON.stringify({
          role: 'global_admin',
          reason: config.reason,
          approval_exception: 'One-time UAT bootstrap because no Global Admin existed',
        }),
      ],
    );
    await client.query('COMMIT');
    transactionStarted = false;
    return target.id;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'UAT Global Admin bootstrap failed and the transaction rollback also failed');
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
