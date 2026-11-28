CREATE OR REPLACE FUNCTION enqueue_scoped_mfi_accounting_event(
  event_source_event_id uuid,
  event_source_entity_id text,
  event_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
SET row_security=off
AS $$
BEGIN
  IF NOT app_is_platform_tenant_scoped()
    OR event_source_entity_id IS DISTINCT FROM nullif(current_setting('app.mfi_institution_id', true), '')
    OR app_user_id() IS NULL
    OR nullif(event_payload->>'maker_id', '') IS NULL
    OR nullif(event_payload->>'checker_id', '') IS NULL
    OR event_payload->>'maker_id' IS NOT DISTINCT FROM event_payload->>'checker_id'
    OR event_payload->>'source_event_id' IS DISTINCT FROM event_source_event_id::text
    OR event_payload->>'source_entity_id' IS DISTINCT FROM event_source_entity_id
    OR coalesce(event_payload->>'source_reference' ~
      '^mfi:[a-z_]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false) IS NOT TRUE
  THEN
    RAISE EXCEPTION 'MFI accounting event is outside the authorized institution context'
      USING ERRCODE='42501',
        DETAIL = format(
          'scope=%s institution=%s user=%s maker=%s checker=%s distinct=%s event_id=%s entity=%s reference=%s',
          app_is_platform_tenant_scoped(),
          event_source_entity_id IS NOT DISTINCT FROM nullif(current_setting('app.mfi_institution_id', true), ''),
          app_user_id() IS NOT NULL,
          nullif(event_payload->>'maker_id', '') IS NOT NULL,
          nullif(event_payload->>'checker_id', '') IS NOT NULL,
          event_payload->>'maker_id' IS DISTINCT FROM event_payload->>'checker_id',
          event_payload->>'source_event_id' IS NOT DISTINCT FROM event_source_event_id::text,
          event_payload->>'source_entity_id' IS NOT DISTINCT FROM event_source_entity_id,
          coalesce(event_payload->>'source_reference' ~
            '^mfi:[a-z_]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false)
        );
  END IF;

  INSERT INTO accounting_event_outbox(source_event_id, source_entity_id, payload)
  VALUES (event_source_event_id, event_source_entity_id, event_payload)
  ON CONFLICT (source_event_id) DO NOTHING;
END
$$;

REVOKE ALL ON FUNCTION enqueue_scoped_mfi_accounting_event(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enqueue_scoped_mfi_accounting_event(uuid, text, jsonb) TO "{{role}}";
