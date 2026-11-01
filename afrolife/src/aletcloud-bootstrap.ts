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
      rolbypassrls: boolean;
    }>('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=$1', [runtime.role]);
    const roleName = quoteIdentifier(runtime.role);
    const password = quoteLiteral(runtime.password);
    if (existingRole.rowCount) {
      if (existingRole.rows[0].rolsuper || existingRole.rows[0].rolbypassrls) {
        throw new Error('The existing runtime role is privileged; use a new restricted role instead.');
      }
      await client.query(
        `ALTER ROLE ${roleName} WITH LOGIN PASSWORD ${password}
         NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`,
      );
    } else {
      await client.query(
        `CREATE ROLE ${roleName} WITH LOGIN PASSWORD ${password}
         NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`,
      );
    }
    await client.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(runtime.database)} TO ${roleName}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${roleName}`);
  } finally {
    await client.end();
  }

  const runtimeClient = new pg.Client({ connectionString: runtimeUrl });
  await runtimeClient.connect();
  try {
    const result = await runtimeClient.query<{
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(
      `SELECT r.rolsuper, r.rolbypassrls
       FROM pg_roles r WHERE r.rolname=current_user`,
    );
    const role = result.rows[0];
    if (!role || role.rolsuper || role.rolbypassrls) {
      throw new Error('The provisioned database runtime role does not meet the restricted-role requirements.');
    }
  } finally {
    await runtimeClient.end();
  }
}

async function seedFirstSuperAdmin(connectionString: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const exists = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM users WHERE role='super_admin') AS exists`,
    );
    if (exists.rows[0].exists) return false;
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
    return true;
  } finally {
    await client.end();
  }
}

const provisioningUrl = process.env.ALETCLOUD_BOOTSTRAP_DATABASE_URL;
if (provisioningUrl) {
  const runtimeUrl = process.env.DATABASE_URL;
  if (!runtimeUrl) throw new Error('DATABASE_URL must be set to the restricted runtime role.');
  const jwtSecret = process.env.JWT_SECRET ?? '';
  const mfaKey = process.env.MFA_ENC_KEY ?? '';
  if (jwtSecret.length < 32 || mfaKey.length < 32 || jwtSecret === mfaKey) {
    throw new Error('Distinct JWT_SECRET and MFA_ENC_KEY values of at least 32 characters are required before provisioning.');
  }

  await provisionRuntimeRole(provisioningUrl, runtimeUrl);
  const migrationEnv: NodeJS.ProcessEnv = { ...process.env, MIGRATION_DATABASE_URL: provisioningUrl };
  delete migrationEnv.ALETCLOUD_BOOTSTRAP_DATABASE_URL;
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

  const adminCreated = await seedFirstSuperAdmin(provisioningUrl);
  if (adminCreated) console.log('Created the initial Super Admin; a password change is required at first sign-in.');
  delete process.env.ALETCLOUD_BOOTSTRAP_DATABASE_URL;
  delete process.env.MIGRATION_DATABASE_URL;
  delete process.env.SEED_ADMIN_NAME;
  delete process.env.SEED_ADMIN_PHONE;
  delete process.env.SEED_ADMIN_PASSWORD;
}

await import('./server.js');
