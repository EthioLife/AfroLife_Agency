CREATE TABLE property_association_dues_policies (
  policy_version_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_system_id uuid NOT NULL,
  association_id uuid NOT NULL,
  property_id uuid NOT NULL,
  policy_version integer NOT NULL CHECK (policy_version>0),
  cadence_months integer NOT NULL CHECK (cadence_months IN (1,3,12)),
  anchor_period_start date NOT NULL CHECK (extract(day FROM anchor_period_start)=1),
  amount numeric(14,2) NOT NULL CHECK (amount>0),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 3 AND 500),
  status text NOT NULL CHECK (status IN ('active','retired')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_system_id,association_id,property_id,policy_version),
  FOREIGN KEY (tenant_system_id,association_id,property_id)
    REFERENCES property_association_properties(tenant_system_id,association_id,property_id)
    ON DELETE RESTRICT
);
CREATE INDEX property_association_dues_policies_history_idx
  ON property_association_dues_policies(
    tenant_system_id,association_id,property_id,policy_version DESC
  );
CREATE TRIGGER property_association_dues_policies_immutable
  BEFORE UPDATE OR DELETE ON property_association_dues_policies
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

CREATE TABLE property_association_dues_cycles (
  cycle_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_system_id uuid NOT NULL,
  association_id uuid NOT NULL,
  period_start date NOT NULL CHECK (extract(day FROM period_start)=1),
  due_on date NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status='completed'),
  generated_assessment_count integer NOT NULL CHECK (generated_assessment_count>0),
  triggered_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_system_id,association_id,period_start),
  UNIQUE (tenant_system_id,cycle_id),
  CHECK (due_on>=period_start),
  FOREIGN KEY (tenant_system_id,association_id)
    REFERENCES property_associations(tenant_system_id,id) ON DELETE RESTRICT
);
CREATE INDEX property_association_dues_cycles_history_idx
  ON property_association_dues_cycles(tenant_system_id,association_id,period_start DESC);
CREATE TRIGGER property_association_dues_cycles_immutable
  BEFORE UPDATE OR DELETE ON property_association_dues_cycles
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

CREATE TABLE property_association_dues_cycle_items (
  tenant_system_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  property_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  policy_version_id bigint NOT NULL,
  PRIMARY KEY (tenant_system_id,cycle_id,property_id),
  UNIQUE (tenant_system_id,assessment_id),
  FOREIGN KEY (tenant_system_id,cycle_id)
    REFERENCES property_association_dues_cycles(tenant_system_id,cycle_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_system_id,assessment_id)
    REFERENCES property_association_assessments(tenant_system_id,id)
    ON DELETE RESTRICT,
  FOREIGN KEY (policy_version_id)
    REFERENCES property_association_dues_policies(policy_version_id)
    ON DELETE RESTRICT
);
CREATE TRIGGER property_association_dues_cycle_items_immutable
  BEFORE UPDATE OR DELETE ON property_association_dues_cycle_items
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

CREATE OR REPLACE FUNCTION record_property_association_dues_policy(
  target_association uuid,
  target_property uuid,
  target_cadence_months integer,
  target_anchor_period_start date,
  target_amount numeric,
  target_description text,
  target_status text
)
RETURNS TABLE(policy_version_id bigint,policy_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  next_version integer;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL
    OR target_association IS NULL OR target_property IS NULL
    OR target_cadence_months IS NULL OR target_cadence_months NOT IN (1,3,12)
    OR target_anchor_period_start IS NULL
    OR extract(day FROM target_anchor_period_start)<>1
    OR target_amount IS NULL OR target_amount<=0 OR target_amount::text='NaN'
    OR target_description IS NULL
    OR length(trim(target_description)) NOT BETWEEN 3 AND 500
    OR target_status IS NULL OR target_status NOT IN ('active','retired')
    OR NOT EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=tenant_id
        AND member.user_id=actor
        AND member.tenant_role='tenant_admin'
        AND member.status='active'
    ) THEN
    RAISE EXCEPTION 'A tenant administrator and valid recurring dues policy are required'
      USING ERRCODE='42501';
  END IF;

  PERFORM 1 FROM property_associations association
  WHERE association.tenant_system_id=tenant_id
    AND association.id=target_association
    AND association.status='active'
  FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM property_association_properties association_property
    WHERE association_property.tenant_system_id=tenant_id
      AND association_property.association_id=target_association
      AND association_property.property_id=target_property
  ) THEN
    RAISE EXCEPTION 'Dues policy property must belong to an active tenant association'
      USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(max(policy.policy_version),0)+1 INTO next_version
  FROM property_association_dues_policies policy
  WHERE policy.tenant_system_id=tenant_id
    AND policy.association_id=target_association
    AND policy.property_id=target_property;

  RETURN QUERY
  INSERT INTO property_association_dues_policies(
    tenant_system_id,association_id,property_id,policy_version,cadence_months,
    anchor_period_start,amount,description,status,created_by
  )
  VALUES (
    tenant_id,target_association,target_property,next_version,target_cadence_months,
    target_anchor_period_start,target_amount,trim(target_description),target_status,actor
  )
  RETURNING property_association_dues_policies.policy_version_id,
            property_association_dues_policies.policy_version;
END;
$$;
REVOKE ALL ON FUNCTION record_property_association_dues_policy(uuid,uuid,integer,date,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_property_association_dues_policy(uuid,uuid,integer,date,numeric,text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION run_property_association_dues_cycle(
  target_association uuid,
  target_period_start date,
  target_due_on date
)
RETURNS TABLE(cycle_id uuid,generated_assessment_count integer,already_run boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  policy record;
  owner_id uuid;
  assessment_id uuid;
  new_cycle_id uuid;
  generated_count integer;
  actual_count integer := 0;
  policy_month_delta integer;
  existing_due_on date;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL OR target_association IS NULL
    OR target_period_start IS NULL OR extract(day FROM target_period_start)<>1
    OR target_due_on IS NULL OR target_due_on<target_period_start
    OR NOT app_property_association_can_manage(tenant_id) THEN
    RAISE EXCEPTION 'A valid cycle period, due date, and tenant assessment authority are required'
      USING ERRCODE='42501';
  END IF;

  PERFORM 1 FROM property_associations association
  WHERE association.tenant_system_id=tenant_id
    AND association.id=target_association
    AND association.status='active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active tenant association is required'
      USING ERRCODE='42501';
  END IF;

  SELECT cycle.cycle_id,cycle.generated_assessment_count,cycle.due_on
  INTO new_cycle_id,generated_count,existing_due_on
  FROM property_association_dues_cycles cycle
  WHERE cycle.tenant_system_id=tenant_id
    AND cycle.association_id=target_association
    AND cycle.period_start=target_period_start;
  IF FOUND THEN
    IF existing_due_on<>target_due_on THEN
      RAISE EXCEPTION 'This association dues cycle already exists with a different due date'
        USING ERRCODE='23514';
    END IF;
    RETURN QUERY SELECT new_cycle_id,generated_count,true;
    RETURN;
  END IF;

  SELECT count(*) INTO generated_count
  FROM property_association_dues_policies configured
  WHERE configured.tenant_system_id=tenant_id
    AND configured.association_id=target_association
    AND configured.status='active'
    AND configured.policy_version=(
      SELECT max(latest.policy_version)
      FROM property_association_dues_policies latest
      WHERE latest.tenant_system_id=configured.tenant_system_id
        AND latest.association_id=configured.association_id
        AND latest.property_id=configured.property_id
    )
    AND (
      (
        (extract(year FROM target_period_start)::integer-extract(year FROM configured.anchor_period_start)::integer)*12
        +extract(month FROM target_period_start)::integer-extract(month FROM configured.anchor_period_start)::integer
      )>=0
    )
    AND (
      (
        (extract(year FROM target_period_start)::integer-extract(year FROM configured.anchor_period_start)::integer)*12
        +extract(month FROM target_period_start)::integer-extract(month FROM configured.anchor_period_start)::integer
      )%configured.cadence_months=0
    );
  IF generated_count=0 THEN
    RAISE EXCEPTION 'No active dues policies apply to this cycle period'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO property_association_dues_cycles(
    tenant_system_id,association_id,period_start,due_on,
    generated_assessment_count,triggered_by
  )
  VALUES (
    tenant_id,target_association,target_period_start,target_due_on,generated_count,actor
  )
  RETURNING property_association_dues_cycles.cycle_id INTO new_cycle_id;

  FOR policy IN
    SELECT configured.*
    FROM property_association_dues_policies configured
    WHERE configured.tenant_system_id=tenant_id
      AND configured.association_id=target_association
      AND configured.status='active'
      AND configured.policy_version=(
        SELECT max(latest.policy_version)
        FROM property_association_dues_policies latest
        WHERE latest.tenant_system_id=configured.tenant_system_id
          AND latest.association_id=configured.association_id
          AND latest.property_id=configured.property_id
      )
    ORDER BY configured.property_id
  LOOP
    policy_month_delta :=
      (extract(year FROM target_period_start)::integer-extract(year FROM policy.anchor_period_start)::integer)*12
      +extract(month FROM target_period_start)::integer-extract(month FROM policy.anchor_period_start)::integer;
    IF policy_month_delta<0 OR policy_month_delta%policy.cadence_months<>0 THEN
      CONTINUE;
    END IF;

    SELECT property.owner_user_id INTO owner_id
    FROM properties property
    WHERE property.tenant_system_id=tenant_id
      AND property.id=policy.property_id
    FOR UPDATE;
    IF owner_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=tenant_id
        AND member.user_id=owner_id
        AND member.tenant_role='owner'
        AND member.status='active'
    ) THEN
      RAISE EXCEPTION 'Each cycle property requires a current active owner membership'
        USING ERRCODE='23514';
    END IF;

    INSERT INTO property_association_assessments(
      tenant_system_id,association_id,property_id,owner_user_id,
      period_start,due_on,amount,description,created_by
    )
    VALUES (
      tenant_id,target_association,policy.property_id,owner_id,
      target_period_start,target_due_on,policy.amount,policy.description,actor
    )
    RETURNING id INTO assessment_id;

    INSERT INTO property_association_dues_cycle_items(
      tenant_system_id,cycle_id,property_id,assessment_id,policy_version_id
    )
    VALUES (
      tenant_id,new_cycle_id,policy.property_id,assessment_id,policy.policy_version_id
    );

    INSERT INTO property_association_events(
      tenant_system_id,association_id,actor_id,event_type,entity_id,details
    )
    VALUES (
      tenant_id,target_association,actor,'assessment_created',assessment_id,
      jsonb_build_object(
        'property_id',policy.property_id,'owner_user_id',owner_id,
        'period_start',target_period_start,'due_on',target_due_on,
        'amount',policy.amount,'description',policy.description,
        'cycle_id',new_cycle_id,'dues_policy_version_id',policy.policy_version_id
      )
    );
    actual_count := actual_count+1;
  END LOOP;

  IF actual_count<>generated_count THEN
    RAISE EXCEPTION 'The generated assessment count did not match the applicable dues policies'
      USING ERRCODE='23514';
  END IF;

  RETURN QUERY SELECT new_cycle_id,generated_count,false;
END;
$$;
REVOKE ALL ON FUNCTION run_property_association_dues_cycle(uuid,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION run_property_association_dues_cycle(uuid,date,date) TO "{{role}}";

ALTER TABLE property_association_dues_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_dues_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_dues_policies_scoped_read
  ON property_association_dues_policies FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND app_property_association_can_view(tenant_system_id,property_id)
  );
CREATE POLICY property_association_dues_policies_command_insert
  ON property_association_dues_policies FOR INSERT
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND created_by=app_user_id()
    AND EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=property_association_dues_policies.tenant_system_id
        AND member.user_id=app_user_id()
        AND member.tenant_role='tenant_admin'
        AND member.status='active'
    )
  );

ALTER TABLE property_association_dues_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_dues_cycles FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_dues_cycles_scoped_read
  ON property_association_dues_cycles FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND app_property_association_can_manage(tenant_system_id)
  );

ALTER TABLE property_association_dues_cycle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_dues_cycle_items FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_dues_cycle_items_scoped_read
  ON property_association_dues_cycle_items FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND app_property_association_can_manage(tenant_system_id)
  );

REVOKE ALL ON TABLE
  property_association_dues_policies,property_association_dues_cycles,
  property_association_dues_cycle_items
FROM PUBLIC,"{{role}}";
GRANT SELECT ON TABLE
  property_association_dues_policies,property_association_dues_cycles,
  property_association_dues_cycle_items
TO "{{role}}";
