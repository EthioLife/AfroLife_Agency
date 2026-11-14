import './env.js';
import bcrypt from 'bcryptjs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { assertMigrationChecksum, migrationChecksum } from './migration-checksums.js';
import { normalizePhone } from './phone.js';

const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('Set MIGRATION_DATABASE_URL or DATABASE_URL');
const appConnectionString = process.env.DATABASE_URL;
const appRole = appConnectionString ? decodeURIComponent(new URL(appConnectionString).username) : '';
if (appRole && !/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(appRole)) {
  throw new Error('DATABASE_URL must use a simple PostgreSQL role name before migrations can grant runtime access.');
}
const client = new pg.Client({ connectionString });
const folder = join(import.meta.dirname, '..', 'migrations');

async function seedInitialAdminBeforePropertyTenantMigration() {
  if (process.env.AFROLIFE_SEED_ADMIN_BEFORE_PROPERTY_TENANT_MIGRATION !== '1') return;

  const activeUser = await client.query('SELECT EXISTS (SELECT 1 FROM users WHERE active=true) AS present');
  if (activeUser.rows[0].present) return;

  const name = process.env.SEED_ADMIN_NAME?.trim();
  const phone = normalizePhone(process.env.SEED_ADMIN_PHONE ?? '');
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  if (!name || name.length < 2 || !phone || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('A valid initial Super Admin name, Ethiopian phone, and 12–72 byte password are required before property tenant isolation migrations.');
  }

  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO users (legal_name, phone, role, kyc_status, active, password_hash, must_change_password)
       VALUES ($1,$2,'super_admin','verified',true,$3,true)`,
      [name, phone, await bcrypt.hash(password, 12)],
    );
    await client.query('COMMIT');
    console.log('Created the initial Super Admin before property tenant isolation migrations.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

await client.connect();
try {
  await client.query("SELECT set_config('app.role', 'global_admin', false)");
  await client.query('SELECT pg_advisory_lock(71924211,1)');
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text');
  for (const name of (await readdir(folder)).filter((x) => x.endsWith('.sql')).sort()) {
    const originalSql = await readFile(join(folder, name), 'utf8');
    const checksum = migrationChecksum(originalSql);
    const applied = await client.query<{ checksum: string | null }>(
      'SELECT checksum FROM schema_migrations WHERE name = $1',
      [name],
    );
    if (applied.rowCount) {
      const storedChecksum = applied.rows[0].checksum;
      assertMigrationChecksum(name, storedChecksum, checksum);
      if (storedChecksum === null) {
        await client.query('UPDATE schema_migrations SET checksum=$2 WHERE name=$1 AND checksum IS NULL', [name, checksum]);
      }
      continue;
    }
    if (name === '118_property_operating_tenant_scope.sql') {
      await seedInitialAdminBeforePropertyTenantMigration();
    }
    if (process.env.MIGRATION_DATABASE_URL && name >= '098_support_case_access_hardening.sql') {
      await client.query('ALTER TABLE IF EXISTS public.support_cases NO FORCE ROW LEVEL SECURITY');
      await client.query('ALTER TABLE IF EXISTS public.support_case_access_requests NO FORCE ROW LEVEL SECURITY');
      await client.query('ALTER TABLE IF EXISTS public.support_case_events NO FORCE ROW LEVEL SECURITY');
    }
    if (process.env.MIGRATION_DATABASE_URL && name === '114_property_resident_rls_recursion_fix.sql') {
      await client.query('ALTER TABLE IF EXISTS public.property_tenant_account_links NO FORCE ROW LEVEL SECURITY');
    }
    let sql = originalSql;
    if (sql.includes('"{{role}}"')) {
      if (!appRole) throw new Error(`${name} requires DATABASE_URL so migration grants can target the application role.`);
      sql = sql.replaceAll('"{{role}}"', `"${appRole}"`);
    }
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name,checksum) VALUES ($1,$2)', [name, checksum]);
      await client.query('COMMIT');
      console.log(`Applied ${name}`);
    } catch (error) {
      console.error(`Migration ${name} failed.`);
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], `Migration ${name} failed and rollback also failed`);
      }
      throw error;
    }
  }
  if (appRole) {
    const roleName = `"${appRole}"`;
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${roleName}`);
    await client.query(`REVOKE INSERT, UPDATE, DELETE ON TABLE schema_migrations FROM ${roleName}`);
    await client.query(`GRANT SELECT ON TABLE schema_migrations TO ${roleName}`);
    await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${roleName}`);
    console.log(`Granted runtime table and sequence privileges to "${appRole}".`);
  }
} finally {
  await client.end();
}
