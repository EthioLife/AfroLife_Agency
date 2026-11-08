ALTER TABLE property_units
  ADD CONSTRAINT property_units_id_property_id_unique UNIQUE (id,property_id);
ALTER TABLE property_association_assessments
  DROP CONSTRAINT property_association_assessments_unit_id_fkey,
  ADD CONSTRAINT property_association_assessments_unit_property_fk
    FOREIGN KEY (unit_id,property_id)
    REFERENCES property_units(id,property_id) ON DELETE RESTRICT;

CREATE TABLE property_association_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_system_id uuid NOT NULL,
  association_id uuid NOT NULL,
  property_id uuid NOT NULL,
  unit_id uuid,
  owner_user_id uuid NOT NULL REFERENCES users(id),
  reported_by uuid NOT NULL REFERENCES users(id),
  category text NOT NULL CHECK (length(trim(category)) BETWEEN 2 AND 80),
  summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 3 AND 160),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 2000),
  evidence_reference text NOT NULL CHECK (
    length(trim(evidence_reference)) BETWEEN 2 AND 200
    AND evidence_reference !~* '://|password|secret|token|credential'
  ),
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','response_submitted','resolved','dismissed')),
  closure_reason text,
  closed_by uuid REFERENCES users(id),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_system_id,id),
  FOREIGN KEY (tenant_system_id,association_id,property_id)
    REFERENCES property_association_properties(tenant_system_id,association_id,property_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (unit_id,property_id)
    REFERENCES property_units(id,property_id) ON DELETE RESTRICT,
  CHECK ((status IN ('pending_review','response_submitted')
          AND closure_reason IS NULL AND closed_by IS NULL AND closed_at IS NULL)
      OR (status IN ('resolved','dismissed')
          AND closure_reason IS NOT NULL AND length(trim(closure_reason)) BETWEEN 10 AND 1000
          AND closed_by IS NOT NULL AND closed_at IS NOT NULL)),
  CHECK (closed_by IS NULL OR (closed_by<>owner_user_id AND closed_by<>reported_by))
);
CREATE INDEX property_association_violations_owner_idx
  ON property_association_violations(tenant_system_id,owner_user_id,created_at DESC);
CREATE INDEX property_association_violations_association_status_idx
  ON property_association_violations(tenant_system_id,association_id,status,created_at DESC);

CREATE TABLE property_association_violation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_system_id uuid NOT NULL,
  violation_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL CHECK (
    event_type IN ('violation_recorded','owner_response_submitted','violation_resolved','violation_dismissed')
  ),
  from_status text CHECK (
    from_status IS NULL OR from_status IN ('pending_review','response_submitted')
  ),
  to_status text NOT NULL CHECK (
    to_status IN ('pending_review','response_submitted','resolved','dismissed')
  ),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 2000),
  evidence_reference text CHECK (
    evidence_reference IS NULL OR (
      length(trim(evidence_reference)) BETWEEN 2 AND 200
      AND evidence_reference !~* '://|password|secret|token|credential'
    )
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_system_id,violation_id)
    REFERENCES property_association_violations(tenant_system_id,id) ON DELETE RESTRICT
);
CREATE INDEX property_association_violation_events_history_idx
  ON property_association_violation_events(tenant_system_id,violation_id,id);
CREATE TRIGGER property_association_violation_events_immutable
  BEFORE UPDATE OR DELETE ON property_association_violation_events
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

CREATE OR REPLACE FUNCTION guard_property_association_violation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE actor uuid := app_user_id();
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_system_id IS DISTINCT FROM OLD.tenant_system_id
    OR NEW.association_id IS DISTINCT FROM OLD.association_id
    OR NEW.property_id IS DISTINCT FROM OLD.property_id
    OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
    OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    OR NEW.reported_by IS DISTINCT FROM OLD.reported_by
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.summary IS DISTINCT FROM OLD.summary
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.evidence_reference IS DISTINCT FROM OLD.evidence_reference
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Violation reports are immutable; responses and decisions must be appended'
      USING ERRCODE='42501';
  END IF;

  IF OLD.status='pending_review'
    AND NEW.status='response_submitted'
    AND NEW.closure_reason IS NULL AND NEW.closed_by IS NULL AND NEW.closed_at IS NULL
    AND actor=OLD.owner_user_id THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('pending_review','response_submitted')
    AND NEW.status IN ('resolved','dismissed')
    AND NEW.closed_by=actor
    AND NEW.closed_at IS NOT NULL
    AND NEW.closure_reason IS NOT NULL
    AND length(trim(NEW.closure_reason)) BETWEEN 10 AND 1000
    AND actor<>OLD.owner_user_id
    AND actor<>OLD.reported_by
    AND app_property_agent_can_manage(OLD.tenant_system_id,OLD.property_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Violation status changes require an owner response or independent reviewer decision'
    USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER property_association_violations_update_guard
  BEFORE UPDATE ON property_association_violations
  FOR EACH ROW EXECUTE FUNCTION guard_property_association_violation_update();
CREATE TRIGGER property_association_violations_immutable
  BEFORE DELETE ON property_association_violations
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

CREATE OR REPLACE FUNCTION record_property_association_violation(
  target_association uuid,
  target_property uuid,
  target_unit uuid,
  violation_category text,
  violation_summary text,
  violation_description text,
  reference text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  owner_id uuid;
  violation_id uuid;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL
    OR target_association IS NULL OR target_property IS NULL
    OR violation_category IS NULL OR length(trim(violation_category)) NOT BETWEEN 2 AND 80
    OR violation_summary IS NULL OR length(trim(violation_summary)) NOT BETWEEN 3 AND 160
    OR violation_description IS NULL OR length(trim(violation_description)) NOT BETWEEN 10 AND 2000
    OR reference IS NULL OR length(trim(reference)) NOT BETWEEN 2 AND 200
    OR reference ~* '://|password|secret|token|credential'
    OR NOT app_property_arc_can_inspect(tenant_id,target_property) THEN
    RAISE EXCEPTION 'An assigned property reviewer and non-secret violation evidence reference are required'
      USING ERRCODE='42501';
  END IF;

  SELECT property.owner_user_id INTO owner_id
  FROM property_association_properties association_property
  JOIN properties property
    ON property.tenant_system_id=association_property.tenant_system_id
   AND property.id=association_property.property_id
  WHERE association_property.tenant_system_id=tenant_id
    AND association_property.association_id=target_association
    AND association_property.property_id=target_property
    AND (target_unit IS NULL OR EXISTS (
      SELECT 1 FROM property_units unit
      WHERE unit.id=target_unit AND unit.property_id=target_property
    ));

  IF owner_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM property_operating_tenant_members member
    WHERE member.tenant_system_id=tenant_id
      AND member.user_id=owner_id
      AND member.tenant_role='owner'
      AND member.status='active'
  ) THEN
    RAISE EXCEPTION 'The association property must have an active owner member'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO property_association_violations(
    tenant_system_id,association_id,property_id,unit_id,owner_user_id,reported_by,
    category,summary,description,evidence_reference
  ) VALUES (
    tenant_id,target_association,target_property,target_unit,owner_id,actor,
    trim(violation_category),trim(violation_summary),trim(violation_description),trim(reference)
  ) RETURNING id INTO violation_id;

  INSERT INTO property_association_violation_events(
    tenant_system_id,violation_id,actor_id,event_type,from_status,to_status,reason,evidence_reference
  ) VALUES (
    tenant_id,violation_id,actor,'violation_recorded',NULL,'pending_review',
    trim(violation_description),trim(reference)
  );
  RETURN violation_id;
END;
$$;
REVOKE ALL ON FUNCTION record_property_association_violation(uuid,uuid,uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_property_association_violation(uuid,uuid,uuid,text,text,text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION submit_property_association_violation_response(
  target_violation uuid,
  response_text text,
  reference text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  violation property_association_violations%ROWTYPE;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL
    OR response_text IS NULL OR length(trim(response_text)) NOT BETWEEN 10 AND 2000
    OR (reference IS NOT NULL AND (
      length(trim(reference)) NOT BETWEEN 2 AND 200
      OR reference ~* '://|password|secret|token|credential'
    )) THEN
    RAISE EXCEPTION 'A documented owner response and optional non-secret evidence reference are required'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO violation
  FROM property_association_violations
  WHERE id=target_violation AND tenant_system_id=tenant_id
  FOR UPDATE;
  IF violation.id IS NULL OR violation.owner_user_id<>actor
    OR violation.status<>'pending_review' THEN
    RAISE EXCEPTION 'Only the assessed owner may respond to an open violation'
      USING ERRCODE='42501';
  END IF;

  UPDATE property_association_violations
  SET status='response_submitted'
  WHERE id=violation.id AND tenant_system_id=tenant_id;
  INSERT INTO property_association_violation_events(
    tenant_system_id,violation_id,actor_id,event_type,from_status,to_status,reason,evidence_reference
  ) VALUES (
    tenant_id,violation.id,actor,'owner_response_submitted','pending_review','response_submitted',
    trim(response_text),NULLIF(trim(reference),'')
  );
END;
$$;
REVOKE ALL ON FUNCTION submit_property_association_violation_response(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_property_association_violation_response(uuid,text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION decide_property_association_violation(
  target_violation uuid,
  decision text,
  decision_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  violation property_association_violations%ROWTYPE;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL
    OR decision IS NULL OR decision NOT IN ('resolved','dismissed')
    OR decision_reason IS NULL OR length(trim(decision_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'A documented independent violation review decision is required'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO violation
  FROM property_association_violations
  WHERE id=target_violation AND tenant_system_id=tenant_id
  FOR UPDATE;
  IF violation.id IS NULL
    OR violation.status NOT IN ('pending_review','response_submitted')
    OR actor=violation.owner_user_id
    OR actor=violation.reported_by
    OR NOT app_property_agent_can_manage(tenant_id,violation.property_id) THEN
    RAISE EXCEPTION 'Only an independent tenant administrator or scoped Master Agent may decide an open violation'
      USING ERRCODE='42501';
  END IF;

  UPDATE property_association_violations
  SET status=decision,closure_reason=trim(decision_reason),closed_by=actor,closed_at=now()
  WHERE id=violation.id AND tenant_system_id=tenant_id;
  INSERT INTO property_association_violation_events(
    tenant_system_id,violation_id,actor_id,event_type,from_status,to_status,reason
  ) VALUES (
    tenant_id,violation.id,actor,
    CASE WHEN decision='resolved' THEN 'violation_resolved' ELSE 'violation_dismissed' END,
    violation.status,decision,trim(decision_reason)
  );
END;
$$;
REVOKE ALL ON FUNCTION decide_property_association_violation(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decide_property_association_violation(uuid,text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION app_property_association_violation_event_can_insert(
  target_tenant uuid,
  target_violation uuid,
  target_actor uuid,
  target_event_type text,
  target_from_status text,
  target_to_status text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT target_actor=app_user_id()
    AND target_tenant=app_property_tenant_system_id()
    AND EXISTS (
      SELECT 1 FROM property_association_violations violation
      WHERE violation.tenant_system_id=target_tenant
        AND violation.id=target_violation
        AND violation.status=target_to_status
        AND (
          (
            target_event_type='violation_recorded'
            AND target_from_status IS NULL
            AND target_to_status='pending_review'
            AND violation.reported_by=target_actor
          )
          OR (
            target_event_type='owner_response_submitted'
            AND target_from_status='pending_review'
            AND target_to_status='response_submitted'
            AND violation.owner_user_id=target_actor
          )
          OR (
            target_event_type='violation_resolved'
            AND target_from_status IN ('pending_review','response_submitted')
            AND target_to_status='resolved'
            AND violation.closed_by=target_actor
            AND target_actor<>violation.owner_user_id
            AND target_actor<>violation.reported_by
            AND app_property_agent_can_manage(target_tenant,violation.property_id)
          )
          OR (
            target_event_type='violation_dismissed'
            AND target_from_status IN ('pending_review','response_submitted')
            AND target_to_status='dismissed'
            AND violation.closed_by=target_actor
            AND target_actor<>violation.owner_user_id
            AND target_actor<>violation.reported_by
            AND app_property_agent_can_manage(target_tenant,violation.property_id)
          )
        )
    )
$$;
REVOKE ALL ON FUNCTION app_property_association_violation_event_can_insert(uuid,uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_property_association_violation_event_can_insert(uuid,uuid,uuid,text,text,text) TO "{{role}}";

ALTER TABLE property_association_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_violations FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_violations_scoped_read
  ON property_association_violations FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND (
      owner_user_id=app_user_id()
      OR reported_by=app_user_id()
      OR app_property_arc_can_inspect(tenant_system_id,property_id)
    )
  );
CREATE POLICY property_association_violations_command_insert
  ON property_association_violations FOR INSERT
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND reported_by=app_user_id()
    AND status='pending_review'
    AND closure_reason IS NULL
    AND closed_by IS NULL
    AND closed_at IS NULL
    AND app_property_arc_can_inspect(tenant_system_id,property_id)
  );
CREATE POLICY property_association_violations_command_update
  ON property_association_violations FOR UPDATE
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND status IN ('pending_review','response_submitted')
    AND (owner_user_id=app_user_id()
      OR app_property_agent_can_manage(tenant_system_id,property_id))
  )
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND (
      (status='response_submitted' AND owner_user_id=app_user_id())
      OR (
        status IN ('resolved','dismissed')
        AND closed_by=app_user_id()
        AND app_property_agent_can_manage(tenant_system_id,property_id)
      )
    )
  );

ALTER TABLE property_association_violation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_violation_events FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_violation_events_scoped_read
  ON property_association_violation_events FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND EXISTS (
      SELECT 1 FROM property_association_violations violation
      WHERE violation.tenant_system_id=property_association_violation_events.tenant_system_id
        AND violation.id=property_association_violation_events.violation_id
        AND (
          violation.owner_user_id=app_user_id()
          OR violation.reported_by=app_user_id()
          OR app_property_arc_can_inspect(violation.tenant_system_id,violation.property_id)
        )
    )
  );
CREATE POLICY property_association_violation_events_command_insert
  ON property_association_violation_events FOR INSERT
  WITH CHECK (
    app_property_association_violation_event_can_insert(
      tenant_system_id,violation_id,actor_id,event_type,from_status,to_status
    )
  );

REVOKE ALL ON TABLE property_association_violations,property_association_violation_events
FROM PUBLIC,"{{role}}";
GRANT SELECT ON TABLE property_association_violations,property_association_violation_events
TO "{{role}}";
