import './env.js';
import pg from 'pg';
import { seedPlatformSuperAdmin, validatePlatformAdminSeedInput } from './platform-admin-seed.js';

const variableNames = [
  'DATABASE_URL',
  'SEED_PLATFORM_ADMIN_ACTOR_ID',
  'SEED_PLATFORM_ADMIN_NAME',
  'SEED_PLATFORM_ADMIN_PHONE',
  'SEED_PLATFORM_ADMIN_PASSWORD',
  'SEED_PLATFORM_ADMIN_REASON',
] as const;
const values = Object.fromEntries(variableNames.map((name) => [name, process.env[name]]));
for (const name of variableNames) delete process.env[name];

const connectionString = values.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for this privileged one-time operation');

const input = validatePlatformAdminSeedInput({
  actorId: values.SEED_PLATFORM_ADMIN_ACTOR_ID ?? '',
  name: values.SEED_PLATFORM_ADMIN_NAME ?? '',
  phone: values.SEED_PLATFORM_ADMIN_PHONE ?? '',
  password: values.SEED_PLATFORM_ADMIN_PASSWORD ?? '',
  reason: values.SEED_PLATFORM_ADMIN_REASON ?? '',
});
const pool = new pg.Pool({ connectionString });
try {
  const id = await seedPlatformSuperAdmin(pool, input);
  console.log(`Created an audited Super Admin account (user ID: ${id}). Global Admin promotion is not included.`);
} finally {
  await pool.end();
}
