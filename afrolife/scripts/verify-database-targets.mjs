import { assertSameDatabaseTarget } from './database-targets.mjs';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!runtimeUrl || !migrationUrl) {
  throw new Error('Set DATABASE_URL and MIGRATION_DATABASE_URL before running the Production migration gate.');
}

assertSameDatabaseTarget(runtimeUrl, migrationUrl);
if (new URL(runtimeUrl).username === new URL(migrationUrl).username) {
  throw new Error('Production runtime and migration connections must use separate database roles.');
}
console.log('Production runtime and migration connections target the same database with separate roles.');
