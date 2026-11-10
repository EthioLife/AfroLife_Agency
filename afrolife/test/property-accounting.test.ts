import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  canReconcileVendorPayment,
  isVendorInvoiceEligible,
  PROPERTY_CHART_OF_ACCOUNTS,
  propertyPeriodCloseCheck,
} from '../src/property-accounting.js';
import { toCsv } from '../src/csv.js';

test('property chart template preserves legacy ledger labels and stays draft pending Finance approval', () => {
  assert.equal(PROPERTY_CHART_OF_ACCOUNTS.status, 'draft_requires_finance_signoff');
  assert.deepEqual(
    PROPERTY_CHART_OF_ACCOUNTS.accounts.map((account) => account.name),
    ['Cash', 'Rent Receivable', 'Accounts Payable', 'Tenant Deposit Liability', 'Owner Funds Payable', 'Rental Revenue', 'Maintenance Expense'],
  );
  assert.equal(new Set(PROPERTY_CHART_OF_ACCOUNTS.accounts.map((account) => account.code)).size, 7);
  assert.ok(PROPERTY_CHART_OF_ACCOUNTS.notes.some((note) => note.includes('IFRS 16')));
});

test('vendor bills and payments require separate maker-checker reconciliations before Accounting outbox events post', async () => {
  const migration = await readFile(new URL('../migrations/075_property_maintenance_accounting.sql', import.meta.url), 'utf8');
  const accessMigration = await readFile(new URL('../migrations/077_property_finance_maintenance_read.sql', import.meta.url), 'utf8');
  const vendorRoutes = await readFile(new URL('../src/property-vendor-accounting.ts', import.meta.url), 'utf8');
  assert.match(vendorRoutes, /property-vendor-bills\/:id\/decision/);
  assert.match(vendorRoutes, /property-vendor-payments\/:id\/reconcile/);
  assert.match(vendorRoutes, /bill\.recorded_by===req\.user!\.id/);
  assert.match(vendorRoutes, /invoiceApproverId: bill\.approved_by/);
  assert.match(vendorRoutes, /paymentRecorderId: bill\.payment_recorded_by/);
  assert.match(vendorRoutes, /Payment reconciliation requires a different Finance Manager/);
  assert.match(vendorRoutes, /source_account_code:'maintenance_expense'/);
  assert.match(vendorRoutes, /source_account_code:'accounts_payable'/);
  assert.match(vendorRoutes, /source_account_code:'cash'/);
  assert.match(migration, /CHECK \(approved_by IS NULL OR approved_by <> recorded_by\)/);
  assert.match(migration, /CHECK \(payment_reconciled_by IS NULL OR payment_reconciled_by <> payment_recorded_by\)/);
  assert.match(migration, /ALTER TABLE property_vendor_bills FORCE ROW LEVEL SECURITY/);
  assert.match(accessMigration, /property_maintenance_finance_read ON maintenance_requests FOR SELECT/);
});

test('vendor invoices require completed work and payment reconciliation is independent', async () => {
  assert.equal(isVendorInvoiceEligible('completed'), true);
  assert.equal(isVendorInvoiceEligible('done'), true);
  for (const status of ['open', 'triaged', 'assigned', 'accepted', 'in_progress', 'awaiting_review', 'rework_required', 'cancelled']) {
    assert.equal(isVendorInvoiceEligible(status), false, `${status} must not accept an invoice`);
  }

  const duties = {
    invoiceApproverId: 'invoice-approver',
    paymentRecorderId: 'payment-recorder',
    reconcilerId: 'payment-reconciler',
  };
  assert.equal(canReconcileVendorPayment(duties), true);
  assert.equal(canReconcileVendorPayment({ ...duties, reconcilerId: duties.invoiceApproverId }), false);
  assert.equal(canReconcileVendorPayment({ ...duties, reconcilerId: duties.paymentRecorderId }), false);
  assert.equal(canReconcileVendorPayment({ ...duties, invoiceApproverId: null }), false);
  assert.equal(canReconcileVendorPayment({ ...duties, paymentRecorderId: null }), false);

  const vendorRoutes = await readFile(new URL('../src/property-vendor-accounting.ts', import.meta.url), 'utf8');
  assert.match(vendorRoutes, /isVendorInvoiceEligible\(maintenance\.status\)/);
  assert.match(vendorRoutes, /canReconcileVendorPayment\(\{/);

  const databaseGuard = await readFile(
    new URL('../migrations/138_property_vendor_bill_work_completion_guard.sql', import.meta.url),
    'utf8',
  );
  assert.match(databaseGuard, /BEFORE INSERT OR UPDATE OF maintenance_request_id ON property_vendor_bills/);
  assert.match(databaseGuard, /FOR SHARE/);
  assert.match(databaseGuard, /work_status NOT IN \('completed','done'\)/);
});

test('property period close is ready only when all report-only checks are clear', () => {
  assert.deepEqual(propertyPeriodCloseCheck({
    period: '2026-10',
    pendingReceipts: 0,
    unpaidRentCharges: 0,
    unbalancedLedgerTransactions: 0,
  }), {
    period: '2026-10',
    pending_receipts: 0,
    unpaid_rent_charges: 0,
    unbalanced_ledger_transactions: 0,
    ready_for_finance_review: true,
    evidence_only: true,
  });
  assert.equal(propertyPeriodCloseCheck({
    period: '2026-10',
    pendingReceipts: 1,
    unpaidRentCharges: 0,
    unbalancedLedgerTransactions: 0,
  }).ready_for_finance_review, false);
});

test('owner statement CSV protects text values and exports deposit disposition columns', async () => {
  const csv = toCsv([{
    address: '=HYPERLINK("https://example.invalid")',
    rent_reconciled: '1250.00',
    deposit_refunded: '0.00',
    approved_deposit_deduction: '0.00',
    approved_deposit_refund_remaining: '1250.00',
  }], ['address', 'rent_reconciled', 'deposit_refunded', 'approved_deposit_deduction', 'approved_deposit_refund_remaining']);
  assert.match(csv, /'=/);
  assert.match(csv, /deposit_refunded,approved_deposit_deduction,approved_deposit_refund_remaining/);
  const ops = await readFile(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(ops, /AS approved_deposit_deduction/);
  assert.match(ops, /AS approved_deposit_refund_remaining/);
});
