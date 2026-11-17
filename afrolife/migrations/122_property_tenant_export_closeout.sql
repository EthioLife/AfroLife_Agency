CREATE TABLE property_tenant_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  tenant_system_id uuid NOT NULL REFERENCES property_operating_tenants(id),
  artifact_reference text NOT NULL CHECK (
    length(trim(artifact_reference)) BETWEEN 2 AND 200
    AND artifact_reference !~* '://|password|secret|token|credential'
  ),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes>0),
  record_count bigint NOT NULL CHECK (record_count>=0),
  notes text NOT NULL CHECK (length(trim(notes)) BETWEEN 10 AND 1000),
  requested_by uuid NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_tenant_export_requests_latest_idx
  ON property_tenant_export_requests(tenant_system_id,request_sequence DESC);
CREATE TRIGGER property_tenant_export_requests_immutable
  BEFORE UPDATE OR DELETE ON property_tenant_export_requests
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

CREATE TABLE property_tenant_export_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_system_id uuid NOT NULL REFERENCES property_operating_tenants(id),
  export_request_id uuid NOT NULL UNIQUE REFERENCES property_tenant_export_requests(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  decision text NOT NULL CHECK (decision IN ('verified','rejected')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER property_tenant_export_events_immutable
  BEFORE UPDATE OR DELETE ON property_tenant_export_events
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

CREATE OR REPLACE FUNCTION request_property_tenant_export(
  target_tenant uuid,
  artifact_reference text,
  artifact_sha256 text,
  artifact_size_bytes bigint,
  artifact_record_count bigint,
  request_notes text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE export_id uuid;
DECLARE tenant_status text;
BEGIN
  SELECT tenant.status INTO tenant_status
  FROM property_operating_tenants tenant
  WHERE tenant.id=target_tenant
  FOR UPDATE;
  IF app_role()<>'global_admin' OR actor IS NULL
    OR length(trim(artifact_reference)) NOT BETWEEN 2 AND 200
    OR artifact_reference ~* '://|password|secret|token|credential'
    OR artifact_sha256 !~ '^[0-9a-f]{64}$'
    OR artifact_size_bytes<=0 OR artifact_record_count<0
    OR length(trim(request_notes)) NOT BETWEEN 10 AND 1000
    OR tenant_status IS NULL OR tenant_status NOT IN ('active','suspended') THEN
    RAISE EXCEPTION 'A Global Admin must register a valid external export for an active or suspended tenant'
      USING ERRCODE='42501';
  END IF;
  INSERT INTO property_tenant_export_requests(
    tenant_system_id,artifact_reference,sha256,size_bytes,record_count,notes,requested_by
  ) VALUES(
    target_tenant,trim(artifact_reference),artifact_sha256,artifact_size_bytes,
    artifact_record_count,trim(request_notes),actor
  ) RETURNING id INTO export_id;
  RETURN export_id;
END;
$$;

CREATE OR REPLACE FUNCTION decide_property_tenant_export(
  target_tenant uuid,
  target_export uuid,
  decision text,
  decision_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE requester uuid;
DECLARE tenant_status text;
BEGIN
  IF app_role()<>'global_admin' OR actor IS NULL
    OR decision NOT IN ('verified','rejected')
    OR length(trim(decision_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Export verification requires a Global Admin, a valid decision, and documented evidence review'
      USING ERRCODE='42501';
  END IF;
  SELECT request.requested_by,tenant.status
  INTO requester,tenant_status
  FROM property_tenant_export_requests request
  JOIN property_operating_tenants tenant ON tenant.id=request.tenant_system_id
  WHERE request.id=target_export AND request.tenant_system_id=target_tenant
  FOR UPDATE OF request;
  IF requester IS NULL OR requester=actor OR tenant_status NOT IN ('active','suspended')
    OR EXISTS (
      SELECT 1 FROM property_tenant_export_events event
      WHERE event.export_request_id=target_export
    ) THEN
    RAISE EXCEPTION 'Export review must be independent, pending, and for an active or suspended tenant'
      USING ERRCODE='23514';
  END IF;
  INSERT INTO property_tenant_export_events(
    tenant_system_id,export_request_id,actor_id,decision,reason
  ) VALUES(target_tenant,target_export,actor,decision,trim(decision_reason));
END;
$$;

CREATE OR REPLACE FUNCTION set_property_operating_tenant_status(
  target_tenant uuid,
  next_status text,
  change_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE previous_status text;
DECLARE latest_export uuid;
BEGIN
  IF app_role()<>'global_admin' OR actor IS NULL
    OR next_status NOT IN ('active','suspended','offboarding','closed')
    OR length(trim(change_reason))<10 THEN
    RAISE EXCEPTION 'Tenant lifecycle changes require a Global Admin and documented reason'
      USING ERRCODE='42501';
  END IF;
  SELECT status INTO previous_status FROM property_operating_tenants
  WHERE id=target_tenant FOR UPDATE;
  IF previous_status IS NULL OR NOT (
    (previous_status='active' AND next_status IN ('suspended','offboarding'))
    OR (previous_status='suspended' AND next_status IN ('active','offboarding'))
    OR (previous_status='offboarding' AND next_status='closed')
  ) THEN
    RAISE EXCEPTION 'Property tenant lifecycle transition is not permitted'
      USING ERRCODE='23514';
  END IF;
  IF next_status IN ('offboarding','closed') THEN
    SELECT request.id INTO latest_export
    FROM property_tenant_export_requests request
    WHERE request.tenant_system_id=target_tenant
    ORDER BY request.request_sequence DESC
    LIMIT 1;
    IF latest_export IS NULL OR NOT EXISTS (
      SELECT 1 FROM property_tenant_export_events event
      WHERE event.export_request_id=latest_export
        AND event.tenant_system_id=target_tenant
        AND event.decision='verified'
    ) THEN
      RAISE EXCEPTION 'Tenant offboarding requires an independently verified export for the latest archive request'
        USING ERRCODE='23514';
    END IF;
  END IF;
  UPDATE property_operating_tenants SET status=next_status,updated_at=now()
  WHERE id=target_tenant;
  IF next_status IN ('suspended','offboarding','closed') THEN
    UPDATE property_operating_tenant_support_grants
    SET status='revoked'
    WHERE tenant_system_id=target_tenant AND status='active';
  END IF;
  INSERT INTO property_operating_tenant_events(tenant_system_id,actor_id,event_type,event_data)
  VALUES(target_tenant,actor,'tenant_status_changed',
    jsonb_build_object('from_status',previous_status,'to_status',next_status,'reason',change_reason));
END;
$$;

REVOKE ALL ON FUNCTION request_property_tenant_export(uuid,text,text,bigint,bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION decide_property_tenant_export(uuid,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_property_operating_tenant_status(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_property_tenant_export(uuid,text,text,bigint,bigint,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION decide_property_tenant_export(uuid,uuid,text,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION set_property_operating_tenant_status(uuid,text,text) TO "{{role}}";

ALTER TABLE property_tenant_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_tenant_export_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE property_tenant_export_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_tenant_export_events FORCE ROW LEVEL SECURITY;
CREATE POLICY property_tenant_export_requests_platform_admin ON property_tenant_export_requests FOR ALL
  USING (app_role()='global_admin')
  WITH CHECK (app_role()='global_admin');
CREATE POLICY property_tenant_export_events_platform_admin ON property_tenant_export_events FOR ALL
  USING (app_role()='global_admin')
  WITH CHECK (app_role()='global_admin');
GRANT SELECT ON property_tenant_export_requests,property_tenant_export_events TO "{{role}}";
