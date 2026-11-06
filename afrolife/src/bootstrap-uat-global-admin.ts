import './env.js';
import pg from 'pg';
import { bootstrapInitialUatGlobalAdmin, validateUatGlobalAdminBootstrapConfig } from './uat-global-admin-bootstrap.js';

const variableNames = [
  'DATABASE_URL',
  'AFROLIFE_DEPLOYMENT_ENV',
  'ALETCLOUD_APP_NAME',
  'ALLOW_UAT_GLOBAL_ADMIN_BOOTSTRAP',
  'UAT_GLOBAL_ADMIN_TARGET_ID',
  'UAT_GLOBAL_ADMIN_REASON',
] as const;
const environment = Object.fromEntries(variableNames.map((name) => [name, process.env[name]]));
for (const name of variableNames) delete process.env[name];
const config = validateUatGlobalAdminBootstrapConfig(environment);

const pool = new pg.Pool({ connectionString: config.connectionString });
try {
  const userId = await bootstrapInitialUatGlobalAdmin(pool, environment);
  console.log(`Completed the one-time audited UAT Global Admin bootstrap for user ID ${userId}.`);
} finally {
  await pool.end();
}
