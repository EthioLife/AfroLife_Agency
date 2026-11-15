import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
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
assert.ok(envPath, 'The local AfroLife environment file is required');
const localConfig = dotenv.parse(readFileSync(envPath));
const configuredMigrationUrl = localConfig.MIGRATION_DATABASE_URL;
assert.ok(configuredMigrationUrl, 'MIGRATION_DATABASE_URL is required for the local E2E credential');
const credentialUrl = new URL(configuredMigrationUrl);
assert.ok(
  credentialUrl.hostname === '127.0.0.1'
    && credentialUrl.port === '5433'
    && credentialUrl.pathname === '/postgres'
    && credentialUrl.username === 'afrolife_e2e_admin'
    && credentialUrl.password.length >= 32,
  'MIGRATION_DATABASE_URL must contain the local E2E credential on the approved loopback target',
);

const image = spawnSync('docker', ['image', 'inspect', 'postgres:16-alpine', '--format', '{{.Id}}'], {
  encoding: 'utf8',
  windowsHide: true,
});
assert.equal(image.status, 0, 'The local postgres:16-alpine image must already be available; this runner will not pull images');

async function findPort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function waitForPostgres(connectionString) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 1000 });
    let identity;
    try {
      await client.connect();
      const result = await client.query(
        `SELECT current_user,
           current_setting('server_version_num')::integer / 10000 AS major_version,
           (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS is_superuser`,
      );
      identity = result.rows[0];
    } catch {
      if (attempt === 59) throw new Error('Temporary PostgreSQL did not become ready on its loopback port');
    } finally {
      await client.end().catch(() => {});
    }
    if (identity) {
      assert.deepEqual(identity, {
        current_user: 'postgres',
        major_version: 16,
        is_superuser: true,
      }, 'The temporary E2E database must be a PostgreSQL 16 superuser-owned instance');
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
}

function assertTemporaryContainer(containerName, expectedPort) {
  const result = spawnSync('docker', ['inspect', containerName], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, 'Could not verify the temporary PostgreSQL container');
  const [containerSpec] = JSON.parse(result.stdout);
  assert.ok(containerSpec?.State?.Running, 'The temporary PostgreSQL container is not running');
  assert.equal(containerSpec.HostConfig.AutoRemove, true, 'The temporary PostgreSQL container must be auto-removed');
  assert.equal(
    containerSpec.HostConfig.Tmpfs?.['/var/lib/postgresql/data'],
    'rw,nosuid,size=1g',
    'The temporary PostgreSQL database must use tmpfs storage',
  );
  assert.deepEqual(containerSpec.HostConfig.PortBindings, {
    '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: String(expectedPort) }],
  }, 'The temporary PostgreSQL port must bind to loopback only');
}

const port = await findPort();
const container = `afrolife-finance-e2e-${randomBytes(8).toString('hex')}`;
const connectionUrl = new URL(configuredMigrationUrl);
connectionUrl.username = 'postgres';
connectionUrl.port = String(port);
connectionUrl.pathname = '/postgres';
let containerStarted = false;
let suiteExitCode = 1;

function runDocker(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

try {
  const started = runDocker([
    'run', '--detach', '--rm', '--pull=never',
    '--name', container,
    '--publish', `127.0.0.1:${port}:5432`,
    '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=1g',
    '--env', 'POSTGRES_PASSWORD',
    'postgres:16-alpine',
  ], {
    env: { ...process.env, POSTGRES_PASSWORD: credentialUrl.password },
  });
  assert.equal(started.status, 0, `Could not start the temporary PostgreSQL container: ${started.stderr.trim()}`);
  containerStarted = true;
  assertTemporaryContainer(container, port);
  await waitForPostgres(connectionUrl.toString());

  const suite = spawnSync(process.execPath, ['scripts/run-local-finance-e2e.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MIGRATION_DATABASE_URL: connectionUrl.toString(),
      AFROLIFE_FINANCE_E2E_ISOLATED: '1',
      AFROLIFE_FINANCE_E2E_PORT: String(port),
      AFROLIFE_FINANCE_E2E_CONTAINER: container,
    },
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: true,
  });
  suiteExitCode = suite.status ?? 1;
} finally {
  if (containerStarted) {
    const stopped = runDocker(['stop', '--time', '10', container], { stdio: 'ignore' });
    const stillExists = runDocker(['inspect', container], { stdio: 'ignore' });
    if (stillExists.status === 0) {
      runDocker(['rm', '--force', container], { stdio: 'ignore' });
    }
    const remains = runDocker(['inspect', container], { stdio: 'ignore' });
    assert.notEqual(remains.status, 0, `Temporary PostgreSQL container ${container} was not removed`);
    if (stopped.status !== 0 && stillExists.status !== 0) {
      console.warn('The temporary PostgreSQL container had already stopped and was removed.');
    } else {
      console.log('Stopped and removed the temporary PostgreSQL container and its tmpfs database.');
    }
  }
}

process.exitCode = suiteExitCode;
