DROP POLICY IF EXISTS accounting_event_outbox_scoped_mfi_insert ON accounting_event_outbox;

ALTER POLICY accounting_event_outbox_staff ON accounting_event_outbox
  WITH CHECK (
    app_is_staff()
    OR (
      app_is_platform_tenant_scoped()
      AND source_entity_id = nullif(current_setting('app.mfi_institution_id', true), '')
    )
  );
