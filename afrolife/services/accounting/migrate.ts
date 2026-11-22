import '../../src/env.js';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { assertMigrationChecksum, migrationChecksum } from '../../src/migration-checksums.js';

const migrationUrl=process.env.ACCOUNTING_MIGRATION_DATABASE_URL;
const runtimeRole=process.env.ACCOUNTING_RUNTIME_DB_ROLE;
if(!migrationUrl)throw new Error('ACCOUNTING_MIGRATION_DATABASE_URL must be configured');
if(!runtimeRole||!/^[a-z_][a-z0-9_]*$/i.test(runtimeRole))throw new Error('ACCOUNTING_RUNTIME_DB_ROLE must be a restricted SQL role name');
const client=new pg.Client({connectionString:migrationUrl}); await client.connect();
try{
  await client.query('SELECT pg_advisory_lock(71924211,2)');
  await client.query('BEGIN');
  await client.query(`CREATE TABLE IF NOT EXISTS accounting_service_migrations(
    version text PRIMARY KEY,checksum text,applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  await client.query('ALTER TABLE accounting_service_migrations ADD COLUMN IF NOT EXISTS checksum text');
  for(const [version,file] of [
    ['accounting-v1-hierarchical-ledger','001_accounting.sql'],
    ['accounting-v2-business-workflows','002_accounting_workflows.sql'],
    ['accounting-v3-direct-entity-access','003_accounting_entity_access.sql'],
    ['accounting-v4-transaction-controls','004_accounting_transaction_controls.sql'],
    ['accounting-v5-subscriber-owned-businesses','005_accounting_subscriber_ownership.sql'],
    ['accounting-v6-tenant-products-and-pricing','006_accounting_products_and_pricing.sql'],
  ]){
    let sql:string;
    try{sql=await readFile(new URL(`./${file}`,import.meta.url),'utf8');}
    catch{sql=await readFile(new URL(`../../../services/accounting/${file}`,import.meta.url),'utf8');}
    const checksum=migrationChecksum(sql);
    const already=await client.query<{checksum:string|null}>('SELECT checksum FROM accounting_service_migrations WHERE version=$1',[version]);
    if(already.rowCount){
      const storedChecksum=already.rows[0].checksum;
      assertMigrationChecksum(file,storedChecksum,checksum);
      if(storedChecksum===null)await client.query('UPDATE accounting_service_migrations SET checksum=$2 WHERE version=$1 AND checksum IS NULL',[version,checksum]);
      continue;
    }
    await client.query(sql.replaceAll('"{{role}}"',`"${runtimeRole}"`));
    await client.query('INSERT INTO accounting_service_migrations(version,checksum) VALUES($1,$2)',[version,checksum]);
    console.log(`Applied ${version}`);
  }
  await client.query('COMMIT');
}catch(error){
  try{await client.query('ROLLBACK');}
  catch(rollbackError){throw new AggregateError([error,rollbackError],'Accounting migrations failed and rollback also failed');}
  throw error;
}finally{await client.end();}
