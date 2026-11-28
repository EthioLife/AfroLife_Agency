CREATE OR REPLACE FUNCTION enqueue_scoped_mfi_accounting_event(
  event_source_event_id uuid,
  event_source_entity_id text,
  event_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
BEGIN
  IF NOT app_is_platform_tenant_scoped()
    OR event_source_entity_id IS DISTINCT FROM nullif(current_setting('app.mfi_institution_id', true), '')
    OR event_payload->>'checker_id' IS DISTINCT FROM app_user_id()::text
    OR nullif(event_payload->>'maker_id', '') IS NULL
    OR event_payload->>'maker_id' IS NOT DISTINCT FROM event_payload->>'checker_id'
    OR event_payload->>'source_reference' !~
      '^mfi:[a-z_]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RAISE EXCEPTION 'MFI accounting event is outside the authorized institution context'
      USING ERRCODE='42501';
  END IF;

  INSERT INTO accounting_event_outbox(source_event_id, source_entity_id, payload)
  VALUES (event_source_event_id, event_source_entity_id, event_payload)
  ON CONFLICT (source_event_id) DO NOTHING;
END
$$;

REVOKE ALL ON FUNCTION enqueue_scoped_mfi_accounting_event(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enqueue_scoped_mfi_accounting_event(uuid, text, jsonb) TO "{{role}}";
