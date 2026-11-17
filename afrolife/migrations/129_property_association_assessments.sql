CREATE TABLE property_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_system_id uuid NOT NULL REFERENCES property_operating_tenants(id),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_system_id,id)
);
CREATE INDEX property_associations_tenant_created_idx
  ON property_associations(tenant_system_id,created_at DESC);

CREATE TABLE property_association_properties (
  tenant_system_id uuid NOT NULL,
  association_id uuid NOT NULL,
  property_id uuid NOT NULL,
  PRIMARY KEY (tenant_system_id,association_id,property_id),
  UNIQUE (tenant_system_id,property_id),
  FOREIGN KEY (tenant_system_id,association_id)
    REFERENCES property_associations(tenant_system_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_system_id,property_id)
    REFERENCES properties(tenant_system_id,id) ON DELETE RESTRICT
);

CREATE TABLE property_association_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_system_id uuid NOT NULL,
  association_id uuid NOT NULL,
  property_id uuid NOT NULL,
  unit_id uuid REFERENCES property_units(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES users(id),
  period_start date NOT NULL,
  due_on date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount>0),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 3 AND 500),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_system_id,id),
  CHECK (due_on>=period_start),
  FOREIGN KEY (tenant_system_id,association_id,property_id)
    REFERENCES property_association_properties(tenant_system_id,association_id,property_id)
    ON DELETE RESTRICT
);
CREATE UNIQUE INDEX property_association_assessment_property_period_unique
  ON property_association_assessments(tenant_system_id,association_id,property_id,period_start)
  WHERE unit_id IS NULL;
CREATE UNIQUE INDEX property_association_assessment_unit_period_unique
  ON property_association_assessments(tenant_system_id,association_id,property_id,unit_id,period_start)
  WHERE unit_id IS NOT NULL;
CREATE INDEX property_association_assessments_owner_idx
  ON property_association_assessments(tenant_system_id,owner_user_id,due_on);

CREATE TABLE property_association_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_system_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount>0),
  channel text NOT NULL CHECK (length(trim(channel)) BETWEEN 2 AND 40),
  reference text NOT NULL CHECK (
    length(trim(reference)) BETWEEN 3 AND 160
    AND reference !~* '://|password|secret|token|credential'
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reconciled','rejected')),
  recorded_by uuid NOT NULL REFERENCES users(id),
  reviewed_by uuid REFERENCES users(id),
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (tenant_system_id,id),
  UNIQUE (tenant_system_id,reference),
  FOREIGN KEY (tenant_system_id,assessment_id)
    REFERENCES property_association_assessments(tenant_system_id,id) ON DELETE RESTRICT,
  CHECK ((status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_reason IS NULL)
      OR (status IN ('reconciled','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
          AND review_reason IS NOT NULL AND length(trim(review_reason)) BETWEEN 10 AND 1000)),
  CHECK (reviewed_by IS NULL OR reviewed_by<>recorded_by)
);
CREATE INDEX property_association_receipts_assessment_idx
  ON property_association_receipts(tenant_system_id,assessment_id,status);

CREATE TABLE property_association_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_system_id uuid NOT NULL,
  association_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL CHECK (
    event_type IN ('association_created','assessment_created','receipt_recorded','receipt_reconciled','receipt_rejected')
  ),
  entity_id uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_system_id,association_id)
    REFERENCES property_associations(tenant_system_id,id) ON DELETE RESTRICT
);
CREATE INDEX property_association_events_history_idx
  ON property_association_events(tenant_system_id,association_id,id);
CREATE TRIGGER property_association_events_immutable
  BEFORE UPDATE OR DELETE ON property_association_events
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

CREATE OR REPLACE FUNCTION app_property_association_can_manage(target_tenant uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT app_property_tenant_system_id()=target_tenant
    AND EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=target_tenant
        AND member.user_id=app_user_id()
        AND member.status='active'
        AND member.tenant_role IN ('tenant_admin','tenant_accountant')
    )
$$;
REVOKE ALL ON FUNCTION app_property_association_can_manage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_property_association_can_manage(uuid) TO "{{role}}";

CREATE OR REPLACE FUNCTION app_property_association_can_view(
  target_tenant uuid,
  target_property uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT app_property_tenant_system_id()=target_tenant
    AND (
      app_property_association_can_manage(target_tenant)
      OR EXISTS (
        SELECT 1
        FROM properties property
        JOIN property_operating_tenant_members member
          ON member.tenant_system_id=property.tenant_system_id
         AND member.user_id=app_user_id()
         AND member.status='active'
        WHERE property.tenant_system_id=target_tenant
          AND property.id=target_property
          AND property.owner_user_id=app_user_id()
          AND member.tenant_role='owner'
      )
      OR EXISTS (
        SELECT 1
        FROM property_units unit
        JOIN leases lease ON lease.unit_id=unit.id
        JOIN property_tenant_account_links link
          ON link.tenant_id=lease.tenant_id
         AND link.user_id=app_user_id()
         AND link.revoked_at IS NULL
        JOIN property_operating_tenant_members member
          ON member.tenant_system_id=lease.tenant_system_id
         AND member.user_id=link.user_id
         AND member.tenant_role='resident'
         AND member.status='active'
        WHERE unit.property_id=target_property
          AND lease.tenant_system_id=target_tenant
          AND lease.status='active'
      )
    )
$$;
REVOKE ALL ON FUNCTION app_property_association_can_view(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_property_association_can_view(uuid,uuid) TO "{{role}}";

CREATE OR REPLACE FUNCTION create_property_association(
  association_name text,
  property_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  association_id uuid;
  property_count integer;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL OR association_name IS NULL OR property_ids IS NULL
    OR length(trim(association_name)) NOT BETWEEN 2 AND 160
    OR COALESCE(cardinality(property_ids),0)=0
    OR cardinality(property_ids)<>(
      SELECT count(DISTINCT selected_property)
      FROM unnest(property_ids) AS selected(selected_property)
    )
    OR NOT EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=tenant_id
        AND member.user_id=actor
        AND member.tenant_role='tenant_admin'
        AND member.status='active'
    ) THEN
    RAISE EXCEPTION 'An active tenant administrator and valid association properties are required'
      USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO property_count
  FROM properties property
  WHERE property.tenant_system_id=tenant_id
    AND property.id=ANY(property_ids);
  IF property_count<>cardinality(property_ids) THEN
    RAISE EXCEPTION 'Every association property must belong to the active property tenant'
      USING ERRCODE='42501';
  END IF;

  INSERT INTO property_associations(tenant_system_id,name,created_by)
  VALUES (tenant_id,trim(association_name),actor)
  RETURNING id INTO association_id;

  INSERT INTO property_association_properties(tenant_system_id,association_id,property_id)
  SELECT tenant_id,association_id,selected_property
  FROM unnest(property_ids) AS selected(selected_property);

  INSERT INTO property_association_events(
    tenant_system_id,association_id,actor_id,event_type,entity_id,details
  ) VALUES (
    tenant_id,association_id,actor,'association_created',association_id,
    jsonb_build_object('name',trim(association_name),'property_count',property_count)
  );
  RETURN association_id;
END;
$$;
REVOKE ALL ON FUNCTION create_property_association(text,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_property_association(text,uuid[]) TO "{{role}}";

CREATE OR REPLACE FUNCTION create_property_association_assessment(
  target_association uuid,
  target_property uuid,
  target_unit uuid,
  assessment_period date,
  assessment_due_on date,
  assessment_amount numeric,
  assessment_description text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  owner_id uuid;
  assessment_id uuid;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL OR assessment_period IS NULL
    OR target_association IS NULL OR target_property IS NULL
    OR assessment_due_on<assessment_period
    OR assessment_amount IS NULL OR assessment_amount<=0 OR assessment_amount::text='NaN'
    OR length(trim(assessment_description)) NOT BETWEEN 3 AND 500
    OR NOT app_property_association_can_manage(tenant_id) THEN
    RAISE EXCEPTION 'A valid manually entered assessment and tenant finance authority are required'
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
    ))
  FOR UPDATE OF property;

  IF owner_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM property_operating_tenant_members member
    WHERE member.tenant_system_id=tenant_id
      AND member.user_id=owner_id
      AND member.tenant_role='owner'
      AND member.status='active'
  ) THEN
    RAISE EXCEPTION 'An assessment requires an association-linked property with an active owner member'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO property_association_assessments(
    tenant_system_id,association_id,property_id,unit_id,owner_user_id,
    period_start,due_on,amount,description,created_by
  ) VALUES (
    tenant_id,target_association,target_property,target_unit,owner_id,
    assessment_period,assessment_due_on,assessment_amount,trim(assessment_description),actor
  ) RETURNING id INTO assessment_id;

  INSERT INTO property_association_events(
    tenant_system_id,association_id,actor_id,event_type,entity_id,details
  ) VALUES (
    tenant_id,target_association,actor,'assessment_created',assessment_id,
    jsonb_build_object(
      'property_id',target_property,'unit_id',target_unit,'owner_user_id',owner_id,
      'period_start',assessment_period,'due_on',assessment_due_on,
      'amount',assessment_amount,'description',trim(assessment_description)
    )
  );
  RETURN assessment_id;
END;
$$;
REVOKE ALL ON FUNCTION create_property_association_assessment(uuid,uuid,uuid,date,date,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_property_association_assessment(uuid,uuid,uuid,date,date,numeric,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION record_property_association_receipt(
  target_assessment uuid,
  receipt_amount numeric,
  receipt_channel text,
  receipt_reference text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  assessment property_association_assessments%ROWTYPE;
  already_recorded numeric;
  receipt_id uuid;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL OR receipt_amount IS NULL
    OR receipt_amount<=0 OR receipt_amount::text='NaN'
    OR receipt_channel IS NULL OR receipt_reference IS NULL
    OR length(trim(receipt_channel)) NOT BETWEEN 2 AND 40
    OR length(trim(receipt_reference)) NOT BETWEEN 3 AND 160
    OR receipt_reference ~* '://|password|secret|token|credential' THEN
    RAISE EXCEPTION 'A valid externally recorded receipt reference is required'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO assessment
  FROM property_association_assessments
  WHERE id=target_assessment AND tenant_system_id=tenant_id
  FOR UPDATE;

  IF assessment.id IS NULL OR assessment.owner_user_id<>actor
    OR NOT app_property_association_can_view(tenant_id,assessment.property_id) THEN
    RAISE EXCEPTION 'Only the assessed owner may submit a receipt reference'
      USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(sum(receipt.amount),0) INTO already_recorded
  FROM property_association_receipts receipt
  WHERE receipt.tenant_system_id=tenant_id
    AND receipt.assessment_id=assessment.id
    AND receipt.status IN ('pending','reconciled');
  IF already_recorded+receipt_amount>assessment.amount THEN
    RAISE EXCEPTION 'Receipt references cannot exceed the remaining assessment balance'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO property_association_receipts(
    tenant_system_id,assessment_id,amount,channel,reference,recorded_by
  ) VALUES (
    tenant_id,assessment.id,receipt_amount,trim(receipt_channel),trim(receipt_reference),actor
  ) RETURNING id INTO receipt_id;

  INSERT INTO property_association_events(
    tenant_system_id,association_id,actor_id,event_type,entity_id,details
  ) VALUES (
    tenant_id,assessment.association_id,actor,'receipt_recorded',receipt_id,
    jsonb_build_object('assessment_id',assessment.id,'amount',receipt_amount,'channel',trim(receipt_channel))
  );
  RETURN receipt_id;
END;
$$;
REVOKE ALL ON FUNCTION record_property_association_receipt(uuid,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_property_association_receipt(uuid,numeric,text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION decide_property_association_receipt(
  target_receipt uuid,
  decision text,
  decision_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  receipt property_association_receipts%ROWTYPE;
  assessment property_association_assessments%ROWTYPE;
  reconciled_total numeric;
BEGIN
  IF actor IS NULL OR decision IS NULL OR decision NOT IN ('reconciled','rejected')
    OR decision_reason IS NULL
    OR length(trim(decision_reason)) NOT BETWEEN 10 AND 1000
    OR NOT app_property_association_can_manage(tenant_id) THEN
    RAISE EXCEPTION 'An independent tenant administrator or accountant must record a documented receipt decision'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO receipt
  FROM property_association_receipts
  WHERE id=target_receipt AND tenant_system_id=tenant_id
  FOR UPDATE;
  IF receipt.id IS NULL OR receipt.recorded_by=actor OR receipt.status<>'pending' THEN
    RAISE EXCEPTION 'Receipt review must be pending and performed by a different authorized actor'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO assessment
  FROM property_association_assessments
  WHERE id=receipt.assessment_id AND tenant_system_id=tenant_id
  FOR UPDATE;
  IF assessment.id IS NULL THEN
    RAISE EXCEPTION 'The assessment for this receipt no longer exists'
      USING ERRCODE='23503';
  END IF;
  IF decision='reconciled' THEN
    SELECT COALESCE(sum(existing.amount),0) INTO reconciled_total
    FROM property_association_receipts existing
    WHERE existing.tenant_system_id=tenant_id
      AND existing.assessment_id=assessment.id
      AND existing.status='reconciled';
    IF reconciled_total+receipt.amount>assessment.amount THEN
      RAISE EXCEPTION 'Reconciliation would exceed the assessment balance'
        USING ERRCODE='23514';
    END IF;
  END IF;

  UPDATE property_association_receipts
  SET status=decision,reviewed_by=actor,review_reason=trim(decision_reason),reviewed_at=now()
  WHERE id=receipt.id AND tenant_system_id=tenant_id;

  INSERT INTO property_association_events(
    tenant_system_id,association_id,actor_id,event_type,entity_id,details
  ) VALUES (
    tenant_id,assessment.association_id,actor,
    CASE WHEN decision='reconciled' THEN 'receipt_reconciled' ELSE 'receipt_rejected' END,
    receipt.id,jsonb_build_object('assessment_id',assessment.id,'reason',trim(decision_reason))
  );
END;
$$;
REVOKE ALL ON FUNCTION decide_property_association_receipt(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decide_property_association_receipt(uuid,text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION app_property_association_event_can_insert(
  target_tenant uuid,
  target_association uuid,
  target_actor uuid,
  target_event_type text,
  target_entity uuid,
  target_details jsonb
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT target_actor=app_user_id()
    AND target_tenant=app_property_tenant_system_id()
    AND CASE target_event_type
      WHEN 'association_created' THEN
        EXISTS (
          SELECT 1 FROM property_associations association
          WHERE association.tenant_system_id=target_tenant
            AND association.id=target_association
            AND association.created_by=target_actor
        )
        AND EXISTS (
          SELECT 1 FROM property_operating_tenant_members member
          WHERE member.tenant_system_id=target_tenant
            AND member.user_id=target_actor
            AND member.tenant_role='tenant_admin'
            AND member.status='active'
        )
      WHEN 'assessment_created' THEN
        app_property_association_can_manage(target_tenant)
        AND EXISTS (
          SELECT 1 FROM property_association_assessments assessment
          WHERE assessment.tenant_system_id=target_tenant
            AND assessment.association_id=target_association
            AND assessment.id=target_entity
            AND assessment.owner_user_id::text=target_details->>'owner_user_id'
        )
      WHEN 'receipt_recorded' THEN
        EXISTS (
          SELECT 1
          FROM property_association_receipts receipt
          JOIN property_association_assessments assessment
            ON assessment.tenant_system_id=receipt.tenant_system_id
           AND assessment.id=receipt.assessment_id
          WHERE receipt.tenant_system_id=target_tenant
            AND receipt.id=target_entity
            AND receipt.recorded_by=target_actor
            AND receipt.status='pending'
            AND assessment.association_id=target_association
            AND assessment.owner_user_id=target_actor
            AND assessment.id=CASE
              WHEN target_details->>'assessment_id'
                ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN (target_details->>'assessment_id')::uuid
              ELSE NULL
            END
        )
      WHEN 'receipt_reconciled' THEN
        app_property_association_can_manage(target_tenant)
        AND EXISTS (
          SELECT 1
          FROM property_association_receipts receipt
          JOIN property_association_assessments assessment
            ON assessment.tenant_system_id=receipt.tenant_system_id
           AND assessment.id=receipt.assessment_id
          WHERE receipt.tenant_system_id=target_tenant
            AND receipt.id=target_entity
            AND receipt.reviewed_by=target_actor
            AND receipt.status='reconciled'
            AND assessment.association_id=target_association
        )
      WHEN 'receipt_rejected' THEN
        app_property_association_can_manage(target_tenant)
        AND EXISTS (
          SELECT 1
          FROM property_association_receipts receipt
          JOIN property_association_assessments assessment
            ON assessment.tenant_system_id=receipt.tenant_system_id
           AND assessment.id=receipt.assessment_id
          WHERE receipt.tenant_system_id=target_tenant
            AND receipt.id=target_entity
            AND receipt.reviewed_by=target_actor
            AND receipt.status='rejected'
            AND assessment.association_id=target_association
        )
      ELSE false
    END
$$;
REVOKE ALL ON FUNCTION app_property_association_event_can_insert(uuid,uuid,uuid,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_property_association_event_can_insert(uuid,uuid,uuid,text,uuid,jsonb) TO "{{role}}";

ALTER TABLE property_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_associations FORCE ROW LEVEL SECURITY;
CREATE POLICY property_associations_scoped_read
  ON property_associations FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND EXISTS (
      SELECT 1 FROM property_association_properties association_property
      WHERE association_property.tenant_system_id=property_associations.tenant_system_id
        AND association_property.association_id=property_associations.id
        AND app_property_association_can_view(
          association_property.tenant_system_id,association_property.property_id
        )
    )
  );
CREATE POLICY property_associations_command_insert
  ON property_associations FOR INSERT
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND created_by=app_user_id()
    AND EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=property_associations.tenant_system_id
        AND member.user_id=app_user_id()
        AND member.tenant_role='tenant_admin'
        AND member.status='active'
    )
  );

ALTER TABLE property_association_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_properties FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_properties_scoped_read
  ON property_association_properties FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND app_property_association_can_view(tenant_system_id,property_id)
  );
CREATE POLICY property_association_properties_command_insert
  ON property_association_properties FOR INSERT
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=property_association_properties.tenant_system_id
        AND member.user_id=app_user_id()
        AND member.tenant_role='tenant_admin'
        AND member.status='active'
    )
  );

ALTER TABLE property_association_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_assessments FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_assessments_scoped_read
  ON property_association_assessments FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND (
      owner_user_id=app_user_id()
      OR app_property_association_can_manage(tenant_system_id)
    )
  );
CREATE POLICY property_association_assessments_command_insert
  ON property_association_assessments FOR INSERT
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND created_by=app_user_id()
    AND app_property_association_can_manage(tenant_system_id)
    AND EXISTS (
      SELECT 1 FROM properties property
      JOIN property_operating_tenant_members member
        ON member.tenant_system_id=property.tenant_system_id
       AND member.user_id=property_association_assessments.owner_user_id
       AND member.tenant_role='owner'
       AND member.status='active'
      WHERE property.tenant_system_id=property_association_assessments.tenant_system_id
        AND property.id=property_association_assessments.property_id
        AND property.owner_user_id=property_association_assessments.owner_user_id
    )
  );

ALTER TABLE property_association_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_receipts_scoped_read
  ON property_association_receipts FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND (
      recorded_by=app_user_id()
      OR app_property_association_can_manage(tenant_system_id)
      OR EXISTS (
        SELECT 1 FROM property_association_assessments assessment
        WHERE assessment.tenant_system_id=property_association_receipts.tenant_system_id
          AND assessment.id=property_association_receipts.assessment_id
          AND assessment.owner_user_id=app_user_id()
      )
    )
  );
CREATE POLICY property_association_receipts_command_insert
  ON property_association_receipts FOR INSERT
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND recorded_by=app_user_id()
    AND status='pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_reason IS NULL
    AND EXISTS (
      SELECT 1 FROM property_association_assessments assessment
      WHERE assessment.tenant_system_id=property_association_receipts.tenant_system_id
        AND assessment.id=property_association_receipts.assessment_id
        AND assessment.owner_user_id=app_user_id()
    )
  );
CREATE POLICY property_association_receipts_command_update
  ON property_association_receipts FOR UPDATE
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND status='pending'
    AND recorded_by<>app_user_id()
    AND app_property_association_can_manage(tenant_system_id)
  )
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND status IN ('reconciled','rejected')
    AND recorded_by<>app_user_id()
    AND reviewed_by=app_user_id()
    AND app_property_association_can_manage(tenant_system_id)
  );

ALTER TABLE property_association_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_events FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_events_scoped_read
  ON property_association_events FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND (
      app_property_association_can_manage(tenant_system_id)
      OR (
        event_type='assessment_created'
        AND details->>'owner_user_id'=app_user_id()::text
      )
      OR (
        event_type IN ('receipt_recorded','receipt_reconciled','receipt_rejected')
        AND EXISTS (
          SELECT 1 FROM property_association_assessments assessment
          WHERE assessment.tenant_system_id=property_association_events.tenant_system_id
            AND assessment.id=CASE
              WHEN property_association_events.details->>'assessment_id'
                ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN (property_association_events.details->>'assessment_id')::uuid
              ELSE NULL
            END
            AND assessment.owner_user_id=app_user_id()
        )
      )
      OR (
        event_type='association_created'
        AND EXISTS (
          SELECT 1 FROM property_association_properties association_property
          WHERE association_property.tenant_system_id=property_association_events.tenant_system_id
            AND association_property.association_id=property_association_events.association_id
            AND app_property_association_can_view(
              association_property.tenant_system_id,association_property.property_id
            )
        )
      )
    )
  );
CREATE POLICY property_association_events_command_insert
  ON property_association_events FOR INSERT
  WITH CHECK (
    app_property_association_event_can_insert(
      tenant_system_id,association_id,actor_id,event_type,entity_id,details
    )
  );

REVOKE ALL ON TABLE
  property_associations,property_association_properties,property_association_assessments,
  property_association_receipts,property_association_events
FROM PUBLIC,"{{role}}";
GRANT SELECT ON TABLE
  property_associations,property_association_properties,property_association_assessments,
  property_association_receipts,property_association_events
TO "{{role}}";
