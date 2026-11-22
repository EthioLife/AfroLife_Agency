import '../src/env.js';
import pg from 'pg';
import { open, keyFromMfaEncryptionSecret } from '../src/security.js';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET ?? '';
const activeMfaKey = process.env.MFA_ENC_KEY ?? '';

if (!runtimeUrl || !migrationUrl) {
  throw new Error('DATABASE_URL and MIGRATION_DATABASE_URL are required for MFA key verification.');
}
if (jwtSecret.length < 32 || activeMfaKey.length < 32 || jwtSecret === activeMfaKey) {
  throw new Error('JWT_SECRET and MFA_ENC_KEY must be distinct secrets of at least 32 characters.');
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

const activeKey = keyFromMfaEncryptionSecret(activeMfaKey);
const client = new pg.Client({
  connectionString: migrationUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 60_000,
  application_name: 'afrolife-mfa-key-verification',
});

await client.connect();
let transactionOpen = false;
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  transactionOpen = true;
  const users = await client.query<{ mfa_secret: string }>(
    'SELECT mfa_secret FROM public.users WHERE mfa_secret IS NOT NULL',
  );
  let invalidSecrets = 0;
  for (const user of users.rows) {
    try {
      open(user.mfa_secret, activeKey);
    } catch {
      invalidSecrets += 1;
    }
  }
  await client.query('COMMIT');
  transactionOpen = false;

  const report = {
    result: users.rows.length > 0 && invalidSecrets === 0 ? 'PASS' : 'FAIL',
    checked_at: new Date().toISOString(),
    target: `${migration.hostname}/${decodeURIComponent(migration.pathname.replace(/^\/+/, ''))}`,
    total_mfa_secrets: users.rows.length,
    active_key_decryptions: users.rows.length - invalidSecrets,
    failed_active_key_decryptions: invalidSecrets,
    failure_reason: users.rows.length === 0 ? 'no_stored_mfa_secrets' : (invalidSecrets ? 'active_key_decryption_failed' : null),
  };
  console.log(JSON.stringify(report, null, 2));
  if (invalidSecrets) process.exitCode = 1;
} catch (error) {
  if (transactionOpen) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'MFA key verification failed and read-only transaction cleanup could not be confirmed.',
      );
    }
  }
  throw error;
} finally {
  await client.end();
}
