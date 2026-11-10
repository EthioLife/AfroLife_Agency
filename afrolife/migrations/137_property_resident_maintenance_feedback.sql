CREATE TABLE maintenance_resident_feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_system_id uuid NOT NULL REFERENCES property_operating_tenants(id),
  maintenance_request_id uuid NOT NULL REFERENCES maintenance_requests(id),
  completion_event_id bigint NOT NULL REFERENCES maintenance_request_events(id),
  submitted_by uuid NOT NULL REFERENCES users(id),
  response text NOT NULL CHECK (response IN ('confirmed','issue_reported')),
  note text,
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (maintenance_request_id,completion_event_id),
  UNIQUE (submitted_by,idempotency_key),
  CHECK (
    (response='confirmed' AND (note IS NULL OR length(trim(note))<=1000))
    OR (response='issue_reported' AND note IS NOT NULL AND length(trim(note)) BETWEEN 10 AND 1000)
  )
);
CREATE INDEX maintenance_resident_feedback_tenant_request_idx
  ON maintenance_resident_feedback(tenant_system_id,maintenance_request_id,created_at,id);

CREATE TRIGGER maintenance_resident_feedback_immutable
  BEFORE UPDATE OR DELETE ON maintenance_resident_feedback
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

ALTER TABLE maintenance_resident_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_resident_feedback FORCE ROW LEVEL SECURITY;
CREATE POLICY maintenance_resident_feedback_scoped_read
  ON maintenance_resident_feedback FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND EXISTS (
      SELECT 1 FROM maintenance_requests maintenance
      WHERE maintenance.id=maintenance_resident_feedback.maintenance_request_id
        AND maintenance.tenant_system_id=maintenance_resident_feedback.tenant_system_id
        AND (
          (app_role()='customer' AND maintenance.resident_user_id=app_user_id())
          OR app_has_permission('property.maintenance.manage')
        )
    )
  );
CREATE POLICY maintenance_resident_feedback_command_insert
  ON maintenance_resident_feedback FOR INSERT
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND submitted_by=app_user_id()
    AND app_role()='customer'
    AND EXISTS (
      SELECT 1 FROM maintenance_requests maintenance
      WHERE maintenance.id=maintenance_resident_feedback.maintenance_request_id
        AND maintenance.tenant_system_id=maintenance_resident_feedback.tenant_system_id
        AND maintenance.resident_user_id=app_user_id()
        AND maintenance.status='completed'
    )
    AND EXISTS (
      SELECT 1 FROM maintenance_request_events event
      WHERE event.id=maintenance_resident_feedback.completion_event_id
        AND event.maintenance_request_id=maintenance_resident_feedback.maintenance_request_id
        AND event.to_status='completed'
    )
  );
REVOKE ALL ON TABLE maintenance_resident_feedback FROM PUBLIC,"{{role}}";
GRANT SELECT ON TABLE maintenance_resident_feedback TO "{{role}}";

CREATE OR REPLACE FUNCTION submit_maintenance_resident_feedback(
  target_request uuid,
  target_response text,
  target_note text,
  target_idempotency_key uuid,
  target_payload_hash text
)
RETURNS TABLE (
  feedback_id bigint,
  response text,
  note text,
  created_at timestamptz,
  completion_event_id bigint,
  replayed boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  maintenance maintenance_requests%ROWTYPE;
  completion_event bigint;
  previous maintenance_resident_feedback%ROWTYPE;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL OR app_role()<>'customer'
    OR target_request IS NULL OR target_response IS NULL
    OR target_response NOT IN ('confirmed','issue_reported')
    OR target_idempotency_key IS NULL OR target_payload_hash IS NULL
    OR target_payload_hash !~ '^[0-9a-f]{64}$'
    OR (target_response='issue_reported'
      AND (target_note IS NULL OR length(trim(target_note)) NOT BETWEEN 10 AND 1000))
    OR (target_response='confirmed' AND target_note IS NOT NULL
      AND length(trim(target_note))>1000) THEN
    RAISE EXCEPTION 'A valid resident completion response is required'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO maintenance
  FROM maintenance_requests request
  WHERE request.id=target_request
    AND request.tenant_system_id=tenant_id
    AND request.resident_user_id=actor
  FOR UPDATE;
  IF maintenance.id IS NULL THEN
    RAISE EXCEPTION 'Feedback is available only to the linked resident after independent completion approval'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO previous
  FROM maintenance_resident_feedback feedback
  WHERE feedback.tenant_system_id=tenant_id
    AND feedback.submitted_by=actor
    AND feedback.idempotency_key=target_idempotency_key;
  IF previous.id IS NOT NULL THEN
    IF previous.maintenance_request_id<>target_request
      OR previous.payload_hash<>target_payload_hash THEN
      RAISE EXCEPTION 'Idempotency-Key was already used for a different maintenance response'
        USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT previous.id,previous.response,previous.note,previous.created_at,
      previous.completion_event_id,true;
    RETURN;
  END IF;
  IF maintenance.status<>'completed' THEN
    RAISE EXCEPTION 'Feedback is available only to the linked resident after independent completion approval'
      USING ERRCODE='42501';
  END IF;

  SELECT event.id INTO completion_event
  FROM maintenance_request_events event
  WHERE event.maintenance_request_id=maintenance.id
    AND event.to_status='completed'
  ORDER BY event.created_at DESC,event.id DESC
  LIMIT 1;
  IF completion_event IS NULL THEN
    RAISE EXCEPTION 'The completed maintenance record has no completion event'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO maintenance_resident_feedback(
    tenant_system_id,maintenance_request_id,completion_event_id,submitted_by,
    response,note,idempotency_key,payload_hash
  ) VALUES (
    tenant_id,maintenance.id,completion_event,actor,target_response,
    NULLIF(trim(target_note),''),target_idempotency_key,target_payload_hash
  )
  RETURNING maintenance_resident_feedback.id,
    maintenance_resident_feedback.response,
    maintenance_resident_feedback.note,
    maintenance_resident_feedback.created_at,
    maintenance_resident_feedback.completion_event_id
  INTO feedback_id,response,note,created_at,completion_event_id;

  RETURN QUERY SELECT feedback_id,response,note,created_at,completion_event_id,false;
END;
$$;
REVOKE ALL ON FUNCTION submit_maintenance_resident_feedback(uuid,text,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_maintenance_resident_feedback(uuid,text,text,uuid,text) TO "{{role}}";
