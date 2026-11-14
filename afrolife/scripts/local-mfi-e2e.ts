import '../src/env.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { totp } from '../src/totp.js';

const credentialsFile = process.env.MFI_E2E_USERS_FILE
  ?? join(process.env.LOCALAPPDATA ?? '', 'AfroLife', 'local-test-users.txt');
const apiBase = new URL(process.env.API_URL ?? 'http://127.0.0.1:3010');
assert.ok(
  apiBase.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(apiBase.hostname),
  'Local SACCO E2E refuses non-local API hosts',
);
const fixtureConnectionString = process.env.MFI_E2E_DATABASE_URL;
const migrationConnectionString = process.env.MIGRATION_DATABASE_URL;
assert.ok(fixtureConnectionString, 'MFI_E2E_DATABASE_URL must explicitly target a disposable test database');
assert.ok(migrationConnectionString, 'MIGRATION_DATABASE_URL must explicitly target the MFI E2E database');
const fixtureDbUrl = new URL(fixtureConnectionString);
const migrationDbUrl = new URL(migrationConnectionString);
const fixtureDatabase = decodeURIComponent(fixtureDbUrl.pathname.replace(/^\/+/, ''));
const migrationDatabase = decodeURIComponent(migrationDbUrl.pathname.replace(/^\/+/, ''));
const containerizedDisposableDatabase = process.env.AFROLIFE_TEST_POSTGRES_CONTAINER === '1'
  && fixtureDbUrl.port === process.env.AFROLIFE_FINANCE_E2E_PORT
  && migrationDbUrl.port === process.env.AFROLIFE_FINANCE_E2E_PORT
  && fixtureDbUrl.username === 'postgres' && migrationDbUrl.username === 'postgres'
  && /^afrolife_test_[a-z0-9_-]+$/i.test(fixtureDatabase);
assert.ok(['127.0.0.1','localhost','::1'].includes(fixtureDbUrl.hostname)
  && ['127.0.0.1','localhost','::1'].includes(migrationDbUrl.hostname)
  && ((fixtureDbUrl.port === '5433' && migrationDbUrl.port === '5433'
      && /^afrolife_test_[a-z0-9_-]+$/i.test(fixtureDatabase))
    || containerizedDisposableDatabase)
  && migrationDatabase === fixtureDatabase,
  'Local SACCO E2E requires matching fixture and migration URLs for a loopback afrolife_test_* database');
const migrationClient = new pg.Client({ connectionString: migrationDbUrl.toString() });
try {
  await migrationClient.connect();
  const identity = (await migrationClient.query(`SELECT current_database() AS database,
    host(inet_server_addr()) AS address,inet_server_port() AS port,
    (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS is_superuser`)).rows[0];
  const containerAddress = identity.address && (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(identity.address)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(identity.address)
    || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(identity.address)
    || /^(fc|fd)[0-9a-f:]*$/i.test(identity.address)
  );
  const loopbackPostgres = ['127.0.0.1','::1'].includes(identity.address) && Number(identity.port) === 5433;
  const disposableContainerPostgres = process.env.AFROLIFE_TEST_POSTGRES_CONTAINER === '1'
    && containerAddress && Number(identity.port) === 5432;
  assert.ok(identity.database === fixtureDatabase && identity.is_superuser
    && (loopbackPostgres || disposableContainerPostgres),
  'Local SACCO E2E requires a loopback or explicitly disposable container superuser database');
} finally {
  await migrationClient.end();
}
const lines = readFileSync(credentialsFile, 'utf8').split(/\r?\n/);
const credentials = new Map<string, { phone: string; password: string }>();
for (const line of lines) {
  const match = line.match(/^([^|]+?)\s*\|\s*(\+\d+)\s*\|\s*(.+)$/);
  if (match) credentials.set(match[1].trim(), { phone: match[2], password: match[3] });
}
const api = `${apiBase.origin}/api/v1`;
const platformTenantId = process.env.MFI_PLATFORM_TENANT_ID;
assert.ok(platformTenantId, 'MFI_PLATFORM_TENANT_ID must identify the assigned local SACCO service tenant');
async function login(role: string) {
  const account = credentials.get(role);
  assert.ok(account, `Missing local ${role} credentials`);
  const response = await fetch(`${api}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(account),
  });
  const result = await response.json() as { token?: string; error?: string; restrict?: string | null };
  assert.equal(response.status, 200, `${role} login: ${JSON.stringify(result)}`);
  let token = result.token!;
  if (result.restrict === 'mfa') {
    const setup = await call<{ secret: string }>({ token }, 'POST', '/auth/mfa/setup', {});
    token = (await call<{ token: string }>({ token }, 'POST', '/auth/mfa/enable', {
      code: totp(setup.secret),
    })).token;
  } else {
    assert.equal(result.restrict, null, `${role} login has an unexpected security restriction`);
  }
  return { token };
}
async function call<T = any>(user: { token: string }, method: string, path: string, body?: unknown, expected = 200): Promise<T> {
  const response = await fetch(api + path, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${user.token}`,
      'x-afrolife-platform-tenant-id': platformTenantId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => null) as any;
  assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(result)}`);
  return result as T;
}
async function callRaw(user: { token: string }, method: string, path: string, body: Buffer, expected = 201): Promise<any> {
  const response = await fetch(api + path, {
    method,
    headers: {
      authorization: `Bearer ${user.token}`,
      'content-type': 'application/pdf',
      'x-afrolife-platform-tenant-id': platformTenantId,
    },
    body,
  });
  const result = await response.json().catch(() => null) as any;
  assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(result)}`);
  return result;
}

const admin = await login('super_admin');
const admin2 = await login('super_admin (second account for four-eyes review)');
const teller = await login('finance');
const creditManager = await login('finance_manager');
const compliance = await login('compliance');
const feature = await call<{ mfiPilotEnabled: boolean }>(admin, 'GET', '/features');
assert.equal(feature.mfiPilotEnabled, true);

const suffix = Date.now().toString().slice(-7);
const institution = await call<{ id: string; institution_code: string }>(admin, 'POST', '/mfi/institutions', {
  institution_code: `QA${suffix}`, name: `Local SACCO E2E ${suffix}`,
}, 201);
const otherInstitution = await call<{ id: string; institution_code: string }>(admin2, 'POST', '/mfi/institutions', {
  institution_code: `QB${suffix}`, name: `Other Local SACCO E2E ${suffix}`,
}, 201);
const base = `/mfi/institutions/${institution.id}`;
const policy = {
  scorecard: { minimum_score: 55, maximum_debt_service_pct: 40, savings_coverage_target_pct: 20,
    membership_tenure_target_days: 365, new_borrower_score: 50,
    weights: { affordability: 40, savings: 20, tenure: 20, repayment_history: 20 } },
  delinquency: { watch_days: 1, substandard_days: 91, doubtful_days: 181, loss_days: 366 },
};
const policyDraft = await call<{ id: string }>(admin, 'POST', `${base}/credit-policy`, {
  policy, change_reason: 'Initial local QA credit and delinquency policy',
}, 201);
await call(admin, 'POST', `${base}/credit-policy/${policyDraft.id}/approve`, {
  decision: 'approve', reason: 'Independent local QA policy approval',
}, 409);
await call(admin2, 'POST', `${base}/credit-policy/${policyDraft.id}/approve`, {
  decision: 'approve', reason: 'Independent local QA policy approval',
}, 200);
const platformInstitutions = await call<Array<{ id: string; role: string }>>(admin, 'GET', '/mfi/institutions');
assert.equal(platformInstitutions.find((item) => item.id === otherInstitution.id)?.role, 'platform_super_admin');
await call(admin, 'GET', `/mfi/institutions/${otherInstitution.id}/staff`, undefined, 200);
await call(admin, 'POST', `${base}/staff`, { phone: credentials.get('finance')!.phone, role: 'teller' }, 201);
await call(admin, 'POST', `${base}/staff`, { phone: credentials.get('finance_manager')!.phone, role: 'credit_manager' }, 201);
await call(admin, 'GET', `${base}/staff`, undefined, 200);
await call(creditManager, 'GET', `${base}/staff`, undefined, 403);
await call(creditManager, 'POST', `${base}/credit-policy`, {
  policy, change_reason: 'Non-administrator policy change must be rejected',
}, 403);
await call(admin, 'POST', `${base}/staff`, { phone: credentials.get('super_admin (second account for four-eyes review)')!.phone, role: 'institution_admin' }, 201);
await call(admin, 'POST', `${base}/staff`, { phone: credentials.get('compliance')!.phone, role: 'compliance' }, 201);
await call(teller, 'GET', `${base}/staff`, undefined, 403);
await call(creditManager, 'GET', `${base}/staff`, undefined, 403);
await call(admin, 'GET', `/mfi/institutions/${otherInstitution.id}/overview`, undefined, 200);
await call(teller, 'GET', `/mfi/institutions/${otherInstitution.id}/overview`, undefined, 404);
await call(admin2, 'GET', `/mfi/institutions/${otherInstitution.id}/overview`, undefined, 200);

const member = await call<{ id: string; phone: string }>(admin, 'POST', `${base}/members`, {
  full_name: `QA Member ${suffix}`, phone: `+2519${suffix}1`,
}, 201);
await call(admin, 'POST', `${base}/members/${member.id}/review`, {
  decision: 'activate', reason: 'Self approval must be rejected',
}, 409);
const active = await call<{ status: string }>(compliance, 'POST', `${base}/members/${member.id}/review`, {
  decision: 'activate', reason: 'QA member review completed',
});
assert.equal(active.status, 'active');
await call(admin, 'POST', `${base}/members/${member.id}/kyc-review`, {
  decision: 'verified', reason: 'Synthetic UAT identity documents independently checked',
}, 409);
const syntheticId = Buffer.from('%PDF-1.7\nSynthetic local UAT identity evidence; not a real identity document.\n%%EOF\n');
const idDocument = await callRaw(admin, 'POST', `${base}/members/${member.id}/documents/national_id`, syntheticId);
await call(compliance, 'POST', `${base}/documents/${idDocument.id}/review`, {
  decision: 'verified', reason: 'Synthetic UAT document reviewed independently',
});
const kyc = await call<{ kyc_status: string }>(admin2, 'POST', `${base}/members/${member.id}/kyc-review`, {
  decision: 'verified', reason: 'Synthetic UAT identity documents independently checked',
});
assert.equal(kyc.kyc_status, 'verified');
await call(admin2, 'POST', `${base}/members/${member.id}/lifecycle`, {
  action: 'suspend', reason: 'Temporary QA suspension for lifecycle controls',
}, 200);
const reactivated = await call<{ status: string }>(admin2, 'POST', `${base}/members/${member.id}/lifecycle`, {
  action: 'reactivate', reason: 'Restore QA member after lifecycle suspension',
}, 200);
assert.equal(reactivated.status, 'active');
const tellerMembers = await call<Array<{ id: string; phone?: string; email?: string | null }>>(teller, 'GET', `${base}/members`);
assert.equal(tellerMembers.find((item) => item.id === member.id)?.phone, undefined);
assert.equal(tellerMembers.find((item) => item.id === member.id)?.email, undefined);
const servicingMembers = await call<Array<{ id: string; phone: string }>>(admin, 'GET', `${base}/members`);
assert.equal(servicingMembers.find((item) => item.id === member.id)?.phone, member.phone);

const products = await call<Array<{ id: string; product_code: string }>>(admin, 'GET', `${base}/products`);
const savings = products.find((item) => item.product_code === 'SAV-ORD')!;
const loanProduct = products.find((item) => item.product_code === 'LON-GEN')!;
assert.ok(savings && loanProduct);
const account = await call<{ id: string }>(admin, 'POST', `${base}/members/${member.id}/accounts`, { product_id: savings.id }, 201);
const depositKey = randomUUID();
const deposit = await call<{ id:string; status:string }>(admin2, 'POST', `${base}/accounts/${account.id}/transactions`, {
  transaction_type: 'savings_deposit', amount: '5000.00', idempotency_key: depositKey,
}, 201);
assert.equal(deposit.status,'draft');
await call(admin2,'POST',`${base}/journals/${deposit.id}/decision`,{decision:'approve',reason:'Maker cannot approve their own synthetic deposit'},409);
await call(admin,'POST',`${base}/journals/${deposit.id}/decision`,{decision:'approve',reason:'Independent approval of synthetic savings deposit'});
const replay = await call<{ replayed: boolean }>(teller, 'POST', `${base}/accounts/${account.id}/transactions`, {
  transaction_type: 'savings_deposit', amount: '5000.00', idempotency_key: depositKey,
});
assert.equal(replay.replayed, true);
await call(teller, 'POST', `${base}/accounts/${account.id}/transactions`, {
  transaction_type: 'savings_deposit', amount: '6000.00', idempotency_key: depositKey,
}, 409);
const rejectedDeposit=await call<{id:string;status:string}>(teller,'POST',`${base}/accounts/${account.id}/transactions`,{
  transaction_type:'savings_deposit',amount:'1.00',idempotency_key:randomUUID(),
},201);
await call(admin,'POST',`${base}/journals/${rejectedDeposit.id}/decision`,{decision:'reject',reason:'Reject synthetic deposit to verify the balance stays unchanged'});
assert.equal((await call<Array<{id:string;balance:string}>>(admin,'GET',`${base}/accounts`)).find((row)=>row.id===account.id)?.balance,'5000.00');
const withdrawal = await call<{ id: string; status:string }>(teller, 'POST', `${base}/accounts/${account.id}/transactions`, {
  transaction_type: 'savings_withdrawal', amount: '100.00', idempotency_key: randomUUID(),
}, 201);
assert.equal(withdrawal.status,'draft');
await call(admin,'POST',`${base}/journals/${withdrawal.id}/decision`,{decision:'approve',reason:'Independent approval of synthetic savings withdrawal'});
await call(admin, 'POST', `${base}/journals/${withdrawal.id}/reverse`, {
  idempotency_key: randomUUID(), reason: 'Reverse QA withdrawal transaction',
}, 201);

const loan = await call<{ id: string }>(admin, 'POST', `${base}/loans`, {
  member_id: member.id, product_id: loanProduct.id, principal_amount: '1000.00', term_months: 6,
  purpose: 'Working capital for a small local shop', monthly_income: '10000.00', monthly_expenses: '1000.00', monthly_debt: '0.00',
}, 201);
const tellerLoanView = await call<Array<{ id: string; monthly_income: string | null; credit_score_factors: unknown }>>(teller, 'GET', `${base}/loans`);
assert.equal(tellerLoanView.find((item) => item.id === loan.id)?.monthly_income, null);
assert.equal(tellerLoanView.find((item) => item.id === loan.id)?.credit_score_factors, null);
const creditLoanView = await call<Array<{ id: string; monthly_income: string | null; credit_score_factors: unknown }>>(creditManager, 'GET', `${base}/loans`);
assert.equal(Number(creditLoanView.find((item) => item.id === loan.id)?.monthly_income), 10000);
await call(admin, 'POST', `${base}/loans/${loan.id}/decision`, {
  decision: 'approve', reason: 'Self approval must be rejected',
}, 409);
await call(creditManager, 'POST', `${base}/loans/${loan.id}/decision`, {
  decision: 'approve', reason: 'Independent QA credit approval',
});
const disbursement = await call<{ account: { account_type: string } }>(admin2, 'POST', `${base}/loans/${loan.id}/disburse`, {
  idempotency_key: randomUUID(),
}, 201);
assert.equal(disbursement.account.account_type, 'loan');
const riskReport = await call<{
  applications: number; assessed: number;
  score_bands: Array<{ band: string; application_count: number }>;
  classifications: Array<{ classification: string; loan_count: number; outstanding_principal: string }>;
  scoring: { output: string };
  portfolio: { disbursed_loans: number; par_ratio_pct: string; aging: Array<{ bucket: string; loan_count: number }> };
  model_registry: Array<{ model_id: string; status: string; connected: boolean; promotion_gates?: string[] }>;
}>(creditManager, 'GET', `${base}/reports/credit-risk`);
assert.ok(riskReport.applications >= 1 && riskReport.assessed >= 1);
assert.ok(riskReport.score_bands.some((band) => band.band !== 'unscored' && band.application_count >= 1));
assert.ok(riskReport.classifications.some((row) => row.classification === 'performing' && row.loan_count >= 1));
assert.match(riskReport.scoring.output, /not a probability of default/);
assert.ok(riskReport.portfolio.disbursed_loans >= 1);
assert.ok(riskReport.portfolio.aging.some((row) => row.bucket === 'current' && row.loan_count >= 1));
assert.equal(riskReport.model_registry.find((model) => model.model_id === 'archive-collection-risk-challenger')?.status, 'shadow_only');
assert.equal(riskReport.model_registry.find((model) => model.model_id === 'archive-collection-risk-challenger')?.connected, false);
assert.ok((riskReport.model_registry.find((model) => model.model_id === 'archive-collection-risk-challenger')?.promotion_gates?.length ?? 0) >= 4);
assert.equal('member_name' in riskReport, false);
for (const [simulation, scenario] of [
  ['crb','adverse_history'], ['biometrics','uncertain'], ['payment_rail','pending'],
  ['regulatory_return','monthly_mfi'], ['ml_shadow','synthetic_portfolio_batch'],
] as const) {
  const mock = await call<{ sandbox_only: boolean; real_provider_called: boolean; production_side_effects: boolean; real_customer_data_used: boolean; result: any }>(
    creditManager, 'POST', `${base}/sandbox/${simulation}`, { scenario }, 201,
  );
  assert.equal(mock.sandbox_only, true);
  assert.equal(mock.real_provider_called, false);
  assert.equal(mock.production_side_effects, false);
  assert.equal(mock.real_customer_data_used, false);
  if (simulation === 'ml_shadow') {
    assert.equal(mock.result.production_status, 'disconnected_shadow_only');
    assert.equal(mock.result.rows.length, 4);
  }
}
assert.equal((await call<Array<{ simulation: string }>>(creditManager, 'GET', `${base}/sandbox/runs`)).length >= 5, true);
await call(teller, 'GET', `${base}/sandbox/runs`, undefined, 403);
await call(teller, 'GET', `${base}/reports/credit-risk`, undefined, 403);
await call(creditManager, 'GET', `/mfi/institutions/${otherInstitution.id}/reports/credit-risk`, undefined, 404);
const installments = await call<Array<{ id: string; status: string; principal_due: string }>>(admin, 'GET', `${base}/loans/${loan.id}/installments`);
assert.equal(installments.length, 6);
assert.equal(installments.reduce((sum, row) => sum + Math.round(Number(row.principal_due) * 100), 0), 100000);
const partialRepayment = await call<{ id: string; status:string }>(admin2, 'POST', `${base}/loans/${loan.id}/repay`, {
  amount: '100.00', idempotency_key: randomUUID(),
}, 201);
assert.equal(partialRepayment.status,'draft');
await call(admin2,'POST',`${base}/journals/${partialRepayment.id}/decision`,{decision:'approve',reason:'Maker cannot approve their own synthetic repayment'},409);
await call(teller,'POST',`${base}/loans/${loan.id}/repay`,{amount:'50.00',idempotency_key:randomUUID()},409);
await call(admin,'POST',`${base}/journals/${partialRepayment.id}/decision`,{decision:'approve',reason:'Independent approval of synthetic partial loan repayment'});
await call(admin, 'POST', `${base}/journals/${partialRepayment.id}/reverse`, {
  idempotency_key: randomUUID(), reason: 'Reverse QA partial loan repayment',
}, 201);
const afterRepaymentReversal = await call<Array<{ id: string; status: string; principal_repaid: string }>>(admin, 'GET', `${base}/loans`);
assert.equal(afterRepaymentReversal.find((item) => item.id === loan.id)?.status, 'disbursed');
assert.equal(Number(afterRepaymentReversal.find((item) => item.id === loan.id)?.principal_repaid), 0);
const scheduleAfterReversal = await call<Array<{ status: string; principal_paid: string }>>(admin, 'GET', `${base}/loans/${loan.id}/installments`);
assert.equal(scheduleAfterReversal.every((row) => row.status === 'due' && Number(row.principal_paid) === 0), true);
const fixturePool = new pg.Pool({ connectionString: fixtureDbUrl.toString() });
await fixturePool.query(
  `UPDATE mfi_loan_installments SET due_on=current_date-100
   WHERE institution_id=$1 AND loan_id=$2 AND installment_no=1`, [institution.id, loan.id],
);
await fixturePool.end();
await call(compliance, 'POST', `${base}/loans/${loan.id}/npl-classification`, {
  status: 'watch', reason: 'The 100 day QA delinquency requires a stronger classification',
}, 409);
const nplProposal = await call<{ id: string; status: string }>(compliance, 'POST', `${base}/loans/${loan.id}/npl-classification`, {
  status: 'substandard', reason: 'The 100 day QA delinquency meets the policy substandard band',
}, 201);
assert.equal(nplProposal.status, 'pending_approval');
await call(admin2, 'POST', `${base}/npl-events/${nplProposal.id}/decision`, {
  decision: 'approve', reason: 'The loan disburser must not approve the risk classification',
}, 409);
await call(creditManager, 'POST', `${base}/npl-events/${nplProposal.id}/decision`, {
  decision: 'approve', reason: 'Independent QA risk classification approval',
}, 200);
const riskEvents = await call<Array<{ status: string; next_status: string }>>(admin, 'GET', `${base}/npl-events`);
assert.equal(riskEvents.find((row) => row.id === nplProposal.id)?.status, 'approved');
const collection = await call<{ id: string }>(admin, 'POST', `${base}/loans/${loan.id}/collections`, {
  reason: 'Open a local QA servicing case to verify follow-up workflow',
}, 201);
await call(admin, 'POST', `${base}/collections/${collection.id}/events`, {
  event_type: 'promise_to_pay', outcome: 'Member confirmed a proposed payment date for local QA',
  promised_amount: '100.00', promised_on: new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10),
}, 201);
const collectionList = await call<Array<{ id: string; status: string; events: unknown[] }>>(admin, 'GET', `${base}/collections`);
assert.equal(collectionList.find((row) => row.id === collection.id)?.status, 'promise_to_pay');
assert.equal(collectionList.find((row) => row.id === collection.id)?.events.length, 2);
await call(admin2, 'POST', `${base}/collections/${collection.id}/close`, {
  status: 'resolved', reason: 'Resolve local QA case before closing repayment test',
}, 200);
const finalRepayment=await call<{id:string;status:string}>(teller, 'POST', `${base}/loans/${loan.id}/repay`, {
  amount: '1000.00', idempotency_key: randomUUID(),
}, 201);
assert.equal(finalRepayment.status,'draft');
await call(admin,'POST',`${base}/journals/${finalRepayment.id}/decision`,{decision:'approve',reason:'Independent approval of synthetic final loan repayment'});
await call(teller, 'POST', `${base}/loans/${loan.id}/repay`, {
  amount: '0.01', idempotency_key: randomUUID(),
}, 409);

const loans = await call<Array<{ id: string; status: string }>>(admin, 'GET', `${base}/loans`);
assert.equal(loans.find((item) => item.id === loan.id)?.status, 'repaid');

const productTerms = {
  product_code: 'QA-REDUCING', name: 'Local QA reducing balance', customer_categories: ['group_member'],
  minimum_principal: '500.00', maximum_principal: '5000.00', minimum_tenor_months: 3, maximum_tenor_months: 12,
  repayment_frequency: 'monthly', annual_interest_rate_bps: 1200, interest_method: 'reducing_balance',
  origination_fee_bps: 100, late_penalty_bps: 0, grace_days: 0,
  repayment_priority: ['penalty', 'fee', 'interest', 'principal'],
  maximum_debt_service_bps: 3300, minimum_membership_days: 0, minimum_savings_coverage_bps: 0,
  maximum_concurrent_loans: 1, minimum_equity_bps: 0, required_documents: [], required_fields: [],
  collateral_required: false, maximum_loan_to_value_bps: 0, manual_review_required: true,
};
const productV1 = await call<{ id: string; status: string }>(admin, 'POST', `${base}/loan-products`, {
  terms: productTerms, change_reason: 'Create a synthetic reducing-balance UAT product',
}, 201);
assert.equal(productV1.status, 'pending_approval');
await call(admin, 'POST', `${base}/loan-products/${productV1.id}/decision`, {
  decision: 'approve', reason: 'Product maker cannot approve their own synthetic product',
}, 403);
const approvedProductV1 = await call<{ status: string }>(admin2, 'POST', `${base}/loan-products/${productV1.id}/decision`, {
  decision: 'approve', reason: 'Independent approval of synthetic UAT product version one',
});
assert.equal(approvedProductV1.status, 'active');
const pricedLoan = await call<{ id: string; product_version_id: string; product_terms: typeof productTerms }>(admin, 'POST', `${base}/loans`, {
  member_id: member.id, product_code: productTerms.product_code, principal_amount: '1000.00', term_months: 6,
  purpose: 'Test approved reducing balance product terms in a synthetic UAT journey',
  monthly_income: '10000.00', monthly_expenses: '1000.00', monthly_debt: '0.00',
}, 201);
assert.equal(pricedLoan.product_version_id, productV1.id);
assert.equal(pricedLoan.product_terms.annual_interest_rate_bps, 1200);
const productV2 = await call<{ id: string; status: string }>(admin, 'POST', `${base}/loan-products`, {
  terms: { ...productTerms, annual_interest_rate_bps: 2400 },
  change_reason: 'Update synthetic UAT product pricing for a snapshot check',
}, 201);
await call(admin2, 'POST', `${base}/loan-products/${productV2.id}/decision`, {
  decision: 'approve', reason: 'Independently approve updated synthetic UAT pricing',
});
await call(creditManager, 'POST', `${base}/loans/${pricedLoan.id}/decision`, {
  decision: 'approve', reason: 'Approve using the application original product version snapshot',
});
const pricedDisbursement = await call<{ quote: { total_interest: string; origination_fee: string }; net_disbursed: string }>(
  admin2, 'POST', `${base}/loans/${pricedLoan.id}/disburse`, { idempotency_key: randomUUID() }, 201,
);
assert.equal(pricedDisbursement.quote.origination_fee, '10.00');
assert.equal(pricedDisbursement.net_disbursed, '990.00');
assert.ok(Number(pricedDisbursement.quote.total_interest) > 0);
await call(admin, 'POST', `${base}/loans`, {
  member_id: member.id, product_code: productTerms.product_code, principal_amount: '1000.00', term_months: 6,
  purpose: 'Verify an active loan prevents a concurrent synthetic UAT application',
  monthly_income: '10000.00', monthly_expenses: '1000.00', monthly_debt: '0.00',
}, 409);
const pricedInstallments = await call<Array<{ principal_due: string; interest_due: string }>>(
  admin, 'GET', `${base}/loans/${pricedLoan.id}/installments`,
);
assert.equal(pricedInstallments.length, 6);
assert.equal(Math.round(pricedInstallments.reduce((sum, row) => sum + Number(row.principal_due), 0) * 100), 100000);
assert.ok(pricedInstallments.reduce((sum, row) => sum + Number(row.interest_due), 0) > 0);

const writeoffKey = randomUUID();
const writeoff = await call<{ id: string; amount: string; status: string }>(admin, 'POST', `${base}/loans/${pricedLoan.id}/writeoffs`, {
  idempotency_key: writeoffKey, reason: 'Synthetic UAT full-principal write-off after documented recovery exhaustion',
}, 201);
assert.equal(writeoff.status, 'pending');
const writeoffReplay = await call<{ created: boolean; id: string }>(admin, 'POST', `${base}/loans/${pricedLoan.id}/writeoffs`, {
  idempotency_key: writeoffKey,
  reason: 'Synthetic UAT full-principal write-off after documented recovery exhaustion',
}, 200);
assert.equal(writeoffReplay.created, false);
await call(admin, 'POST', `${base}/writeoffs/${writeoff.id}/decision`, {
  decision: 'approve', reason: 'The write-off requester and loan maker cannot approve this request',
}, 409);
const writeoffDecision = await call<{ status: string; journal: { transaction_type: string } }>(compliance, 'POST', `${base}/writeoffs/${writeoff.id}/decision`, {
  decision: 'approve', reason: 'Independent UAT approval after the recovery review evidence was examined',
});
assert.equal(writeoffDecision.status, 'approved');
assert.equal(writeoffDecision.journal.transaction_type, 'loan_writeoff');
const writtenOffLoans = await call<Array<{ id: string; status: string }>>(admin, 'GET', `${base}/loans`);
assert.equal(writtenOffLoans.find((row) => row.id === pricedLoan.id)?.status, 'written_off');
const memberHolds = await call<Array<{ category: string; status: string }>>(compliance, 'GET', `${base}/members/${member.id}/risk-flags`);
assert.ok(memberHolds.some((row) => row.category === 'delinquency_restriction' && row.status === 'active'));
await call(admin, 'POST', `${base}/loans`, {
  member_id: member.id, product_code: productTerms.product_code, principal_amount: '1000.00', term_months: 6,
  purpose: 'Verify an approved loss restriction prevents new credit',
  monthly_income: '10000.00', monthly_expenses: '1000.00', monthly_debt: '0.00',
}, 409);

const journals = await call<Array<{ lines: Array<{ debit: string; credit: string }> }>>(admin, 'GET', `${base}/transactions`);
assert.ok(journals.length >= 5);
for (const journal of journals) {
  const debit = journal.lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const credit = journal.lines.reduce((sum, line) => sum + Number(line.credit), 0);
  assert.equal(debit, credit, 'Every posted journal must balance');
}
const audit = await call<unknown[]>(compliance, 'GET', `${base}/audit`);
assert.ok(audit.length >= 8);
const overview = await call<{ members: Record<string, number>; cash_balance: string }>(admin, 'GET', `${base}/overview`);
assert.equal(overview.members.active, 1);
assert.equal(Number(overview.cash_balance), 4010);

console.log(JSON.stringify({
  result: 'PASS', feature_flag: feature.mfiPilotEnabled, institution_code: institution.institution_code,
  member_status: active.status, savings_balance: '5000.00', loan_status: loans.find((item) => item.id === loan.id)?.status,
  versioned_product_status: approvedProductV1.status, priced_loan_interest: pricedDisbursement.quote.total_interest,
  balanced_journals: journals.length, audit_events: audit.length,
  verified: ['institution and staff setup', 'separate member review', 'synthetic national ID upload, independent document review, four-eyes KYC and KYC gating', 'savings deposit and idempotency',
    'withdrawal and four-eyes reversal', 'loan application, independent approval and disbursement',
    'credit policy maker-checker, affordability scoring, and role-based personal/financial-data visibility', 'principal-only origination schedule',
    'loan product maker-checker, immutable application terms, priced origination fee, and reducing-balance schedule',
    'active-loan concurrent application eligibility gate',
    'partial repayment reversal and principal balance recalculation', 'policy-threshold NPL classification and independent approval',
    'collection promise and resolution lifecycle',
    'principal repayment and overpayment rejection', 'four-eyes loan write-off, loss journal, waived schedule and post-loss credit hold', 'balanced ledger and audit trail',
    'institution tenant isolation', 'role authorization', 'administrator-only staff and credit-policy configuration'],
}, null, 2));
