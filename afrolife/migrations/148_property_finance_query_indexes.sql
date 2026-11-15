CREATE INDEX rent_transactions_tenant_created_idx
  ON rent_transactions(tenant_system_id,created_at)
  INCLUDE (status,reconciled_at,voided_at);

CREATE INDEX rent_transactions_lease_kind_status_idx
  ON rent_transactions(lease_id,kind,status)
  INCLUDE (amount,reconciled_at);

CREATE INDEX rent_charges_due_status_idx
  ON rent_charges(due_on,status)
  INCLUDE (lease_id,paid_at);

CREATE INDEX rent_charges_lease_status_idx
  ON rent_charges(lease_id,status)
  INCLUDE (amount,due_on,paid_at);

CREATE INDEX ledger_entries_rent_period_idx
  ON ledger_entries(created_at,txn_id)
  INCLUDE (debit,credit)
  WHERE ref_type='rent_transaction';

CREATE INDEX ledger_entries_rent_transaction_idx
  ON ledger_entries(txn_id)
  INCLUDE (debit,credit)
  WHERE ref_type='rent_transaction';
