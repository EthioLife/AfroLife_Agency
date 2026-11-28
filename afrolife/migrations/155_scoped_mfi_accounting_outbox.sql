CREATE POLICY accounting_event_outbox_scoped_mfi_insert ON accounting_event_outbox
  FOR INSERT
  WITH CHECK (
    app_is_platform_tenant_scoped()
    AND source_entity_id = nullif(current_setting('app.mfi_institution_id', true), '')
  );
