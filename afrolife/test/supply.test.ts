import '../src/env.js';

// Integration tests use TEST_DATABASE_URL for fixture setup; the API runs with the
// restricted DATABASE_URL role so the HTTP requests exercise row-level security.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const API = (process.env.API_URL ?? 'http://localhost:3010') + '/api/v1';
const SECRET = process.env.JWT_SECRET!;
const platformTenantId = process.env.MFI_PLATFORM_TENANT_ID;
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL must explicitly point to a disposable integration-test database');
const testDatabaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\/+/, ''));
if (!/^(?:test[_-]|afrolife[_-]test(?:[_-]|$))/i.test(testDatabaseName)) {
  throw new Error('TEST_DATABASE_URL must target a database named test_* or afrolife_test*; refusing to modify a normal application database');
}
const db = new pg.Pool({ connectionString: testDatabaseUrl });
const propertyTenantId = (await db.query(
  "SELECT id FROM property_operating_tenants WHERE tenant_key='legacy-property-operations'",
)).rows[0]?.id as string | undefined;
if (!propertyTenantId) throw new Error('The legacy property tenant must exist before supply tests run');
const run = Date.now().toString().slice(-7);
const SECTOR = 'domestic-' + run; // unique per run so candidate lists are not polluted by other data
const SHA = 'a'.repeat(64);

type U = { id: string; role: string; token: string; propertyTenantId?: string };
const propertyTenantRoles: Record<string, string> = {
  super_admin: 'tenant_admin',
  corporate_business_manager: 'tenant_admin',
  finance: 'tenant_accountant',
  finance_manager: 'tenant_accountant',
  master_agent: 'master_agent',
  field_agent: 'field_agent',
  customer: 'resident',
  property_owner: 'owner',
};
let propertyTenantAssigner: string | undefined;

async function mkUser(role: string, n: number): Promise<U> {
  const r = await db.query(
    "INSERT INTO users (legal_name, phone, role, kyc_status, active, password_hash) VALUES ($1,$2,$3,'verified',true,$4) RETURNING id",
    [`${role}-${n}`, `+2517${run}${n}`, role, bcrypt.hashSync('Passw0rd!test', 4)],
  );
  const id = r.rows[0].id as string;
  const propertyRole = propertyTenantRoles[role];
  if (propertyRole) {
    await db.query(
      `INSERT INTO property_operating_tenant_members(tenant_system_id,user_id,tenant_role,status,assigned_by)
       VALUES($1,$2,$3,'active',$4)`,
      [propertyTenantId, id, propertyRole, propertyTenantAssigner ?? id],
    );
    if (role === 'super_admin') propertyTenantAssigner ??= id;
  }
  const sessionId = randomUUID();
  await db.query('INSERT INTO auth_sessions (id,user_id,expires_at) VALUES ($1,$2,now()+interval \'30 days\')', [sessionId, id]);
  if (role === 'super_admin' && platformTenantId) {
    await db.query(
      'INSERT INTO platform_tenant_admins(tenant_id,user_id,assigned_by) VALUES($1,$2,$2)',
      [platformTenantId, id],
    );
  }
  return {
    id,
    role,
    token: jwt.sign({ sub: id, role, sid: sessionId }, SECRET, { expiresIn: '30d' }),
    ...(propertyRole ? { propertyTenantId } : {}),
  };
}

async function call(u: U, method: string, path: string, body?: unknown) {
  const r = await fetch(API + path, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + u.token,
      ...(platformTenantId ? { 'x-afrolife-platform-tenant-id': platformTenantId } : {}),
      ...(u.propertyTenantId ? { 'x-afrolife-property-tenant-id': u.propertyTenantId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}

async function withPropertyTenantFixture<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    assert.ok(propertyTenantAssigner, 'The property tenant fixture requires its assigned tenant administrator');
    await client.query(
      `SELECT set_config('app.user_id',$1,true),
              set_config('app.role','super_admin',true),
              set_config('app.property_tenant_system_id',$2,true)`,
      [propertyTenantAssigner, propertyTenantId],
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ---- Setup: two sibling areas under one parent; admin, compliance, master, two field agents ----
const parent = Number((await db.query("INSERT INTO territories (level, name) VALUES ('city', $1) RETURNING id", ['P' + run])).rows[0].id);
const areaA = Number((await db.query("INSERT INTO territories (parent_id, level, name) VALUES ($1,'sub_city',$2) RETURNING id", [parent, 'A' + run])).rows[0].id);
const admin = await mkUser('super_admin', 1);
const globalAdmin = await mkUser('global_admin', 12);
const propertyReviewer = await mkUser('corporate_business_manager', 13);
const compliance = await mkUser('compliance', 2);
const complianceAlt = await mkUser('compliance', 8);
const master = await mkUser('master_agent', 3);
const fa = await mkUser('field_agent', 4);
const fb = await mkUser('field_agent', 5);
const finance = await mkUser('finance', 6);
const propertyOwner = await mkUser('property_owner', 9);
const otherPropertyOwner = await mkUser('property_owner', 10);
const buyer = await mkUser('customer', 11);
await db.query("INSERT INTO agents (id, agent_type, parent_id, territory_id) VALUES ($1,'master',NULL,$2)", [master.id, areaA]);
for (const f of [fa, fb]) await db.query("INSERT INTO agents (id, agent_type, parent_id, territory_id) VALUES ($1,'field',$2,$3)", [f.id, master.id, areaA]);

const workerBody = (n: number, extra: object = {}) => ({
  name: 'Worker ' + n, phone: `+2511${run}${n}`, national_id: `ID${run}${n}`, sector: SECTOR,
  skills: ['cooking', 'cleaning'], languages: ['amharic'], experience_years: 5, rate_expected: 9000, territory_id: areaA, ...extra,
});
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('test-image-' + run)]);
async function upload(agent: U, workerId: string, doc_type: string, extra: Record<string, string> = {}, body: Buffer = PNG) {
  const qs = new URLSearchParams({ doc_type, ...extra });
  const r = await fetch(`${API}/workers/${workerId}/documents/upload?${qs}`, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + agent.token, 'content-type': 'application/octet-stream' },
    body: new Uint8Array(body),
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}

let w1: any, w2: any, w3: any, request: any, match: any;

test('workers: created by an agent; duplicate phone or national ID is rejected', async () => {
  const r = await call(fa, 'POST', '/workers', workerBody(1));
  assert.equal(r.status, 201);
  assert.equal('national_id' in r.body, false);
  w1 = r.body;
  assert.equal(w1.verification, 'uploaded');
  assert.equal((await call(fb, 'POST', '/workers', workerBody(2, { phone: w1.phone }))).status, 409);
  assert.equal((await call(fb, 'POST', '/workers', workerBody(3, { national_id: workerBody(1).national_id }))).status, 409);
  assert.equal((await call(fa, 'POST', '/workers', workerBody(4, { skills: Array(51).fill('skill') }))).status, 400);
});

test('data isolation: another agent cannot see the worker; the master can', async () => {
  const ids = (r: any) => r.body.map((w: any) => w.id);
  assert.ok(!ids(await call(fb, 'GET', '/workers')).includes(w1.id));
  const visible = await call(master, 'GET', '/workers');
  assert.ok(ids(visible).includes(w1.id));
  assert.equal(visible.body.find((w: any) => w.id === w1.id).national_id, undefined);
  assert.equal((await upload(fb, w1.id, 'national_id')).status, 404);
});

test('verification: refused without verified documents; uploading is not verification', async () => {
  const none = await call(compliance, 'POST', `/workers/${w1.id}/verify`);
  assert.equal(none.status, 409);
  assert.match(none.body.error, /national_id/);
  const d1 = await upload(fa, w1.id, 'national_id');
  const d2 = await upload(fa, w1.id, 'police_clearance');
  const d3 = await upload(compliance, w1.id, 'reference');
  assert.equal(d1.status, 201);
  assert.equal(d2.status, 201);
  assert.equal(d3.status, 201);
  assert.equal((await call(compliance, 'POST', `/workers/${w1.id}/verify`)).status, 409); // still only uploaded
  assert.equal((await call(fa, 'POST', `/documents/${d1.body.id}/review`, { decision: 'verified' })).status, 403);
  for (const d of [d1, d2]) assert.equal((await call(compliance, 'POST', `/documents/${d.body.id}/review`, { decision: 'verified' })).status, 200);
  assert.equal((await call(compliance, 'POST', `/documents/${d3.body.id}/review`, { decision: 'verified' })).status, 403);
  assert.equal((await call(complianceAlt, 'POST', `/documents/${d3.body.id}/review`, { decision: 'verified' })).status, 200);
  assert.equal((await call(compliance, 'POST', `/documents/${d1.body.id}/review`, {
    decision: 'rejected', note: 'This document has already been reviewed.',
  })).status, 409); // already reviewed
  const ok = await call(compliance, 'POST', `/workers/${w1.id}/verify`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.verification, 'verified');
  assert.equal('national_id' in ok.body, false);
});

test('worker document rejection requires and exposes corrective feedback', async () => {
  const worker = await call(fa, 'POST', '/workers', workerBody(8));
  assert.equal(worker.status, 201);
  const document = await upload(fa, worker.body.id, 'national_id');
  assert.equal(document.status, 201);

  assert.equal((await call(compliance, 'POST', `/documents/${document.body.id}/review`, {
    decision: 'rejected',
  })).status, 422);
  assert.equal((await call(compliance, 'POST', `/documents/${document.body.id}/review`, {
    decision: 'rejected', note: 'No',
  })).status, 400);

  const note = 'The identity image is blurred; upload a clearer copy.';
  const rejected = await call(compliance, 'POST', `/documents/${document.body.id}/review`, {
    decision: 'rejected', note,
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.review_note, note);

  const history = await call(fa, 'GET', `/workers/${worker.body.id}/documents`);
  assert.equal(history.status, 200);
  assert.equal(history.body.find((entry: any) => entry.id === document.body.id).review_note, note);
});

test('verification: an expired police clearance does not count', async () => {
  w2 = (await call(fa, 'POST', '/workers', workerBody(2))).body;
  const d1 = await upload(fa, w2.id, 'national_id');
  const d2 = await upload(fa, w2.id, 'police_clearance', { expires_on: '2020-01-01' });
  for (const d of [d1, d2]) await call(compliance, 'POST', `/documents/${d.body.id}/review`, { decision: 'verified' });
  const r = await call(compliance, 'POST', `/workers/${w2.id}/verify`);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /police_clearance/);
});

test('worker directory marks a verified profile as expired when required evidence lapses', async () => {
  const worker = (await call(fa, 'POST', '/workers', workerBody(9))).body;
  const nationalId = await upload(fa, worker.id, 'national_id');
  const clearance = await upload(fa, worker.id, 'police_clearance');
  for (const document of [nationalId, clearance]) {
    assert.equal(document.status, 201);
    assert.equal((await call(compliance, 'POST', `/documents/${document.body.id}/review`, { decision: 'verified' })).status, 200);
  }
  assert.equal((await call(compliance, 'POST', `/workers/${worker.id}/verify`)).status, 200);
  await db.query("UPDATE documents SET expires_on=current_date-1 WHERE id=$1", [clearance.body.id]);
  const listedWorker = (await call(fa, 'GET', '/workers')).body.find((entry: any) => entry.id === worker.id);
  assert.equal(listedWorker.verification, 'expired');
});

test('document expiry queue surfaces due evidence and verified replacement supersedes the prior copy', async () => {
  const created = await call(fa, 'POST', '/workers', workerBody(10, { phone: `+2519${run}0` }));
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const worker = created.body;
  const expiresOn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const current = await upload(fa, worker.id, 'national_id', { expires_on: expiresOn });
  assert.equal(current.status, 201, JSON.stringify({ workerId: worker.id, expiresOn, upload: current.body }));
  assert.equal((await call(compliance, 'POST', `/documents/${current.body.id}/review`, { decision: 'verified' })).status, 200);

  const due = await call(fa, 'GET', '/documents/expiry?within_days=30');
  assert.equal(due.status, 200);
  assert.equal(due.body.find((entry: any) => entry.id === current.body.id)?.expiry_state, 'expiring');
  assert.equal((await call(finance, 'GET', '/documents/expiry?within_days=30')).status, 403);

  const replacement = await upload(fa, worker.id, 'national_id');
  assert.equal(replacement.status, 201);
  assert.equal((await call(compliance, 'POST', `/documents/${replacement.body.id}/review`, { decision: 'verified' })).status, 200);
  const history = await call(fa, 'GET', `/workers/${worker.id}/documents`);
  assert.equal(history.body.find((entry: any) => entry.id === current.body.id)?.status, 'superseded');
  assert.equal(history.body.find((entry: any) => entry.id === replacement.body.id)?.status, 'verified');
  const refreshedDue = await call(fa, 'GET', '/documents/expiry?within_days=30');
  assert.equal(refreshedDue.body.some((entry: any) => entry.id === current.body.id), false);
});

test('matching: agents can manage candidates only within their own team scope', async () => {
  const lead = await call(fb, 'POST', '/leads', { lead_type: 'household', name: 'Employer ' + run, phone: `+2511${run}8` });
  assert.equal(lead.status, 201);
  const r = await call(fb, 'POST', '/requests', { lead_id: lead.body.id, sector: SECTOR, skills_required: ['cooking', 'cleaning'], languages_required: ['amharic'], min_experience: 2, rate_offered: 10000, territory_id: areaA });
  assert.equal(r.status, 201);
  request = r.body;
  const fieldCandidates = await call(fb, 'GET', `/requests/${request.id}/candidates`);
  assert.equal(fieldCandidates.status, 200);
  assert.deepEqual(fieldCandidates.body, []);
  assert.equal((await call(fa, 'GET', `/requests/${request.id}/candidates`)).status, 404);
  assert.equal((await call(fb, 'GET', `/requests/${request.id}/matches`)).status, 200);
});

test('matching: only verified, available workers are candidates, ranked by score', async () => {
  w3 = (await call(fa, 'POST', '/workers', workerBody(3))).body; // never verified
  const c = await call(admin, 'GET', `/requests/${request.id}/candidates`);
  assert.equal(c.status, 200);
  const ids = c.body.map((x: any) => x.worker_id);
  assert.deepEqual(ids, [w1.id]); // w2 (expired document) and w3 (unverified) are excluded
  assert.equal(c.body[0].score, 100);
  const masterCandidates = await call(master, 'GET', `/requests/${request.id}/candidates`);
  assert.equal(masterCandidates.status, 200);
  assert.deepEqual(masterCandidates.body.map((candidate: any) => candidate.worker_id), [w1.id]);
});

test('matching: Global Admin can make verified certificates an additional eligibility requirement', async () => {
  const settings = await call(globalAdmin, 'GET', '/business-rules');
  const oldValue = Number(settings.body.find((rule: any) => rule.key === 'worker_requires_certificate').value);
  try {
    assert.equal((await call(globalAdmin, 'PATCH', '/business-rules', {
      values: { worker_requires_certificate: 1 },
    })).status, 200);
    const candidates = await call(globalAdmin, 'GET', `/requests/${request.id}/candidates`);
    assert.equal(candidates.status, 200);
    assert.ok(!candidates.body.some((worker: any) => worker.worker_id === w1.id));
  } finally {
    assert.equal((await call(globalAdmin, 'PATCH', '/business-rules', {
      values: { worker_requires_certificate: oldValue },
    })).status, 200);
  }
});

test('matching: agents can propose eligible workers while the server rejects ineligible workers', async () => {
  assert.equal((await call(admin, 'POST', `/requests/${request.id}/matches`, { worker_id: w3.id })).status, 409);
  assert.equal((await call(fb, 'POST', `/requests/${request.id}/matches`, { worker_id: w1.id })).status, 409);
  const m = await call(master, 'POST', `/requests/${request.id}/matches`, { worker_id: w1.id });
  assert.equal(m.status, 201);
  assert.equal(Number(m.body.score), 100);
  match = m.body;
  assert.equal((await call(master, 'POST', `/requests/${request.id}/matches`, { worker_id: w1.id })).status, 409);
});

test('matching: agent acceptance rechecks live requirements and proposal notice contains no worker details', async () => {
  const notice = await db.query(
    "SELECT channel, payload FROM notifications WHERE user_id=$1 AND template='staffing_match_status' AND payload->>'match_id'=$2 AND payload->>'status'='proposed'",
    [fb.id, match.id],
  );
  assert.equal(notice.rowCount, 2); // in-app and webhook outbox, written with the proposal
  assert.equal('worker_id' in notice.rows[0].payload, false);

  const settings = await call(globalAdmin, 'GET', '/business-rules');
  const oldValue = Number(settings.body.find((rule: any) => rule.key === 'worker_requires_certificate').value);
  try {
    assert.equal((await call(globalAdmin, 'PATCH', '/business-rules', {
      values: { worker_requires_certificate: 1 },
    })).status, 200);
    const stale = await call(master, 'POST', `/matches/${match.id}/respond`, { decision: 'accepted' });
    assert.equal(stale.status, 409);
    assert.match(stale.body.error, /current verification|document requirements/i);
  } finally {
    assert.equal((await call(globalAdmin, 'PATCH', '/business-rules', {
      values: { worker_requires_certificate: oldValue },
    })).status, 200);
  }
});

test('database trigger: even a direct insert cannot match an unverified worker', async () => {
  await assert.rejects(
    db.query('INSERT INTO matches (request_id, worker_id, score, created_by) VALUES ($1,$2,50,$3)', [request.id, w3.id, admin.id]),
    /not verified/,
  );
});

test('matching: accepting a match marks the request matched; it cannot be answered twice', async () => {
  assert.equal((await call(master, 'POST', `/matches/${match.id}/respond`, { decision: 'accepted' })).status, 200);
  const reqs = await call(fb, 'GET', '/requests');
  assert.equal(reqs.body.find((x: any) => x.id === request.id).status, 'matched');
  const workers = await call(fa, 'GET', '/workers');
  assert.equal(workers.body.find((x: any) => x.id === w1.id).availability, 'unavailable');
  const nextRequest = await call(fb, 'POST', '/requests', {
    lead_id: request.lead_id, sector: SECTOR, skills_required: ['cooking'], rate_offered: 10000, territory_id: areaA,
  });
  assert.equal(nextRequest.status, 201);
  const candidates = await call(master, 'GET', `/requests/${nextRequest.body.id}/candidates`);
  assert.ok(!candidates.body.some((x: any) => x.worker_id === w1.id));
  const released = await call(master, 'POST', `/matches/${match.id}/release`, { availability: 'within_2_weeks' });
  assert.equal(released.status, 200);
  assert.equal(released.body.availability, 'within_2_weeks');
  const restored = await call(master, 'GET', `/requests/${nextRequest.body.id}/candidates`);
  assert.ok(restored.body.some((x: any) => x.worker_id === w1.id));
  const reopened = await call(fb, 'GET', '/requests');
  assert.equal(reopened.body.find((x: any) => x.id === request.id).status, 'open');
  assert.equal((await call(master, 'POST', `/matches/${match.id}/release`, { availability: 'immediate' })).status, 409);
  assert.equal((await call(master, 'POST', `/matches/${match.id}/respond`, { decision: 'declined' })).status, 409);
});

test('master agents can submit scoped rent/deposit payments while field agents cannot access tenant finances', async () => {
  const { lease, charge } = await withPropertyTenantFixture(async (client) => {
    const property = (await client.query(
      `INSERT INTO properties (address, ptype, territory_id, source_agent_id, created_by)
       VALUES ($1,'house',$2,$3,$3) RETURNING id`,
      [`Agent rent flow ${run}`, areaA, fa.id],
    )).rows[0];
    const unit = (await client.query(
      "INSERT INTO property_units (property_id, unit_no, ptype) VALUES ($1,$2,'house') RETURNING id",
      [property.id, `Rent-${run}`],
    )).rows[0];
    const tenant = (await client.query(
      'INSERT INTO tenants (name, phone, source_agent_id) VALUES ($1,$2,$3) RETURNING id',
      [`Rent tenant ${run}`, `+2515${run}1`, fa.id],
    )).rows[0];
    const lease = (await client.query(
      `INSERT INTO leases (unit_id, tenant_id, rent, deposit, start_date, rent_start_on, end_date, source_agent_id, status)
       VALUES ($1,$2,10000,1000,current_date,current_date,(current_date + interval '1 year')::date,$3,'active') RETURNING id`,
      [unit.id, tenant.id, fa.id],
    )).rows[0];
    const charge = (await client.query(
      `INSERT INTO rent_charges (lease_id, period, due_on, amount)
       VALUES ($1,date_trunc('month',current_date)::date,current_date,10000) RETURNING id`,
      [lease.id],
    )).rows[0];
    return { lease, charge };
  });

  assert.equal((await call(fa, 'POST', `/charges/${charge.id}/pay`, {
    reference: `field-agent-rent-${run}`, channel: 'manual',
  })).status, 403);
  const rent = await call(master, 'POST', `/charges/${charge.id}/pay`, {
    reference: `agent-rent-${run}`, channel: 'manual',
  });
  assert.equal(rent.status, 200, JSON.stringify(rent.body));
  assert.equal(rent.body.status, 'pending');
  assert.equal(rent.body.kind, 'rent');
  assert.equal((await call(fb, 'POST', `/charges/${charge.id}/pay`, {
    reference: `sibling-rent-${run}`, channel: 'manual',
  })).status, 403);
  assert.equal((await call(master, 'POST', `/rent-transactions/${rent.body.id}/reconcile`, {})).status, 403);
  assert.equal((await call(master, 'POST', `/rent-transactions/${rent.body.id}/void`, {
    reason: 'Agent cannot void recorded payments.',
  })).status, 403);
  const stillDue = await db.query('SELECT status FROM rent_charges WHERE id=$1', [charge.id]);
  assert.equal(stillDue.rows[0].status, 'due');

  const deposit = await call(master, 'POST', `/leases/${lease.id}/deposit/pay`, {
    reference: `agent-deposit-${run}`, channel: 'manual',
  });
  assert.equal(deposit.status, 201);
  assert.equal(deposit.body.status, 'pending');
  assert.equal(deposit.body.kind, 'deposit');
  assert.equal((await call(master, 'POST', `/leases/${lease.id}/deposit/refund`, {
    amount: 100, reference: `agent-refund-${run}`, channel: 'manual', reason: 'Agent cannot issue deposit refunds.',
  })).status, 403);

  const contractId = randomUUID();
  const commissionId = randomUUID();
  assert.equal((await call(fb, 'POST', `/contracts/${contractId}/transition`, {
    action: 'record_payment', channel: 'cash', reference: `agent-${run}`, amount: 100,
  })).status, 403);
  assert.equal((await call(fb, 'POST', `/contracts/${contractId}/transition`, {
    action: 'reconcile',
  })).status, 403);
  assert.equal((await call(fb, 'POST', `/commissions/${commissionId}/approve`, {})).status, 403);
  assert.equal((await call(fb, 'POST', `/commissions/${commissionId}/pay`, {})).status, 403);
});

test('documents: wrong file types are refused; downloads are access-controlled', async () => {
  assert.equal((await upload(fa, w1.id, 'reference', {}, Buffer.from('just text'))).status, 415);
  const d = await upload(fa, w1.id, 'reference');
  assert.equal(d.status, 201);
  const get = (u: U) => fetch(`${API}/documents/${d.body.id}/file`, { headers: { authorization: 'Bearer ' + u.token } });
  const ok = await get(fa);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await ok.arrayBuffer()), PNG);
  assert.equal((await get(fb)).status, 404); // another agent cannot see this worker's files
  assert.equal((await get(finance)).status, 403); // finance has no business with identity documents
  assert.equal((await get(compliance)).status, 200);
  const log = await db.query("SELECT 1 FROM audit_logs WHERE action = 'document_downloaded' AND entity_id = $1", [d.body.id]);
  assert.ok((log.rowCount ?? 0) >= 2); // both downloads are audited
});

test('areas: anyone signed in can list them; only Global Admin can create them', async () => {
  assert.equal((await call(fa, 'POST', '/territories', { level: 'city', name: 'Nope' })).status, 403);
  const made = await call(globalAdmin, 'POST', '/territories', { level: 'city', name: 'Created ' + run });
  assert.equal(made.status, 201);
  assert.ok((await call(fa, 'GET', '/territories')).body.some((t: any) => t.id === made.body.id));
});

test('properties: units are stored with the property; duplicates and cross-agent access are blocked', async () => {
  const address = `Bole Road Plot ${run}`;
  const p = await call(fa, 'POST', '/properties', { address, ptype: 'apartment_building', territory_id: areaA, units: [{ unit_no: '1A', floor: 1, rent: 15000 }, { unit_no: '1B', floor: 1, rent: 16000 }] });
  assert.equal(p.status, 201);
  assert.equal(p.body.listing_review_status, 'pending_review');
  assert.equal((await call(fa, 'POST', '/properties', {
    address: `Sale only property ${run}`,
    ptype: 'house',
    listing_mode: 'sale',
    sale_price: 1000000,
    territory_id: areaA,
    units: [{ unit_no: 'Sale-1', rent: 5000 }],
  })).status, 422);
  const uploadPhoto = (u: U, content: Buffer, contentType = 'image/png') => fetch(
    `${API}/properties/${p.body.id}/photos/upload?caption=Front+entrance`,
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + u.token,
        'content-type': contentType,
        ...(u.propertyTenantId ? { 'x-afrolife-property-tenant-id': u.propertyTenantId } : {}),
      },
      body: new Uint8Array(content),
    },
  );
  const uploaded = await uploadPhoto(fa, PNG);
  assert.equal(uploaded.status, 201, await uploaded.clone().text());
  const photoInfo = await uploaded.json() as any;
  assert.equal(photoInfo.caption, 'Front entrance');
  assert.equal((await uploadPhoto(fa, Buffer.from('not an image'), 'text/plain')).status, 415);
  const listing = (await call(fa, 'GET', '/properties')).body.find((item: any) => item.id === p.body.id);
  assert.equal(listing.units.length, 2);
  const photos = await call(fa, 'GET', `/properties/${p.body.id}/photos`);
  assert.equal(photos.status, 200);
  assert.equal(photos.body.length, 1);
  const photo = await fetch(`${API}/properties/${p.body.id}/photos/${photoInfo.id}/file`, {
    headers: { authorization: 'Bearer ' + fa.token, 'x-afrolife-property-tenant-id': propertyTenantId },
  });
  assert.equal(photo.status, 200);
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), PNG);
  assert.equal((await call(fb, 'GET', `/properties/${p.body.id}/photos`)).status, 404);
  assert.equal((await call(fb, 'POST', '/properties', { address: address.toUpperCase(), ptype: 'house', territory_id: areaA })).status, 409);
  assert.equal((await call(fa, 'POST', `/properties/${p.body.id}/units`, { unit_no: '1A' })).status, 409);
  assert.equal((await call(fb, 'POST', `/properties/${p.body.id}/units`, { unit_no: '2A' })).status, 404);
  const mine = (await call(fa, 'GET', '/properties')).body.find((x: any) => x.id === p.body.id);
  assert.equal(mine.units.length, 2);
  assert.ok(!(await call(fb, 'GET', '/properties')).body.some((x: any) => x.id === p.body.id));
  assert.ok((await call(master, 'GET', '/properties')).body.some((x: any) => x.id === p.body.id));
});

test('property owners manage their own listings and photos without seeing other owners or agent listings', async () => {
  const address = `Owner property ${run}`;
  const created = await call(propertyOwner, 'POST', '/properties', {
    address,
    ptype: 'house',
    territory_id: areaA,
    units: [{ unit_no: 'Owner-1', rent: 12000 }],
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.source_agent_id, null);
  assert.equal(created.body.owner_user_id, propertyOwner.id);

  const listing = (await call(propertyOwner, 'GET', '/properties')).body.find((item: any) => item.id === created.body.id);
  assert.equal(listing.units.length, 1);
  assert.equal((await call(propertyOwner, 'POST', `/properties/${created.body.id}/units`, { unit_no: 'Owner-2' })).status, 201);

  const uploaded = await fetch(
    `${API}/properties/${created.body.id}/photos/upload?caption=Owner+photo`,
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + propertyOwner.token,
        'content-type': 'image/png',
        'x-afrolife-property-tenant-id': propertyTenantId,
      },
      body: PNG,
    },
  );
  assert.equal(uploaded.status, 201, await uploaded.clone().text());
  const photoInfo = await uploaded.json() as any;
  const downloaded = await fetch(`${API}/properties/${created.body.id}/photos/${photoInfo.id}/file`, {
    headers: {
      authorization: 'Bearer ' + propertyOwner.token,
      'x-afrolife-property-tenant-id': propertyTenantId,
    },
  });
  assert.equal(downloaded.status, 200);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), PNG);

  assert.equal((await call(otherPropertyOwner, 'GET', '/properties')).body.some((item: any) => item.id === created.body.id), false);
  assert.equal((await call(otherPropertyOwner, 'GET', `/properties/${created.body.id}/photos`)).status, 404);
  assert.equal((await call(otherPropertyOwner, 'POST', `/properties/${created.body.id}/units`, { unit_no: 'Other-1' })).status, 404);
  assert.equal((await call(fa, 'GET', '/properties')).body.some((item: any) => item.id === created.body.id), false);
  assert.equal((await call(fa, 'POST', `/properties/${created.body.id}/units`, { unit_no: 'Agent-1' })).status, 404);
});

test('buyers can read available listings and photos but cannot write or see internal ownership data', async () => {
  const agentListing = await call(fa, 'POST', '/properties', {
    address: `Buyer visible agent listing ${run}`,
    ptype: 'apartment_building',
    territory_id: areaA,
  });
  assert.equal(agentListing.status, 201);
  const hiddenListing = await withPropertyTenantFixture(async (client) => (await client.query(
    `INSERT INTO properties (address, ptype, territory_id, source_agent_id, created_by, status)
     VALUES ($1,'house',$2,$3,$4,'pending_review') RETURNING id`,
    [`Buyer hidden listing ${run}`, areaA, fa.id, fa.id],
  )).rows[0]);

  const beforeReview = await call(buyer, 'GET', '/properties');
  assert.equal(beforeReview.status, 200);
  assert.equal(beforeReview.body.some((item: any) => item.id === agentListing.body.id), false);
  assert.equal((await call(buyer, 'GET', `/properties/${agentListing.body.id}/photos`)).status, 404);
  const ownerListingForReview = (await call(propertyOwner, 'GET', '/properties')).body
    .find((item: any) => item.address === `Owner property ${run}`);
  assert.equal(ownerListingForReview.listing_review_status, 'pending_review');
  assert.equal((await call(propertyOwner, 'PATCH', `/properties/${ownerListingForReview.id}/review`, {
    decision: 'approve',
  })).status, 403);
  const approvedAgentListing = await call(propertyReviewer, 'PATCH', `/properties/${agentListing.body.id}/review`, {
    decision: 'approve',
  });
  assert.equal(approvedAgentListing.status, 200);
  assert.equal(approvedAgentListing.body.listing_review_status, 'approved');
  const agentAuthorityEvidence = await fetch(
    `${API}/properties/${agentListing.body.id}/authority-evidence?evidence_type=ownership_authority`,
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + fa.token,
        'content-type': 'image/png',
        'x-afrolife-property-tenant-id': propertyTenantId,
      },
      body: PNG,
    },
  );
  assert.equal(agentAuthorityEvidence.status, 201, await agentAuthorityEvidence.clone().text());
  const agentAuthorityApproval = await call(propertyReviewer, 'PATCH', `/properties/${agentListing.body.id}/authority-review`, {
    decision: 'approve',
  });
  assert.equal(agentAuthorityApproval.status, 200, JSON.stringify(agentAuthorityApproval.body));
  assert.equal((await call(propertyReviewer, 'PATCH', `/properties/${ownerListingForReview.id}/review`, {
    decision: 'reject',
    note: 'No',
  })).status, 422);
  const returned = await call(propertyReviewer, 'PATCH', `/properties/${ownerListingForReview.id}/review`, {
    decision: 'reject',
    note: 'Please clarify the property access and unit details.',
  });
  assert.equal(returned.status, 200);
  assert.equal(returned.body.listing_review_status, 'rejected');
  assert.equal((await call(buyer, 'GET', '/properties')).body.some((item: any) => item.id === ownerListingForReview.id), false);
  const resubmitted = await call(propertyOwner, 'PATCH', `/properties/${ownerListingForReview.id}/resubmit`, {
    address: ownerListingForReview.address,
    description: 'Updated property details following the review request.',
    listing_mode: ownerListingForReview.listing_mode,
    rent_period: ownerListingForReview.rent_period,
  });
  assert.equal(resubmitted.status, 200);
  assert.equal(resubmitted.body.listing_review_status, 'pending_review');
  assert.equal(resubmitted.body.listing_review_note, null);
  assert.equal((await call(propertyReviewer, 'PATCH', `/properties/${ownerListingForReview.id}/review`, {
    decision: 'approve',
  })).status, 200);
  const authorityEvidence = await fetch(
    `${API}/properties/${ownerListingForReview.id}/authority-evidence?evidence_type=ownership_authority`,
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + propertyOwner.token,
        'content-type': 'image/png',
        'x-afrolife-property-tenant-id': propertyTenantId,
      },
      body: PNG,
    },
  );
  assert.equal(authorityEvidence.status, 201, await authorityEvidence.clone().text());
  const authorityApproval = await call(propertyReviewer, 'PATCH', `/properties/${ownerListingForReview.id}/authority-review`, {
    decision: 'approve',
  });
  assert.equal(authorityApproval.status, 200, JSON.stringify(authorityApproval.body));
  assert.equal(authorityApproval.body.authority_review_status, 'approved');

  const visible = await call(buyer, 'GET', '/properties');
  assert.equal(visible.status, 200);
  const ownerListing = visible.body.find((item: any) => item.address === `Owner property ${run}`);
  const agentProperty = visible.body.find((item: any) => item.id === agentListing.body.id);
  assert.ok(ownerListing);
  assert.ok(agentProperty, JSON.stringify(visible.body));
  assert.equal(visible.body.some((item: any) => item.id === hiddenListing.id), false);
  assert.equal('owner_user_id' in ownerListing, false);
  assert.equal('source_agent_id' in ownerListing, false);
  assert.equal('owner_lead_id' in ownerListing, false);
  assert.equal('created_by' in ownerListing, false);
  assert.equal((await call(buyer, 'POST', '/properties', {
    address: `Buyer forbidden listing ${run}`,
    ptype: 'house',
    territory_id: areaA,
  })).status, 403);
  assert.equal((await call(buyer, 'POST', `/properties/${ownerListing.id}/units`, { unit_no: 'Buyer-1' })).status, 403);
  assert.equal((await call(buyer, 'POST', `/properties/${ownerListing.id}/photos/upload`, {})).status, 403);
});

test('marketplace listing media, independent moderation, buyer visibility, and sandbox checkout are end-to-end', async () => {
  const listing = await call(propertyOwner, 'POST', '/marketplace/listings', {
    domain: 'products',
    category_key: 'electronics',
    title: `LOCAL QA synthetic listing ${run}`,
    description: 'Synthetic marketplace lifecycle coverage; no real product is offered.',
    transaction_mode: 'sale',
    price: 1250.5,
    condition: 'good',
    territory_id: areaA,
  });
  assert.equal(listing.status, 201, JSON.stringify(listing.body));
  assert.equal(listing.body.status, 'draft');

  const mediaResponse = await fetch(`${API}/marketplace/listings/${listing.body.id}/media/upload?caption=Synthetic+marketplace+fixture`, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + propertyOwner.token, 'content-type': 'image/png' },
    body: PNG,
  });
  assert.equal(mediaResponse.status, 201, await mediaResponse.clone().text());
  const media = await mediaResponse.json() as any;
  const submitted = await call(propertyOwner, 'POST', `/marketplace/listings/${listing.body.id}/submit`, {});
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.status, 'pending_review');

  const selfReview = await call(propertyOwner, 'PATCH', `/marketplace/listings/${listing.body.id}/review`, {
    decision: 'publish',
  });
  assert.equal(selfReview.status, 403);
  const published = await call(admin, 'PATCH', `/marketplace/listings/${listing.body.id}/review`, {
    decision: 'publish',
    note: 'Internal moderation-only note for the synthetic QA listing.',
  });
  assert.equal(published.status, 200);
  assert.equal(published.body.status, 'published');

  const customerListings = await call(buyer, 'GET', '/marketplace/listings');
  assert.equal(customerListings.status, 200);
  const customerListing = customerListings.body.find((item: any) => item.id === listing.body.id);
  assert.ok(customerListing);
  assert.equal(customerListing.seller_name, `property_owner-9`);
  for (const field of ['seller_user_id', 'source_agent_id', 'created_by', 'review_note', 'reviewed_by', 'reviewed_at']) {
    assert.equal(Object.hasOwn(customerListing, field), false, `Customer response must omit internal ${field}`);
  }
  assert.equal(customerListing.media.length, 1);
  const mediaFile = await fetch(`${API}/marketplace/media/${media.id}/file`, {
    headers: { authorization: 'Bearer ' + buyer.token },
  });
  const mediaFileBytes = Buffer.from(await mediaFile.arrayBuffer());
  assert.equal(mediaFile.status, 200, `Marketplace media fetch returned ${mediaFile.status}: ${mediaFileBytes.toString().slice(0, 500)}`);
  assert.deepEqual(mediaFileBytes, PNG);

  const orderBody = { quantity: 2, idempotency_key: `marketplace-qa-${run}` };
  const order = await call(buyer, 'POST', `/marketplace/listings/${listing.body.id}/sandbox-orders`, orderBody);
  assert.equal(order.status, 201);
  assert.equal(order.body.total, '2501.00');
  const retry = await call(buyer, 'POST', `/marketplace/listings/${listing.body.id}/sandbox-orders`, orderBody);
  assert.equal(retry.status, 201);
  assert.equal(retry.body.id, order.body.id);
  const conflictingRetry = await call(buyer, 'POST', `/marketplace/listings/${listing.body.id}/sandbox-orders`, {
    ...orderBody,
    quantity: 3,
  });
  assert.equal(conflictingRetry.status, 409);

  const payment = await call(buyer, 'POST', `/marketplace/sandbox-orders/${order.body.id}/mock-payment`, {});
  assert.equal(payment.status, 200);
  assert.equal(payment.body.status, 'sandbox_paid');
  assert.match(payment.body.notice, /no charge was made/i);
  const repeatedPayment = await call(buyer, 'POST', `/marketplace/sandbox-orders/${order.body.id}/mock-payment`, {});
  assert.equal(repeatedPayment.body.status, 'sandbox_paid');
  assert.equal(repeatedPayment.body.payment_reference, payment.body.payment_reference);
});

test.after(() => db.end());
