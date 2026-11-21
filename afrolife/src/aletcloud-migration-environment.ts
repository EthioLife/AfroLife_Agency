export function createAletCloudMigrationEnvironment(
  source: NodeJS.ProcessEnv,
  provisioningUrl: string,
  migrationsOnly: boolean,
): NodeJS.ProcessEnv {
  const migrationEnv: NodeJS.ProcessEnv = {
    ...source,
    MIGRATION_DATABASE_URL: provisioningUrl,
  };
  delete migrationEnv.ALETCLOUD_BOOTSTRAP_DATABASE_URL;
  delete migrationEnv.ALETCLOUD_BOOTSTRAP_MIGRATIONS_ONLY;

  if (migrationsOnly) {
    delete migrationEnv.SEED_ADMIN_NAME;
    delete migrationEnv.SEED_ADMIN_PHONE;
    delete migrationEnv.SEED_ADMIN_PASSWORD;
  } else {
    migrationEnv.AFROLIFE_SEED_ADMIN_BEFORE_PROPERTY_TENANT_MIGRATION = '1';
  }

  return migrationEnv;
}
