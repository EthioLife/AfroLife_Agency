import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({path:join(process.env.LOCALAPPDATA??'','AfroLife','afrolife.env')});

const database = new URL(process.env.DATABASE_URL ?? '');
const databaseName = decodeURIComponent(database.pathname.replace(/^\/+/, ''));
assert.ok(['127.0.0.1','localhost','::1'].includes(database.hostname) && database.port === '5433'
  && /^afrolife_test_[a-z0-9_-]+$/i.test(databaseName),
'Property finance E2E requires a disposable local afrolife_test_* database');
const usersFile=process.env.PROPERTY_E2E_USERS_FILE??join(process.env.LOCALAPPDATA??'','AfroLife','local-test-users.txt');
const users=new Map();
const credentialsText=process.env.PROPERTY_E2E_USERS_DATA??readFileSync(usersFile,'utf8');
for(const line of credentialsText.split(/\r?\n/)){
  const match=line.match(/^([^|]+?)\s*\|\s*(\+\d+)\s*\|\s*(.+)$/);
  if(match)users.set(match[1].trim(),{phone:match[2],password:match[3]});
}
for(const [role,phone] of [['finance_manager','+12025550106'],['finance','+12025550105'],['super_admin','+12025550101'],['super_admin (second account for four-eyes review)','+12025550102'],['field_agent','+12025550108'],['property_owner','+12025550111']])
  assert.equal(users.get(role)?.phone,phone,`Expected synthetic local ${role} identity`);

const port=Number(process.env.PROPERTY_E2E_PORT??3317);
const api=`http://127.0.0.1:${port}/api/v1`;
const child=spawn(process.execPath,['dist/src/server.js'],{cwd:process.cwd(),stdio:'inherit',windowsHide:true,env:{...process.env,
  NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),
  ACCOUNTING_GATEWAY_SECRET:'local-property-finance-gateway-secret-only',
  ACCOUNTING_SERVICE_URL:'http://127.0.0.1:1',ACCOUNTING_INGEST_SECRET:'local-property-finance-e2e-secret-only',
}});
async function waitForServer(){
  let lastHealth='no response';
  for(let attempt=0;attempt<60;attempt++){
    if(child.exitCode!==null)throw new Error(`Local API exited early with code ${child.exitCode}`);
    try{const response=await fetch(`http://127.0.0.1:${port}/healthz`);if(response.ok)return;lastHealth=`HTTP ${response.status}: ${(await response.text()).slice(0,300)}`;}catch(error){lastHealth=error instanceof Error?error.message:String(error);}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`Local API did not become ready (${lastHealth})`);
}
async function request(method,path,token,body,expected=200,tenantSystemId){
  const response=await fetch(api+path,{method,headers:{...(token?{authorization:`Bearer ${token}`}:{ }),...(tenantSystemId?{'x-afrolife-property-tenant-id':tenantSystemId}:{}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>null);
  assert.equal(response.status,expected,`${method} ${path} expected ${expected}, received ${response.status}: ${JSON.stringify(data)}`);
  return data;
}
async function login(role){
  const response=await fetch(`${api}/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(users.get(role))});
  const data=await response.json();assert.equal(response.status,200,`${role} mock login failed: ${JSON.stringify(data)}`);return data.token;
}
async function assignFieldAgentToProperty(propertyId){
  const fixtureDatabaseUrl=process.env.TEST_DATABASE_URL;
  assert.ok(fixtureDatabaseUrl,'TEST_DATABASE_URL is required for disposable property-finance fixtures');
  const client=new pg.Client({connectionString:fixtureDatabaseUrl});
  await client.connect();
  let transactionOpen=false;
  try{
    await client.query('BEGIN');
    transactionOpen=true;
    const assignment=(await client.query(
      `SELECT property.tenant_system_id,tenant.created_by,
          field_agent.id AS field_agent_id
       FROM properties property
       JOIN property_operating_tenants tenant ON tenant.id=property.tenant_system_id
       JOIN users field_agent ON field_agent.phone=$2 AND field_agent.role='field_agent' AND field_agent.active=true
       WHERE property.id=$1`,
      [propertyId,'+12025550108'],
    )).rows[0];
    assert.ok(assignment,'Synthetic property and field-agent fixture are required');
    const actorId=assignment.created_by??assignment.field_agent_id;
    await client.query(
      `INSERT INTO property_operating_tenant_members(tenant_system_id,user_id,tenant_role,status,assigned_by)
       VALUES($1,$2,'field_agent','active',$3)
       ON CONFLICT(tenant_system_id,user_id) DO UPDATE
       SET tenant_role='field_agent',status='active',assigned_by=EXCLUDED.assigned_by`,
      [assignment.tenant_system_id,assignment.field_agent_id,actorId],
    );
    await client.query(
      `INSERT INTO property_agent_scopes(
         tenant_system_id,property_id,user_id,tenant_role,status,effective_from,assigned_by
       ) VALUES($1,$2,$3,'field_agent','active',current_date,$4)
       ON CONFLICT(tenant_system_id,property_id,user_id) DO UPDATE
       SET tenant_role='field_agent',status='active',effective_from=current_date,
           effective_to=NULL,assigned_by=EXCLUDED.assigned_by,assigned_at=now()`,
      [assignment.tenant_system_id,propertyId,assignment.field_agent_id,actorId],
    );
    await client.query(
      `INSERT INTO property_agent_scope_events(
         tenant_system_id,property_id,user_id,actor_id,event_type,reason
       ) VALUES($1,$2,$3,$4,'assigned','Local finance E2E synthetic property assignment')`,
      [assignment.tenant_system_id,propertyId,assignment.field_agent_id,actorId],
    );
    await client.query('COMMIT');
    transactionOpen=false;
    return {fieldAgentId:assignment.field_agent_id,tenantSystemId:assignment.tenant_system_id};
  }catch(error){
    if(transactionOpen)await client.query('ROLLBACK');
    throw error;
  }finally{
    await client.end();
  }
}
try{
  await waitForServer();
  const admin=await login('super_admin');
  const reviewer=await login('super_admin (second account for four-eyes review)');
  const finance=await login('finance');
  const financeManager=await login('finance_manager');
  const fieldAgent=await login('field_agent');
  const propertyOwner=await login('property_owner');
  const outboxBefore=(await request('GET','/accounting-event-outbox/status',financeManager)).length;
  const territories=await request('GET','/territories',admin);
  const territory=territories.find(item=>item.level==='sub_city');assert.ok(territory,'Synthetic territory seed is required');
  const suffix=Date.now().toString(36).toUpperCase();
  const property=await request('POST','/properties',propertyOwner,{address:`LOCAL QA property ${suffix}, Addis Ababa`,description:'Synthetic property-finance test only',ptype:'house',listing_mode:'rent',rent_period:'month',territory_id:territory.id,units:[{unit_no:'QA-1',ptype:'apartment',rent:10000}]},201);
  const fieldAgentAssignment=await assignFieldAgentToProperty(property.id);
  const maintenancePayload={property_id:property.id,description:'Synthetic vendor accounting workflow test',priority:'normal',idempotency_key:randomUUID()};
  const maintenance=await request('POST','/maintenance',propertyOwner,maintenancePayload,201);
  const maintenanceRetry=await request('POST','/maintenance',propertyOwner,maintenancePayload,200);
  assert.equal(maintenanceRetry.id,maintenance.id,'A retried maintenance request must return the original record');
  assert.equal(maintenanceRetry.replayed,true,'A retried maintenance request must be marked as replayed');
  await request('POST','/maintenance',propertyOwner,{...maintenancePayload,description:'Changed content under an existing retry key'},409);
  const vendor=await request('POST','/property-vendors',financeManager,{name:`LOCAL QA Vendor ${suffix}`,tax_id:`QA-${suffix}`,phone:'+12025550999',email:`vendor-${suffix.toLowerCase()}@example.test`},201);
  const billPayload={vendor_id:vendor.id,invoice_reference:`INV-${suffix}`,amount:1250.50,invoice_date:new Date().toISOString().slice(0,10),due_date:new Date(Date.now()+86400000*30).toISOString().slice(0,10)};
  await request('POST',`/maintenance/${maintenance.id}/update`,admin,{status:'triaged',sla_hours:24,resolution_note:'Synthetic maintenance triage for finance E2E'});
  await request('POST',`/maintenance/${maintenance.id}/update`,admin,{status:'assigned',assigned_to:fieldAgentAssignment.fieldAgentId});
  await request('POST',`/maintenance/${maintenance.id}/update`,fieldAgent,{status:'in_progress',resolution_note:'Synthetic maintenance work started'},200,fieldAgentAssignment.tenantSystemId);
  await request('POST',`/maintenance/${maintenance.id}/vendor-bills`,financeManager,billPayload,409);
  await request('POST',`/maintenance/${maintenance.id}/update`,fieldAgent,{status:'awaiting_review',resolution_note:'Synthetic maintenance work completed and submitted for review'},200,fieldAgentAssignment.tenantSystemId);
  await request('POST',`/maintenance/${maintenance.id}/update`,reviewer,{status:'completed',cost:1250.50,review_note:'Independent review approved the completed synthetic work'});
  const bill=await request('POST',`/maintenance/${maintenance.id}/vendor-bills`,financeManager,billPayload,201);
  await request('POST',`/property-vendor-bills/${bill.id}/decision`,financeManager,{decision:'approve',reason:'Self approval must be rejected for the synthetic vendor invoice'},403);
  const approved=await request('POST',`/property-vendor-bills/${bill.id}/decision`,reviewer,{decision:'approve',reason:'Independent review of synthetic vendor invoice and maintenance evidence'});
  assert.equal(approved.status,'approved');
  let vendors=await request('GET','/property-vendors',financeManager);
  assert.equal(vendors.find(item=>item.id===vendor.id)?.accounts_payable,'1250.50');
  const payment=await request('POST',`/property-vendor-bills/${bill.id}/payments`,financeManager,{payment_reference:`BANK-${suffix}`,payment_channel:'bank_transfer',payment_date:new Date().toISOString().slice(0,10)},201);
  await request('POST',`/property-vendor-payments/${bill.id}/reconcile`,financeManager,{reason:'Payment maker cannot reconcile their own vendor payment'},403);
  const paid=await request('POST',`/property-vendor-payments/${bill.id}/reconcile`,admin,{reason:'Independent review of synthetic payment reference and vendor invoice'});
  assert.equal(paid.status,'paid');assert.equal(payment.status,'payment_pending');
  vendors=await request('GET','/property-vendors',financeManager);
  assert.equal(vendors.find(item=>item.id===vendor.id)?.accounts_payable,'0.00');
  const bills=await request('GET','/property-vendor-bills',financeManager);
  assert.equal(bills.find(item=>item.id===bill.id)?.status,'paid');
  const outboxAfter=(await request('GET','/accounting-event-outbox/status',financeManager)).length;
  assert.equal(outboxAfter-outboxBefore,2,'Approved invoice and reconciled settlement each publish one Accounting event');
  console.log(JSON.stringify({result:'PASS',environment:'local synthetic identities and local PostgreSQL',cases:[
    'Mock Finance Manager created vendor and maintenance invoice',
    'Maintenance request retry returned the original record and changed-payload key reuse was rejected',
    'Invoice maker was denied approval; independent Super Admin approved Expense/Accounts Payable',
    'Vendor accounts-payable balance increased by the full invoice amount',
    'Payment maker was denied reconciliation; independent Super Admin posted Accounts Payable/Cash',
    'Vendor payable returned to zero and bill reached paid status',
    'Exactly two Accounting outbox events were created',
  ],synthetic_ids:{property_id:property.id,maintenance_id:maintenance.id,vendor_id:vendor.id,bill_id:bill.id},note:'All records use LOCAL QA identities and synthetic data on loopback PostgreSQL.'},null,2));
}finally{
  child.kill('SIGTERM');
}
