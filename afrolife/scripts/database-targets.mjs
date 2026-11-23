export function assertSameDatabaseTarget(runtimeUrl, migrationUrl) {
  let runtime;
  let migration;
  try {
    runtime = new URL(runtimeUrl);
    migration = new URL(migrationUrl);
  } catch {
    throw new Error('DATABASE_URL and MIGRATION_DATABASE_URL must be valid PostgreSQL connection URLs.');
  }
  if (!['postgres:', 'postgresql:'].includes(runtime.protocol)
    || !['postgres:', 'postgresql:'].includes(migration.protocol)) {
    throw new Error('DATABASE_URL and MIGRATION_DATABASE_URL must use PostgreSQL URLs.');
  }
  if (
    runtime.protocol !== migration.protocol
    || runtime.hostname !== migration.hostname
    || runtime.port !== migration.port
    || runtime.pathname !== migration.pathname
  ) {
    throw new Error('DATABASE_URL and MIGRATION_DATABASE_URL must target the same host, port, and database.');
  }
}
