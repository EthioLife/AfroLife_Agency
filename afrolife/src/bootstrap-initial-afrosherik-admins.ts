import './env.js';
import pg from 'pg';
import {
  bootstrapInitialAfroSherikAdmins,
  validateInitialPlatformAdminBootstrapConfig,
} from './initial-platform-admin-bootstrap.js';

const variableNames = [
  'ALLOW_INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP',
  'INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP_CONFIRM',
  'INITIAL_AFROSHERIK_TENANT_KEY',
  'INITIAL_DAWIT_ADMIN_PASSWORD',
  'INITIAL_YALEMWORK_ADMIN_PASSWORD',
  'INITIAL_AFROSHERIK_ADMIN_BOOTSTRAP_REASON',
] as const;
const environment = { ...process.env };
for (const name of variableNames) delete process.env[name];
const config = validateInitialPlatformAdminBootstrapConfig(environment);
for (const name of variableNames) delete environment[name];
const connectionString = environment.DATABASE_URL?.trim();
if (!connectionString) throw new Error('DATABASE_URL is required for the initial AfroSherik admin bootstrap.');

const pool = new pg.Pool({ connectionString });
try {
  const result = await bootstrapInitialAfroSherikAdmins(pool, config);
  if (result) {
    console.log(`Completed the one-time AfroSherik platform administrator bootstrap (${result.created} accounts created).`);
  } else {
    console.log('The one-time AfroSherik platform administrator bootstrap has already completed.');
  }
} finally {
  await pool.end();
}
