import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const compose = readFileSync(new URL('../compose.qa.yaml', import.meta.url), 'utf8');
const accountingService = compose
  .split(/\r?\n  accounting:\r?\n/)[1]
  ?.split(/\r?\n  [a-zA-Z0-9_-]+:\s*(?=\r?\n|$)/)[0] ?? '';
const initSql = readFileSync(new URL('../docker/qa-init.sql', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const accountingDockerfile = readFileSync(new URL('../services/accounting/Dockerfile', import.meta.url), 'utf8');
const apiServer = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
const dockerIgnore = readFileSync(new URL('../.dockerignore', import.meta.url), 'utf8');
const gitIgnore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
const seedUsers = readFileSync(new URL('../scripts/seed-local-test-users.ts', import.meta.url), 'utf8');
const qaScript = readFileSync(new URL('../scripts/docker-qa.ps1', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('Docker QA exposes one app port and keeps PostgreSQL on loopback', () => {
  assert.match(compose, /127\.0\.0\.1:\$\{AFROLIFE_HTTP_PORT:-3010\}:3010/);
  assert.match(qaScript, /function Get-HttpPort/);
  assert.match(qaScript, /\$environmentPort = \$env:AFROLIFE_HTTP_PORT/);
  assert.match(qaScript, /AFROLIFE_HTTP_PORT=\(\\d\+\)/);
  assert.match(qaScript, /127\.0\.0\.1:\$httpPort\/readyz/);
  assert.match(qaScript, /localhost:\$httpPort/);
  assert.match(compose, /127\.0\.0\.1:\$\{AFROLIFE_DB_HTTP_PORT:-5433\}:5432/);
  assert.match(qaScript, /AFROLIFE_DB_HTTP_PORT=\$databaseHttpPort/);
  assert.match(qaScript, /PostgreSQL is private to loopback port \$databaseHttpPort/);
  assert.match(compose, /qa_database:\/var\/lib\/postgresql/);
  assert.match(compose, /qa_private_files:\/app\/afrolife\/data\/private-files/);
  assert.doesNotMatch(compose, /(?:\.\/|\.\.\/)data(?:\/|:)/);
});

test('Accounting stays private behind the single port 3010 application gateway', () => {
  assert.match(apiServer, /const port = Number\(process\.env\.PORT \?\? 3010\)/);
  assert.match(apiServer, /api\.use\('\/accounting'/);
  assert.match(accountingDockerfile, /EXPOSE 3301/);
  assert.match(accountingDockerfile, /process\.env\.PORT\|\|3301/);
  assert.doesNotMatch(accountingDockerfile, /EXPOSE 3010/);
  assert.match(compose, /ACCOUNTING_SERVICE_URL: http:\/\/accounting:3301/);
  assert.match(compose, /ACCOUNTING_AUTH_MODE: gateway/);
  assert.match(compose, /ACCOUNTING_DATABASE_URL: postgres:\/\/accounting_runtime:/);
  assert.match(compose, /ACCOUNTING_RUNTIME_DB_ROLE: accounting_runtime/);
  assert.match(compose, /qa_accounting_database:\/var\/lib\/postgresql/);
  assert.match(accountingService, /PORT: 3301[\s\S]*?healthcheck:/);
  assert.match(accountingService, /ACCOUNTING_GATEWAY_SECRET:/);
  assert.match(accountingService, /depends_on:\s*\n\s+accounting-migrate:\s*\n\s+condition: service_completed_successfully/);
  assert.match(compose, /accounting:\s*\n\s+condition: service_healthy/);
  assert.match(qaScript, /AFROLIFE_ACCOUNTING_DB_ADMIN_PASSWORD/);
  assert.match(qaScript, /AFROLIFE_ACCOUNTING_DB_RUNTIME_PASSWORD/);
  assert.match(qaScript, /ACCOUNTING_GATEWAY_SECRET/);
  assert.match(qaScript, /ACCOUNTING_INGEST_SECRET/);
});

test('Docker QA migrations run as database owner and the app uses a restricted runtime role', () => {
  assert.match(initSql, /CREATE ROLE afrolife_app LOGIN PASSWORD .*NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS/s);
  assert.match(compose, /MIGRATION_DATABASE_URL: postgres:\/\/postgres:/);
  assert.match(compose, /DATABASE_URL: postgres:\/\/afrolife_app:/);
  assert.match(compose, /condition: service_completed_successfully/);
});

test('Docker QA passes optional Edir gateway configuration to the app', () => {
  assert.match(compose, /EDIR_SERVICE_URL: \$\{EDIR_SERVICE_URL:-\}/);
  assert.match(compose, /EDIR_GATEWAY_SECRET: \$\{EDIR_GATEWAY_SECRET:-\}/);
  assert.match(compose, /EDIR_PUBLIC_GATEWAY_HTTP_HOST: \$\{EDIR_PUBLIC_GATEWAY_HTTP_HOST:-\}/);
});

test('Docker QA reapplies restricted Insurance ledger ACLs after broad runtime grants', () => {
  const grantRuntime = compose.split('  grant-runtime:')[1]?.split('  app:')[0] ?? '';
  const broadGrant = grantRuntime.indexOf('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES');
  const accountRestriction = grantRuntime.indexOf('REVOKE ALL ON TABLE insurance_ledger_accounts');
  assert.ok(broadGrant >= 0 && accountRestriction > broadGrant,
    'Insurance ledger restrictions must be reapplied after the general runtime grants');
  for (const statement of [
    'REVOKE ALL ON TABLE insurance_ledger_accounts FROM afrolife_app',
    'REVOKE ALL ON TABLE insurance_ledger_journals FROM afrolife_app',
    'REVOKE ALL ON TABLE insurance_ledger_lines FROM afrolife_app',
    'REVOKE ALL ON TABLE insurance_ledger_audit FROM afrolife_app',
    'GRANT SELECT, INSERT ON TABLE insurance_ledger_accounts TO afrolife_app',
    'GRANT SELECT, INSERT, UPDATE ON TABLE insurance_ledger_journals TO afrolife_app',
    'GRANT SELECT, INSERT ON TABLE insurance_ledger_lines TO afrolife_app',
    'GRANT SELECT, INSERT ON TABLE insurance_ledger_audit TO afrolife_app',
    'REVOKE ALL ON SEQUENCE insurance_ledger_lines_id_seq FROM afrolife_app',
    'REVOKE ALL ON SEQUENCE insurance_ledger_audit_id_seq FROM afrolife_app',
    'GRANT USAGE, SELECT ON SEQUENCE insurance_ledger_lines_id_seq TO afrolife_app',
    'GRANT USAGE, SELECT ON SEQUENCE insurance_ledger_audit_id_seq TO afrolife_app',
  ]) {
    assert.ok(grantRuntime.includes(statement), `Docker QA grant-runtime must include: ${statement}`);
  }
});

test('Docker image includes migration inputs and generated QA credentials stay untracked', () => {
  assert.match(dockerfile, /COPY migrations \.\/migrations/);
  assert.match(dockerfile, /COPY scripts\/copy-migrations\.mjs \.\/scripts\/copy-migrations\.mjs/);
  assert.match(dockerIgnore, /!scripts\/copy-migrations\.mjs/);
  assert.match(gitIgnore, /^\.env\.docker$/m);
  assert.match(gitIgnore, /^\.local-qa\/$/m);
});

test('Docker app health reflects full readiness, not only process/database liveness', () => {
  assert.match(dockerfile, /\/readyz/);
  assert.doesNotMatch(dockerfile, /HEALTHCHECK[\s\S]*?\/healthz/);
  assert.match(compose, /\/readyz/);
});

test('Docker QA user seeding is explicit and verifies loopback host mapping and private container identity', () => {
  assert.match(qaScript, /\$env:AFROLIFE_DOCKER_QA = '1'/);
  assert.match(seedUsers, /process\.env\.AFROLIFE_DOCKER_QA === '1'/);
  assert.match(seedUsers, /dockerQaMode && disposableDatabaseUrl/);
  assert.match(seedUsers, /dockerQaMode \|\| connectionPort === 5433/);
  assert.match(seedUsers, /dockerQaMode && dockerPrivateAddress && Number\(identity\.port\) === 5432/);
  assert.match(seedUsers, /localUrl\.hostname/);
  assert.match(seedUsers, /identity\.database_user === 'postgres' && identity\.is_superuser/);
  assert.match(qaScript, /MIGRATION_DATABASE_URL/);
  assert.match(qaScript, /Remove-Item Env:TEST_DATABASE_URL/);
});

test('Docker QA stop preserves its named volumes and local app entrypoint is documented', () => {
  assert.match(qaScript, /Invoke-Compose -Arguments @\('down'\)/);
  assert.doesNotMatch(qaScript, /Arguments @\('down',\s*'-v'/);
  assert.match(compose, /^name: afrolife-qa$/m);
  assert.match(readme, /http:\/\/localhost:3010/);
});
