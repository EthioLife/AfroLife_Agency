CREATE POLICY accounting_event_outbox_scoped_mfi_insert ON accounting_event_outbox
  FOR INSERT
  WITH CHECK (
    app_is_platform_tenant_scoped()
    AND source_entity_id = nullif(current_setting('app.mfi_institution_id', true), '')
    AND payload->>'checker_id' = app_user_id()::text
    AND payload->>'source_reference' = (
      SELECT 'mfi:' || journal.transaction_type || ':' || journal.id::text
      FROM mfi_journals journal
      WHERE journal.institution_id::text = source_entity_id
        AND journal.status = 'posted'
        AND journal.requires_approval
        AND journal.created_by::text = payload->>'maker_id'
        AND journal.approved_by = app_user_id()
      LIMIT 1
    )
  );
