import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decimalToCents, parseMfiAmount } from '../src/mfi-money.js';
import { MFI_SANDBOX_SIMULATIONS, runMfiSandboxSimulation } from '../src/mfi-sandbox.js';

const sharedPortals = readFileSync(new URL('../migrations/050_shared_mini_app_portals.sql', import.meta.url), 'utf8');
const mfiRouter = readFileSync(new URL('../src/mfi.ts', import.meta.url), 'utf8');
const mfiStaffLookupMigration = readFileSync(new URL('../migrations/154_scoped_mfi_staff_phone_lookup.sql', import.meta.url), 'utf8');
const core = readFileSync(new URL('../src/core.ts', import.meta.url), 'utf8');
const mfiUi = readFileSync(new URL('../public/mfi.js', import.meta.url), 'utf8');
const mfiE2e = readFileSync(new URL('../scripts/local-mfi-e2e.ts', import.meta.url), 'utf8');
const mfiApprovalMigration = readFileSync(new URL('../migrations/073_mfi_journal_maker_checker.sql', import.meta.url), 'utf8');
const accountingMock = JSON.parse(readFileSync(new URL('./fixtures/accounting-source-events.json', import.meta.url), 'utf8')) as {
  events:Array<{source_reference:string;lines:Array<{debit:string;credit:string}>}>;
};
const insuranceRequests = readFileSync(new URL('../src/insurance-requests.ts', import.meta.url), 'utf8');

test('MFI amounts preserve decimal cents without floating-point rounding', () => {
  assert.equal(parseMfiAmount('0.01'), '0.01');
  assert.equal(decimalToCents('0.01'), 1n);
  assert.equal(decimalToCents('12345678901234.56'), 1234567890123456n);
  assert.equal(decimalToCents(parseMfiAmount('12')), 1200n);
});

test('MFI amounts reject zero, excess precision, negatives and exponent notation', () => {
  for (const value of ['0', '0.00', '-1.00', '1.001', '1e2', '100000000000000.00']) {
    assert.throws(() => parseMfiAmount(value));
  }
  assert.throws(() => decimalToCents('1.001'), TypeError);
});

test('MFI E2E requires matching disposable fixture and migration database URLs', () => {
  assert.match(mfiE2e, /MFI_E2E_DATABASE_URL must explicitly target a disposable test database/);
  assert.match(mfiE2e, /MIGRATION_DATABASE_URL must explicitly target the MFI E2E database/);
  assert.match(mfiE2e, /migrationDatabase === fixtureDatabase/);
  assert.match(mfiE2e, /afrolife_test_\[a-z0-9_-\]/);
});

test('tenant-scoped MFI staff provisioning only looks up the explicitly requested phone', () => {
  assert.match(mfiStaffLookupMigration, /ALTER POLICY users_platform_tenant_scope ON users[\s\S]*app_role\(\)='super_admin'[\s\S]*app_platform_tenant_id\(\) IS NOT NULL[\s\S]*app_user_phone_lookup\(phone\)/);
  assert.match(mfiRouter, /withUser\(req\.user!, async \(client\) => \{[\s\S]*WHERE phone=\$1 AND active AND role IN \('global_admin','super_admin','compliance','finance','finance_manager'\)/);
  assert.match(mfiRouter, /\}, \{ userLookupPhones: \[body\.phone\] \}\)/);
  assert.match(core, /options\.userLookupPhones[\s\S]*set_config\('app\.user_lookup_phones'/);
});

test('synthetic MFI financial events balance and MFI savings/repayments require an independent checker', () => {
  assert.equal(accountingMock.events.length,4);
  assert.equal(new Set(accountingMock.events.map((event)=>event.source_reference)).size,accountingMock.events.length);
  for(const event of accountingMock.events){
    const debit=event.lines.reduce((sum,line)=>sum+decimalToCents(line.debit),0n);
    const credit=event.lines.reduce((sum,line)=>sum+decimalToCents(line.credit),0n);
    assert.ok(debit>0n);
    assert.equal(debit,credit,event.source_reference);
  }
  assert.match(mfiApprovalMigration,/requires_approval boolean NOT NULL DEFAULT false/);
  assert.match(mfiApprovalMigration,/MFI journal requires an independent reviewer and reason/);
  assert.match(mfiRouter,/requiresApproval: true/);
  assert.match(mfiRouter,/The financial request maker cannot review their own request/);
  assert.match(mfiRouter,/enqueueAccountingEvent\(client/);
  assert.match(mfiUi,/journal-decision/);
});

test('shared mini-app member portals require consent and isolate member financial records', () => {
  assert.match(sharedPortals, /CREATE TABLE mfi_member_applications/);
  assert.match(sharedPortals, /consented_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(sharedPortals, /user_id = app_user_id\(\)/);
  assert.match(sharedPortals, /mfi_journals_self_read/);
  assert.match(sharedPortals, /mfi_journal_lines_self_read/);
  assert.match(sharedPortals, /mfi_member_application_audit_create/);
  assert.match(sharedPortals, /application\.user_id = app_user_id\(\)/);
  assert.match(sharedPortals, /insurance_interest_request_read/);
  assert.match(mfiRouter, /mfiRouter\.get\('\/member-portal'/);
  assert.match(mfiRouter, /WHERE application\.user_id=\$1/);
  assert.match(mfiRouter, /z\.object\(\{ consent: z\.literal\(true\) \}\)\.strict\(\)/);
  assert.match(mfiRouter, /Applicants cannot review their own membership request/);
  assert.match(insuranceRequests, /consent: z\.literal\(true\)/);
  assert.match(insuranceRequests, /Assigned Insurance request-review access is required/);
});

test('credit risk reporting stays institution-scoped and aggregate-only', () => {
  assert.match(mfiRouter, /reports\/credit-risk/);
  assert.match(mfiRouter, /WITH scored AS \(/);
  assert.match(mfiRouter, /'institution_admin','finance_manager','credit_manager','compliance','auditor'/);
  assert.match(mfiRouter, /score_bands: scoreBands\.rows/);
  assert.match(mfiRouter, /classifications: classifications\.rows/);
  assert.match(mfiRouter, /portfolio: portfolio\.rows\[0\]/);
  assert.match(mfiRouter, /model_registry:/);
  assert.match(mfiRouter, /promotion_gates:/);
  assert.match(mfiRouter, /GROUP BY loan\.npl_status/);
  assert.match(mfiRouter, /not a probability of default/);
  assert.doesNotMatch(mfiRouter.slice(mfiRouter.indexOf("reports/credit-risk"), mfiRouter.indexOf("reports/trial-balance")), /member_name|phone|full_name/);
  assert.match(mfiUi, /id: 'risk-analytics', label: 'Credit scoring & risk'/);
  assert.match(mfiUi, /function renderCreditRisk\(\)/);
  assert.match(mfiUi, /Portfolio quality and arrears aging/);
  assert.match(mfiUi, /Model inventory and promotion gates/);
  assert.match(mfiUi, /reports\/credit-risk/);
});

test('provider, regulatory, and challenger sandbox scenarios are synthetic and side-effect-free', () => {
  const examples = [
    ['crb','clear_file'], ['biometrics','match'], ['payment_rail','success'],
    ['regulatory_return','monthly_mfi'], ['ml_shadow','synthetic_portfolio_batch'],
  ] as const;
  assert.equal(MFI_SANDBOX_SIMULATIONS.length, 5);
  for (const [simulation, scenario] of examples) {
    const result = runMfiSandboxSimulation(simulation, scenario);
    assert.equal(result.sandbox_only, true);
    assert.equal(result.real_provider_called, false);
    assert.equal(result.production_side_effects, false);
    assert.equal(result.real_customer_data_used, false);
  }
  const payment = runMfiSandboxSimulation('payment_rail', 'success');
  assert.match(String(payment.result.notice), /no ledger journal was posted/i);
  const report = runMfiSandboxSimulation('regulatory_return', 'monthly_mfi');
  assert.match(String(report.result.notice), /not submitted/i);
  const model = runMfiSandboxSimulation('ml_shadow', 'synthetic_portfolio_batch');
  assert.equal(model.result.production_status, 'disconnected_shadow_only');
  assert.match(String(model.result.metric_label), /not a probability of default/);
  assert.throws(() => runMfiSandboxSimulation('crb', 'real_member_id'));
  assert.match(mfiRouter, /sandbox\/runs/);
  assert.match(mfiRouter, /sandbox\/:simulation/);
  assert.match(mfiUi, /id: 'sandbox-lab', label: 'Sandbox integrations'/);
  assert.match(mfiUi, /function renderSandboxLab\(\)/);
  assert.match(mfiUi, /SANDBOX ONLY/);
});
