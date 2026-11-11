import '../src/env.js';
import { randomBytes } from 'node:crypto';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString=process.env.MFI_E2E_DATABASE_URL;
const credentialsPath=process.env.MFI_E2E_USERS_FILE;
if(!connectionString||!credentialsPath)throw new Error('Set MFI_E2E_DATABASE_URL and a new MFI_E2E_USERS_FILE path');
if(existsSync(credentialsPath))throw new Error('Refusing to overwrite an existing MFI E2E credentials file');
const url=new URL(connectionString);const database=decodeURIComponent(url.pathname.replace(/^\/+/,''));
if(!['127.0.0.1','localhost','::1'].includes(url.hostname)||url.port!=='5433'||!/^afrolife_test_[a-z0-9_-]+$/i.test(database))
  throw new Error('Refusing to seed users outside a loopback afrolife_test_* database on port 5433');
const containerizedDisposableDatabase=process.env.AFROLIFE_TEST_POSTGRES_CONTAINER==='1';
const pool=new pg.Pool({connectionString});const client=await pool.connect();let wroteCredentials=false;
try{
  const identity=(await client.query(`SELECT current_database() AS database,current_user AS db_user,
    host(inet_server_addr()) AS address,inet_server_port() AS port,
    (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS is_superuser`)).rows[0];
  const containerAddress=identity.address&&(
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(identity.address)
    ||/^192\.168\.\d{1,3}\.\d{1,3}$/.test(identity.address)
    ||/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(identity.address)
    ||/^(fc|fd)[0-9a-f:]*$/i.test(identity.address)
  );
  const loopbackPostgres=['127.0.0.1','::1'].includes(identity.address)&&Number(identity.port)===5433;
  const disposableContainerPostgres=containerizedDisposableDatabase&&containerAddress&&Number(identity.port)===5432;
  if(identity.database!==database||identity.db_user!=='postgres'
    ||(!loopbackPostgres&&!disposableContainerPostgres)||!identity.is_superuser)throw new Error('Refusing to seed test identities: unexpected database identity');
  const nonce=String(randomBytes(2).readUInt16BE(0)).padStart(5,'0');
  const definitions=[
    {label:'super_admin',name:'LOCAL E2E MFI Admin One',role:'super_admin'},
    {label:'super_admin (second account for four-eyes review)',name:'LOCAL E2E MFI Admin Two',role:'super_admin'},
    {label:'finance',name:'LOCAL E2E MFI Teller',role:'finance'},
    {label:'finance_manager',name:'LOCAL E2E MFI Finance Manager',role:'finance_manager'},
    {label:'compliance',name:'LOCAL E2E MFI Compliance',role:'compliance'},
  ];
  const collisions=await client.query('SELECT phone FROM users WHERE phone=ANY($1::text[])',[
    definitions.map((_,index)=>`+1202558${nonce}${index}`),
  ]);
  if(collisions.rowCount)throw new Error('Generated synthetic phone collision; rerun to use another random range');
  const rows:Array<{label:string;phone:string;password:string;name:string}>=[];
  await client.query('BEGIN');
  let creator:string|null=null;
  for(const [index,definition] of definitions.entries()){
    const phone=`+1202558${nonce}${index}`;const password=`AfroQA!${randomBytes(24).toString('base64url')}`;
    const result=await client.query(`INSERT INTO users(legal_name,phone,email,role,territory_id,password_hash,
      must_change_password,kyc_status,active,created_by) VALUES($1,$2,$3,$4,NULL,$5,false,'verified',true,$6) RETURNING id`,
      [definition.name,phone,`mfi-e2e-${nonce}-${index}@example.test`,definition.role,await bcrypt.hash(password,12),creator]);
    if(index===0)creator=result.rows[0].id;
    rows.push({...definition,phone,password});
  }
  const contents=rows.map(row=>`${row.label} | ${row.phone} | ${row.password}`).join('\n')+'\n';
  writeFileSync(credentialsPath,contents,{flag:'wx',mode:0o600});wroteCredentials=true;
  await client.query('COMMIT');
  console.log(`Created ${rows.length} synthetic local MFI E2E users in ${database}; credentials stored in the requested temporary file.`);
}catch(error){
  try{await client.query('ROLLBACK');}catch{}
  if(wroteCredentials&&existsSync(credentialsPath))unlinkSync(credentialsPath);
  throw error;
}finally{client.release();await pool.end();}
