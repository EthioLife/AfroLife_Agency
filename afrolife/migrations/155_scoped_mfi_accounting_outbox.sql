CREATE POLICY accounting_event_outbox_scoped_mfi_insert ON accounting_event_outbox
  FOR INSERT
  WITH CHECK (
    app_is_platform_tenant_scoped()
    AND source_entity_id = nullif(current_setting('app.mfi_institution_id', true), '')
    AND payload->>'checker_id' = app_user_id()::text
    AND payload->>'maker_id' IS NOT NULL
    AND payload->>'maker_id' <> payload->>'checker_id'
    AND payload->>'source_reference' ~
      '^mfi:(savings_deposit|savings_withdrawal|share_contribution|loan_disbursement|loan_repayment|reversal):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );
