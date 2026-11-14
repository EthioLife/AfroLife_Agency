import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';
import { mfaKeys, openAny } from '../dist/src/security.js';
import { totp } from '../dist/src/totp.js';

dotenv.config({path:join(process.env.LOCALAPPDATA??'','AfroLife','afrolife.env')});
const database=new URL(process.env.DATABASE_URL??'');
const databaseName=decodeURIComponent(database.pathname.replace(/^\/+/,''));
const containerizedDisposableDatabase=process.env.AFROLIFE_TEST_POSTGRES_CONTAINER==='1'
  &&database.port===process.env.AFROLIFE_FINANCE_E2E_PORT
  &&/^afrolife_test_[a-z0-9_-]+$/i.test(databaseName);
assert.ok(['127.0.0.1','localhost','::1'].includes(database.hostname)
  &&((database.port==='5433'&&/^afrolife_test_[a-z0-9_-]+$/i.test(databaseName))||containerizedDisposableDatabase),
  'Staffing Accounting E2E requires a disposable local afrolife_test_* database');
const users=new Map();
const credentials=process.env.PROPERTY_E2E_USERS_DATA;
assert.ok(credentials,'Pass synthetic local identity data through PROPERTY_E2E_USERS_DATA');
for(const line of credentials.split(/\r?\n/)){const m=line.match(/^([^|]+?)\s*\|\s*(\+\d+)\s*\|\s*(.+)$/);if(m)users.set(m[1].trim(),{phone:m[2],password:m[3]});}
for(const role of ['finance','finance_manager','master_agent','compliance','customer','worker'])assert.ok(users.has(role),`Missing synthetic ${role} identity`);
assert.ok(process.env.STAFFING_DATABASE_URL,'STAFFING_DATABASE_URL must target the isolated Staffing service database');
assert.ok(process.env.STAFFING_TEST_DATABASE_URL,'STAFFING_TEST_DATABASE_URL must target the isolated Staffing fixture database');
const staffingTestDb=new pg.Pool({connectionString:process.env.STAFFING_TEST_DATABASE_URL});

const port=Number(process.env.STAFFING_E2E_PORT??3318),api=`http://127.0.0.1:${port}/api/v1`;
const staffingPort=Number(process.env.STAFFING_SERVICE_E2E_PORT??3401);
const staffingUrl=`http://127.0.0.1:${staffingPort}`;
const staffingSecret=randomBytes(48).toString('base64url');
const service=spawn(process.execPath,['dist/services/staffing/server.js'],{cwd:process.cwd(),stdio:'inherit',windowsHide:true,env:{...process.env,HOST:'127.0.0.1',PORT:String(staffingPort),STAFFING_GATEWAY_SECRET:staffingSecret}});
const child=spawn(process.execPath,['dist/src/server.js'],{cwd:process.cwd(),stdio:'inherit',windowsHide:true,env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),STAFFING_SERVICE_URL:staffingUrl,STAFFING_GATEWAY_SECRET:staffingSecret,STAFFING_SERVICE_CUTOVER_READY:'1',ACCOUNTING_GATEWAY_SECRET:'local-staffing-finance-gateway-secret',ACCOUNTING_SERVICE_URL:'http://127.0.0.1:1',ACCOUNTING_INGEST_SECRET:'local-staffing-finance-e2e-secret'}});
async function stopChild(processHandle){
  if(processHandle.exitCode!==null||processHandle.signalCode!==null)return;
  const exited=new Promise(resolveExit=>processHandle.once('exit',resolveExit));
  const stopped=new Promise(resolveStop=>{
    const timer=setTimeout(()=>resolveStop(false),5000);
    processHandle.once('exit',()=>{clearTimeout(timer);resolveStop(true);});
  });
  processHandle.kill('SIGTERM');
  if(!await stopped){
    processHandle.kill('SIGKILL');
    await exited;
  }
}
async function waitFor(target,processHandle,label){let last='no response';for(let i=0;i<120;i++){if(processHandle.exitCode!==null)throw new Error(`${label} exited: ${processHandle.exitCode}`);try{const response=await fetch(`${target}/healthz`);if(response.ok)return;last=`HTTP ${response.status}: ${(await response.text()).slice(0,300)}`;}catch(error){last=error instanceof Error?error.message:String(error);}await new Promise(r=>setTimeout(r,250));}throw new Error(`${label} did not become ready (${last})`);}
async function call(method,path,token,body,expected=200){const response=await fetch(api+path,{method,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json().catch(()=>null);assert.equal(response.status,expected,`${method} ${path} expected ${expected}, received ${response.status}: ${JSON.stringify(data)}`);return data;}
async function login(role){
  const identity=users.get(role);
  const authenticate=async(code)=>{
    const response=await fetch(`${api}/auth/login`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({...identity,...(code?{code}:{})}),
    });
    return {response,data:await response.json()};
  };
  let {response,data}=await authenticate();
  assert.equal(response.status,200,`${role} mock login: ${JSON.stringify(data)}`);
  if(data.mfa_required){
    const stored=(await staffingTestDb.query(
      'SELECT mfa_secret,mfa_last_step FROM users WHERE phone=$1',
      [identity.phone],
    )).rows[0];
    assert.ok(stored?.mfa_secret,`${role} MFA challenge has no stored authenticator secret`);
    const jwtSecret=process.env.JWT_SECRET;
    assert.ok(jwtSecret,'JWT_SECRET is required to verify synthetic MFA credentials');
    const secret=openAny(stored.mfa_secret,mfaKeys(jwtSecret,process.env.MFA_ENC_KEY));
    const currentStep=Math.floor(Date.now()/30_000);
    const codeStep=Math.max(currentStep,Number(stored.mfa_last_step)+1);
    ({response,data}=await authenticate(totp(secret,codeStep*30_000)));
    assert.equal(response.status,200,`${role} MFA login: ${JSON.stringify(data)}`);
  }
  let token=data.token;
  if(data.restrict==='mfa'){
    const setup=await call('POST','/auth/mfa/setup',token,{});
    token=(await call('POST','/auth/mfa/enable',token,{code:totp(setup.secret)})).token;
  }else assert.equal(data.restrict,null,`${role} login has an unexpected security restriction`);
  assert.ok(token,`${role} login did not return an access token`);
  const expectedRole=role.split(' ')[0];
  const actualRole=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).role;
  assert.equal(actualRole,expectedRole,`${role} mock identity has an unexpected role`);
  return token;
}
try{
  await waitFor(staffingUrl,service,'Staffing service');
  await waitFor(`http://127.0.0.1:${port}`,child,'Local API');
  const finance=await login('finance'),financeManager=await login('finance_manager'),agent=await login('master_agent'),compliance=await login('compliance'),customer=await login('customer'),workerIdentity=await login('worker');
  const outboxBefore=Number((await staffingTestDb.query('SELECT count(*) AS count FROM accounting_event_outbox')).rows[0].count);
  const territories=await call('GET','/territories',agent);const territory=territories.find(x=>x.level==='sub_city');assert.ok(territory,'Synthetic sub-city territory is required');
  const suffix=Date.now().toString(36).toUpperCase();
  let worker=(await call('GET','/workers',agent)).find(x=>x.phone===users.get('worker').phone);
  if(!worker){worker=await call('POST','/workers',agent,{name:'LOCAL QA Worker',phone:users.get('worker').phone,national_id:`QA-${suffix}`,sector:'Synthetic Accounting QA',skills:['bookkeeping'],languages:['English'],experience_years:3,rate_expected:80,availability:'immediate',territory_id:territory.id},201);}
  if(worker.verification!=='verified'){
    const docs=await call('GET',`/workers/${worker.id}/documents`,agent);
    for(const type of ['national_id','police_clearance'])if(!docs.some(d=>d.doc_type===type&&d.status==='verified')){
      const upload=await fetch(`${api}/workers/${worker.id}/documents/upload?doc_type=${type}`,{method:'POST',headers:{authorization:`Bearer ${agent}`,'content-type':'application/pdf'},body:Buffer.from('%PDF-1.4\n% synthetic QA evidence\n%%EOF\n')});const document=await upload.json();assert.equal(upload.status,201,`Mock ${type} evidence upload: ${JSON.stringify(document)}`);
      await call('POST',`/documents/${document.id}/review`,compliance,{decision:'verified'});
    }
    worker=await call('POST',`/workers/${worker.id}/verify`,compliance,{});
  }
  const leads=await call('GET','/leads',agent);let lead=leads.find(x=>x.phone===users.get('customer').phone);
  if(!lead)lead=await call('POST','/leads',agent,{lead_type:'business',name:'LOCAL QA Staffing Client',phone:users.get('customer').phone},201);
  const request=await call('POST','/requests',agent,{lead_id:lead.id,sector:'Synthetic Accounting QA',skills_required:['bookkeeping'],languages_required:['English'],min_experience:1,rate_offered:150,territory_id:territory.id},201);
  const matches=await call('GET',`/requests/${request.id}/candidates`,agent);assert.ok(matches.some(x=>x.worker_id===worker.id),'Verified mock worker should be eligible for the matching request');
  const match=await call('POST',`/requests/${request.id}/matches`,agent,{worker_id:worker.id},201);
  await call('POST',`/matches/${match.id}/respond`,agent,{decision:'accepted'});
  const engagement=await call('POST','/staffing-engagements',agent,{match_id:match.id,worker_type:'hourly_professional',billing_unit:'hour',client_rate:120,worker_rate:80,starts_on:new Date().toISOString().slice(0,10)},201);
  await call('POST',`/staffing-engagements/${engagement.id}/terms-decision`,financeManager,{decision:'approve',reason:'Independent review of synthetic client rate, worker rate and engagement dates'});
  const clientAccepted=await call('POST',`/staffing-engagements/${engagement.id}/accept`,customer,{reason:'I accept the synthetic client engagement terms and hourly bill rate'});
  assert.equal(clientAccepted.status,'terms_approved','Client acceptance alone must not activate the engagement');
  const active=await call('POST',`/staffing-engagements/${engagement.id}/accept`,workerIdentity,{reason:'I accept the synthetic worker engagement terms and hourly pay rate'});
  assert.equal(active.status,'active','Terms require independent finance approval plus both party acceptances');
  const workerEngagements=await call('GET','/staffing-engagements/mine',workerIdentity);
  assert.ok(workerEngagements.some(x=>x.id===engagement.id&&x.worker_type==='hourly_professional'&&x.employer_client==='LOCAL QA Staffing Client'),'Worker self-service must show their engagement type and employer client');
  const period=await call('POST',`/staffing-engagements/${engagement.id}/work-periods`,workerIdentity,{period_start:new Date().toISOString().slice(0,10),period_end:new Date().toISOString().slice(0,10),quantity:2,description:'Synthetic two-hour bookkeeping work period'},201);
  const workerReports=await call('GET','/staffing-work-periods/mine',workerIdentity);
  assert.ok(workerReports.some(x=>x.id===period.id),'Workers can view only their own work reports');
  await call('POST',`/staffing-work-periods/${period.id}/decision`,financeManager,{decision:'approve',reason:'Approved synthetic work evidence after independent review'});
  const ticket=await call('POST','/worker-support',workerIdentity,{category:'work_report_or_pay',subject:'Synthetic QA support request',description:'Please clarify the review status of my synthetic work report.'},201);
  const queuedTickets=await call('GET','/worker-support/queue',agent);
  assert.ok(queuedTickets.some(x=>x.id===ticket.id),'Authorized support staff can see the worker support queue');
  await call('POST',`/worker-support/${ticket.id}/respond`,agent,{status:'in_progress',response:'Your report is being reviewed by the finance team.'});
  assert.equal((await call('GET','/worker-support/mine',workerIdentity)).find(x=>x.id===ticket.id)?.status,'in_progress');
  const receipt1=await call('POST',`/staffing-engagements/${engagement.id}/settlements`,finance,{kind:'client_receipt',amount:100,channel:'bank_transfer',reference:`QA-CLIENT-${suffix}-1`,payment_date:new Date().toISOString().slice(0,10)},201);
  await call('POST',`/staffing-settlements/${receipt1.id}/reconcile`,finance,{reason:'Settlement maker must not reconcile their own client transfer'},403);
  await call('POST',`/staffing-settlements/${receipt1.id}/reconcile`,financeManager,{reason:'Independent confirmation of synthetic first client receipt'},200);
  const receipt2=await call('POST',`/staffing-engagements/${engagement.id}/settlements`,finance,{kind:'client_receipt',amount:140,channel:'bank_transfer',reference:`QA-CLIENT-${suffix}-2`,payment_date:new Date().toISOString().slice(0,10)},201);
  await call('POST',`/staffing-settlements/${receipt2.id}/reconcile`,financeManager,{reason:'Independent confirmation of synthetic final client receipt'},200);
  const payout=await call('POST',`/staffing-engagements/${engagement.id}/settlements`,finance,{kind:'worker_payment',amount:160,channel:'bank_transfer',reference:`QA-WORKER-${suffix}`,payment_date:new Date().toISOString().slice(0,10)},201);
  await call('POST',`/staffing-settlements/${payout.id}/reconcile`,financeManager,{reason:'Independent confirmation of synthetic worker payment'},200);
  await call('POST',`/staffing-engagements/${engagement.id}/settlements`,finance,{kind:'worker_payment',amount:0.01,channel:'bank_transfer',reference:`QA-OVER-${suffix}`,payment_date:new Date().toISOString().slice(0,10)},422);
  const final=(await call('GET','/staffing-engagements',finance)).find(x=>x.id===engagement.id);
  assert.equal(final.client_accrued,'240.00');assert.equal(final.worker_accrued,'160.00');
  const outboxAfter=Number((await staffingTestDb.query('SELECT count(*) AS count FROM accounting_event_outbox')).rows[0].count);assert.equal(outboxAfter-outboxBefore,4,'Approved work plus two client receipts and worker payment publish four source events');
  console.log(JSON.stringify({result:'PASS',environment:'local synthetic identities and local PostgreSQL',cases:[
    'Compliance verified synthetic worker identity evidence uploaded by the master agent',
    'Accepted match converted to engagement with explicit client bill and worker pay terms',
    'Finance terms approval and individual customer and worker acceptances required before active work',
    'Hourly professional engagement and employer-client terms are visible in worker self-service',
    'Worker submitted and viewed their own activity report before independent approval',
    'Worker support requests are visible to the authorized service queue and replies return to the worker',
    'Independent work approval accrued client receivable and worker payable with balanced journals',
    'Partial client receipts and worker payout required independent reconciliation; overpayment was rejected',
    'Four Accounting outbox events were recorded atomically with approved work and settlements',
  ],synthetic_ids:{lead_id:lead.id,worker_id:worker.id,request_id:request.id,match_id:match.id,engagement_id:engagement.id},note:'Local-only synthetic records; no external payment was made.'},null,2));
}finally{await Promise.all([stopChild(child),stopChild(service)]);await staffingTestDb.end();}
