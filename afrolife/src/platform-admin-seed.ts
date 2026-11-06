import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import { normalizePhone } from './phone.js';

export type PlatformAdminSeedInput = {
  actorId: string;
  name: string;
  phone: string;
  password: string;
  reason: string;
};

export function validatePlatformAdminSeedInput(input: PlatformAdminSeedInput): PlatformAdminSeedInput {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const reason = input.reason.trim();

  if (name.length < 2) throw new Error('SEED_PLATFORM_ADMIN_NAME must be at least 2 characters');
  if (!phone) throw new Error('SEED_PLATFORM_ADMIN_PHONE must be a valid phone number');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.actorId)) {
    throw new Error('SEED_PLATFORM_ADMIN_ACTOR_ID must be a valid user ID');
  }
  if (Buffer.byteLength(input.password, 'utf8') > 72 || input.password.length < 12) {
    throw new Error('SEED_PLATFORM_ADMIN_PASSWORD must be at least 12 characters and at most 72 UTF-8 bytes');
  }
  if (reason.length < 10 || reason.length > 1000) {
    throw new Error('SEED_PLATFORM_ADMIN_REASON must be between 10 and 1000 characters');
  }

  return { ...input, name, phone, reason };
}

export async function seedPlatformSuperAdmin(pool: Pool, input: PlatformAdminSeedInput): Promise<string> {
  const seed = validatePlatformAdminSeedInput(input);
  const passwordHash = await bcrypt.hash(seed.password, 12);
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    transactionStarted = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('afrolife:platform-super-admin-seed:v1', 0))");
    await client.query(
      "SELECT set_config('app.role','global_admin',true), set_config('app.user_id',$1,true), set_config('app.access_change_reason',$2,true)",
      [seed.actorId, seed.reason],
    );

    const actor = await client.query<{ role: string; active: boolean; mfa_enabled: boolean }>(
      'SELECT role, active, mfa_enabled FROM users WHERE id = $1 FOR UPDATE',
      [seed.actorId],
    );
    const actorRecord = actor.rows[0];
    if (!actorRecord || !actorRecord.active || !actorRecord.mfa_enabled
      || !['super_admin', 'global_admin'].includes(actorRecord.role)) {
      throw new Error('The initiating account must be an active, MFA-enabled Super Admin or Global Admin');
    }

    const alreadySeeded = await client.query(
      "SELECT 1 FROM audit_logs WHERE action = 'platform_super_admin_seeded' LIMIT 1",
    );
    if (alreadySeeded.rowCount) throw new Error('The one-time platform Super Admin seed has already been used');

    const existing = await client.query('SELECT 1 FROM users WHERE phone = $1', [seed.phone]);
    if (existing.rowCount) throw new Error('An account with SEED_PLATFORM_ADMIN_PHONE already exists');

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO users (legal_name, phone, role, kyc_status, active, password_hash, must_change_password)
       VALUES ($1,$2,'super_admin','verified',true,$3,true)
       RETURNING id`,
      [seed.name, seed.phone, passwordHash],
    );
    const userId = inserted.rows[0].id;

    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, new_value)
       VALUES ($1,'platform_super_admin_seeded','user',$2,$3)`,
      [seed.actorId, userId, JSON.stringify({
        role: 'super_admin',
        must_change_password: true,
        mfa_enrollment_required: true,
        reason: seed.reason,
      })],
    );
    await client.query('COMMIT');
    transactionStarted = false;
    return userId;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Admin seeding failed and the transaction rollback also failed');
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
