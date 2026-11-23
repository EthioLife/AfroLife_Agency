import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { assertSameDatabaseTarget } from './database-targets.mjs';

const localEnvironment = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'AfroLife', 'afrolife.env')
  : undefined;
const environmentFile = process.env.AFROLIFE_ENV_FILE && existsSync(process.env.AFROLIFE_ENV_FILE)
  ? process.env.AFROLIFE_ENV_FILE
  : existsSync(resolve('.env'))
    ? resolve('.env')
    : localEnvironment;
if (environmentFile) dotenv.config({ path: environmentFile });

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!runtimeUrl || !migrationUrl) {
  throw new Error('Set DATABASE_URL and MIGRATION_DATABASE_URL to the same target database before checking runtime ACLs.');
}

const runtime = new URL(runtimeUrl);
const migration = new URL(migrationUrl);
assertSameDatabaseTarget(runtimeUrl, migrationUrl);
const runtimeRole = decodeURIComponent(runtime.username);
if (!runtimeRole || runtimeRole === decodeURIComponent(migration.username)) {
  throw new Error('DATABASE_URL must use a separate runtime role from MIGRATION_DATABASE_URL.');
}

const pool = new pg.Pool({ connectionString: migrationUrl });
try {
  const roleResult = await pool.query(
    `SELECT rolsuper,rolbypassrls,
       has_schema_privilege($1,'public','USAGE') AS public_schema_usage
     FROM pg_roles WHERE rolname=$1`,
    [runtimeRole],
  );
  const role = roleResult.rows[0];
  if (!role) throw new Error('The configured runtime role does not exist.');
  if (role.rolsuper || role.rolbypassrls || !role.public_schema_usage) {
    throw new Error('Runtime role must be non-superuser, must not have BYPASSRLS, and must have public schema USAGE.');
  }
  const ownedRlsTables = await pool.query(
    `SELECT c.relname FROM pg_class c
     WHERE c.relnamespace='public'::regnamespace AND c.relrowsecurity
       AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=$1) LIMIT 1`,
    [runtimeRole],
  );
  if (ownedRlsTables.rowCount) throw new Error(`Runtime role owns RLS table ${ownedRlsTables.rows[0].relname}.`);

  const privileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
  const insuranceAccess = {
    insurance_ledger_accounts: ['SELECT', 'INSERT'],
    insurance_ledger_journals: ['SELECT', 'INSERT', 'UPDATE'],
    insurance_ledger_lines: ['SELECT', 'INSERT'],
    insurance_ledger_audit: ['SELECT', 'INSERT'],
  };
  for (const [table, allowed] of Object.entries(insuranceAccess)) {
    for (const privilege of privileges) {
      const result = await pool.query(
        'SELECT has_table_privilege($1,$2,$3) AS allowed',
        [runtimeRole, `public.${table}`, privilege],
      );
      const actual = result.rows[0].allowed === true;
      if (actual !== allowed.includes(privilege)) {
        throw new Error(`Unexpected ${privilege} privilege on ${table}: expected ${allowed.includes(privilege)}, received ${actual}.`);
      }
    }
  }

  for (const sequence of ['insurance_ledger_lines_id_seq', 'insurance_ledger_audit_id_seq']) {
    for (const [privilege, expected] of [['USAGE', true], ['SELECT', true], ['UPDATE', false]]) {
      const result = await pool.query(
        'SELECT has_sequence_privilege($1,$2,$3) AS allowed',
        [runtimeRole, `public.${sequence}`, privilege],
      );
      if ((result.rows[0].allowed === true) !== expected) {
        throw new Error(`Unexpected ${privilege} privilege on ${sequence}.`);
      }
    }
  }

  const sessionPrivileges = await pool.query(
    `SELECT has_table_privilege($1,'public.auth_sessions','SELECT') AS can_select,
       has_table_privilege($1,'public.auth_sessions','INSERT') AS can_insert,
       has_table_privilege($1,'public.auth_sessions','UPDATE') AS can_update,
       has_table_privilege($1,'public.auth_sessions','DELETE') AS can_delete`,
    [runtimeRole],
  );
  if (Object.values(sessionPrivileges.rows[0]).some((allowed) => allowed !== true)) {
    throw new Error('Runtime role is missing a required auth_sessions privilege.');
  }
  console.log('Runtime role safety, central Insurance ledger ACLs, and auth-session ACLs verified.');
} finally {
  await pool.end();
}
