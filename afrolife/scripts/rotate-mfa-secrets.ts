import '../src/env.js';
import pg from 'pg';
import { keyFrom, mfaKeys, openAny, reencryptMfaSecret } from '../src/security.js';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET ?? '';
const activeMfaKey = process.env.MFA_ENC_KEY ?? '';
const previousMfaKey = process.env.MFA_ENC_KEY_PREVIOUS ?? '';
const legacyJwtSecret = process.env.MFA_LEGACY_JWT_SECRET ?? '';

if (!runtimeUrl || !migrationUrl) {
  throw new Error('DATABASE_URL and MIGRATION_DATABASE_URL are required for MFA key rotation.');
}
if (jwtSecret.length < 32 || activeMfaKey.length < 32 || previousMfaKey.length < 32) {
  throw new Error('JWT_SECRET, MFA_ENC_KEY, and MFA_ENC_KEY_PREVIOUS must each be at least 32 characters.');
}
if (activeMfaKey === previousMfaKey || activeMfaKey === jwtSecret || previousMfaKey === jwtSecret) {
  throw new Error('The active MFA, previous MFA, and JWT secrets must be distinct.');
}
if (legacyJwtSecret && (
  legacyJwtSecret.length < 32
  || legacyJwtSecret === jwtSecret
  || legacyJwtSecret === activeMfaKey
  || legacyJwtSecret === previousMfaKey
)) {
  throw new Error('MFA_LEGACY_JWT_SECRET must be a distinct secret of at least 32 characters when provided.');
}

const runtime = new URL(runtimeUrl);
const migration = new URL(migrationUrl);
if (
  runtime.protocol !== migration.protocol
  || runtime.hostname !== migration.hostname
  || runtime.port !== migration.port
  || runtime.pathname !== migration.pathname
) {
  throw new Error('DATABASE_URL and MIGRATION_DATABASE_URL must target the same database.');
}
if (decodeURIComponent(runtime.username) === decodeURIComponent(migration.username)) {
  throw new Error('MIGRATION_DATABASE_URL must use a separate owner role from DATABASE_URL.');
}

const decryptionKeys = mfaKeys(jwtSecret, activeMfaKey, previousMfaKey);
if (legacyJwtSecret) decryptionKeys.push(keyFrom(legacyJwtSecret));
const activeKey = decryptionKeys[0];
const client = new pg.Client({
  connectionString: migrationUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 300_000,
  application_name: 'afrolife-mfa-key-rotation',
});

await client.connect();
let transactionOpen = false;
try {
  await client.query('BEGIN');
  transactionOpen = true;
  await client.query('LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE');
  const users = await client.query<{ id: string; mfa_secret: string }>(
    'SELECT id, mfa_secret FROM public.users WHERE mfa_secret IS NOT NULL FOR UPDATE',
  );

  for (const user of users.rows) {
    let reencrypted: string;
    try {
      reencrypted = reencryptMfaSecret(user.mfa_secret, decryptionKeys, activeKey);
    } catch {
      throw new Error('An MFA secret could not be safely re-encrypted; no records were changed.');
    }
    const updated = await client.query<{ mfa_secret: string }>(
      'UPDATE public.users SET mfa_secret = $2 WHERE id = $1 AND mfa_secret = $3 RETURNING mfa_secret',
      [user.id, reencrypted, user.mfa_secret],
    );
    if (updated.rowCount !== 1 || updated.rows[0].mfa_secret !== reencrypted) {
      throw new Error('An MFA secret changed or failed active-key verification; no records were committed.');
    }
  }

  await client.query('COMMIT');
  transactionOpen = false;
  console.log(`Re-encrypted ${users.rowCount} MFA secret(s) with the active key.`);
} catch (error) {
  if (transactionOpen) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'MFA key rotation failed and rollback could not be confirmed.',
      );
    }
  }
  throw error;
} finally {
  await client.end();
}
