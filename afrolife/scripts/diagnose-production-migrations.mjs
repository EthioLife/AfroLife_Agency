import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { diagnoseMigrations, loadExpectedMigrations } from './migration-diagnostics.mjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for read-only migration diagnostics.');
const connection = new URL(connectionString);
if (!['postgres:', 'postgresql:'].includes(connection.protocol)) {
  throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
}

const folder = fileURLToPath(new URL('../migrations/', import.meta.url));
const expected = await loadExpectedMigrations(folder);
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
let transactionOpen = false;
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  transactionOpen = true;
  await client.query("SET LOCAL statement_timeout = '5s'");
  const result = await client.query('SELECT name, checksum FROM schema_migrations ORDER BY name');
  const diagnostic = diagnoseMigrations(expected, result.rows);
  await client.query('COMMIT');
  transactionOpen = false;
  console.log(JSON.stringify(diagnostic, null, 2));
} catch {
  throw new Error('Read-only migration diagnostics failed; no schema changes were attempted.');
} finally {
  if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  await client.end();
}
