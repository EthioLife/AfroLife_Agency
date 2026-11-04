import './env.js';
import bcrypt from 'bcryptjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePhone } from './phone.js';

function databaseUrlDetails(connectionString: string) {
  const url = new URL(connectionString);
  const role = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(role) || !database || !password) {
    throw new Error('Database URLs must include a simple role name, password, and database.');
  }
  return { role, password, database };
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function provisionRuntimeRole(adminUrl: string, runtimeUrl: string) {
  const admin = databaseUrlDetails(adminUrl);
  const runtime = databaseUrlDetails(runtimeUrl);
  if (admin.role === runtime.role) {
    throw new Error('The application runtime role must be different from the database provisioning role.');
  }

  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const connection = await client.query<{
      current_user: string;
      current_database: string;
      rolsuper: boolean;
      rolcreaterole: boolean;
    }>(
      `SELECT current_user, current_database(), r.rolsuper, r.rolcreaterole
       FROM pg_roles r WHERE r.rolname=current_user`,
    );
    const current = connection.rows[0];
    if (!current || current.current_database !== runtime.database) {
      throw new Error('Provisioning and runtime URLs must point to the same database.');
    }
    if (!current.rolsuper && !current.rolcreaterole) {
      throw new Error('The database provisioning role cannot create the restricted runtime role.');
    }

    const existingRole = await client.query<{
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolbypassrls: boolean;
    }>('SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname=$1', [runtime.role]);
    let runtimeRole = runtime.role;
    if (existingRole.rowCount) {
      const currentRole = existingRole.rows[0];
      if (currentRole.rolsuper || currentRole.rolcreatedb || currentRole.rolcreaterole || currentRole.rolbypassrls) {
        runtimeRole = `${runtime.role.slice(0, 46)}_afrolife_runtime`;
      }
    }

    if (runtimeRole === admin.role) {
      throw new Error('The application runtime role must be different from the database provisioning role.');
    }
    const targetRole = await client.query<{
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolbypassrls: boolean;
    }>('SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname=$1', [runtimeRole]);
    const roleName = quoteIdentifier(runtimeRole);
    if (targetRole.rowCount) {
      const role = targetRole.rows[0];
      if (role.rolsuper || role.rolcreatedb || role.rolcreaterole || role.rolbypassrls) {
        throw new Error('The selected application runtime role has elevated privileges; choose a different DATABASE_URL username.');
      }
    } else {
      await client.query(
        `CREATE ROLE ${roleName} WITH LOGIN PASSWORD ${quoteLiteral(runtime.password)}`,
      );
    }
    await client.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(runtime.database)} TO ${roleName}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${roleName}`);
    if (runtimeRole !== runtime.role) {
      const runtimeConnection = new URL(runtimeUrl);
      runtimeConnection.username = runtimeRole;
      process.env.DATABASE_URL = runtimeConnection.toString();
      console.log(`Created restricted database role "${runtimeRole}". Update AletCloud DATABASE_URL to use this role after deployment.`);
    }
  } finally {
    await client.end();
  }

  const effectiveRuntimeUrl = process.env.DATABASE_URL ?? runtimeUrl;
  const runtimeClient = new pg.Client({ connectionString: effectiveRuntimeUrl });
  await runtimeClient.connect();
  try {
    const result = await runtimeClient.query<{
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolbypassrls: boolean;
    }>(
      `SELECT r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolbypassrls
       FROM pg_roles r WHERE r.rolname=current_user`,
    );
    const role = result.rows[0];
    if (!role || role.rolsuper || role.rolcreatedb || role.rolcreaterole || role.rolbypassrls) {
      throw new Error('The provisioned database runtime role does not meet the restricted-role requirements.');
    }
  } finally {
    await runtimeClient.end();
  }
  return effectiveRuntimeUrl;
}

async function seedFirstSuperAdmin(connectionString: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN'); await client.query("SELECT set_config('app.role', 'global_admin', true)"); const exists = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM users WHERE role='super_admin') AS exists`,
    );
    if (exists.rows[0].exists) { await client.query('COMMIT'); return false; }
    const name = process.env.SEED_ADMIN_NAME?.trim();
    const phone = normalizePhone(process.env.SEED_ADMIN_PHONE ?? '');
    const password = process.env.SEED_ADMIN_PASSWORD ?? '';
    if (!name || !phone || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('A valid initial Super Admin name, Ethiopian phone, and 12–72 byte password are required.');
    }
    await client.query(
      `INSERT INTO users (legal_name, phone, role, kyc_status, active, password_hash, must_change_password)
       VALUES ($1,$2,'super_admin','verified',true,$3,true)`,
      [name, phone, await bcrypt.hash(password, 12)],
    );
    await client.query('COMMIT'); return true;
  } finally {
    await client.end();
  }
}

const provisioningUrl = process.env.ALETCLOUD_BOOTSTRAP_DATABASE_URL;
const migrationsOnly = process.env.ALETCLOUD_BOOTSTRAP_MIGRATIONS_ONLY === '1';
if (process.env.ALETCLOUD_BOOTSTRAP_MIGRATIONS_ONLY !== undefined && !migrationsOnly) {
  throw new Error('ALETCLOUD_BOOTSTRAP_MIGRATIONS_ONLY must be set to 1 when provided.');
}
if (migrationsOnly && !provisioningUrl) {
  throw new Error('ALETCLOUD_BOOTSTRAP_DATABASE_URL is required for a migrations-only bootstrap.');
}

if (provisioningUrl) {
  const runtimeUrl = process.env.DATABASE_URL;
  if (!runtimeUrl) throw new Error('DATABASE_URL must be set to the restricted runtime role.');
  const jwtSecret = process.env.JWT_SECRET ?? '';
  const mfaKey = process.env.MFA_ENC_KEY ?? '';
  if (jwtSecret.length < 32 || mfaKey.length < 32 || jwtSecret === mfaKey) {
    throw new Error('Distinct JWT_SECRET and MFA_ENC_KEY values of at least 32 characters are required before provisioning.');
  }

  const effectiveRuntimeUrl = await provisionRuntimeRole(provisioningUrl, runtimeUrl);
  process.env.DATABASE_URL = effectiveRuntimeUrl;
  const migrationEnv: NodeJS.ProcessEnv = { ...process.env, MIGRATION_DATABASE_URL: provisioningUrl };
  delete migrationEnv.ALETCLOUD_BOOTSTRAP_DATABASE_URL;
  delete migrationEnv.ALETCLOUD_BOOTSTRAP_MIGRATIONS_ONLY;

  delete migrationEnv.SEED_ADMIN_NAME;
  delete migrationEnv.SEED_ADMIN_PHONE;
  delete migrationEnv.SEED_ADMIN_PASSWORD;
  const migration = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./migrate.js', import.meta.url))],
    {
      env: migrationEnv,
      stdio: 'inherit',
    },
  );
  if (migration.error) throw migration.error;
  if (migration.status !== 0) {
    throw new Error(`Database migrations failed with exit code ${migration.status ?? 'unknown'}.`);
  }

  const adminCreated = migrationsOnly ? false : await seedFirstSuperAdmin(provisioningUrl);
  if (adminCreated) console.log('Created the initial Super Admin; a password change is required at first sign-in.');
  if (migrationsOnly) console.log('Completed AletCloud migrations-only bootstrap; administrator seeding was skipped.');

  delete process.env.ALETCLOUD_BOOTSTRAP_DATABASE_URL;
  delete process.env.ALETCLOUD_BOOTSTRAP_MIGRATIONS_ONLY;

  delete process.env.MIGRATION_DATABASE_URL;
  delete process.env.SEED_ADMIN_NAME;
  delete process.env.SEED_ADMIN_PHONE;
  delete process.env.SEED_ADMIN_PASSWORD;
}

const recoveryEnabled = process.env.ALETCLOUD_ADMIN_RECOVERY_ENABLED;
const recoveryPhoneInput = process.env.ALETCLOUD_ADMIN_RECOVERY_PHONE;
const recoveryName = process.env.ALETCLOUD_ADMIN_RECOVERY_NAME?.trim();
const recoveryPassword = process.env.ALETCLOUD_ADMIN_RECOVERY_PASSWORD;
const recoveryConfirm = process.env.ALETCLOUD_ADMIN_RECOVERY_CONFIRM;
if (
  recoveryEnabled !== undefined
  || recoveryPhoneInput !== undefined
  || recoveryName !== undefined
  || recoveryPassword !== undefined
  || recoveryConfirm !== undefined
) {
  const phone = normalizePhone(recoveryPhoneInput ?? '');
  if (
    recoveryEnabled !== '1'
    || recoveryConfirm !== 'rotate-super-admin'
    || !phone
    || (recoveryName !== undefined && recoveryName.length < 2)
    || !recoveryPassword
    || recoveryPassword.length < 16
    || Buffer.byteLength(recoveryPassword, 'utf8') > 72
  ) {
    throw new Error('Valid one-time Super Admin recovery settings are required.');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for Super Admin recovery.');

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.role', 'global_admin', true)");
    const user = recoveryName
      ? await client.query<{ id: string }>(
        `SELECT id FROM users
         WHERE role IN ('super_admin', 'global_admin') AND active = true
         FOR UPDATE`,
      )
      : await client.query<{ id: string }>(
        `SELECT id FROM users
         WHERE phone = $1 AND role IN ('super_admin', 'global_admin') AND active = true
         FOR UPDATE`,
        [phone],
      );
    if (user.rowCount !== 1) {
      throw new Error('Super Admin recovery requires exactly one active administrator for the selected recovery mode.');
    }

    const userId = user.rows[0].id;
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    if (recoveryName) {
      await client.query(
        `UPDATE users
         SET legal_name = $2, phone = $3, password_hash = $4, must_change_password = true,
             failed_logins = 0, locked_until = NULL
         WHERE id = $1`,
        [userId, recoveryName, phone, await bcrypt.hash(recoveryPassword, 12)],
      );
    } else {
      await client.query(
        `UPDATE users
         SET password_hash = $2, must_change_password = true, failed_logins = 0, locked_until = NULL
         WHERE id = $1`,
        [userId, await bcrypt.hash(recoveryPassword, 12)],
      );
    }
    await client.query(
      'UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  delete process.env.ALETCLOUD_ADMIN_RECOVERY_ENABLED;
  delete process.env.ALETCLOUD_ADMIN_RECOVERY_PHONE;
  delete process.env.ALETCLOUD_ADMIN_RECOVERY_NAME;
  delete process.env.ALETCLOUD_ADMIN_RECOVERY_PASSWORD;
  delete process.env.ALETCLOUD_ADMIN_RECOVERY_CONFIRM;
  console.log('Recovered the configured Super Admin; a password change is required at first sign-in.');
}

await import('./server.js');
