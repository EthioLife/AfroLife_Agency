import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MAX_JOURNAL_AMOUNT_CENTS,
  toCents,
  validateBalancedJournal,
} from '../services/accounting/journal-validation.js';
import {
  ethioLifePlanScenario,
  ethioLifePrices,
  ethioLifeProducts,
  ethioLifeRevenueTargets,
} from '../services/accounting/product-catalog.js';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('standalone accounting workspace shares AfroLife surface and focus tokens', () => {
  const styles = source('services/accounting/web/accounting.css');

  assert.match(styles, /--ink:\s*#202a27/i);
  assert.match(styles, /--green:\s*#174b3d/i);
  assert.match(styles, /--green-dark:\s*#10382e/i);
  assert.match(styles, /--gold:\s*#d7ad59/i);
  assert.match(styles, /--surface-shadow:\s*0 2px 8px rgba\(23, 75, 61, \.08\)/i);
  assert.match(styles, /header\s*\{[^}]*border-top:\s*3px solid var\(--green\);[^}]*background:\s*var\(--surface\);/s);
  assert.match(styles, /\.card\s*\{[^}]*border-radius:\s*12px;[^}]*box-shadow:\s*var\(--surface-shadow\);/s);
  assert.match(styles, /\.metric\s*\{[^}]*border-top:\s*3px solid var\(--green\);[^}]*background:\s*var\(--surface\);/s);
  assert.match(styles, /button:focus-visible,\s*a:focus-visible,\s*input:focus-visible/);
  assert.match(styles, /th\s*\{\s*background:\s*var\(--surface-soft\);/);
});

test('journal validation balances exact cents and rejects invalid or oversized entries', () => {
  assert.equal(toCents('9999999999999999.99'), MAX_JOURNAL_AMOUNT_CENTS);
  assert.equal(validateBalancedJournal([
    { debit: '9999999999999999.99', credit: '0.00' },
    { debit: '0.00', credit: '9999999999999999.99' },
  ]), MAX_JOURNAL_AMOUNT_CENTS);

  assert.throws(() => validateBalancedJournal([
    { debit: '1.00', credit: '1.00' },
    { debit: '0.00', credit: '0.00' },
  ]), /Each journal line must contain either a debit or a credit/);
  assert.throws(() => validateBalancedJournal([
    { debit: '1.00', credit: '0.00' },
    { debit: '0.00', credit: '0.99' },
  ]), /must balance and be greater than zero/);
  assert.throws(() => validateBalancedJournal([
    { debit: '9999999999999999.99', credit: '0.00' },
    { debit: '0.00', credit: '9999999999999999.99' },
    { debit: '0.01', credit: '0.00' },
    { debit: '0.00', credit: '0.01' },
  ]), /exceeds the supported journal amount/);
});

test('accounting database migration protects unique transaction references and review controls', () => {
  const migration = source('services/accounting/004_accounting_transaction_controls.sql');
  const workflowRouter = source('services/accounting/workflows.ts');
  const accountingRouter = source('services/accounting/router.ts');
  const accountingUi = source('services/accounting/web/app.js');
  const coreAccountingUi = source('public/accounting.js');
  const ingestion = source('services/accounting/ingest.ts');
  const server = source('services/accounting/server.ts');

  assert.match(migration, /CREATE UNIQUE INDEX accounting_journals_entity_source_reference_uq/);
  assert.match(migration, /CREATE TRIGGER accounting_journal_insert_guard/);
  assert.match(migration, /CREATE TRIGGER accounting_journal_line_insert_guard/);
  assert.match(migration, /ADD COLUMN close_requested_by uuid/);
  assert.match(migration, /OLD\.status = 'open' AND NEW\.status = 'review'/);
  assert.match(migration, /OLD\.status = 'review' AND NEW\.status = 'closed'/);
  assert.match(migration, /NEW\.closed_by = OLD\.close_requested_by/);
  assert.match(migration, /FOR UPDATE;\s*IF period_status IS DISTINCT FROM 'open'/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OR DELETE ON accounting_document_lines/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OR DELETE ON accounting_budget_lines/);
  assert.match(migration, /CREATE TRIGGER accounting_document_payment_guard/);
  assert.match(migration, /NEW\.reviewed_by = OLD\.recorded_by/);
  assert.match(migration, /Approved document must reference its balanced, independently approved journal/);
  assert.match(migration, /Payment journal lines must clear the document control account/);
  assert.match(migration, /CREATE TRIGGER accounting_budget_guard/);
  assert.match(migration, /CREATE TRIGGER accounting_tax_filing_guard/);
  assert.match(migration, /NEW\.matched_by/);
  assert.match(workflowRouter, /Bank statement importer cannot reconcile their own statement line/);
  assert.match(accountingRouter, /accounting-journal:\$\{entityId\}:\$\{body\.idempotency_key\}/);
  assert.match(accountingRouter, /j\.entry_date<\$2::date/);
  assert.match(accountingRouter, /period_close_requested/);
  assert.match(accountingRouter, /periods\/:periodId\/close\/approve/);
  assert.match(accountingRouter, /The period close requester cannot approve their own request/);
  assert.match(accountingUi, /period\.status==='review'&&period\.close_requested_by!==user\.id/);
  assert.match(coreAccountingUi, /period\.status==='review'&&period\.close_requested_by!==user\.id/);
  assert.match(ingestion, /accounting-reference:\$\{entityId\}:\$\{body\.source_reference\}/);
  assert.match(server, /ingestHandler\(req,res\)\.catch\(next\)/);
});

test('accounting production image packages every migration required by the migrator', () => {
  const dockerfile = source('services/accounting/Dockerfile');
  const migrator = source('services/accounting/migrate.ts');
  const migrations = [
    '001_accounting.sql',
    '002_accounting_workflows.sql',
    '003_accounting_entity_access.sql',
    '004_accounting_transaction_controls.sql',
    '005_accounting_subscriber_ownership.sql',
    '006_accounting_products_and_pricing.sql',
  ];

  for (const migration of migrations) {
    assert.match(migrator, new RegExp(`'[^']+','${migration.replaceAll('.', '\\.')}'`));
    assert.match(dockerfile, new RegExp(`COPY services/accounting/${migration.replaceAll('.', '\\.')} \\.\\/dist\\/services\\/accounting\\/${migration.replaceAll('.', '\\.')}`));
  }
});

test('tenant service template keeps historical references subordinate to divisions', () => {
  const divisions = new Set(ethioLifeProducts.filter((product) => product.productType === 'division').map((product) => product.code));
  const offerings = new Set(ethioLifeProducts.filter((product) => product.productType === 'offering').map((product) => product.code));

  assert.deepEqual([...divisions].sort(), [
    'BRIGHT_SPACES', 'DLS', 'ETHIOCARE', 'RPM', 'SKS', 'TRAINING',
  ]);
  assert.ok(ethioLifeProducts
    .filter((product) => product.productType === 'offering')
    .every((product) => product.parentCode && divisions.has(product.parentCode)));
  assert.ok(ethioLifePrices.every((price) => offerings.has(price.productCode)));
  assert.ok(ethioLifePrices.every((price) => /Draft guidance only/.test(price.sourceNote)));
  assert.ok(ethioLifePrices.every((price) => price.pricingModel !== 'percentage'
    || (price.priceUnit === 'percentage_of_gross_monthly_rent' && price.currency === null)));
  assert.ok(ethioLifeRevenueTargets.every((target) => divisions.has(target.productCode)));
  assert.match(ethioLifePlanScenario.name, /historical reference/i);
  assert.match(ethioLifePlanScenario.sourceNote, /not calendar years or approved current budgets/i);
});

test('tenant product migration and workflows enforce isolated, reviewed price references', () => {
  const migration = source('services/accounting/006_accounting_products_and_pricing.sql');
  const productsRouter = source('services/accounting/products.ts');
  const accountingRouter = source('services/accounting/router.ts');
  const workflows = source('services/accounting/workflows.ts');
  const operationsUi = source('public/accounting-operations.js');
  const journalUi = source('services/accounting/web/app.js');

  assert.match(migration, /FOREIGN KEY \(parent_product_id,entity_id\)/);
  assert.match(migration, /FOREIGN KEY \(product_id,entity_id\) REFERENCES accounting_products/);
  assert.match(migration, /CHECK \(minimum_rate IS NULL OR minimum_rate>=0\)/);
  assert.match(migration, /CHECK \(maximum_rate IS NULL OR maximum_rate>=0\)/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /Product price review requires an independent reviewer and reason/);
  assert.match(migration, /overlapping effective dates/);
  assert.match(accountingRouter, /createAccountingProductRouter\(withUser\)/);
  assert.match(productsRouter, /product-profitability/);
  assert.match(productsRouter, /sendProfitabilityCsv/);
  assert.match(accountingRouter, /product_id/);
  assert.match(workflows, /product_id:UUID\.optional\(\)\.nullable\(\)/);
  assert.match(workflows, /l\.product_id/);
  assert.match(operationsUi, /select\('product_id','Service offering \(optional\)'/);
  assert.match(operationsUi, /\.\.\.\(v\.product_id\?\{product_id:v\.product_id\}:\{\}\)/);
  assert.match(journalUi, /name='product_id'/);
});
