import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pg from 'pg';

const localEnv = process.env.AFROLIFE_ENV_FILE
  ?? join(process.env.LOCALAPPDATA ?? '', 'AfroLife', 'afrolife.env');
if (!existsSync(localEnv) && !process.env.TEST_DATABASE_URL?.trim()) {
  throw new Error('The isolated local AfroLife environment file is required. Run the local database setup first.');
}
if (existsSync(localEnv)) dotenv.config({ path: localEnv });
const disposableDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const dockerQaMode = process.env.AFROLIFE_DOCKER_QA === '1';
const containerizedDisposableDatabase = process.env.AFROLIFE_TEST_POSTGRES_CONTAINER === '1';
const connectionString = disposableDatabaseUrl ?? process.env.MIGRATION_DATABASE_URL;
const credentialPath = process.env.AFROLIFE_TEST_USERS_FILE
  ?? join(process.env.LOCALAPPDATA ?? '', 'AfroLife', 'local-test-users.txt');
if (!connectionString) {
  throw new Error('Run this only on Windows with the local AfroLife environment configured.');
}
if (existsSync(credentialPath)) {
  throw new Error(`Credential file already exists at ${credentialPath}. Move it safely before re-running.`);
}
const localUrl = new URL(connectionString);
const databaseName = decodeURIComponent(localUrl.pathname.replace(/^\/+/, ''));
const connectionPort = Number(localUrl.port);
const allowedConnectionPort = Number.isInteger(connectionPort)
  && connectionPort >= 1
  && connectionPort <= 65535
  && (dockerQaMode || containerizedDisposableDatabase || connectionPort === 5433);
if (!['127.0.0.1', 'localhost', '::1'].includes(localUrl.hostname)
  || !allowedConnectionPort
  || (dockerQaMode && disposableDatabaseUrl)
  || (disposableDatabaseUrl
    ? !/^afrolife_test_[a-z0-9_-]+$/i.test(databaseName)
    : databaseName !== 'afrolife')) {
  throw new Error('Refusing to seed users: target must be the local afrolife database or an explicitly named afrolife_test_* database on port 5433.');
}

const pool = new pg.Pool({ connectionString });
const client = await pool.connect();
let credentialFileCreated = false;
try {
  const identity = (await client.query(`
    SELECT current_database() AS database, current_user AS database_user,
           host(inet_server_addr()) AS address, inet_server_port() AS port,
           (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
           (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypasses_rls
  `)).rows[0];
  const allowedFixtureRole = disposableDatabaseUrl
    && /^afrolife_test_[a-z0-9_-]+$/i.test(databaseName)
    && /^afrolife_fixture_[a-z0-9_]+$/i.test(identity.database_user)
    && !identity.is_superuser && identity.bypasses_rls;
  const allowedExistingLocalSetup = !disposableDatabaseUrl && databaseName === 'afrolife'
    && identity.database_user === 'postgres' && identity.is_superuser;
  const loopbackPostgres = ['127.0.0.1', '::1'].includes(identity.address)
    && Number(identity.port) === 5433;
  const dockerPrivateAddress = identity.address && (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(identity.address)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(identity.address)
    || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(identity.address)
    || /^(fc|fd)[0-9a-f:]*$/i.test(identity.address)
  );
  const dockerPostgres = (dockerQaMode || containerizedDisposableDatabase)
    && dockerPrivateAddress && Number(identity.port) === 5432;
  if ((!loopbackPostgres && !dockerPostgres)
    || (!allowedFixtureRole && !allowedExistingLocalSetup)) {
    throw new Error(`Refusing to seed users: unexpected local database identity ${JSON.stringify(identity)}.`);
  }
  const migration = await client.query("SELECT 1 FROM schema_migrations WHERE name = '020_mfi_control_hardening.sql'");
  if (!migration.rowCount) throw new Error('Apply all migrations through 020 before creating local test users.');

  const territory = (await client.query("SELECT id FROM territories WHERE level = 'sub_city' AND name = 'Bole' ORDER BY id LIMIT 1")).rows[0];
  if (!territory) throw new Error('The starter Bole territory is missing; create a territory before seeding agent test users.');

  const definitions = [
    { key: 'super_admin_1', name: 'LOCAL QA Super Admin One', role: 'super_admin', phone: '+12025550101' },
    { key: 'super_admin_2', name: 'LOCAL QA Super Admin Two', role: 'super_admin', phone: '+12025550102' },
    { key: 'corporate_business_manager', name: 'LOCAL QA Corporate Manager', role: 'corporate_business_manager', phone: '+12025550103' },
    { key: 'compliance', name: 'LOCAL QA Compliance', role: 'compliance', phone: '+12025550104' },
    { key: 'finance', name: 'LOCAL QA Finance', role: 'finance', phone: '+12025550105' },
    { key: 'finance_manager', name: 'LOCAL QA Finance Manager', role: 'finance_manager', phone: '+12025550106' },
    { key: 'master_agent', name: 'LOCAL QA Master Agent', role: 'master_agent', phone: '+12025550107' },
    { key: 'field_agent', name: 'LOCAL QA Field Agent', role: 'field_agent', phone: '+12025550108' },
    { key: 'customer', name: 'LOCAL QA Customer', role: 'customer', phone: '+12025550109' },
    { key: 'worker', name: 'LOCAL QA Worker', role: 'worker', phone: '+12025550110' },
    { key: 'property_owner', name: 'LOCAL QA Property Owner', role: 'property_owner', phone: '+12025550111' },
  ];
  const collisions = await client.query('SELECT phone FROM users WHERE phone = ANY($1::text[])', [definitions.map((user) => user.phone)]);
  if (collisions.rowCount) {
    throw new Error(`Reserved local QA phone numbers are already in use (${collisions.rows.map((row) => row.phone).join(', ')}); no accounts were created.`);
  }

  const credentials: Array<{ role: string; phone: string; password: string }> = [];
  const ids = new Map<string, string>();
  await client.query('BEGIN');
  for (const definition of definitions) {
    const password = `AfroQA!${randomBytes(24).toString('base64url')}`;
    const createdBy = definition.key === 'super_admin_1' ? null : ids.get('super_admin_1');
    const result = await client.query(
      `INSERT INTO users (legal_name, phone, email, role, territory_id, password_hash,
                          must_change_password, kyc_status, active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,false,'verified',true,$7)
       RETURNING id`,
      [definition.name, definition.phone, `${definition.key}@example.test`, definition.role,
        ['master_agent', 'field_agent'].includes(definition.role) ? territory.id : null,
        await bcrypt.hash(password, 12), createdBy ?? null],
    );
    const userId = result.rows[0].id as string;
    ids.set(definition.key, userId);
    credentials.push({ role: definition.role + (definition.key === 'super_admin_2' ? ' (second account for four-eyes review)' : ''), phone: definition.phone, password });
    if (definition.role === 'master_agent') {
      await client.query('INSERT INTO agents (id, agent_type, parent_id, territory_id) VALUES ($1,\'master\',NULL,$2)', [userId, territory.id]);
    } else if (definition.role === 'field_agent') {
      await client.query('INSERT INTO agents (id, agent_type, parent_id, territory_id) VALUES ($1,\'field\',$2,$3)', [userId, ids.get('master_agent'), territory.id]);
    }
  }

  const reviewerId = ids.get('super_admin_1')!;
  for (const definition of definitions.filter((user) => ['master_agent', 'field_agent', 'customer', 'worker', 'property_owner'].includes(user.role))) {
    const accountType = ['master_agent', 'field_agent'].includes(definition.role) ? 'agent' : definition.role;
    const userId = ids.get(definition.key)!;
    await client.query(
      `INSERT INTO user_signups
         (user_id, account_type, requested_plan, payment_status, agent_type, territory_id,
          parent_agent_id, status, reviewed_by, reviewed_at)
       VALUES ($1,$2,$3,'not_required',$4,$5,$6,'approved',$7,now())`,
      [userId, accountType,
        ['agent', 'property_owner'].includes(accountType) ? 'free' : null,
        accountType === 'agent' ? (definition.role === 'master_agent' ? 'master' : 'field') : null,
        accountType === 'agent' ? territory.id : null,
        definition.role === 'field_agent' ? ids.get('master_agent') : null,
        reviewerId],
    );
  }
  for (const definition of definitions) {
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, new_value)
       VALUES ($1,'local_test_user_seeded','user',$2,$3::jsonb)`,
      [reviewerId, ids.get(definition.key), JSON.stringify({ role: definition.role, label: definition.name })],
    );
  }

  mkdirSync(dirname(credentialPath), { recursive: true });
  const contents = [
    'AfroLife local test accounts',
    'Local development only. These accounts are synthetic, active, and KYC-marked for workflow testing.',
    'Never use these accounts or credentials on staging or production.',
    `Database: ${identity.database} on ${identity.address}:${identity.port}`,
    '',
    'Role | Login phone | Password',
    ...credentials.map((item) => `${item.role} | ${item.phone} | ${item.password}`),
    '',
    'All passwords are unique. Delete this file when finished testing.',
  ].join('\n');
  writeFileSync(credentialPath, contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  credentialFileCreated = true;
  if (process.platform === 'win32') {
    const account = `${process.env.USERDOMAIN ?? ''}\\${process.env.USERNAME ?? ''}`;
    execFileSync('icacls.exe', [credentialPath, '/inheritance:r', '/grant:r', `${account}:(M)`], { stdio: 'ignore' });
  }
  await client.query('COMMIT');
  console.log(`Created ${definitions.length} local test accounts, including two Super Admins.`);
  console.log(`Credentials saved outside the repository at ${credentialPath}`);
  console.log('Public signup types: worker, customer, agent (master and field), property owner.');
  console.log('Staff roles: Super Admin, Corporate Business Manager, Compliance, Finance, Finance Manager.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  if (credentialFileCreated) unlinkSync(credentialPath);
  throw error;
} finally {
  client.release();
  await pool.end();
}
