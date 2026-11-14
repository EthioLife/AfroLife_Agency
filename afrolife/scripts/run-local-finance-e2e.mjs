import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import dotenv from 'dotenv';
import pg from 'pg';

const localEnv = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'AfroLife', 'afrolife.env')
  : undefined;
const configuredEnv = process.env.AFROLIFE_ENV_FILE;
const envPath = configuredEnv && existsSync(configuredEnv)
  ? configuredEnv
  : existsSync(resolve('.env'))
    ? resolve('.env')
    : localEnv && existsSync(localEnv)
      ? localEnv
      : undefined;
if (envPath) dotenv.config({ path: envPath });

const adminConnectionString = process.env.MIGRATION_DATABASE_URL;
assert.ok(adminConnectionString, 'MIGRATION_DATABASE_URL is required to create an isolated local finance test database');
const adminUrl = new URL(adminConnectionString);
const adminDatabase = decodeURIComponent(adminUrl.pathname.replace(/^\/+/, ''));
const isolatedPort = Number(process.env.AFROLIFE_FINANCE_E2E_PORT);
const isolatedContainer = process.env.AFROLIFE_FINANCE_E2E_CONTAINER ?? '';
const temporaryContainerTarget = process.env.AFROLIFE_FINANCE_E2E_ISOLATED === '1'
  && Number.isInteger(isolatedPort)
  && isolatedPort >= 1024
  && isolatedPort <= 65535
  && adminUrl.port === String(isolatedPort)
  && adminDatabase === 'postgres'
  && adminUrl.username === 'postgres'
  && /^afrolife-finance-e2e-[0-9a-f]{16}$/.test(isolatedContainer);
const existingLocalTarget = adminUrl.port === '5433'
  && ['afrolife', 'postgres'].includes(adminDatabase);
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(adminUrl.hostname)
  && (existingLocalTarget || temporaryContainerTarget),
'Finance E2E setup only provisions databases on the approved loopback PostgreSQL target');

const suffix = `${Date.now()}_${randomBytes(4).toString('hex')}`;
const databaseName = `afrolife_test_finance_${suffix}`;
const fixtureRole = `afrolife_fixture_${suffix}`;
const runtimeRole = `afrolife_runtime_${suffix}`;
const staffingRole = `afrolife_staffing_${suffix}`;
const testDataDirectory = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'AfroLife')
  : tmpdir();
mkdirSync(testDataDirectory, { recursive: true });
const fixturePassword = randomBytes(36).toString('base64url');
const runtimePassword = randomBytes(36).toString('base64url');
const staffingPassword = randomBytes(36).toString('base64url');
const credentialsPath = join(
  testDataDirectory,
  `finance-e2e-users-${suffix}.txt`,
);
const mfiCredentialsPath = join(
  testDataDirectory,
  `mfi-e2e-users-${suffix}.txt`,
);
const storagePath = join(tmpdir(), `afrolife-finance-e2e-storage-${suffix}`);
const adminClient = new pg.Client({ connectionString: adminConnectionString, connectionTimeoutMillis: 5000 });
let createdRoles = [];
let databaseCreated = false;
let apiProcess;
let apiLogs = '';
let testDatabaseUrl;
let suiteExitCode = 0;

function runNode(args, env, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, `${label} failed with exit code ${result.status ?? result.signal}`);
}

function runNodeAsync(args, env, label) {
  return new Promise((resolveStatus, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', (error) => reject(new Error(`${label} could not start: ${error.message}`)));
    child.once('exit', (status) => resolveStatus(status ?? 1));
  });
}

async function findPorts(count) {
  const reservations = [];
  try {
    for (let index = 0; index < count; index++) {
      const server = createServer();
      await new Promise((resolveListen, rejectListen) => {
        server.once('error', rejectListen);
        server.listen(0, '127.0.0.1', resolveListen);
      });
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      reservations.push({ server, port: address.port });
    }
    return reservations.map(({ port }) => port);
  } finally {
    await Promise.all(reservations.map(({ server }) => new Promise((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    })));
  }
}

async function findPort() {
  return (await findPorts(1))[0];
}

const [propertyPort, staffingPort, staffingServicePort, clamAvPort] = await findPorts(4);
let clamAvScanCount = 0;
const clamAvTestServer = createServer((socket) => {
  let buffer = Buffer.alloc(0);
  let replied = false;
  const respond = () => {
    if (replied) return;
    replied = true;
    clamAvScanCount++;
    const validStream = buffer.includes(Buffer.from('zINSTREAM\0'))
      && buffer.length >= 4 && buffer.subarray(-4).equals(Buffer.alloc(4));
    socket.end(validStream ? 'stream: OK\0' : 'stream: ERROR\0');
  };
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length >= 4 && buffer.subarray(-4).equals(Buffer.alloc(4))) respond();
  });
  socket.on('end', respond);
  socket.on('error', (error) => console.error('E2E ClamAV protocol fixture socket failed', error.message));
});
await new Promise((resolveListen, rejectListen) => {
  clamAvTestServer.once('error', rejectListen);
  clamAvTestServer.listen(clamAvPort, '127.0.0.1', resolveListen);
});

async function startApi(port, env) {
  apiProcess = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: process.cwd(),
    env: { ...env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  apiProcess.on('error', (error) => { apiLogs = (apiLogs + `API process failed to start: ${error.message}\n`).slice(-8000); });
  apiProcess.stdout.on('data', (chunk) => { apiLogs = (apiLogs + chunk.toString()).slice(-8000); });
  apiProcess.stderr.on('data', (chunk) => { apiLogs = (apiLogs + chunk.toString()).slice(-8000); });
  let lastHealth = 'no response';
  for (let attempt = 0; attempt < 120; attempt++) {
    if (apiProcess.exitCode !== null) throw new Error(`Finance test API exited early: ${apiLogs}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok && apiLogs.includes('API listening;')) return;
      lastHealth = `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`;
    } catch (error) {
      lastHealth = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Finance test API did not become ready (${lastHealth}): ${apiLogs}`);
}

async function stopApi() {
  if (!apiProcess || apiProcess.exitCode !== null) return;
  apiProcess.kill('SIGTERM');
  await new Promise((resolveExit) => {
    const timer = setTimeout(resolveExit, 3000);
    apiProcess.once('exit', () => {
      clearTimeout(timer);
      resolveExit();
    });
  });
}

try {
  await adminClient.connect();
  const admin = (await adminClient.query(
    'SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user',
  )).rows[0];
  assert.ok(admin && admin.rolcreatedb && admin.rolcreaterole,
    'Local provisioning role must have CREATEDB and CREATEROLE; it is used only to create and remove the disposable test database and roles');

  for (const [role, password, bypassRls] of [
    [fixtureRole, fixturePassword, true],
    [runtimeRole, runtimePassword, false],
    [staffingRole, staffingPassword, false],
  ]) {
    await adminClient.query(
      `CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE ${bypassRls ? 'BYPASSRLS' : 'NOBYPASSRLS'}`,
    );
    createdRoles.push(role);
  }
  await adminClient.query(`CREATE DATABASE ${databaseName}`);
  databaseCreated = true;
  await adminClient.query(`GRANT CONNECT ON DATABASE ${databaseName} TO ${fixtureRole},${runtimeRole}`);

  const migrationUrl = new URL(adminUrl);
  migrationUrl.pathname = `/${databaseName}`;
  const runtimeUrl = new URL(migrationUrl);
  runtimeUrl.username = runtimeRole;
  runtimeUrl.password = runtimePassword;
  const fixtureUrl = new URL(migrationUrl);
  fixtureUrl.username = fixtureRole;
  fixtureUrl.password = fixturePassword;
  testDatabaseUrl = fixtureUrl.toString();

  const testEnv = {
    ...process.env,
    DATABASE_URL: runtimeUrl.toString(),
    MIGRATION_DATABASE_URL: migrationUrl.toString(),
    TEST_DATABASE_URL: testDatabaseUrl,
    NODE_ENV: 'development',
    INSURANCE_BROKERAGE_MODE: 'sandbox',
    MARKETPLACE_PAYMENT_MODE: 'mock',
    JWT_SECRET: process.env.JWT_SECRET ?? randomBytes(48).toString('base64url'),
    MFA_ENC_KEY: process.env.MFA_ENC_KEY ?? randomBytes(48).toString('base64url'),
    AFROLIFE_SEED_ADMIN_BEFORE_PROPERTY_TENANT_MIGRATION: '1',
    SEED_ADMIN_NAME: 'LOCAL QA Migration Bootstrap Admin',
    SEED_ADMIN_PHONE: '+12025550999',
    SEED_ADMIN_PASSWORD: randomBytes(32).toString('base64url'),
    MFI_PILOT_ENABLED: '1',
    MFI_SERVICE_URL: '',
    MFI_E2E_DATABASE_URL: migrationUrl.toString(),
    MFI_E2E_USERS_FILE: mfiCredentialsPath,
    AFROLIFE_TEST_POSTGRES_CONTAINER: temporaryContainerTarget ? '1' : '',
    WORKFORCE_MANAGEMENT_SERVICE_URL: '',
    WORKER_MANAGEMENT_SERVICE_URL: '',
    STAFFING_SERVICE_URL: '',
    PROPERTY_MANAGEMENT_SERVICE_URL: '',
    MARKETPLACE_SERVICE_URL: '',
    ACCOUNTING_SERVICE_URL: 'http://127.0.0.1:1',
    ACCOUNTING_INGEST_SECRET: randomBytes(48).toString('hex'),
    ACCOUNTING_GATEWAY_SECRET: randomBytes(48).toString('hex'),
    CLAMAV_HOST: '127.0.0.1',
    CLAMAV_PORT: String(clamAvPort),
    AFROLIFE_TEST_USERS_FILE: credentialsPath,
    PROPERTY_E2E_USERS_FILE: credentialsPath,
    PROPERTY_E2E_PORT: String(propertyPort),
    STAFFING_E2E_PORT: String(staffingPort),
    STAFFING_SERVICE_E2E_PORT: String(staffingServicePort),
    FILE_STORAGE_DIR: storagePath,
  };

  runNode(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], testEnv, 'API build');
  runNode(['node_modules/typescript/bin/tsc', '-p', 'services/staffing/tsconfig.json'], testEnv, 'Staffing service build');
  runNode(['--import', 'tsx', 'src/migrate.ts'], testEnv, 'Disposable database migrations');
  const fixtureGrants = new pg.Client({ connectionString: migrationUrl.toString() });
  try {
    await fixtureGrants.connect();
    await fixtureGrants.query(`GRANT USAGE ON SCHEMA public TO ${fixtureRole}`);
    await fixtureGrants.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${fixtureRole}`);
    await fixtureGrants.query(`GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${fixtureRole}`);
    await fixtureGrants.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${fixtureRole}`);
    await fixtureGrants.query(`GRANT USAGE ON SCHEMA public TO ${runtimeRole}`);
    await fixtureGrants.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${runtimeRole}`);
    await fixtureGrants.query(`GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${runtimeRole}`);
    await fixtureGrants.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${runtimeRole}`);
  } finally {
    await fixtureGrants.end();
  }

  runNode(
    ['--require', './.codex-osinfo-fallback.cjs', '--import', 'tsx', 'scripts/seed-local-mfi-e2e-users.ts'],
    testEnv,
    'Synthetic MFI-user seeding',
  );
  runNode(['--import', 'tsx', 'scripts/seed-local-test-users.ts'], testEnv, 'Synthetic finance-user seeding');
  const mfiPlatformClient = new pg.Client({ connectionString: migrationUrl.toString() });
  let mfiPlatformTenantId;
  try {
    await mfiPlatformClient.connect();
    await mfiPlatformClient.query('BEGIN');
    const admins = await mfiPlatformClient.query(
      "SELECT id FROM users WHERE legal_name=ANY($1::text[]) AND role='super_admin' ORDER BY legal_name",
      [['LOCAL E2E MFI Admin One', 'LOCAL E2E MFI Admin Two']],
    );
    assert.equal(admins.rowCount, 2, 'The MFI platform fixture requires both synthetic Super Admins');
    const packageRow = (await mfiPlatformClient.query(
      `INSERT INTO platform_service_packages(package_key,display_name,description,created_by)
       VALUES($1,'Local MFI E2E','Synthetic local-only MFI integration entitlement',$2) RETURNING id`,
      [`local-mfi-e2e-${suffix}`, admins.rows[0].id],
    )).rows[0];
    await mfiPlatformClient.query(
      `INSERT INTO platform_service_package_items(package_id,service_key)
       SELECT $1,service_key FROM platform_services WHERE available`,
      [packageRow.id],
    );
    const tenantRow = (await mfiPlatformClient.query(
      `INSERT INTO platform_tenants(tenant_key,display_name,status,hosting_mode,deployment_status,
          deployment_verification_reference,created_by)
       VALUES($1,'Local MFI E2E','active','cloud','verified','Synthetic local E2E fixture',$2) RETURNING id`,
      [`local-mfi-e2e-${Date.now()}`, admins.rows[0].id],
    )).rows[0];
    mfiPlatformTenantId = tenantRow.id;
    await mfiPlatformClient.query(
      'INSERT INTO platform_tenant_packages(tenant_id,package_id,assigned_by) VALUES($1,$2,$3)',
      [tenantRow.id, packageRow.id, admins.rows[0].id],
    );
    const assignedAdmins = await mfiPlatformClient.query(
      `INSERT INTO platform_tenant_admins(tenant_id,user_id,assigned_by)
       SELECT $1,id,$2 FROM users WHERE id=ANY($3::uuid[]) RETURNING user_id`,
      [tenantRow.id, admins.rows[0].id, admins.rows.map((row) => row.id)],
    );
    assert.equal(assignedAdmins.rowCount, 2, 'Both synthetic Super Admins must be assigned to the MFI platform tenant');
    await mfiPlatformClient.query(
      `INSERT INTO platform_tenant_events(tenant_id,actor_id,event_type,event_data)
       VALUES($1,$2,'tenant_created',$3),($1,$2,'service_package_assigned',$4)`,
      [tenantRow.id, admins.rows[0].id,
        JSON.stringify({ source: 'local MFI E2E fixture', hosting_mode: 'cloud' }),
        JSON.stringify({ source: 'local MFI E2E fixture', package_id: packageRow.id })],
    );
    const entitlement = await mfiPlatformClient.query(
      `SELECT t.status,count(DISTINCT a.user_id)::int AS admin_count,
          array_agg(DISTINCT i.service_key) FILTER (WHERE i.service_key IS NOT NULL) AS services
       FROM platform_tenants t
       JOIN platform_tenant_packages tp ON tp.tenant_id=t.id
       JOIN platform_service_packages p ON p.id=tp.package_id AND p.active
       JOIN platform_service_package_items i ON i.package_id=p.id
       JOIN platform_services s ON s.service_key=i.service_key AND s.available
       LEFT JOIN platform_tenant_admins a ON a.tenant_id=t.id
       WHERE t.id=$1 GROUP BY t.id`,
      [tenantRow.id],
    );
    assert.equal(entitlement.rows[0]?.status, 'active', 'The synthetic MFI tenant must be active');
    assert.equal(entitlement.rows[0]?.admin_count, 2, 'The synthetic MFI tenant must be assigned to both administrators');
    assert.ok(entitlement.rows[0]?.services.includes('sacco_mfi'),
      'The synthetic MFI tenant must be entitled to SACCO/MFI');
    await mfiPlatformClient.query('COMMIT');
  } catch (error) {
    try { await mfiPlatformClient.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    await mfiPlatformClient.end();
  }
  const userData = readFileSync(credentialsPath, 'utf8');
  const suiteEnv = {
    ...testEnv,
    PROPERTY_E2E_USERS_DATA: userData,
    MFI_PLATFORM_TENANT_ID: mfiPlatformTenantId,
  };

  runNode(['scripts/local-property-finance-e2e.mjs'], suiteEnv, 'Property finance E2E');

  const staffingRuntimeUrl = new URL(migrationUrl);
  staffingRuntimeUrl.username = staffingRole;
  staffingRuntimeUrl.password = staffingPassword;
  const staffingGrants = new pg.Client({ connectionString: migrationUrl.toString() });
  try {
    await staffingGrants.connect();
    await staffingGrants.query(`GRANT USAGE ON SCHEMA public TO ${staffingRole},${fixtureRole}`);
    await staffingGrants.query(`GRANT SELECT ON role_activity_defaults TO ${staffingRole}`);
    await staffingGrants.query(`GRANT SELECT ON config_rules,leads,territories,job_requests,matches,documents,workers TO ${staffingRole}`);
    await staffingGrants.query(`GRANT EXECUTE ON FUNCTION app_worker_can_view_engagement_client(uuid) TO ${staffingRole}`);
    await staffingGrants.query(`GRANT EXECUTE ON FUNCTION app_worker_owns_phone(text) TO ${staffingRole}`);
    await staffingGrants.query(`GRANT INSERT (lead_id,sector,skills_required,languages_required,min_experience,rate_offered,territory_id,source_agent_id,idempotency_user_id,idempotency_key,payload_hash) ON job_requests TO ${staffingRole}`);
    await staffingGrants.query(`GRANT UPDATE (status) ON job_requests,matches TO ${staffingRole}`);
    await staffingGrants.query(`GRANT INSERT (request_id,worker_id,score,score_breakdown,created_by) ON matches TO ${staffingRole}`);
    await staffingGrants.query(`GRANT UPDATE (availability) ON workers TO ${staffingRole}`);
    await staffingGrants.query(`GRANT INSERT (actor_id,action,entity,entity_id,old_value,new_value) ON audit_logs TO ${staffingRole}`);
    await staffingGrants.query(`GRANT INSERT (user_id,channel,template,payload,status) ON notifications TO ${staffingRole}`);
    await staffingGrants.query(`GRANT SELECT,INSERT,UPDATE ON staffing_engagements,staffing_work_periods,staffing_settlements,accounting_event_outbox TO ${staffingRole}`);
    await staffingGrants.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${staffingRole}`);
    const privilegeCheck = await staffingGrants.query(
      `SELECT has_column_privilege($1,'public.users','password_hash','SELECT')
          OR has_column_privilege($1,'public.users','mfa_secret','SELECT') AS auth_secret_access,
        has_table_privilege($1,'public.users','SELECT')
          OR has_column_privilege($1,'public.users','phone','SELECT') AS user_contact_access,
        has_schema_privilege($1,'public','CREATE') AS schema_create,
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind IN ('r','p')
            AND (c.relname LIKE 'mfi_%' OR c.relname LIKE 'insurance_ledger_%')
            AND (has_table_privilege($1,c.oid,'SELECT') OR has_table_privilege($1,c.oid,'INSERT')
              OR has_table_privilege($1,c.oid,'UPDATE') OR has_table_privilege($1,c.oid,'DELETE'))) AS financial_access`,
      [staffingRole],
    );
    assert.deepEqual(privilegeCheck.rows[0], {
      auth_secret_access: false,
      user_contact_access: false,
      schema_create: false,
      financial_access: false,
    }, 'Staffing service test role has privileges outside its service boundary');
  } finally {
    await staffingGrants.end();
  }

  suiteEnv.STAFFING_DATABASE_URL = staffingRuntimeUrl.toString();
  suiteEnv.STAFFING_TEST_DATABASE_URL = testDatabaseUrl;
  suiteEnv.TEST_DATABASE_URL = testDatabaseUrl;
  runNode(['scripts/local-staffing-accounting-e2e.mjs'], suiteEnv, 'Staffing Accounting E2E');

  const port = await findPort();
  await startApi(port, suiteEnv);
  runNode(
    ['--require', './.codex-osinfo-fallback.cjs', '--import', 'tsx', 'scripts/local-mfi-e2e.ts'],
    { ...suiteEnv, API_URL: `http://127.0.0.1:${port}` },
    'SACCO/MFI role journey E2E',
  );
  suiteExitCode = await runNodeAsync(
    ['--import', 'tsx', '--test', 'test/api.test.ts', 'test/supply.test.ts'],
    { ...suiteEnv, API_URL: `http://127.0.0.1:${port}` },
    'Core HTTP integration suite',
  );
  console.log(`E2E ClamAV protocol fixture handled ${clamAvScanCount} scan request(s).`);
  if (suiteExitCode !== 0) console.error(`Core API logs before E2E failure:\n${apiLogs}`);
  assert.equal(suiteExitCode, 0, 'Core HTTP integration suite failed');
  console.log('Finance E2E passed on a temporary database with a non-superuser runtime role.');
} finally {
  await stopApi();
  await new Promise((resolveClose, rejectClose) => {
    clamAvTestServer.close((error) => error ? rejectClose(error) : resolveClose());
  });
  try { await adminClient.end(); } catch {}
  if (databaseCreated) {
    const cleanup = new pg.Client({ connectionString: adminConnectionString, connectionTimeoutMillis: 5000 });
    try {
      await cleanup.connect();
      await cleanup.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    } catch (error) {
      console.error(`Could not remove disposable finance database ${databaseName}: ${error instanceof Error ? error.message : error}`);
      suiteExitCode = 1;
    } finally {
      try { await cleanup.end(); } catch {}
    }
  }
  for (const role of createdRoles.reverse()) {
    const cleanup = new pg.Client({ connectionString: adminConnectionString, connectionTimeoutMillis: 5000 });
    try {
      await cleanup.connect();
      await cleanup.query(`DROP ROLE IF EXISTS ${role}`);
    } catch (error) {
      console.error(`Could not remove disposable finance role ${role}: ${error instanceof Error ? error.message : error}`);
      suiteExitCode = 1;
    } finally {
      try { await cleanup.end(); } catch {}
    }
  }
  for (const file of [credentialsPath, mfiCredentialsPath]) {
    try { rmSync(file, { force: true }); } catch (error) {
      console.error(`Could not remove test credential file: ${error instanceof Error ? error.message : error}`);
      suiteExitCode = 1;
    }
  }
  try { rmSync(storagePath, { recursive: true, force: true }); } catch (error) {
    console.error(`Could not remove temporary finance test files: ${error instanceof Error ? error.message : error}`);
    suiteExitCode = 1;
  }
}

if (suiteExitCode !== 0) process.exitCode = suiteExitCode;
