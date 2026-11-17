export const PROPERTY_CHART_OF_ACCOUNTS = {
  version: 1,
  status: 'draft_requires_finance_signoff',
  currency: 'ETB',
  accounts: [
    { code: '1000', name: 'Cash', type: 'asset', normal_balance: 'debit', posting_key: 'cash' },
    { code: '1200', name: 'Rent Receivable', type: 'asset', normal_balance: 'debit', posting_key: 'rent_receivable' },
    { code: '2100', name: 'Accounts Payable', type: 'liability', normal_balance: 'credit', posting_key: 'accounts_payable' },
    { code: '2200', name: 'Tenant Deposit Liability', type: 'liability', normal_balance: 'credit', posting_key: 'tenant_deposit_liability' },
    { code: '2300', name: 'Owner Funds Payable', type: 'liability', normal_balance: 'credit', posting_key: 'owner_funds_payable' },
    { code: '4000', name: 'Rental Revenue', type: 'income', normal_balance: 'credit', posting_key: 'rental_revenue' },
    { code: '6100', name: 'Maintenance Expense', type: 'expense', normal_balance: 'debit', posting_key: 'maintenance_expense' },
  ],
  notes: [
    'Proposed mapping only; Finance must approve the legal entity, account codes and recognition policy before production use.',
    'Approved vendor invoices accrue Maintenance Expense and Accounts Payable; reconciled payments clear the payable against Cash. This template does not establish custody, tax or owner remittance policy.',
    'Assess lessor accounting under IFRS 16 where applicable; assess property-management service fees under IFRS 15 where applicable.',
  ],
} as const;

export type PropertyPeriodCloseCheck = {
  period: string;
  pending_receipts: number;
  unpaid_rent_charges: number;
  unbalanced_ledger_transactions: number;
  ready_for_finance_review: boolean;
  evidence_only: true;
};

export function isVendorInvoiceEligible(status: string): boolean {
  return status === 'completed' || status === 'done';
}

export function canReconcileVendorPayment(input: {
  invoiceApproverId: string | null;
  paymentRecorderId: string | null;
  reconcilerId: string;
}): boolean {
  return Boolean(input.invoiceApproverId && input.paymentRecorderId)
    && input.reconcilerId !== input.invoiceApproverId
    && input.reconcilerId !== input.paymentRecorderId;
}

export function propertyPeriodCloseCheck(input: {
  period: string;
  pendingReceipts: number;
  unpaidRentCharges: number;
  unbalancedLedgerTransactions: number;
}): PropertyPeriodCloseCheck {
  return {
    period: input.period,
    pending_receipts: input.pendingReceipts,
    unpaid_rent_charges: input.unpaidRentCharges,
    unbalanced_ledger_transactions: input.unbalancedLedgerTransactions,
    ready_for_finance_review: input.pendingReceipts === 0
      && input.unpaidRentCharges === 0
      && input.unbalancedLedgerTransactions === 0,
    evidence_only: true,
  };
}
