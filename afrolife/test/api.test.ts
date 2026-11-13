import '../src/env.js';

// Integration tests use TEST_DATABASE_URL (a disposable elevated test role) for fixtures
// and DATABASE_URL for the API's restricted runtime role. Start the API with `npm run dev`.
// Run: npm run test:integration
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const API = (process.env.API_URL ?? 'http://localhost:3010') + '/api/v1';
const SECRET = process.env.JWT_SECRET!;
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL must explicitly point to a disposable integration-test database');
const testDatabaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\/+/, ''));
if (!/^(?:test[_-]|afrolife[_-]test(?:[_-]|$))/i.test(testDatabaseName)) {
  throw new Error('TEST_DATABASE_URL must target a database named test_* or afrolife_test*; refusing to modify a normal application database');
}
const db = new pg.Pool({ connectionString: testDatabaseUrl });
const run = randomInt(0, 10_000_000).toString().padStart(7, '0');
const uniquePhone = () => `+2519${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const PW = 'Passw0rd!test';
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('kyc-test-image')]);

type U = { id: string; role: string; phone: string; token: string };

test('health endpoint confirms the database connection', async () => {
  const response = await fetch((process.env.API_URL ?? 'http://localhost:3010') + '/healthz');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, database: 'connected' });
});

async function mkUser(role: string, n: number): Promise<U> {
  const phone = `+2519${run}${n}`;
  const r = await db.query(
    "INSERT INTO users (legal_name, phone, role, kyc_status, active, password_hash) VALUES ($1,$2,$3,'verified',true,$4) RETURNING id",
    [`${role}-${n}`, phone, role, bcrypt.hashSync(PW, 4)],
  );
  const id = r.rows[0].id as string;
  const sessionId = randomUUID();
  await db.query('INSERT INTO auth_sessions (id,user_id,expires_at) VALUES ($1,$2,now()+interval \'8 hours\')', [sessionId, id]);
  return { id, role, phone, token: jwt.sign({ sub: id, role, sid: sessionId }, SECRET, { expiresIn: '8h' }) };
}

async function call(
  u: Pick<U, 'token'>,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + u.token, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}

async function callFile(u: Pick<U, 'token'>, path: string, file: Buffer, contentType = 'image/png') {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + u.token, 'content-type': contentType },
    body: new Uint8Array(file),
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}

// ---- Setup: one user per role; two field agents under one master ----
const tid = (await db.query("INSERT INTO territories (level, name) VALUES ('city', $1) RETURNING id", ['Test ' + run])).rows[0].id;
const admin = await mkUser('super_admin', 1);
const unassignedSuperAdmin = await mkUser('super_admin', 14);
const globalAdmin = await mkUser('global_admin', 10);
const ungrantedGlobalAdmin = await mkUser('global_admin', 15);
const scopedGlobalAdmin = await mkUser('global_admin', 16);
const compliance = await mkUser('compliance', 2);
const complianceAlt = await mkUser('compliance', 13);
const fin1 = await mkUser('finance', 3);
const fin2 = await mkUser('finance_manager', 4);
const learningManager = await mkUser('corporate_business_manager', 11);
const learningCustomer = await mkUser('customer', 12);
const master = await mkUser('master_agent', 5);
const fa = await mkUser('field_agent', 6);
const fb = await mkUser('field_agent', 7);
await db.query("INSERT INTO agents (id, agent_type, parent_id, territory_id) VALUES ($1,'master',NULL,$2)", [master.id, tid]);
for (const f of [fa, fb]) await db.query("INSERT INTO agents (id, agent_type, parent_id, territory_id) VALUES ($1,'field',$2,$3)", [f.id, master.id, tid]);

test('Global Admin provisions Super and Master Agents while Super and Master Agents provision their agent tiers', async () => {
  const onboardedSuper = await call(globalAdmin, 'POST', '/users', {
    legal_name: `Provisioned Super Admin ${run}`,
    phone: uniquePhone(),
    role: 'super_admin',
  });
  assert.equal(onboardedSuper.status, 201, JSON.stringify(onboardedSuper.body));
  assert.equal(onboardedSuper.body.user.role, 'super_admin');

  const onboardedMaster = await call(globalAdmin, 'POST', '/users', {
    legal_name: `Provisioned Master Agent ${run}`,
    phone: uniquePhone(),
    role: 'master_agent',
    territory_id: tid,
    requested_plan: 'free',
  });
  assert.equal(onboardedMaster.status, 201, JSON.stringify(onboardedMaster.body));
  assert.equal(onboardedMaster.body.user.role, 'master_agent');

  const superOwnedMaster = await mkUser('master_agent', 95);
  await db.query('UPDATE users SET created_by=$1,territory_id=$2 WHERE id=$3', [admin.id, tid, superOwnedMaster.id]);
  await db.query("INSERT INTO agents (id,agent_type,parent_id,territory_id) VALUES ($1,'master',NULL,$2)", [superOwnedMaster.id, tid]);
  const superOnboardedField = await call(admin, 'POST', '/users', {
    legal_name: `Super Admin Field Agent ${run}`,
    phone: uniquePhone(),
    role: 'field_agent',
    territory_id: tid,
    parent_agent_id: superOwnedMaster.id,
    requested_plan: 'free',
  });
  assert.equal(superOnboardedField.status, 201, JSON.stringify(superOnboardedField.body));
  assert.equal(superOnboardedField.body.user.role, 'field_agent');

  const masterOnboardedField = await call(master, 'POST', '/users', {
    legal_name: `Master Agent Sub-agent ${run}`,
    phone: uniquePhone(),
    role: 'field_agent',
    territory_id: tid,
    parent_agent_id: master.id,
    requested_plan: 'free',
  });
  assert.equal(masterOnboardedField.status, 201, JSON.stringify(masterOnboardedField.body));
  assert.equal(masterOnboardedField.body.user.role, 'field_agent');
  const createdBy = await db.query('SELECT created_by FROM users WHERE id=$1', [masterOnboardedField.body.user.id]);
  assert.equal(createdBy.rows[0].created_by, master.id);

  const otherMaster = await mkUser('master_agent', 96);
  await db.query("INSERT INTO agents (id,agent_type,parent_id,territory_id) VALUES ($1,'master',NULL,$2)", [otherMaster.id, tid]);
  const outOfTeamField = await call(master, 'POST', '/users', {
    legal_name: `Out-of-team Field Agent ${run}`,
    phone: uniquePhone(),
    role: 'field_agent',
    territory_id: tid,
    parent_agent_id: otherMaster.id,
    requested_plan: 'free',
  });
  assert.equal(outOfTeamField.status, 422);

  const deniedMasterTier = await call(master, 'POST', '/users', {
    legal_name: `Disallowed Master Agent ${run}`,
    phone: uniquePhone(),
    role: 'master_agent',
    territory_id: tid,
    requested_plan: 'free',
  });
  assert.equal(deniedMasterTier.status, 403);
});

test('users can list and revoke only their own active sessions', async () => {
  const otherSessionId = randomUUID();
  await db.query(
    `INSERT INTO auth_sessions (id,user_id,expires_at,user_agent)
     VALUES ($1,$2,now()+interval '8 hours',$3)`,
    [otherSessionId, admin.id, 'Integration test browser'],
  );
  const sessions = await call(admin, 'GET', '/auth/sessions');
  assert.equal(sessions.status, 200);
  const adminSessionId = (jwt.decode(admin.token) as { sid: string }).sid;
  assert.ok(sessions.body.some((item: any) => item.id === adminSessionId && item.current));
  assert.ok(sessions.body.some((item: any) => item.id === otherSessionId && item.user_agent === 'Integration test browser' && item.active));

  const foreignSessionId = randomUUID();
  await db.query(
    `INSERT INTO auth_sessions (id,user_id,expires_at)
     VALUES ($1,$2,now()+interval '8 hours')`,
    [foreignSessionId, fb.id],
  );
  assert.equal((await call(admin, 'DELETE', `/auth/sessions/${foreignSessionId}`)).status, 404);
  assert.equal((await call(admin, 'DELETE', `/auth/sessions/${otherSessionId}`)).status, 204);
  const revokedUse = await fetch(API + '/auth/me', {
    headers: { authorization: `Bearer ${jwt.sign({ sub: admin.id, role: admin.role, sid: otherSessionId }, SECRET, { expiresIn: '8h' })}` },
  });
  assert.equal(revokedUse.status, 401);
});

test('support complaints require independent sensitive access and structured resolution and appeal', async () => {
  const created = await call(learningCustomer,'POST','/support/cases',{
    category:'agent_complaint',
    subject_user_id:fa.id,
    subject:'Complaint about an Agent',
    description:'The Agent did not explain the service terms before requesting a decision.',
  });
  assert.equal(created.status,201,JSON.stringify(created.body));
  assert.equal(created.body.priority,'normal');

  const safety = await call(learningCustomer,'POST','/support/cases',{
    category:'safety',subject:'Urgent safety concern',
    description:'I need a safe and prompt review of a safety concern.',
  });
  assert.equal(safety.status,201,JSON.stringify(safety.body));
  assert.equal(safety.body.priority,'urgent');
  const safetyAccess = await call(compliance,'POST',`/support/cases/${safety.body.id}/access-requests`,{
    reason:'Need temporary access to assess the reported safety concern.',
  });
  assert.equal(safetyAccess.status,201);
  assert.equal((await call(compliance,'POST',`/support/access-requests/${safetyAccess.body.id}/decision`,{
    decision:'approve',reason:'Self-approval must be blocked by the independent-review policy.',
  })).status,403);
  assert.equal((await call(complianceAlt,'POST',`/support/access-requests/${safetyAccess.body.id}/decision`,{
    decision:'approve',reason:'Independent Compliance reviewer approved a limited review window.',
  })).status,200);

  const queue = await call(learningManager,'GET','/support/cases/queue');
  assert.equal(queue.status,200);
  const queueCase = queue.body.find((item:any)=>item.id===created.body.id);
  assert.ok(queueCase);
  assert.equal('subject' in queueCase,false);
  assert.equal('user_id' in queueCase,false);
  assert.equal('description' in queueCase,false);
  assert.equal((await call(learningManager,'GET',`/support/cases/${created.body.id}`)).status,404);
  assert.equal((await call(learningManager,'GET',`/support/cases/${created.body.id}/events`)).status,404);

  const access = await call(learningManager,'POST',`/support/cases/${created.body.id}/access-requests`,{
    reason:'Need case evidence to investigate and respond fairly.',
  });
  assert.equal(access.status,201,JSON.stringify(access.body));
  assert.equal((await call(compliance,'POST',`/support/access-requests/${access.body.id}/decision`,{
    decision:'approve',reason:'Independent review authorizes a short investigation window.',
  })).status,200);

  const details = await call(learningManager,'GET',`/support/cases/${created.body.id}`);
  assert.equal(details.status,200);
  assert.match(details.body.description,/service terms/);
  const resolution = await call(learningManager,'POST',`/support/cases/${created.body.id}/resolve`,{
    outcome:'The complaint has been reviewed and addressed.',
    rationale:'The case evidence supports the reported communication gap.',
    corrective_action:'The Agent received policy coaching and the customer was contacted.',
    refund_reference:'N/A',
    appeal_route:'Contact the Compliance team within 30 days.',
  });
  assert.equal(resolution.status,200,JSON.stringify(resolution.body));
  assert.equal((await call(learningCustomer,'POST',`/support/cases/${created.body.id}/appeal`,{
    reason:'I do not agree that the corrective action resolved my concern.',
  })).status,200);
  assert.equal((await call(learningCustomer,'GET','/support/cases/mine')).body
    .find((item:any)=>item.id===created.body.id).status,'appealed');
  assert.equal((await call(learningManager,'POST',`/support/cases/${created.body.id}/access-requests`,{
    reason:'Original resolver must not enter the independent appeal review.',
  })).status,403);
  const appealsQueue = await call(compliance,'GET','/support/cases/appeals/queue');
  assert.equal(appealsQueue.status,200);
  assert.ok(appealsQueue.body.some((item:any)=>item.id===created.body.id));
  assert.equal('subject' in appealsQueue.body.find((item:any)=>item.id===created.body.id),false);
  const appealAccess = await call(compliance,'POST',`/support/cases/${created.body.id}/access-requests`,{
    reason:'Need approved evidence access to independently review this appeal.',
  });
  assert.equal(appealAccess.status,201);
  assert.equal((await call(complianceAlt,'POST',`/support/access-requests/${appealAccess.body.id}/decision`,{
    decision:'approve',reason:'Independent reviewer grants temporary access for appeal review.',
  })).status,200);
  const appealReview = await call(compliance,'POST',`/support/cases/${created.body.id}/appeal-review`,{
    decision:'upheld',
    rationale:'The initial resolution and documented corrective action were appropriate.',
  });
  assert.equal(appealReview.status,201,JSON.stringify(appealReview.body));
  assert.equal(appealReview.body.decision,'upheld');
  assert.equal((await call(compliance,'POST',`/support/cases/${created.body.id}/appeal-review`,{
    decision:'overturned',
    rationale:'A duplicate appeal review must not overwrite the immutable decision.',
    corrective_action:'Issue a new corrective action and contact the customer.',
  })).status,409);
  const ownerCase = (await call(learningCustomer,'GET','/support/cases/mine')).body
    .find((item:any)=>item.id===created.body.id);
  assert.equal(ownerCase.appeal_decision,'upheld');
  const timeline=await call(learningCustomer,'GET',`/support/cases/${created.body.id}/events`);
  assert.equal(timeline.status,200);
  assert.ok(timeline.body.some((item:any)=>item.event_type==='resolved'));
  assert.ok(timeline.body.some((item:any)=>item.event_type==='appealed'));
  assert.ok(timeline.body.some((item:any)=>item.event_type==='appeal_reviewed'));
  await db.query(
    `UPDATE support_case_access_requests SET expires_at=now()-interval '1 second'
     WHERE case_id=$1 AND status='approved'`,
    [created.body.id],
  );
  assert.equal((await call(learningManager,'GET',`/support/cases/${created.body.id}`)).status,404);
  assert.equal((await call(learningManager,'GET',`/support/cases/${created.body.id}/events`)).status,404);
});

test('Insurance Agent referrals require opt-in and remain within the assigned Agent hierarchy', async () => {
  const withoutAgentShare = await call(learningCustomer, 'POST', '/insurance/requests', {
    product_interest: 'life',
    message: 'Please send me general life insurance information.',
    consent: true,
    agent_referral_consent: false,
  });
  assert.equal(withoutAgentShare.status, 201);
  const optedIn = await call(learningCustomer, 'POST', '/insurance/requests', {
    product_interest: 'property',
    message: 'Please send me general property insurance information.',
    consent: true,
    agent_referral_consent: true,
  });
  assert.equal(optedIn.status, 201);

  const customerRequests = await call(learningCustomer, 'GET', '/insurance/requests/me');
  assert.equal(customerRequests.status, 200);
  assert.equal(customerRequests.body.find((item: any) => item.id === withoutAgentShare.body.id).agent_referral_status, null);
  assert.equal(customerRequests.body.find((item: any) => item.id === optedIn.body.id).agent_referral_status, 'unassigned');

  const staffQueue = await call(admin, 'GET', '/insurance/requests/agent-referrals/me');
  assert.equal(staffQueue.status, 200);
  assert.equal(staffQueue.body.some((item: any) => item.request_id === withoutAgentShare.body.id), false);
  const referral = staffQueue.body.find((item: any) => item.request_id === optedIn.body.id);
  assert.ok(referral);

  const eligibleAgents = await call(admin, 'GET', '/insurance/requests/agent-referrals/agents');
  assert.equal(eligibleAgents.status, 200);
  assert.ok(eligibleAgents.body.some((item: any) => item.id === fa.id));
  const assigned = await call(admin, 'POST', `/insurance/requests/agent-referrals/${referral.id}/assign`, {
    agent_id: fa.id,
    reason: 'staff_review',
  });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.body));

  const fieldQueue = await call(fa, 'GET', '/insurance/requests/agent-referrals/me');
  assert.equal(fieldQueue.status, 200);
  const fieldReferral = fieldQueue.body.find((item: any) => item.id === referral.id);
  assert.ok(fieldReferral);
  assert.equal(fieldReferral.can_update, true);
  assert.equal('message' in fieldReferral, false);
  assert.deepEqual(fieldReferral.events.map((event: any) => event.event_type), ['customer_consented', 'assigned']);
  assert.equal((await call(fa, 'GET', '/insurance/requests')).status, 403);
  const siblingQueue = await call(fb, 'GET', '/insurance/requests/agent-referrals/me');
  assert.equal(siblingQueue.status, 200);
  assert.equal(siblingQueue.body.some((item: any) => item.id === referral.id), false);
  const masterQueue = await call(master, 'GET', '/insurance/requests/agent-referrals/me');
  assert.equal(masterQueue.body.some((item: any) => item.id === referral.id), true);
  assert.equal((await call(fb, 'POST', `/insurance/requests/agent-referrals/${referral.id}/status`, {
    status: 'contact_attempted',
  })).status, 404);

  assert.equal((await call(fa, 'POST', `/insurance/requests/agent-referrals/${referral.id}/status`, {
    status: 'contact_attempted',
  })).status, 200);
  assert.equal((await call(fa, 'POST', `/insurance/requests/agent-referrals/${referral.id}/status`, {
    status: 'referred_to_insurance_team',
  })).status, 200);
  assert.equal((await call(fa, 'POST', `/insurance/requests/agent-referrals/${referral.id}/status`, {
    status: 'customer_declined',
  })).status, 404);
  const finalRequests = await call(learningCustomer, 'GET', '/insurance/requests/me');
  const finalRequest = finalRequests.body.find((item: any) => item.id === optedIn.body.id);
  assert.equal(finalRequest.agent_referral_status, 'referred_to_insurance_team');
  assert.equal(finalRequest.assigned_agent_name, 'field_agent-6');
  assert.deepEqual(finalRequest.agent_referral_events.map((event: any) => event.event_type), [
    'customer_consented', 'assigned', 'contact_attempted', 'referred_to_insurance_team',
  ]);

  const withdrawalRequest = await call(learningCustomer, 'POST', '/insurance/requests', {
    product_interest: 'household',
    message: 'Please send me general household cover information.',
    consent: true,
    agent_referral_consent: true,
  });
  assert.equal(withdrawalRequest.status, 201);
  const withdrawalQueue = await call(admin, 'GET', '/insurance/requests/agent-referrals/me');
  const withdrawalReferral = withdrawalQueue.body.find((item: any) => item.request_id === withdrawalRequest.body.id);
  assert.ok(withdrawalReferral);
  assert.equal((await call(admin, 'POST', `/insurance/requests/agent-referrals/${withdrawalReferral.id}/assign`, {
    agent_id: fb.id,
    reason: 'customer_requested',
  })).status, 200);
  assert.equal((await call(fb, 'GET', '/insurance/requests/agent-referrals/me')).body.some((item: any) => item.id === withdrawalReferral.id), true);
  assert.equal((await call(learningCustomer, 'POST', `/insurance/requests/agent-referrals/${withdrawalReferral.id}/withdraw`, {})).status, 200);
  assert.equal((await call(fb, 'GET', '/insurance/requests/agent-referrals/me')).body.some((item: any) => item.id === withdrawalReferral.id), false);
  const withdrawnRequests = await call(learningCustomer, 'GET', '/insurance/requests/me');
  const withdrawnRequest = withdrawnRequests.body.find((item: any) => item.id === withdrawalRequest.body.id);
  assert.equal(withdrawnRequest.agent_referral_status, 'customer_withdrew');
  assert.deepEqual(withdrawnRequest.agent_referral_events.map((event: any) => event.event_type), [
    'customer_consented', 'assigned', 'customer_withdrew',
  ]);
});

test('persistent API metrics aggregate route traffic and remain Global Admin only', async () => {
  assert.equal((await call(admin, 'GET', '/system/metrics')).status, 403);
  const metrics = await call(globalAdmin, 'GET', '/system/metrics');
  assert.equal(metrics.status, 200, JSON.stringify(metrics.body));
  assert.ok(Array.isArray(metrics.body.routes));
  const route = metrics.body.routes.find((metric: any) => metric.route === 'GET /api/v1/agent-referrals/me');
  assert.ok(route, `Completed API traffic should have been flushed to persistent metrics before the read: ${JSON.stringify(metrics.body.routes)}`);
  assert.ok(Number(route.requests) >= 1);
  assert.ok(Number(route.average_duration_ms) >= 0);
});

test('Global System Admin controls shared platform configuration while Super Admin configures assigned modules only', async () => {
  assert.equal((await call(compliance, 'GET', '/platform/services')).status, 403);
  const services = await call(globalAdmin, 'GET', '/platform/services');
  assert.equal(services.status, 200);
  assert.ok(services.body.some((service: any) => service.service_key === 'agency'));
  assert.equal((await call(admin, 'GET', '/platform/services')).status, 403);
  assert.equal((await call(admin, 'GET', '/platform/service-packages')).status, 403);
  assert.equal((await call(admin, 'GET', '/platform/tenants')).status, 403);
  assert.equal((await call(admin, 'GET', '/platform/catalog-products')).status, 403);
  assert.equal((await call(admin, 'GET', '/platform/super-admins')).status, 403);

  const packageKey = `test-control-${run}`;
  const packageResponse = await call(globalAdmin, 'POST', '/platform/service-packages', {
    package_key: packageKey,
    display_name: `Test Control Package ${run}`,
    description: 'Synthetic package for control-plane integration coverage.',
    services: ['agency', 'workforce'],
  });
  assert.equal(packageResponse.status, 201, JSON.stringify(packageResponse.body));

  const tenantResponse = await call(globalAdmin, 'POST', '/platform/tenants', {
    tenant_key: `test-control-${run}`,
    display_name: `Test Control Tenant ${run}`,
    hosting_mode: 'on_premises',
    deployment_reference: `uat-deployment-${run}`,
    package_id: packageResponse.body.id,
  });
  assert.equal(tenantResponse.status, 201, JSON.stringify(tenantResponse.body));
  assert.equal(tenantResponse.body.status, 'provisioning');
  assert.equal(tenantResponse.body.deployment_status, 'not_registered');
  assert.equal((await call(unassignedSuperAdmin, 'GET', `/features?platform_tenant_id=${tenantResponse.body.id}`)).status, 403);
  assert.equal((await call(unassignedSuperAdmin, 'PATCH', `/platform/my-tenants/${tenantResponse.body.id}/modules`, {
    services: ['agency'],
  })).status, 404);
  assert.equal((await call(globalAdmin, 'POST', `/platform/tenants/${tenantResponse.body.id}/admins`, {
    user_id: admin.id,
  })).status, 204);
  assert.equal((await call(globalAdmin, 'POST', `/platform/tenants/${tenantResponse.body.id}/admins`, {
    user_id: globalAdmin.id,
  })).status, 409);
  assert.equal((await call(globalAdmin, 'POST', `/platform/tenants/${tenantResponse.body.id}/admins`, {
    user_id: ungrantedGlobalAdmin.id,
  })).status, 422);
  await db.query('UPDATE users SET mfa_enabled=true WHERE id=$1', [scopedGlobalAdmin.id]);
  await db.query(
    `INSERT INTO user_admin_role_grants(user_id,role_name,module_keys,all_tenants,granted_by)
     VALUES($1,'super_admin',ARRAY[]::text[],false,$2)`,
    [scopedGlobalAdmin.id, globalAdmin.id],
  );
  assert.equal((await call(globalAdmin, 'POST', `/platform/tenants/${tenantResponse.body.id}/admins`, {
    user_id: scopedGlobalAdmin.id,
  })).status, 204);
  const scopedAssignments = await db.query(
    'SELECT tenant_id FROM platform_tenant_admins WHERE user_id=$1 ORDER BY tenant_id',
    [scopedGlobalAdmin.id],
  );
  assert.deepEqual(scopedAssignments.rows.map((row) => row.tenant_id), [tenantResponse.body.id]);
  const assignedTenants = await call(admin, 'GET', '/platform/my-tenants');
  assert.equal(assignedTenants.status, 200);
  assert.deepEqual(assignedTenants.body[0].available_services, ['agency', 'workforce']);
  assert.equal((await call(admin, 'PATCH', `/platform/tenants/${tenantResponse.body.id}`, {
    status: 'active',
  })).status, 403);

  const registration = await call(admin, 'PATCH', `/platform/my-tenants/${tenantResponse.body.id}/registration`, {
    deployment_status: 'registered',
    deployment_reference: `super-admin-registration-${run}`,
  });
  assert.equal(registration.status, 200, JSON.stringify(registration.body));
  const platformTenantContext = { 'x-afrolife-platform-tenant-id': tenantResponse.body.id as string };
  assert.equal((await call(admin, 'GET', '/leads')).status, 403);
  assert.equal((await call(admin, 'GET', '/leads', undefined, platformTenantContext)).status, 403);
  assert.equal((await call(admin, 'GET', '/accounting', undefined, platformTenantContext)).status, 403);
  assert.equal((await call(unassignedSuperAdmin, 'GET', '/leads', undefined, platformTenantContext)).status, 403);

  const activateWithoutVerification = await call(globalAdmin, 'PATCH', `/platform/tenants/${tenantResponse.body.id}`, {
    status: 'active',
  });
  assert.equal(activateWithoutVerification.status, 409);

  const verifyWithoutEvidence = await call(globalAdmin, 'PATCH', `/platform/tenants/${tenantResponse.body.id}`, {
    deployment_status: 'verified',
  });
  assert.equal(verifyWithoutEvidence.status, 422);

  const verified = await call(globalAdmin, 'PATCH', `/platform/tenants/${tenantResponse.body.id}`, {
    deployment_status: 'verified',
    deployment_verification_reference: `uat-attestation-${run}`,
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  assert.equal(verified.body.deployment_status, 'verified');
  assert.equal(verified.body.deployment_verification_reference, `uat-attestation-${run}`);

  const active = await call(globalAdmin, 'PATCH', `/platform/tenants/${tenantResponse.body.id}`, {
    status: 'active',
  });
  assert.equal(active.status, 200, JSON.stringify(active.body));
  assert.equal(active.body.status, 'active');
  assert.equal((await call(admin, 'GET', '/leads')).status, 403);
  assert.equal((await call(unassignedSuperAdmin, 'GET', '/leads', undefined, platformTenantContext)).status, 403);

  const unscopedFeatures = await call(admin, 'GET', '/features');
  const scopedFeatures = await call(admin, 'GET', `/features?platform_tenant_id=${tenantResponse.body.id}`);
  assert.deepEqual(unscopedFeatures.body.enabledModules, []);
  assert.equal(scopedFeatures.status, 200, JSON.stringify(scopedFeatures.body));
  assert.equal(scopedFeatures.body.platformTenantId, tenantResponse.body.id);
  assert.deepEqual(
    scopedFeatures.body.enabledModules,
    ['leads', 'workers', 'contracts', 'commissions', 'agents'],
  );
  assert.equal((await call(admin, 'GET', '/leads', undefined, platformTenantContext)).status, 200);
  assert.notEqual((await call(admin, 'GET', '/workers', undefined, platformTenantContext)).status, 403);
  assert.equal((await call(admin, 'GET', '/accounting', undefined, platformTenantContext)).status, 403);
  const narrowed = await call(admin, 'PATCH', `/platform/my-tenants/${tenantResponse.body.id}/modules`, {
    services: ['workforce'],
  });
  assert.equal(narrowed.status, 200, JSON.stringify(narrowed.body));
  assert.equal((await call(admin, 'GET', '/leads', undefined, platformTenantContext)).status, 403);
  assert.equal((await call(admin, 'GET', '/contracts', undefined, platformTenantContext)).status, 403);
  assert.equal((await call(admin, 'GET', '/commissions', undefined, platformTenantContext)).status, 403);
  assert.equal((await call(admin, 'GET', '/accounting', undefined, platformTenantContext)).status, 403);
  assert.notEqual((await call(admin, 'GET', '/workers', undefined, platformTenantContext)).status, 403);
  const narrowedFeatures = await call(admin, 'GET', `/features?platform_tenant_id=${tenantResponse.body.id}`);
  assert.deepEqual(narrowedFeatures.body.enabledModules, ['workers']);
  const outOfPackage = await call(admin, 'PATCH', `/platform/my-tenants/${tenantResponse.body.id}/modules`, {
    services: ['property'],
  });
  assert.equal(outOfPackage.status, 422);

  const unsafeDeploymentChange = await call(globalAdmin, 'PATCH', `/platform/tenants/${tenantResponse.body.id}`, {
    region: 'another-region',
  });
  assert.equal(unsafeDeploymentChange.status, 409);

  const productResponse = await call(globalAdmin, 'POST', '/platform/catalog-products', {
    product_key: `test-product-${run}`,
    display_name: `Test Catalog Product ${run}`,
    description: 'Synthetic non-financial catalog item.',
    category: 'marketplace',
  });
  assert.equal(productResponse.status, 201, JSON.stringify(productResponse.body));
  const activeProduct = await call(globalAdmin, 'PATCH', `/platform/catalog-products/${productResponse.body.id}`, {
    display_name: productResponse.body.display_name,
    description: productResponse.body.description,
    status: 'active',
    attributes: {},
  });
  assert.equal(activeProduct.status, 200);
  assert.equal(activeProduct.body.status, 'active');

  const regulatedProduct = await call(globalAdmin, 'POST', '/platform/catalog-products', {
    product_key: `test-credit-${run}`,
    display_name: 'Regulated credit offer',
    description: 'Must be configured by the financial product workflow.',
    category: 'credit',
  });
  assert.equal(regulatedProduct.status, 400);
});

async function newContract(agent: U, track: 'A' | 'B', suffix: number) {
  const lead = await call(agent, 'POST', '/leads', { lead_type: 'household', name: 'Test Customer ' + suffix, phone: `+2517${run}${suffix}` });
  assert.equal(lead.status, 201);
  const c = await call(agent, 'POST', `/leads/${lead.body.id}/contracts`, { track, base_value: 100000 });
  assert.equal(c.status, 201);
  return { lead: lead.body, contract: c.body };
}

async function drive(agent: U, contractId: string, amount: number) {
  const t = (u: U, action: string, body?: object) => call(u, 'POST', `/contracts/${contractId}/transition`, { action, ...body });
  assert.equal((await t(agent, 'submit')).status, 200);
  assert.equal((await t(compliance, 'verify_kyc')).status, 200);
  assert.equal((await t(admin, 'approve')).status, 200);
  const partySigned = await callFile(agent, `/contracts/${contractId}/documents?stage=party_signed`, PNG);
  assert.equal(partySigned.status, 201, JSON.stringify(partySigned.body));
  const companySigned = await callFile(admin, `/contracts/${contractId}/documents?stage=company_countersigned`, PNG);
  assert.equal(companySigned.status, 201, JSON.stringify(companySigned.body));
  assert.equal((await t(admin, 'sign')).status, 200);
  assert.equal((await t(fin1, 'record_payment', { channel: 'telebirr', reference: randomUUID(), amount })).status, 200);
  return (await t(fin2, 'reconcile')).body;
}

let A: Awaited<ReturnType<typeof newContract>>;

test('role access and learning content work through the restricted API runtime', async () => {
  const roleAccess = await call(globalAdmin, 'GET', '/role-access');
  assert.equal(roleAccess.status, 200);
  assert.equal(roleAccess.body.roles.find((role: any) => role.key === 'super_admin').editable, false);
  assert.equal((await call(admin, 'GET', '/role-access')).status, 403);
  const accessHistoryUser = await mkUser('customer', 92);
  assert.equal((await call(globalAdmin, 'POST', `/users/${accessHistoryUser.id}/deactivate`, {
    reason: 'Synthetic UAT account deactivation for access history verification',
  })).status, 200);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const inactiveAt = new Date(Date.now() - 10).toISOString();
  assert.equal((await call(globalAdmin, 'POST', `/users/${accessHistoryUser.id}/activate`, {
    reason: 'Synthetic UAT account reactivation after access history verification',
  })).status, 200);
  const accessHistory = await call(globalAdmin, 'GET', `/users/${accessHistoryUser.id}/access-history`);
  assert.equal(accessHistory.status, 200);
  assert.equal(accessHistory.body.history[0].current_active, true);
  assert.equal(accessHistory.body.history[0].actor_id, globalAdmin.id);
  assert.ok(accessHistory.body.history.some((event: any) =>
    event.current_active === false
    && event.actor_id === globalAdmin.id
    && event.reason === 'Synthetic UAT account deactivation for access history verification'));
  const historicalState = await call(globalAdmin, 'GET',
    `/users/${accessHistoryUser.id}/access-history?at=${encodeURIComponent(inactiveAt)}`);
  assert.equal(historicalState.status, 200);
  assert.equal(historicalState.body.state_at_time.active, false);
  assert.equal((await call(accessHistoryUser, 'GET', `/users/${accessHistoryUser.id}/access-history`)).status, 403);
  assert.equal((await call(globalAdmin, 'GET', '/role-access/history?limit=1')).status, 200);
  assert.equal((await call(globalAdmin, 'PATCH', '/role-access', {
    changes: [{ role: 'super_admin', activity: 'learning.content.view', enabled: false }],
  })).status, 422);

  const denied = await call(globalAdmin, 'PATCH', '/role-access', {
    changes: [{ role: 'customer', activity: 'learning.content.view', enabled: false }],
  });
  assert.equal(denied.status, 200);
  assert.equal((await call(learningCustomer, 'GET', '/learning/content')).status, 403);
  assert.equal((await call(fin1, 'POST', '/learning/content', {
    title: 'Unauthorized UAT content',
    summary: 'Finance role cannot publish learning materials',
    category: 'general_support',
    content_type: 'article',
    audience_roles: ['customer'],
    body: 'This content must not be created.',
    status: 'published',
  })).status, 403);

  const restored = await call(globalAdmin, 'PATCH', '/role-access', {
    changes: [{ role: 'customer', activity: 'learning.content.view', enabled: true }],
  });
  assert.equal(restored.status, 200);
  const content = await call(learningManager, 'POST', '/learning/content', {
    title: 'UAT Tenant Guide',
    summary: 'Synthetic customer-targeted training content',
    category: 'tenant_support',
    content_type: 'video',
    audience_roles: ['customer'],
    video_url: 'https://example.invalid/uat-guide',
    body: 'Synthetic training content for disposable UAT only.',
    status: 'published',
  });
  assert.equal(content.status, 201);
  const audience = await call(learningCustomer, 'GET', '/learning/content');
  assert.equal(audience.status, 200);
  assert.ok(audience.body.some((item: any) => item.id === content.body.id));

  const updated = await call(learningManager, 'PATCH', `/learning/content/${content.body.id}`, {
    title: 'Updated UAT Tenant Guide',
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, 'Updated UAT Tenant Guide');
  assert.equal((await call(learningManager, 'DELETE', `/learning/content/${content.body.id}`)).status, 200);
  const noLongerPublished = await call(learningCustomer, 'GET', '/learning/content');
  assert.ok(!noLongerPublished.body.some((item: any) => item.id === content.body.id));

  const audit = await db.query(
    'SELECT action FROM learning_content_audit WHERE content_id=$1 ORDER BY id',
    [content.body.id],
  );
  assert.deepEqual(audit.rows.map((row) => row.action), ['published', 'updated', 'archived']);
});

test('account role updates persist safely within Global Admin and Super Admin scopes', async () => {
  const member = await mkUser('customer', 93);
  await db.query(
    `INSERT INTO user_signups (user_id,account_type,payment_status)
     VALUES ($1,'customer','not_required')`,
    [member.id],
  );
  const memberUpdate = await call(globalAdmin, 'PATCH', `/users/${member.id}/role`, { role: 'worker' });
  assert.equal(memberUpdate.status, 200, JSON.stringify(memberUpdate.body));
  assert.equal(memberUpdate.body.user.role, 'worker');
  const storedMember = (await db.query(
    `SELECT u.role,s.account_type FROM users u
     JOIN user_signups s ON s.user_id=u.id WHERE u.id=$1`,
    [member.id],
  )).rows[0];
  assert.deepEqual(storedMember, { role: 'worker', account_type: 'worker' });
  assert.equal((await call(admin, 'PATCH', `/users/${member.id}/role`, { role: 'customer' })).status, 404);
  assert.equal((await call(globalAdmin, 'PATCH', `/users/${member.id}/role`, { role: 'super_admin' })).status, 422);

  const ownedFieldAgent = await mkUser('field_agent', 94);
  await db.query('UPDATE users SET created_by=$1,territory_id=$2 WHERE id=$3', [admin.id, tid, ownedFieldAgent.id]);
  await db.query(
    `INSERT INTO agents (id,agent_type,parent_id,territory_id) VALUES ($1,'field',$2,$3)`,
    [ownedFieldAgent.id, master.id, tid],
  );
  await db.query(
    `INSERT INTO user_signups
       (user_id,account_type,requested_plan,payment_status,agent_type,territory_id,parent_agent_id)
     VALUES ($1,'agent','free','not_required','field',$2,$3)`,
    [ownedFieldAgent.id, tid, master.id],
  );
  const promotedAgent = await call(admin, 'PATCH', `/users/${ownedFieldAgent.id}/role`, { role: 'master_agent' });
  assert.equal(promotedAgent.status, 200, JSON.stringify(promotedAgent.body));
  const storedAgent = (await db.query(
    `SELECT u.role,a.agent_type,a.parent_id,s.agent_type AS signup_agent_type,s.parent_agent_id
     FROM users u JOIN agents a ON a.id=u.id JOIN user_signups s ON s.user_id=u.id WHERE u.id=$1`,
    [ownedFieldAgent.id],
  )).rows[0];
  assert.deepEqual(storedAgent, {
    role: 'master_agent',
    agent_type: 'master',
    parent_id: null,
    signup_agent_type: 'master',
    parent_agent_id: null,
  });
  const demotedAgent = await call(globalAdmin, 'PATCH', `/users/${ownedFieldAgent.id}/role`, {
    role: 'field_agent',
    parent_agent_id: master.id,
  });
  assert.equal(demotedAgent.status, 200, JSON.stringify(demotedAgent.body));
  assert.equal((await db.query('SELECT role FROM users WHERE id=$1', [ownedFieldAgent.id])).rows[0].role, 'field_agent');
});

test('login returns a token for an active user', async () => {
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: admin.phone, password: PW }) });
  assert.equal(r.status, 200);
  const result = await r.json() as { token: string };
  const claims = jwt.decode(result.token) as { sid?: string } | null;
  assert.ok(claims?.sid);
  assert.ok((await db.query('SELECT 1 FROM auth_sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL', [claims.sid, admin.id])).rowCount);
});

test('authenticated requests reject a session that exceeded its inactivity window', async () => {
  const idle = await mkUser('customer', 90);
  await db.query(
    `UPDATE auth_sessions SET last_activity_at=now()-interval '9 hours',expires_at=now()+interval '1 hour'
     WHERE user_id=$1`,
    [idle.id],
  );
  assert.equal((await call(idle, 'GET', '/auth/me')).status, 401);
});

test('logout revokes the current server-side session', async () => {
  const user = await mkUser('customer', 91);
  await db.query("UPDATE auth_sessions SET last_activity_at=now()-interval '2 minutes' WHERE user_id=$1", [user.id]);
  assert.equal((await call(user, 'GET', '/auth/session')).status, 204);
  assert.ok((await db.query(
    "SELECT 1 FROM auth_sessions WHERE user_id=$1 AND last_activity_at>now()-interval '1 minute'",
    [user.id],
  )).rowCount);
  assert.equal((await call(user, 'POST', '/auth/logout')).status, 204);
  assert.equal((await call(user, 'GET', '/auth/me')).status, 401);
});

test('privacy case events record safe before/after metadata for incident updates', async () => {
  const created = await call(compliance, 'POST', '/privacy/incidents', {
    incident_type: 'other',
    severity: 'low',
    summary: 'Synthetic privacy event test',
    details: 'Synthetic details for the privacy event integration test',
    affected_data: 'Synthetic records',
    affected_people_estimate: 1,
  });
  assert.equal(created.status, 201);
  const update = await call(compliance, 'PATCH', `/privacy/incidents/${created.body.id}`, {
    status: 'contained',
    assigned_to: compliance.id,
    containment_actions: 'Synthetic containment details for the privacy event test',
  });
  assert.equal(update.status, 200);
  const events = await call(compliance, 'GET', `/privacy/cases/privacy_incident/${created.body.id}/events`);
  assert.equal(events.status, 200);
  const event = events.body.find((item: any) => item.action === 'updated');
  assert.equal(event.details.before.status, 'open');
  assert.equal(event.details.after.status, 'contained');
  assert.equal(event.details.containment_changed, true);
  assert.doesNotMatch(JSON.stringify(event.details), /Synthetic containment details/);
});

test('public sign-up creates a pending account that cannot sign in before approval', async () => {
  const phone = uniquePhone();
  const response = await fetch(API + '/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      legal_name: 'Pending Customer',
      phone,
      email: '',
      password: 'FreshSignupPass!2026',
      password_confirmation: 'FreshSignupPass!2026',
      account_type: 'customer',
    }),
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json() as any).status, 'pending_approval');
  const stored = (await db.query(
    `SELECT u.role, u.active, u.kyc_status, s.account_type, s.status
     FROM users u JOIN user_signups s ON s.user_id = u.id WHERE u.phone = $1`,
    [phone],
  )).rows[0];
  assert.equal(stored.role, 'customer');
  assert.equal(stored.active, false);
  assert.equal(stored.kyc_status, 'uploaded');
  assert.equal(stored.account_type, 'customer');
  assert.equal(stored.status, 'pending');
  const login = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, password: 'FreshSignupPass!2026' }),
  });
  assert.equal(login.status, 401);
});

test('worker sign-up uploads private KYC documents and requires separate compliance review', async () => {
  const phone = uniquePhone();
  const response = await fetch(API + '/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      legal_name: 'KYC Worker',
      phone,
      password: 'KycWorkerPass!2026',
      password_confirmation: 'KycWorkerPass!2026',
      account_type: 'worker',
      worker_document_consent: true,
      date_of_birth: '1990-01-01',
    }),
  });
  assert.equal(response.status, 201);
  const signup = await response.json() as any;
  const user = (await db.query('SELECT id FROM users WHERE phone = $1', [phone])).rows[0];
  assert.ok(user);
  assert.equal((await fetch(API + '/auth/signup/documents?doc_type=national_id', {
    method: 'POST',
    headers: { 'content-type': 'image/png' },
    body: PNG,
  })).status, 401);

  for (const doc_type of ['national_id', 'police_clearance']) {
    const uploaded = await fetch(`${API}/auth/signup/documents?doc_type=${doc_type}`, {
      method: 'POST',
      headers: { authorization: `Signup ${signup.upload_token}`, 'content-type': 'image/png' },
      body: PNG,
    });
    assert.equal(uploaded.status, 201, `${doc_type}: ${await uploaded.text()}`);
  }
  const tokenStatus = await fetch(API + '/auth/signup/documents', {
    headers: { authorization: `Signup ${signup.upload_token}` },
  });
  assert.equal(tokenStatus.status, 200);
  const initialStatus = await tokenStatus.json() as any;
  assert.deepEqual(initialStatus.required.sort(), ['national_id', 'police_clearance']);
  const identityDocumentStatus = initialStatus.documents.find((doc: any) => doc.doc_type === 'national_id');
  assert.equal(identityDocumentStatus.status, 'uploaded');
  const identityDocument = (await db.query(
    "SELECT id FROM user_documents WHERE user_id = $1 AND doc_type = 'national_id'",
    [user.id],
  )).rows[0];
  assert.ok(identityDocument);
  assert.equal((await call(compliance, 'POST', `/users/${user.id}/documents/${identityDocument.id}/review`, {
    decision: 'rejected',
  })).status, 422);
  const rejectionNote = 'The identity image is blurred; upload a clearer copy.';
  const rejected = await call(compliance, 'POST', `/users/${user.id}/documents/${identityDocument.id}/review`, {
    decision: 'rejected', note: rejectionNote,
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.review_note, rejectionNote);
  const rejectedStatus = await fetch(API + '/auth/signup/documents', {
    headers: { authorization: `Signup ${signup.upload_token}` },
  });
  assert.equal(rejectedStatus.status, 200);
  const rejectedDocuments = await rejectedStatus.json() as any;
  assert.equal(rejectedDocuments.documents.find((doc: any) => doc.doc_type === 'national_id').review_note, rejectionNote);
  const replacement = await fetch(`${API}/auth/signup/documents?doc_type=national_id`, {
    method: 'POST',
    headers: { authorization: `Signup ${signup.upload_token}`, 'content-type': 'image/png' },
    body: PNG,
  });
  assert.equal(replacement.status, 201);
  assert.equal((await replacement.json() as any).id, identityDocument.id);
  const replacedDocuments = await call(compliance, 'GET', `/users/${user.id}/documents`);
  assert.equal(replacedDocuments.status, 200);
  const replacedIdentity = replacedDocuments.body.find((doc: any) => doc.doc_type === 'national_id');
  assert.equal(replacedIdentity.id, identityDocument.id);
  assert.equal(replacedIdentity.status, 'uploaded');
  assert.equal(replacedIdentity.review_note, null);
  assert.equal((await call(complianceAlt, 'POST', `/users/${user.id}/kyc`, {
    decision: 'verified',
    reason: 'Required identity evidence must be verified first.',
  })).status, 409);
  const documents = await call(compliance, 'GET', `/users/${user.id}/documents`);
  assert.equal(documents.status, 200);
  assert.deepEqual(documents.body.map((doc: any) => doc.doc_type).sort(), ['national_id', 'police_clearance']);
  for (const document of documents.body) {
    assert.equal((await call(compliance, 'POST', `/users/${user.id}/documents/${document.id}/review`, { decision: 'verified' })).status, 200);
    const downloaded = await fetch(`${API}/users/${user.id}/documents/${document.id}/file`, {
      headers: { authorization: 'Bearer ' + compliance.token },
    });

    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), PNG);
  }
  const finalKyc = await call(complianceAlt, 'POST', `/users/${user.id}/kyc`, {
    decision: 'verified',
    reason: 'Required identity evidence has passed independent review.',
  });
  assert.equal(finalKyc.status, 200, JSON.stringify(finalKyc.body));
  assert.equal((await call(globalAdmin, 'POST', `/users/${user.id}/activate`, {
    reason: 'Synthetic KYC-complete test account activation.',
  })).status, 200);
});

test('property-owner sign-up completes national-ID review and remains an owner role', async () => {
  const phone = uniquePhone();
  const response = await fetch(API + '/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      legal_name: 'Property Owner',
      phone,
      password: 'PropertyOwnerPass!2026',
      password_confirmation: 'PropertyOwnerPass!2026',
      account_type: 'property_owner',
      requested_plan: 'free',
    }),
  });
  assert.equal(response.status, 201);
  const signup = await response.json() as any;
  const owner = (await db.query(
    `SELECT u.id, u.role, u.active, s.account_type, s.status
     FROM users u JOIN user_signups s ON s.user_id = u.id WHERE u.phone = $1`,
    [phone],
  )).rows[0];
  assert.equal(owner.role, 'property_owner');
  assert.equal(owner.active, false);
  assert.equal(owner.account_type, 'property_owner');
  assert.equal(owner.status, 'pending');

  const uploaded = await fetch(`${API}/auth/signup/documents?doc_type=national_id`, {
    method: 'POST',
    headers: { authorization: `Signup ${signup.upload_token}`, 'content-type': 'image/png' },
    body: PNG,
  });
  assert.equal(uploaded.status, 201);
  const documents = await call(compliance, 'GET', `/users/${owner.id}/documents`);
  assert.equal(documents.status, 200);
  assert.equal(documents.body.length, 1);
  assert.equal((await call(compliance, 'POST', `/users/${owner.id}/documents/${documents.body[0].id}/review`, { decision: 'verified' })).status, 200);
  const ownerKyc = await call(complianceAlt, 'POST', `/users/${owner.id}/kyc`, {
    decision: 'verified',
    reason: 'The property owner identity document has passed review.',
  });
  assert.equal(ownerKyc.status, 200, JSON.stringify(ownerKyc.body));
  assert.equal((await call(globalAdmin, 'POST', `/users/${owner.id}/activate`, {
    reason: 'Synthetic property owner identity verification is complete.',
  })).status, 200);
});

test('Gate 3: lead is attributed to its agent; duplicate phone is rejected', async () => {
  A = await newContract(fa, 'A', 1);
  assert.equal(A.lead.source_agent_id, fa.id);
  assert.ok(new Date(A.lead.protected_until).getTime() > Date.now() + 89 * 86400000);
  const dup = await call(fb, 'POST', '/leads', { lead_type: 'household', name: 'Copy', phone: A.lead.phone });
  assert.equal(dup.status, 409);
});

test('Global Admin can formally reassign an unconverted lead with an immutable attribution trail', async () => {
  const created = await call(fa, 'POST', '/leads', {
    lead_type: 'business', name: 'Reassignment test', phone: uniquePhone(),
  });
  assert.equal(created.status, 201);
  const before = await call(fa, 'GET', `/leads/${created.body.id}/attribution-history`);
  assert.equal(before.status, 200);
  assert.equal(before.body.length, 1);
  assert.equal(before.body[0].event_type, 'created');

  const moved = await call(globalAdmin, 'POST', `/admin/leads/${created.body.id}/reassign`, {
    target_agent_id: fb.id, reason: 'Territory coverage requires an accountable reassignment',
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.source_agent_id, fb.id);
  assert.ok(new Date(moved.body.protected_until).getTime() > Date.now() + 89 * 86400000);
  const after = await call(fb, 'GET', `/leads/${created.body.id}/attribution-history`);
  assert.equal(after.status, 200);
  assert.deepEqual(after.body.map((event: any) => event.event_type), ['created','reassigned']);
  assert.equal((await call(fa, 'GET', `/leads/${created.body.id}/attribution-history`)).status, 404);
  assert.equal((await call(globalAdmin, 'POST', `/admin/leads/${created.body.id}/reassign`, {
    target_agent_id: fa.id, reason: 'short',
  })).status, 400);

  const activeLead = await call(fb, 'POST', '/leads', {
    lead_type: 'household', name: 'Contracted lead', phone: uniquePhone(),
  });
  assert.equal((await call(fb, 'POST', `/leads/${activeLead.body.id}/contracts`, { track: 'A', base_value: 100000 })).status, 201);
  assert.equal((await call(globalAdmin, 'POST', `/admin/leads/${activeLead.body.id}/reassign`, {
    target_agent_id: fa.id, reason: 'Attempt to move a converted lead for test',
  })).status, 409);
});

test('Agents can qualify or lose owned leads with reasons but cannot reopen terminal leads', async () => {
  const created = await call(fa, 'POST', '/leads', {
    lead_type: 'business', name: 'Status workflow test', phone: uniquePhone(),
  });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal((await call(fb, 'PATCH', `/leads/${id}/status`, {
    status: 'qualified', reason: 'The other agent does not own this lead',
  })).status, 404);
  assert.equal((await call(fa, 'PATCH', `/leads/${id}/status`, {
    status: 'qualified', reason: 'short',
  })).status, 400);
  const qualified = await call(fa, 'PATCH', `/leads/${id}/status`, {
    status: 'qualified', reason: 'Confirmed the prospect is ready for follow-up',
  });
  assert.equal(qualified.status, 200);
  assert.equal(qualified.body.status, 'qualified');
  const lost = await call(fa, 'PATCH', `/leads/${id}/status`, {
    status: 'lost', reason: 'Prospect declined after a follow-up discussion',
  });
  assert.equal(lost.status, 200);
  assert.equal(lost.body.status, 'lost');
  assert.equal((await call(fa, 'PATCH', `/leads/${id}/status`, {
    status: 'qualified', reason: 'Attempt to reopen a closed lead',
  })).status, 409);
});

test('Gate 8: agents cannot see each other\'s leads; master sees the downline', async () => {
  const ids = (r: any) => r.body.map((l: any) => l.id);
  assert.ok(ids(await call(fa, 'GET', '/leads')).includes(A.lead.id));
  assert.ok(!ids(await call(fb, 'GET', '/leads')).includes(A.lead.id));
  assert.ok(ids(await call(master, 'GET', '/leads')).includes(A.lead.id));
});

test('Gate 3: the same number written another way is still a duplicate', async () => {
  const alt = '0' + A.lead.phone.slice(4); // +251 7xxxxxxxx -> 07xxxxxxxx
  assert.equal((await call(fb, 'POST', '/leads', { lead_type: 'household', name: 'Copy again', phone: alt })).status, 409);
  assert.equal((await call(fb, 'POST', '/leads', { lead_type: 'household', name: 'Bad', phone: '12345' })).status, 400);
});

test('business rules are Global Admin-only, audited, validated, and applied to unsigned contracts', async () => {
  const settings = await call(globalAdmin, 'GET', '/business-rules');
  assert.equal(settings.status, 200);
  const oldRate = Number(settings.body.find((rule: any) => rule.key === 'A_onboarding_pct').value);
  assert.equal((await call(fa, 'GET', '/business-rules')).status, 403);
  assert.equal((await call(globalAdmin, 'PATCH', '/business-rules', { values: { A_onboarding_pct: 101 } })).status, 422);
  assert.equal((await call(globalAdmin, 'PATCH', '/business-rules', {
    values: {
      match_w_skills: 0, match_w_location: 0, match_w_availability: 0,
      match_w_experience: 0, match_w_rate: 0, match_w_language: 0,
    },
  })).status, 422);

  try {
    const updated = await call(globalAdmin, 'PATCH', '/business-rules', { values: { A_onboarding_pct: 21 } });
    assert.equal(updated.status, 200);
    const contract = (await call(fa, 'GET', '/contracts')).body.find((item: any) => item.id === A.contract.id);
    assert.equal(Number(contract.onboarding_amt), 21000);
    assert.ok((await db.query("SELECT 1 FROM audit_logs WHERE action = 'business_rules_updated' AND actor_id = $1", [globalAdmin.id])).rowCount);
  } finally {
    assert.equal((await call(globalAdmin, 'PATCH', '/business-rules', { values: { A_onboarding_pct: oldRate } })).status, 200);
  }

  const restored = (await call(fa, 'GET', '/contracts')).body.find((item: any) => item.id === A.contract.id);
  assert.equal(Number(restored.onboarding_amt), 20000);
});

test('public signup prices follow the current business rules', async () => {
  const [optionsResponse, rulesResponse] = await Promise.all([
    fetch(API + '/auth/signup/options'),
    call(globalAdmin, 'GET', '/business-rules'),
  ]);
  assert.equal(optionsResponse.status, 200);
  assert.equal(rulesResponse.status, 200);
  const options = await optionsResponse.json() as any;
  const rule = (key: string) => Number(rulesResponse.body.find((entry: any) => entry.key === key).value);
  assert.equal(options.plans.agent_pro_monthly_etb, rule('agent_pro_monthly_etb'));
  assert.equal(options.plans.agent_enterprise_monthly_etb, rule('agent_enterprise_monthly_etb'));
});

test('rule changes update contracts awaiting signature, not signed contracts, and invoice timing', async () => {
  const settings = await call(globalAdmin, 'GET', '/business-rules');
  const value = (key: string) => Number(settings.body.find((rule: any) => rule.key === key).value);
  const oldRate = value('A_onboarding_pct');
  const oldDueDays = value('invoice_due_days');
  const created = await newContract(fa, 'A', 3);
  const transition = (user: U, action: string) =>
    call(user, 'POST', `/contracts/${created.contract.id}/transition`, { action });

  try {
    assert.equal((await transition(fa, 'submit')).status, 200);
    assert.equal((await transition(compliance, 'verify_kyc')).status, 200);
    assert.equal((await transition(admin, 'approve')).status, 200);
    const awaitingSignature = await call(globalAdmin, 'PATCH', '/business-rules', {
      values: { A_onboarding_pct: 22, invoice_due_days: 3 },
    });
    assert.equal(awaitingSignature.status, 200);
    const unsigned = (await call(fa, 'GET', '/contracts')).body.find((item: any) => item.id === created.contract.id);
    assert.equal(unsigned.state, 'signature_pending');
    assert.equal(Number(unsigned.onboarding_amt), 22000);

    assert.equal((await callFile(admin, `/contracts/${created.contract.id}/documents?stage=company_countersigned`, PNG)).status, 409);
    assert.equal((await callFile(admin, `/contracts/${created.contract.id}/documents?stage=party_signed`, PNG)).status, 403);
    assert.equal((await callFile(fa, `/contracts/${created.contract.id}/documents?stage=party_signed`, PNG)).status, 201);
    assert.equal((await callFile(fa, `/contracts/${created.contract.id}/documents?stage=company_countersigned`, PNG)).status, 403);
    assert.equal((await callFile(admin, `/contracts/${created.contract.id}/documents?stage=company_countersigned`, PNG)).status, 201);
    assert.equal((await transition(admin, 'sign')).status, 200);
    const invoice = (await db.query(
      'SELECT (due_on - current_date)::int AS days_until_due FROM invoices WHERE contract_id = $1',
      [created.contract.id],
    )).rows[0];
    assert.equal(invoice.days_until_due, 3);

    assert.equal((await call(globalAdmin, 'PATCH', '/business-rules', {
      values: { A_onboarding_pct: 23 },
    })).status, 200);
    const signed = (await call(fa, 'GET', '/contracts')).body.find((item: any) => item.id === created.contract.id);
    assert.equal(signed.state, 'payment_pending');
    assert.equal(Number(signed.onboarding_amt), 22000);
  } finally {
    assert.equal((await call(globalAdmin, 'PATCH', '/business-rules', {
      values: { A_onboarding_pct: oldRate, invoice_due_days: oldDueDays },
    })).status, 200);
  }
});

test('login: the first typo after a lock has expired does not lock the account again', async () => {
  const u = await mkUser('finance', 8);
  await db.query("UPDATE users SET failed_logins = 5, locked_until = now() - interval '1 minute' WHERE id = $1", [u.id]);
  const login = (password: string) => fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: u.phone, password }) });
  assert.equal((await login('wrong-password')).status, 401);
  assert.equal((await login(PW)).status, 200); // used to be 429: the counter stayed at 5
});

test('login: a phone written with a leading 0 finds the same account', async () => {
  const u = await mkUser('finance', 9);
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '0' + u.phone.slice(4), password: PW }) });
  assert.equal(r.status, 200);
});

test('Track A fees are stored as separate amounts', () => {
  assert.equal(Number(A.contract.onboarding_amt), 20000);
  assert.equal(Number(A.contract.guarantee_amt), 2000);
  assert.equal(Number(A.contract.monthly_mgmt_amt), 5000);
});

test('Gate 5: steps are role-gated and cannot be skipped', async () => {
  const id = A.contract.id;
  assert.equal((await call(fa, 'POST', `/contracts/${id}/transition`, { action: 'approve' })).status, 403);
  assert.equal((await call(fin2, 'POST', `/contracts/${id}/transition`, { action: 'reconcile' })).status, 409);
});

test('Gate 6: payment must match the invoice; reconciler must differ from the recorder', async () => {
  const id = A.contract.id;
  const t = (u: U, action: string, body?: object) => call(u, 'POST', `/contracts/${id}/transition`, { action, ...body });
  await t(fa, 'submit'); await t(compliance, 'verify_kyc'); await t(admin, 'approve');
  assert.equal((await callFile(fa, `/contracts/${id}/documents?stage=party_signed`, PNG)).status, 201);
  assert.equal((await callFile(admin, `/contracts/${id}/documents?stage=company_countersigned`, PNG)).status, 201);
  await t(admin, 'sign');
  assert.equal((await t(fin1, 'record_payment', { channel: 'telebirr', reference: randomUUID(), amount: 26999 })).status, 422);
  assert.equal((await t(fin1, 'record_payment', { channel: 'telebirr', reference: randomUUID(), amount: 27000 })).status, 200);
  assert.equal((await t(fin1, 'reconcile')).status, 403);
  const done = await t(fin2, 'reconcile');
  assert.equal(done.status, 200);
  assert.equal(done.body.state, 'active');
});

let comm: any;
test('Gate 7: first contract creates a 50% commission excluding the guarantee', async () => {
  comm = (await call(admin, 'GET', '/commissions')).body.find((k: any) => k.contract_id === A.contract.id);
  assert.ok(comm);
  assert.equal(Number(comm.eligible_revenue), 25000);
  assert.equal(Number(comm.amount), 12500);
  assert.equal(comm.status, 'qualified');
});

test('Gate 7: four-eyes approval, then only Super Admin can pay', async () => {
  assert.equal((await call(fin2, 'POST', `/commissions/${comm.id}/approve`)).status, 403); // fin2 qualified it
  assert.equal((await call(fin1, 'POST', `/commissions/${comm.id}/approve`)).status, 200);
  assert.equal((await call(fin1, 'POST', `/commissions/${comm.id}/pay`, { reference: 'PAY-001' })).status, 403);
  const paid = await call(admin, 'POST', `/commissions/${comm.id}/pay`, { reference: 'PAY-001' });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.status, 'paid');
  assert.equal((await call(admin, 'POST', `/commissions/${comm.id}/pay`, { reference: 'PAY-002' })).status, 409);
});

test('Gate 6: every ledger transaction balances and entries cannot be changed', async () => {
  const bad = await db.query('SELECT txn_id FROM ledger_entries GROUP BY txn_id HAVING sum(debit) <> sum(credit)');
  assert.equal(bad.rowCount, 0);
  await assert.rejects(db.query('UPDATE ledger_entries SET debit = debit + 1 WHERE id = (SELECT min(id) FROM ledger_entries)'), /append-only/);
});

test('Gate 7: a lead cannot be converted twice, and a renewal earns no commission', async () => {
  assert.equal((await call(fa, 'POST', `/leads/${A.lead.id}/contracts`, { track: 'A', base_value: 1000 })).status, 409);
  const ren = await call(admin, 'POST', `/contracts/${A.contract.id}/renew`);
  assert.equal(ren.status, 201);
  assert.equal(ren.body.is_renewal, true);
  const done = await drive(fa, ren.body.id, 27000);
  assert.equal(done.state, 'active');
  const forLead = (await call(admin, 'GET', '/commissions')).body.filter((k: any) => k.lead_id === A.lead.id);
  assert.equal(forLead.length, 1);
});

test('Track B: 10% + 10% agency revenue, commission is 50% of it', async () => {
  const B = await newContract(fb, 'B', 2);
  assert.equal(Number(B.contract.employer_fee_amt), 10000);
  assert.equal(Number(B.contract.other_fee_amt), 10000);
  await drive(fb, B.contract.id, 20000);
  const k = (await call(admin, 'GET', '/commissions')).body.find((x: any) => x.contract_id === B.contract.id);
  assert.equal(Number(k.amount), 10000);
});

test('lease defaults and maximum duration follow business rules', async () => {
  const settings = await call(globalAdmin, 'GET', '/business-rules');
  const oldDueDay = Number(settings.body.find((rule: any) => rule.key === 'lease_default_due_day').value);
  const oldMinMonths = Number(settings.body.find((rule: any) => rule.key === 'lease_min_term_months').value);
  const oldMaxMonths = Number(settings.body.find((rule: any) => rule.key === 'lease_max_months').value);
  try {
    assert.equal((await call(globalAdmin, 'PATCH', '/business-rules', {
      values: { lease_default_due_day: 12, lease_min_term_months: 1, lease_max_months: 2 },
    })).status, 200);
    const property = await call(fa, 'POST', '/properties', {
      address: `Rule test property ${run}`,
      ptype: 'apartment_building',
      territory_id: tid,
      units: [{ unit_no: `R${run}`, rent: 15000 }],
    });
    assert.equal(property.status, 201);
    const unit = (await db.query('SELECT id FROM property_units WHERE property_id = $1', [property.body.id])).rows[0];
    const tenant = await call(fa, 'POST', '/tenants', {
      name: 'Rule Test Tenant',
      phone: `+2517${run}0`,
    });
    assert.equal(tenant.status, 201);
    const lease = {
      unit_id: unit.id,
      tenant_id: tenant.body.id,
      rent: 15000,
      start_date: '2030-01-01',
      months: 24,
    };
    assert.equal((await call(fa, 'POST', '/leases', lease)).status, 422);
    const created = await call(fa, 'POST', '/leases', { ...lease, months: 2 });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'active');
    const leaseEvidence = await db.query(
      'SELECT snapshot FROM lease_versions WHERE lease_id=$1 AND version=1',
      [created.body.id],
    );
    assert.equal(leaseEvidence.rows[0].snapshot.legacy_immediate_active_path, true);
    assert.equal(leaseEvidence.rows[0].snapshot.signature_evidence_available, false);
    const charges = await db.query(
      'SELECT due_on::text FROM rent_charges WHERE lease_id = $1 ORDER BY period',
      [created.body.id],
    );
    assert.deepEqual(charges.rows.map((charge) => charge.due_on), ['2030-01-12', '2030-02-12']);
  } finally {
    assert.equal((await call(globalAdmin, 'PATCH', '/business-rules', {
      values: { lease_default_due_day: oldDueDay, lease_min_term_months: oldMinMonths, lease_max_months: oldMaxMonths },
    })).status, 200);
  }
});

test('opt-in lease lifecycle requires independent approval, signature evidence, and handover before activation', async () => {
  const property = await call(fa, 'POST', '/properties', {
    address: `Workflow test property ${run}`,
    ptype: 'apartment_building',
    territory_id: tid,
    units: [{ unit_no: `W${run}`, rent: 12000 }],
  });
  assert.equal(property.status, 201);
  const unit = (await db.query('SELECT id FROM property_units WHERE property_id=$1', [property.body.id])).rows[0];
  const tenant = await call(fa, 'POST', '/tenants', {
    name: 'Workflow Test Tenant',
    phone: `+2517${run}1`,
  });
  assert.equal(tenant.status, 201);
  const lease = await call(fa, 'POST', '/leases/workflow', {
    unit_id: unit.id,
    tenant_id: tenant.body.id,
    rent: 12000,
    deposit: 24000,
    start_date: '2031-01-01',
    months: 24,
  });
  assert.equal(lease.status, 201, JSON.stringify(lease.body));
  assert.equal(lease.body.status, 'draft');
  assert.equal((await db.query('SELECT occupancy FROM property_units WHERE id=$1', [unit.id])).rows[0].occupancy, 'vacant');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM rent_charges WHERE lease_id=$1', [lease.body.id])).rows[0].count, 0);

  const reason = 'Terms reviewed for workflow UAT.';
  assert.equal((await call(fa, 'POST', `/leases/${lease.body.id}/submit-for-approval`, { reason })).status, 200);
  assert.equal((await call(fa, 'POST', `/leases/${lease.body.id}/approve`, { reason })).status, 403);
  const approved = await call(compliance, 'POST', `/leases/${lease.body.id}/approve`, { reason });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.status, 'pending_signature');

  const handover = { reason, handover_date: '2031-01-01', move_in_inspection_completed: true };
  assert.equal((await call(learningManager, 'POST', `/leases/${lease.body.id}/execute`, handover)).status, 409);
  let signatureDocumentId: string | undefined;
  for (const party of ['tenant', 'owner']) {
    const uploaded = await callFile(
      fa,
      `/leases/${lease.body.id}/signature-documents?party=${party}&signer_name=${encodeURIComponent(party === 'tenant' ? tenant.body.name : 'Workflow Property Owner')}`,
      PNG,
    );
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.signature_evidence_only, true);
    signatureDocumentId ??= uploaded.body.id;
  }
  assert.ok(signatureDocumentId);
  const signatureDownload = await fetch(`${API}/lease-signature-documents/${signatureDocumentId}/file`, {
    headers: { authorization: `Bearer ${fa.token}` },
  });
  assert.equal(signatureDownload.status, 200);
  assert.deepEqual(Buffer.from(await signatureDownload.arrayBuffer()), PNG);
  const downloadAudit = await db.query(
    `SELECT id FROM audit_logs
     WHERE actor_id=$1 AND action='lease_signature_evidence_downloaded'
       AND entity='lease' AND entity_id=$2
       AND new_value->>'document_id'=$3`,
    [fa.id, lease.body.id, signatureDocumentId],
  );
  assert.equal(downloadAudit.rowCount, 1, 'Lease signature evidence download must be auditable');
  assert.equal((await call(compliance, 'POST', `/leases/${lease.body.id}/execute`, handover)).status, 403);
  const executed = await call(learningManager, 'POST', `/leases/${lease.body.id}/execute`, handover);
  assert.equal(executed.status, 200, JSON.stringify(executed.body));
  assert.equal(executed.body.lease.status, 'active');
  assert.match(executed.body.lease.execution_hash, /^[0-9a-f]{64}$/);
  assert.equal(executed.body.signature_evidence_only, true);
  assert.equal((await db.query('SELECT occupancy FROM property_units WHERE id=$1', [unit.id])).rows[0].occupancy, 'occupied');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM rent_charges WHERE lease_id=$1', [lease.body.id])).rows[0].count, 24);
  const notice = {
    idempotency_key: randomUUID(),
    notice_type: 'tenant_to_owner',
    received_on: new Date().toISOString().slice(0, 10),
    proposed_effective_on: '2032-01-01',
    summary: 'Tenant reported an intended move-out date for review.',
  };
  assert.equal((await call(compliance, 'POST', `/leases/${lease.body.id}/notices`, notice)).status, 403);
  const recordedNotice = await call(fa, 'POST', `/leases/${lease.body.id}/notices`, notice);
  assert.equal(recordedNotice.status, 201, JSON.stringify(recordedNotice.body));
  assert.equal(recordedNotice.body.legal_effect, 'record_only');
  assert.match(recordedNotice.body.notice_disclaimer, /does not verify service/);
  assert.equal((await call(fa, 'POST', `/leases/${lease.body.id}/notices`, notice)).status, 200);
  assert.equal((await call(fa, 'POST', `/leases/${lease.body.id}/notices`, {
    ...notice, summary: 'Changed content reusing the original request key.',
  })).status, 409);
  const notices = await call(fa, 'GET', `/leases/${lease.body.id}/notices`);
  assert.equal(notices.status, 200);
  assert.equal(notices.body.length, 1);
  const leaseSummary = await call(fa, 'GET', '/leases');
  const leaseSummaryRow = leaseSummary.body.find((row: any) => row.id === lease.body.id);
  assert.equal(leaseSummaryRow.notice_type, 'tenant_to_owner');
  assert.equal(leaseSummaryRow.proposed_effective_on, '2032-01-01');
  assert.equal((await db.query('SELECT status FROM leases WHERE id=$1', [lease.body.id])).rows[0].status, 'active');
  await assert.rejects(
    db.query('UPDATE lease_notices SET summary=$2 WHERE id=$1', [recordedNotice.body.notice.id, 'Tampered notice summary']),
    /Lease notice records are append-only/,
  );
  await assert.rejects(
    db.query('UPDATE leases SET rent=rent+1 WHERE id=$1', [lease.body.id]),
    /Versioned lease terms are immutable/,
  );
});

test('owner rent statement CSV is scoped and reconciled totals match recorded evidence', async () => {
  const owner = await mkUser('property_owner', 120);
  const property = await call(fa, 'POST', '/properties', {
    address: `Owner statement acceptance ${run}`,
    ptype: 'apartment_building',
    territory_id: tid,
    units: [{ unit_no: `OS${run}`, rent: 15000 }],
  });
  assert.equal(property.status, 201, JSON.stringify(property.body));
  const unit = (await db.query('SELECT id FROM property_units WHERE property_id=$1', [property.body.id])).rows[0];
  const tenant = await call(fa, 'POST', '/tenants', {
    name: `Owner Statement Tenant ${run}`,
    phone: uniquePhone(),
  });
  assert.equal(tenant.status, 201, JSON.stringify(tenant.body));
  const lease = await call(fa, 'POST', '/leases', {
    unit_id: unit.id,
    tenant_id: tenant.body.id,
    rent: 15000,
    deposit: 30000,
    start_date: '2032-01-01',
    months: 24,
  });
  assert.equal(lease.status, 201, JSON.stringify(lease.body));
  await db.query(
    'UPDATE properties SET owner_user_id=$2,source_agent_id=NULL,created_by=$2 WHERE id=$1',
    [property.body.id, owner.id],
  );
  const charges = (await db.query(
    'SELECT id,amount FROM rent_charges WHERE lease_id=$1 ORDER BY period',
    [lease.body.id],
  )).rows;
  assert.equal(charges.length, 24);
  const firstPayment = await call(fa, 'POST', `/charges/${charges[0].id}/pay`, {
    reference: `owner-statement-reconciled-${run}`,
    channel: 'manual',
  });
  const secondPayment = await call(fa, 'POST', `/charges/${charges[1].id}/pay`, {
    reference: `owner-statement-pending-${run}`,
    channel: 'manual',
  });
  assert.equal(firstPayment.status, 200, JSON.stringify(firstPayment.body));
  assert.equal(secondPayment.status, 200, JSON.stringify(secondPayment.body));
  assert.equal((await call(fin2, 'POST', `/rent-transactions/${firstPayment.body.id}/reconcile`, {})).status, 200);

  const json = await call(owner, 'GET', '/owner/statements');
  assert.equal(json.status, 200, JSON.stringify(json.body));
  assert.equal(json.body.statements.length, 1);
  assert.equal(Number(json.body.statements[0].rent_charged), 360000);
  assert.equal(Number(json.body.statements[0].rent_reconciled), 15000);
  assert.equal(Number(json.body.statements[0].rent_pending_reconciliation), 15000);
  assert.match(json.body.note, /not a payout/);

  const csv = await fetch(`${API}/owner/statements?format=csv`, {
    headers: { authorization: `Bearer ${owner.token}` },
  });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type') ?? '', /text\/csv/);
  const csvText = await csv.text();
  assert.match(csvText, /rent_reconciled/);
  assert.match(csvText, /owner statement acceptance/i);
  assert.equal((await call(fa, 'GET', '/owner/statements')).status, 403);

  const chart = await call(fin1, 'GET', '/finance/property-chart-of-accounts-template');
  assert.equal(chart.status, 200);
  assert.equal(chart.body.status, 'draft_requires_finance_signoff');
  const close = await call(fin1, 'GET', '/finance/property-period-close?period=2032-03');
  assert.equal(close.status, 200, JSON.stringify(close.body));
  assert.ok(close.body.unpaid_rent_charges >= 1);
  assert.equal(close.body.ready_for_finance_review, false);
  assert.equal(close.body.evidence_only, true);
});

test('service identity inventory requires independent administrators for rotation and retirement', async () => {
  const created = await call(globalAdmin, 'POST', '/service-identities', {
    name: `staging-recon-${run}`,
    purpose: 'Staging ledger reconciliation test identity',
    environment: 'staging',
    secret_manager_reference: `vault://afrolife/test/${run}`,
    evidence: 'Approved staging service identity inventory entry.',
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal((await call(globalAdmin, 'POST', `/service-identities/${created.body.id}/rotate`, {
    secret_manager_reference: `vault://afrolife/test/${run}/rotated`,
    expiry_date: '2030-01-01',
    evidence: 'Rotated in the staging secret manager and independently verified.',
  })).status, 403);
  const rotated = await call(admin, 'POST', `/service-identities/${created.body.id}/rotate`, {
    secret_manager_reference: `vault://afrolife/test/${run}/rotated`,
    expiry_date: '2030-01-01',
    evidence: 'Rotated in the staging secret manager and independently verified.',
  });
  assert.equal(rotated.status, 200, JSON.stringify(rotated.body));
  assert.equal(rotated.body.status, 'active');
  assert.equal(rotated.body.last_rotated_by, admin.id);
  const retired = await call(admin, 'POST', `/service-identities/${created.body.id}/retire`, {
    evidence: 'Staging identity retired after test completion.',
  });
  assert.equal(retired.status, 200, JSON.stringify(retired.body));
  assert.equal(retired.body.status, 'retired');
  const events = await call(globalAdmin, 'GET', `/service-identities/${created.body.id}/events`);
  assert.equal(events.status, 200);
  assert.deepEqual(events.body.map((event: any) => event.action).reverse(), ['created','rotated','retired']);

  const approval = await call(fin1, 'POST', `/releases/v7-finance-acceptance-${run}/approve`, {
    decision: 'approve',
    notes: 'Finance reviewed the property ledger and reconciliation evidence.',
  });
  assert.equal(approval.status, 201, JSON.stringify(approval.body));
  assert.equal(approval.body.approver_role, 'finance');
  assert.equal(approval.body.approver_name, 'finance-3');
  const globalAdminApproval = await call(globalAdmin, 'POST', `/releases/v7-global-admin-acceptance-${run}/approve`, {
    decision: 'approve',
    notes: 'Global administration reviewed this release evidence.',
  });
  assert.equal(globalAdminApproval.status, 201, JSON.stringify(globalAdminApproval.body));
  assert.equal(globalAdminApproval.body.approver_role, 'global_admin');
});

test('readiness evidence is persisted, attributed, and restricted to platform administrators', async () => {
  const forbidden = await call(learningCustomer, 'POST', '/readiness-evidence', {
    module: 'workforce',
    category: 'operations',
    status: 'evidence_recorded',
    owner_name: 'Workforce Operations',
    approver_name: 'Workforce Lead',
    evidence_reference: `ops-evidence-${run}`,
    environment: 'staging',
    notes: 'Synthetic workforce acceptance evidence.',
  });
  assert.equal(forbidden.status, 403);

  const recorded = await call(globalAdmin, 'POST', '/readiness-evidence', {
    module: 'workforce',
    category: 'operations',
    status: 'evidence_recorded',
    owner_name: 'Workforce Operations',
    approver_name: 'Workforce Lead',
    evidence_reference: `ops-evidence-${run}`,
    environment: 'staging',
    notes: 'Synthetic workforce acceptance evidence.',
  });
  assert.equal(recorded.status, 201, JSON.stringify(recorded.body));
  assert.equal(recorded.body.module, 'workforce');
  assert.equal(recorded.body.recorded_by_role, 'global_admin');

  const listed = await call(admin, 'GET', '/readiness-evidence');
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  assert.ok(listed.body.some((entry: any) =>
    entry.id === recorded.body.id && entry.recorded_by_name === 'global_admin-10',
  ));

  const invalid = await call(admin, 'POST', '/readiness-evidence', {
    module: 'unknown',
    category: 'operations',
    status: 'evidence_recorded',
    owner_name: 'Workforce Operations',
    approver_name: 'Workforce Lead',
    evidence_reference: `ops-evidence-invalid-${run}`,
    environment: 'staging',
  });
  assert.equal(invalid.status, 400);
});

test('Insurance brokerage sandbox runs a synthetic, scoped and production-locked lifecycle', {
  skip: process.env.INSURANCE_BROKERAGE_MODE !== 'sandbox' || process.env.NODE_ENV === 'production',
}, async () => {
  const organizationId = '00000000-0000-4000-8000-000000000002';
  for (const staff of [compliance, fin2]) {
    await db.query(
      `INSERT INTO insurance_ledger_staff (user_id, organization_id, role, assigned_by)
       VALUES ($1,$2,$3,$4)`,
      [staff.id, organizationId, staff.role === 'compliance' ? 'compliance' : 'finance_manager', admin.id],
    );
  }

  const features = await call(admin, 'GET', '/features');
  assert.equal(features.status, 200);
  assert.equal(features.body.insuranceBrokerageSandboxEnabled, true);
  assert.equal((await call(master, 'GET', '/insurance/brokerage-sandbox/status')).status, 403);

  const unacknowledged = await call(compliance, 'POST', '/insurance/brokerage-sandbox/cases', {});
  assert.equal(unacknowledged.status, 400);
  const created = await call(compliance, 'POST', '/insurance/brokerage-sandbox/cases', {
    acknowledge_synthetic_only: true,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const otherStaffCases = await call(fin2, 'GET', '/insurance/brokerage-sandbox/cases/mine');
  assert.equal(otherStaffCases.status, 200);
  assert.equal(otherStaffCases.body.some((item: any) => item.id === created.body.id), false);
  assert.equal((await call(fin2, 'GET', `/insurance/brokerage-sandbox/cases/${created.body.id}/events`)).status, 404);

  const runId = randomUUID();
  const quoteInput = {
    scenario_run_id: runId,
    product_key: 'demo-household-a',
    term_months: 12,
    acknowledge_synthetic_only: true,
  };
  const prematureQuote = await call(compliance, 'POST', `/insurance/brokerage-sandbox/cases/${created.body.id}/quotes`, quoteInput);
  assert.equal(prematureQuote.status, 409);
  const prematureComparison = await call(compliance, 'GET', `/insurance/brokerage-sandbox/cases/${created.body.id}/comparison?category=household`);
  assert.equal(prematureComparison.status, 409);

  const demo = await call(compliance, 'POST', `/insurance/brokerage-sandbox/cases/${created.body.id}/run-demo`, {
    scenario_run_id: runId,
    acknowledge_synthetic_only: true,
  });
  assert.equal(demo.status, 201, JSON.stringify(demo.body));
  assert.equal(demo.body.events.length, 22);
  assert.equal(demo.body.events.some((event: any) =>
    event.event_type === 'claim_decision_simulated' && event.event_data.legal_effect === 'NONE',
  ), true);
  const repeatedDemo = await call(compliance, 'POST', `/insurance/brokerage-sandbox/cases/${created.body.id}/run-demo`, {
    scenario_run_id: runId,
    acknowledge_synthetic_only: true,
  });
  assert.equal(repeatedDemo.status, 201);
  assert.equal(repeatedDemo.body.events.length, 22);
  const eventTrace = await call(compliance, 'GET', `/insurance/brokerage-sandbox/cases/${created.body.id}/events`);
  assert.equal(eventTrace.status, 200);
  assert.equal(eventTrace.body.length, 22);
  assert.equal(eventTrace.body.every((event: any) => event.scenario_run_id === runId), true);

  const comparison = await call(compliance, 'GET', `/insurance/brokerage-sandbox/cases/${created.body.id}/comparison?category=household`);
  assert.equal(comparison.status, 200, JSON.stringify(comparison.body));
  assert.equal(comparison.body.products.length, 2);
  assert.equal(comparison.body.products.every((item: any) => item.category === 'household'), true);
  assert.equal((await call(compliance, 'GET', `/insurance/brokerage-sandbox/cases/${created.body.id}/comparison?category=life`)).status, 409);

  const mismatchedQuote = await call(compliance, 'POST', `/insurance/brokerage-sandbox/cases/${created.body.id}/quotes`, {
    ...quoteInput,
    product_key: 'demo-life-a',
  });
  assert.equal(mismatchedQuote.status, 409);
  const quote = await call(compliance, 'POST', `/insurance/brokerage-sandbox/cases/${created.body.id}/quotes`, quoteInput);
  assert.equal(quote.status, 201, JSON.stringify(quote.body));
  assert.equal(quote.body.quote.event_data.quote_state, 'SYNTHETIC_NOT_AN_OFFER', JSON.stringify(quote.body));
  const repeatedQuote = await call(compliance, 'POST', `/insurance/brokerage-sandbox/cases/${created.body.id}/quotes`, quoteInput);
  assert.equal(repeatedQuote.body.quote.id, quote.body.quote.id);
  const conflictingQuote = await call(compliance, 'POST', `/insurance/brokerage-sandbox/cases/${created.body.id}/quotes`, {
    ...quoteInput,
    product_key: 'demo-household-b',
  });
  assert.equal(conflictingQuote.status, 409);
  assert.equal((await call(fin2, 'POST', `/insurance/brokerage-sandbox/cases/${created.body.id}/quotes`, quoteInput)).status, 404);
  const finalTrace = await call(compliance, 'GET', `/insurance/brokerage-sandbox/cases/${created.body.id}/events`);
  assert.equal(finalTrace.body.filter((event: any) => event.event_type === 'quote_generated_simulated').length, 1);

  await assert.rejects(
    db.query('UPDATE insurance_brokerage_sandbox_events SET event_data=$1 WHERE id=$2', [{ tampered: true }, eventTrace.body[0].id]),
    /append-only/i,
  );
  const activation = await call(admin, 'POST', '/insurance/brokerage-sandbox/production-activation', {});
  assert.equal(activation.status, 423);
  assert.equal(activation.body.enabled, false);
});

test.after(() => db.end());

test('manual service subscriptions enforce fixed catalog, ownership, and independent Finance review', async () => {
  const catalog = await call(learningCustomer, 'GET', '/subscriptions/catalog');
  assert.equal(catalog.status, 200);
  assert.deepEqual(catalog.body.services.map((service: any) => service.key), [
    'accounting',
    'property_management', 'workforce_management', 'super_agent', 'edir',
    'insurance_brokerage', 'agent', 'landlord', 'seller',
  ]);
  assert.equal(catalog.body.services.every((service: any) =>
    service.monthly_fee === 1000 && service.currency === 'ETB' && service.payment_method === 'manual'), true);
  assert.equal((await call(learningCustomer, 'GET', '/subscriptions/review')).status, 403);
  const accountingRequest = await call(learningCustomer, 'POST', '/subscriptions/requests', {
    services: ['accounting'],
  });
  assert.equal(accountingRequest.status, 201, JSON.stringify(accountingRequest.body));
  assert.equal(accountingRequest.body.requests[0].service_key, 'accounting');
  assert.equal((await call(learningCustomer, 'POST', '/subscriptions/requests', {
    services: ['edir', 'edir'],
  })).status, 400);

  const created = await call(learningCustomer, 'POST', '/subscriptions/requests', {
    services: ['seller'],
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const subscription = created.body.requests[0];
  assert.equal(subscription.monthly_fee, '1000.00');
  assert.equal(subscription.status, 'requested');
  const paymentReference = `TEST-${randomUUID()}`;
  const submitted = await call(learningCustomer, 'POST',
    `/subscriptions/${subscription.id}/payment-reference`, { payment_reference: paymentReference });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  assert.equal(submitted.body.request.status, 'payment_review');

  const ownerReview = await call(learningCustomer, 'POST', `/subscriptions/review/${subscription.id}`, {
    decision: 'reject',
    reason: 'The payment reference needs independent verification.',
  });
  assert.equal(ownerReview.status, 403);
  const queue = await call(fin1, 'GET', '/subscriptions/review');
  assert.equal(queue.status, 200, JSON.stringify(queue.body));
  assert.equal(queue.body.requests.some((item: any) => item.id === subscription.id), true);

  const rejected = await call(fin1, 'POST', `/subscriptions/review/${subscription.id}`, {
    decision: 'reject',
    reason: 'The payment could not be matched to the submitted reference.',
  });
  assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
  assert.equal(rejected.body.request.status, 'rejected');
  const mine = await call(learningCustomer, 'GET', '/subscriptions/mine');
  assert.equal(mine.status, 200);
  assert.equal(mine.body.requests.find((item: any) => item.id === subscription.id).payment_reference, paymentReference);
  const otherOwnerRequest = await call(learningManager, 'POST', '/subscriptions/requests', {
    services: ['seller'],
  });
  assert.equal(otherOwnerRequest.status, 201, JSON.stringify(otherOwnerRequest.body));
  const duplicateReference = await call(learningManager, 'POST',
    `/subscriptions/${otherOwnerRequest.body.requests[0].id}/payment-reference`,
    { payment_reference: paymentReference.toLowerCase() });
  assert.equal(duplicateReference.status, 409);
});
