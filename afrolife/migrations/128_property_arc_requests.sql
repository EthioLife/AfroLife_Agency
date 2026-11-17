ALTER TABLE properties
  ADD CONSTRAINT properties_tenant_id_unique UNIQUE (tenant_system_id,id);

CREATE TABLE property_arc_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  tenant_system_id uuid NOT NULL REFERENCES property_operating_tenants(id),
  property_id uuid NOT NULL,
  submitted_by uuid NOT NULL REFERENCES users(id),
  request_type text NOT NULL CHECK (
    request_type IN ('exterior_alteration','landscaping','painting','structural','other')
  ),
  summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 3 AND 120),
  proposal text NOT NULL CHECK (length(trim(proposal)) BETWEEN 10 AND 2000),
  evidence_reference text CHECK (
    evidence_reference IS NULL OR (
      length(trim(evidence_reference)) BETWEEN 2 AND 200
      AND evidence_reference !~* '://|password|secret|token|credential'
    )
  ),
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_system_id,id),
  FOREIGN KEY (tenant_system_id,property_id)
    REFERENCES properties(tenant_system_id,id) ON DELETE RESTRICT
);
CREATE INDEX property_arc_requests_tenant_latest_idx
  ON property_arc_requests(tenant_system_id,request_sequence DESC);
CREATE INDEX property_arc_requests_property_status_idx
  ON property_arc_requests(tenant_system_id,property_id,status);

CREATE TABLE property_arc_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_system_id uuid NOT NULL REFERENCES property_operating_tenants(id),
  arc_request_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL CHECK (
    event_type IN ('submitted','inspection_recorded','approved','rejected')
  ),
  from_status text CHECK (
    from_status IS NULL OR from_status IN ('pending_review','approved','rejected')
  ),
  to_status text NOT NULL CHECK (
    to_status IN ('pending_review','approved','rejected')
  ),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  evidence_reference text CHECK (
    evidence_reference IS NULL OR (
      length(trim(evidence_reference)) BETWEEN 2 AND 200
      AND evidence_reference !~* '://|password|secret|token|credential'
    )
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_system_id,arc_request_id)
    REFERENCES property_arc_requests(tenant_system_id,id) ON DELETE RESTRICT
);
CREATE INDEX property_arc_events_history_idx
  ON property_arc_events(tenant_system_id,arc_request_id,id);

CREATE OR REPLACE FUNCTION app_property_arc_can_inspect(
  target_tenant uuid,
  target_property uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT app_property_tenant_system_id()=target_tenant
    AND (
      app_is_property_tenant_admin(target_tenant)
      OR app_property_agent_can_manage(target_tenant,target_property)
      OR (
        app_role()='field_agent'
        AND EXISTS (
          SELECT 1
          FROM property_agent_scopes scope
          JOIN property_operating_tenant_members member
            ON member.tenant_system_id=scope.tenant_system_id
           AND member.user_id=scope.user_id
          WHERE scope.tenant_system_id=target_tenant
            AND scope.property_id=target_property
            AND scope.user_id=app_user_id()
            AND scope.tenant_role='field_agent'
            AND scope.status='active'
            AND scope.effective_from<=current_date
            AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
            AND member.tenant_role='field_agent'
            AND member.status='active'
        )
      )
    )
$$;
REVOKE ALL ON FUNCTION app_property_arc_can_inspect(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_property_arc_can_inspect(uuid,uuid) TO "{{role}}";

CREATE OR REPLACE FUNCTION list_property_arc_eligible_properties()
RETURNS TABLE(property_id uuid,address text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT property.id,property.address
  FROM properties property
  WHERE property.tenant_system_id=app_property_tenant_system_id()
    AND (
      (
        app_role()='property_owner'
        AND property.owner_user_id=app_user_id()
        AND EXISTS (
          SELECT 1 FROM property_operating_tenant_members member
          WHERE member.tenant_system_id=property.tenant_system_id
            AND member.user_id=app_user_id()
            AND member.tenant_role='owner'
            AND member.status='active'
        )
      )
      OR (
        app_role()='customer'
        AND EXISTS (
          SELECT 1
          FROM property_units unit
          JOIN leases lease ON lease.unit_id=unit.id
          JOIN property_tenant_account_links link ON link.tenant_id=lease.tenant_id
          JOIN property_operating_tenant_members member
            ON member.tenant_system_id=lease.tenant_system_id
           AND member.user_id=link.user_id
          WHERE unit.property_id=property.id
            AND lease.tenant_system_id=property.tenant_system_id
            AND lease.status='active'
            AND link.user_id=app_user_id()
            AND link.revoked_at IS NULL
            AND member.tenant_role='resident'
            AND member.status='active'
        )
      )
    )
  ORDER BY property.address,property.id
$$;
REVOKE ALL ON FUNCTION list_property_arc_eligible_properties() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_property_arc_eligible_properties() TO "{{role}}";

CREATE OR REPLACE FUNCTION app_property_arc_can_submit(
  target_tenant uuid,
  target_property uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT app_property_tenant_system_id()=target_tenant
    AND EXISTS (
      SELECT 1 FROM list_property_arc_eligible_properties() eligible
      WHERE eligible.property_id=target_property
    )
$$;
REVOKE ALL ON FUNCTION app_property_arc_can_submit(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_property_arc_can_submit(uuid,uuid) TO "{{role}}";

CREATE OR REPLACE FUNCTION submit_property_arc_request(
  target_property uuid,
  request_type text,
  request_summary text,
  request_proposal text,
  reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  request_id uuid;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL
    OR request_type NOT IN ('exterior_alteration','landscaping','painting','structural','other')
    OR length(trim(request_summary)) NOT BETWEEN 3 AND 120
    OR length(trim(request_proposal)) NOT BETWEEN 10 AND 2000
    OR (reference IS NOT NULL AND (
      length(trim(reference)) NOT BETWEEN 2 AND 200
      OR reference ~* '://|password|secret|token|credential'
    )) THEN
    RAISE EXCEPTION 'A valid property change request and active property tenant are required'
      USING ERRCODE='23514';
  END IF;

  IF NOT app_property_arc_can_submit(tenant_id,target_property) THEN
    RAISE EXCEPTION 'Only an owner or resident with an active relationship to this property may submit a request'
      USING ERRCODE='42501';
  END IF;

  INSERT INTO property_arc_requests(
    tenant_system_id,property_id,submitted_by,request_type,summary,proposal,evidence_reference
  ) VALUES (
    tenant_id,target_property,actor,request_type,trim(request_summary),trim(request_proposal),
    NULLIF(trim(reference),'')
  ) RETURNING id INTO request_id;

  INSERT INTO property_arc_events(
    tenant_system_id,arc_request_id,actor_id,event_type,from_status,to_status,reason,evidence_reference
  ) VALUES (
    tenant_id,request_id,actor,'submitted',NULL,'pending_review','Request submitted.',
    NULLIF(trim(reference),'')
  );
  RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION submit_property_arc_request(uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_property_arc_request(uuid,text,text,text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION decide_property_arc_request(
  target_request uuid,
  decision text,
  decision_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid;
  property_id uuid;
  requester uuid;
  previous_status text;
BEGIN
  IF actor IS NULL OR decision NOT IN ('approved','rejected')
    OR length(trim(decision_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'A documented ARC decision is required'
      USING ERRCODE='23514';
  END IF;

  SELECT request.tenant_system_id,request.property_id,request.submitted_by,request.status
  INTO tenant_id,property_id,requester,previous_status
  FROM property_arc_requests request
  WHERE request.id=target_request
    AND request.tenant_system_id=app_property_tenant_system_id()
  FOR UPDATE;

  IF tenant_id IS NULL OR requester=actor OR previous_status<>'pending_review'
    OR NOT app_property_agent_can_manage(tenant_id,property_id) THEN
    RAISE EXCEPTION 'Only an independent tenant administrator or scoped Master Agent may decide a pending request'
      USING ERRCODE='42501';
  END IF;

  UPDATE property_arc_requests SET status=decision
  WHERE id=target_request AND tenant_system_id=tenant_id;
  INSERT INTO property_arc_events(
    tenant_system_id,arc_request_id,actor_id,event_type,from_status,to_status,reason
  ) VALUES (
    tenant_id,target_request,actor,decision,previous_status,decision,trim(decision_reason)
  );
END;
$$;
REVOKE ALL ON FUNCTION decide_property_arc_request(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decide_property_arc_request(uuid,text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION record_property_arc_inspection(
  target_request uuid,
  inspection_notes text,
  reference text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid;
  property_id uuid;
  requester uuid;
  request_status text;
BEGIN
  IF actor IS NULL OR length(trim(inspection_notes)) NOT BETWEEN 10 AND 1000
    OR (reference IS NOT NULL AND (
      length(trim(reference)) NOT BETWEEN 2 AND 200
      OR reference ~* '://|password|secret|token|credential'
    )) THEN
    RAISE EXCEPTION 'Inspection notes and a non-secret evidence reference are required'
      USING ERRCODE='23514';
  END IF;

  SELECT request.tenant_system_id,request.property_id,request.submitted_by,request.status
  INTO tenant_id,property_id,requester,request_status
  FROM property_arc_requests request
  WHERE request.id=target_request
    AND request.tenant_system_id=app_property_tenant_system_id()
  FOR UPDATE;

  IF tenant_id IS NULL OR requester=actor OR request_status<>'pending_review'
    OR NOT app_property_arc_can_inspect(tenant_id,property_id) THEN
    RAISE EXCEPTION 'Inspection evidence requires an independent, assigned property reviewer and a pending request'
      USING ERRCODE='42501';
  END IF;

  INSERT INTO property_arc_events(
    tenant_system_id,arc_request_id,actor_id,event_type,from_status,to_status,reason,evidence_reference
  ) VALUES (
    tenant_id,target_request,actor,'inspection_recorded',request_status,request_status,
    trim(inspection_notes),NULLIF(trim(reference),'')
  );
END;
$$;
REVOKE ALL ON FUNCTION record_property_arc_inspection(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_property_arc_inspection(uuid,text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION guard_property_arc_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor uuid := app_user_id();
  request_row property_arc_requests%ROWTYPE;
BEGIN
  SELECT * INTO request_row FROM property_arc_requests
  WHERE id=NEW.arc_request_id AND tenant_system_id=NEW.tenant_system_id;

  IF actor IS NULL OR NEW.actor_id IS DISTINCT FROM actor OR request_row.id IS NULL THEN
    RAISE EXCEPTION 'ARC events require the authenticated actor and matching tenant request'
      USING ERRCODE='42501';
  END IF;

  IF NEW.event_type='submitted'
    AND NEW.actor_id=request_row.submitted_by
    AND NEW.from_status IS NULL
    AND NEW.to_status='pending_review'
    AND request_row.status='pending_review'
    AND NOT EXISTS (
      SELECT 1 FROM property_arc_events event
      WHERE event.tenant_system_id=NEW.tenant_system_id
        AND event.arc_request_id=NEW.arc_request_id
    ) THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type='inspection_recorded'
    AND NEW.actor_id<>request_row.submitted_by
    AND NEW.from_status='pending_review'
    AND NEW.to_status='pending_review'
    AND request_row.status='pending_review'
    AND app_property_arc_can_inspect(NEW.tenant_system_id,request_row.property_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type IN ('approved','rejected')
    AND NEW.actor_id<>request_row.submitted_by
    AND NEW.from_status='pending_review'
    AND NEW.to_status=request_row.status
    AND NEW.event_type=request_row.status
    AND app_property_agent_can_manage(NEW.tenant_system_id,request_row.property_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ARC event does not match an authorized submission, inspection, or decision'
    USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER property_arc_events_insert_guard
  BEFORE INSERT ON property_arc_events
  FOR EACH ROW EXECUTE FUNCTION guard_property_arc_event();
CREATE TRIGGER property_arc_events_immutable
  BEFORE UPDATE OR DELETE ON property_arc_events
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

ALTER TABLE property_arc_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_arc_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY property_arc_requests_scoped_read
  ON property_arc_requests FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND (
      submitted_by=app_user_id()
      OR app_is_property_tenant_admin(tenant_system_id)
      OR app_property_agent_can_manage(tenant_system_id,property_id)
      OR app_property_arc_can_inspect(tenant_system_id,property_id)
    )
  );
CREATE POLICY property_arc_requests_command_insert
  ON property_arc_requests FOR INSERT
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND submitted_by=app_user_id()
    AND status='pending_review'
    AND app_property_arc_can_submit(tenant_system_id,property_id)
  );
CREATE POLICY property_arc_requests_command_update
  ON property_arc_requests FOR UPDATE
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND submitted_by<>app_user_id()
    AND status='pending_review'
    AND app_property_agent_can_manage(tenant_system_id,property_id)
  )
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND submitted_by<>app_user_id()
    AND status IN ('approved','rejected')
    AND app_property_agent_can_manage(tenant_system_id,property_id)
  );

ALTER TABLE property_arc_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_arc_events FORCE ROW LEVEL SECURITY;
CREATE POLICY property_arc_events_scoped_read
  ON property_arc_events FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND EXISTS (
      SELECT 1 FROM property_arc_requests request
      WHERE request.id=property_arc_events.arc_request_id
        AND request.tenant_system_id=property_arc_events.tenant_system_id
    )
  );
CREATE POLICY property_arc_events_command_insert
  ON property_arc_events FOR INSERT
  WITH CHECK (
    actor_id=app_user_id()
    AND EXISTS (
      SELECT 1 FROM property_arc_requests request
      WHERE request.id=property_arc_events.arc_request_id
        AND request.tenant_system_id=property_arc_events.tenant_system_id
        AND (
          (
            property_arc_events.event_type='submitted'
            AND request.submitted_by=app_user_id()
            AND request.status='pending_review'
            AND NOT EXISTS (
              SELECT 1 FROM property_arc_events prior
              WHERE prior.tenant_system_id=request.tenant_system_id
                AND prior.arc_request_id=request.id
            )
          )
          OR (
            property_arc_events.event_type='inspection_recorded'
            AND request.submitted_by<>app_user_id()
            AND request.status='pending_review'
            AND app_property_arc_can_inspect(request.tenant_system_id,request.property_id)
          )
          OR (
            property_arc_events.event_type IN ('approved','rejected')
            AND request.submitted_by<>app_user_id()
            AND request.status=property_arc_events.event_type
            AND app_property_agent_can_manage(request.tenant_system_id,request.property_id)
          )
        )
    )
  );

REVOKE ALL ON TABLE property_arc_requests,property_arc_events FROM PUBLIC;
REVOKE ALL ON TABLE property_arc_requests,property_arc_events FROM "{{role}}";
GRANT SELECT ON TABLE property_arc_requests,property_arc_events TO "{{role}}";
