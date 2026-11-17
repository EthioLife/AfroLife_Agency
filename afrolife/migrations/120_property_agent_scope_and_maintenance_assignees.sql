CREATE TABLE property_agent_scopes (
  tenant_system_id uuid NOT NULL REFERENCES property_operating_tenants(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  user_id uuid NOT NULL REFERENCES users(id),
  tenant_role text NOT NULL CHECK (tenant_role IN ('master_agent','field_agent')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','ended')),
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  assigned_by uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_system_id,property_id,user_id),
  CHECK (effective_to IS NULL OR effective_to>=effective_from)
);
CREATE INDEX property_agent_scopes_user_active_idx
  ON property_agent_scopes(tenant_system_id,user_id,property_id)
  WHERE status='active';

CREATE TABLE property_agent_scope_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_system_id uuid NOT NULL REFERENCES property_operating_tenants(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  user_id uuid NOT NULL REFERENCES users(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL CHECK (event_type IN ('assigned','suspended','reactivated','ended')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_agent_scope_events_history_idx
  ON property_agent_scope_events(tenant_system_id,property_id,user_id,created_at,id);
CREATE TRIGGER property_agent_scope_events_immutable
  BEFORE UPDATE OR DELETE ON property_agent_scope_events
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

ALTER TABLE property_vendors NO FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_property_vendor_matches_active_tenant(target_vendor_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM property_vendors vendor
    WHERE vendor.id=target_vendor_id
      AND vendor.tenant_system_id=app_property_tenant_system_id()
  )
$$;
REVOKE ALL ON FUNCTION app_property_vendor_matches_active_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_property_vendor_matches_active_tenant(uuid) TO "{{role}}";

DROP POLICY property_vendor_memberships_operating_tenant_scope ON property_vendor_memberships;
CREATE POLICY property_vendor_memberships_operating_tenant_scope ON property_vendor_memberships AS RESTRICTIVE FOR ALL
  USING (app_property_vendor_matches_active_tenant(vendor_id))
  WITH CHECK (app_property_vendor_matches_active_tenant(vendor_id));

ALTER TABLE properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE property_units DISABLE ROW LEVEL SECURITY;
ALTER TABLE property_units
  ADD COLUMN tenant_system_id uuid REFERENCES property_operating_tenants(id);
UPDATE property_units unit
SET tenant_system_id=property.tenant_system_id
FROM properties property
WHERE property.id=unit.property_id;
ALTER TABLE property_units ALTER COLUMN tenant_system_id SET NOT NULL;
CREATE UNIQUE INDEX properties_id_tenant_system_unique
  ON properties(id,tenant_system_id);
CREATE INDEX property_units_tenant_system_idx
  ON property_units(tenant_system_id,property_id,id);
ALTER TABLE property_units
  ADD CONSTRAINT property_units_property_tenant_system_fk
  FOREIGN KEY (property_id,tenant_system_id)
  REFERENCES properties(id,tenant_system_id);
DROP POLICY property_units_operating_tenant_scope ON property_units;
CREATE POLICY property_units_operating_tenant_scope ON property_units AS RESTRICTIVE FOR ALL
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());
ALTER TABLE properties NO FORCE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_units NO FORCE ROW LEVEL SECURITY;
ALTER TABLE property_units ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER property_units_tenant_system_guard
  BEFORE INSERT OR UPDATE OF tenant_system_id ON property_units
  FOR EACH ROW EXECUTE FUNCTION guard_property_tenant_system_id();

ALTER TABLE maintenance_requests
  ADD COLUMN assigned_to_user_id uuid REFERENCES users(id);
CREATE INDEX maintenance_requests_internal_assignee_idx
  ON maintenance_requests(tenant_system_id,assigned_to_user_id,status)
  WHERE assigned_to_user_id IS NOT NULL;

-- Disable the cross-referencing policies for this migration-only backfill.
ALTER TABLE maintenance_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE property_vendor_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE property_vendors DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
INSERT INTO property_agent_scopes(
  tenant_system_id,property_id,user_id,tenant_role,assigned_by
)
SELECT DISTINCT maintenance.tenant_system_id,maintenance.property_id,member.user_id,
  member.tenant_role,tenant.created_by
FROM maintenance_requests maintenance
JOIN users assignee
  ON maintenance.assigned_to ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 AND assignee.id=CASE WHEN maintenance.assigned_to ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   THEN maintenance.assigned_to::uuid END AND assignee.active=true
JOIN property_operating_tenant_members member
  ON member.tenant_system_id=maintenance.tenant_system_id
 AND member.user_id=assignee.id AND member.status='active'
 AND member.tenant_role IN ('master_agent','field_agent')
JOIN property_operating_tenants tenant ON tenant.id=maintenance.tenant_system_id
WHERE tenant.created_by IS NOT NULL
ON CONFLICT (tenant_system_id,property_id,user_id) DO NOTHING;
RAISE NOTICE 'MIGRATION_STAGE: agent scopes backfilled';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Property agent scope backfill failed.'
      USING ERRCODE=SQLSTATE;
  END;

  BEGIN
UPDATE maintenance_requests maintenance
SET assigned_to_user_id=assignee.id
FROM users assignee,property_operating_tenant_members member
WHERE maintenance.assigned_to ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND assignee.id=CASE WHEN maintenance.assigned_to ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN maintenance.assigned_to::uuid END AND assignee.active=true
  AND member.user_id=assignee.id AND member.status='active'
  AND member.tenant_role IN ('master_agent','field_agent')
  AND member.tenant_system_id=maintenance.tenant_system_id
  AND EXISTS (
    SELECT 1 FROM property_agent_scopes scope
    WHERE scope.tenant_system_id=maintenance.tenant_system_id
      AND scope.property_id=maintenance.property_id AND scope.user_id=assignee.id
      AND scope.status='active'
  );
    RAISE NOTICE 'MIGRATION_STAGE: maintenance assignees backfilled';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Maintenance assignee backfill failed.'
      USING ERRCODE=SQLSTATE;
  END;
END
$$;

ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE property_vendor_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_vendor_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE property_vendors ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  RAISE NOTICE 'MIGRATION_STAGE: vendor RLS restored';
END
$$;

CREATE OR REPLACE FUNCTION app_property_tenant_role_matches(target_tenant_role text,target_auth_role text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE target_tenant_role
    WHEN 'tenant_admin' THEN target_auth_role IN ('super_admin','corporate_business_manager')
    WHEN 'tenant_accountant' THEN target_auth_role IN ('finance','finance_manager')
    WHEN 'master_agent' THEN target_auth_role='master_agent'
    WHEN 'field_agent' THEN target_auth_role='field_agent'
    WHEN 'owner' THEN target_auth_role='property_owner'
    WHEN 'resident' THEN target_auth_role='customer'
    WHEN 'vendor' THEN target_auth_role IN ('property_vendor','vendor')
    ELSE false
  END
$$;
REVOKE ALL ON FUNCTION app_property_tenant_role_matches(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_property_tenant_role_matches(text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION provision_property_operating_tenant(
  requested_key text,
  requested_legal_name text,
  initial_admin uuid,
  requested_jurisdiction text,
  requested_timezone text,
  requested_currency text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE created_tenant uuid;
BEGIN
  IF app_role()<>'global_admin' OR actor IS NULL THEN
    RAISE EXCEPTION 'Only a Global Admin can provision a property tenant'
      USING ERRCODE='42501';
  END IF;
  IF initial_admin=actor OR NOT EXISTS (
    SELECT 1 FROM users WHERE id=initial_admin AND active=true
      AND app_property_tenant_role_matches('tenant_admin',role)
  ) THEN
    RAISE EXCEPTION 'The initial tenant administrator must be an active, eligible user other than the provisioning administrator'
      USING ERRCODE='23514';
  END IF;
  INSERT INTO property_operating_tenants(
    tenant_key,legal_name,jurisdiction,timezone,currency,status,created_by
  ) VALUES (
    requested_key,requested_legal_name,requested_jurisdiction,
    requested_timezone,requested_currency,'active',actor
  ) RETURNING id INTO created_tenant;
  INSERT INTO property_operating_tenant_members(tenant_system_id,user_id,tenant_role,assigned_by)
  VALUES(created_tenant,initial_admin,'tenant_admin',actor);
  INSERT INTO property_operating_tenant_events(tenant_system_id,actor_id,event_type,event_data)
  VALUES(created_tenant,actor,'tenant_created',
    jsonb_build_object('initial_admin',initial_admin,'jurisdiction',requested_jurisdiction,
      'timezone',requested_timezone,'currency',requested_currency));
  RETURN created_tenant;
END;
$$;
REVOKE ALL ON FUNCTION provision_property_operating_tenant(text,text,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_property_operating_tenant(text,text,uuid,text,text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION assign_property_operating_tenant_member(
  target_tenant uuid,
  target_user uuid,
  target_role text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
BEGIN
  IF NOT (
    app_role()='global_admin'
    OR (
      app_property_tenant_system_id()=target_tenant
      AND app_has_permission('property.tenancy.manage')
      AND EXISTS (
        SELECT 1 FROM property_operating_tenant_members member
        WHERE member.tenant_system_id=target_tenant AND member.user_id=actor
          AND member.tenant_role='tenant_admin' AND member.status='active'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Tenant membership requires Global Admin or tenant administrator authority'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id=target_user AND active=true
      AND app_property_tenant_role_matches(target_role,role)
  ) THEN
    RAISE EXCEPTION 'The selected tenant role is not supported for this active account role'
      USING ERRCODE='23514';
  END IF;
  INSERT INTO property_operating_tenant_members(tenant_system_id,user_id,tenant_role,assigned_by)
  VALUES(target_tenant,target_user,target_role,actor)
  ON CONFLICT(tenant_system_id,user_id) DO UPDATE
    SET tenant_role=EXCLUDED.tenant_role,status='active',assigned_by=EXCLUDED.assigned_by,assigned_at=now();
  INSERT INTO property_operating_tenant_events(tenant_system_id,actor_id,event_type,event_data)
  VALUES(target_tenant,actor,'member_assigned',
    jsonb_build_object('user_id',target_user,'tenant_role',target_role));
END;
$$;
REVOKE ALL ON FUNCTION assign_property_operating_tenant_member(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assign_property_operating_tenant_member(uuid,uuid,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION app_property_tenant_system_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT tenant.id
  FROM property_operating_tenants tenant
  WHERE tenant.id=nullif(current_setting('app.property_tenant_system_id',true),'')::uuid
    AND tenant.status='active'
    AND (
      (
        app_role()<>'global_admin'
        AND EXISTS (
          SELECT 1 FROM property_operating_tenant_members member
          JOIN users user_row ON user_row.id=member.user_id AND user_row.active=true
          WHERE member.tenant_system_id=tenant.id AND member.user_id=app_user_id()
            AND member.status='active'
            AND app_property_tenant_role_matches(member.tenant_role,user_row.role)
        )
      )
      OR (
        app_role()='global_admin'
        AND EXISTS (
          SELECT 1 FROM property_operating_tenant_support_grants grant_row
          WHERE grant_row.tenant_system_id=tenant.id AND grant_row.user_id=app_user_id()
            AND grant_row.status='active' AND grant_row.expires_at>now()
            AND grant_row.purpose=current_setting('app.property_tenant_purpose',true)
        )
      )
    )
$$;

CREATE OR REPLACE FUNCTION assign_property_agent_scope(
  target_tenant uuid,
  target_property uuid,
  target_user uuid,
  target_role text,
  assignment_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE previous_status text;
BEGIN
  IF actor IS NULL OR app_property_tenant_system_id() IS DISTINCT FROM target_tenant
    OR NOT app_has_permission('property.tenancy.manage')
    OR NOT app_is_property_tenant_admin(target_tenant)
    OR target_user=actor
    OR target_role NOT IN ('master_agent','field_agent')
    OR length(trim(assignment_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Property agent assignments require tenant administrator authority, a different active member, and a documented reason'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=target_property AND property.tenant_system_id=target_tenant
  ) THEN
    RAISE EXCEPTION 'Property is not part of the active tenant'
      USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM users user_row
    JOIN property_operating_tenant_members member ON member.user_id=user_row.id
    WHERE user_row.id=target_user AND user_row.active=true
      AND member.tenant_system_id=target_tenant AND member.tenant_role=target_role
      AND member.status='active'
      AND app_property_tenant_role_matches(target_role,user_row.role)
  ) THEN
    RAISE EXCEPTION 'The assignee must be an active tenant member with the selected agent role'
      USING ERRCODE='23514';
  END IF;
  SELECT status INTO previous_status FROM property_agent_scopes
  WHERE tenant_system_id=target_tenant AND property_id=target_property AND user_id=target_user
  FOR UPDATE;
  INSERT INTO property_agent_scopes(
    tenant_system_id,property_id,user_id,tenant_role,status,effective_from,effective_to,assigned_by,assigned_at
  ) VALUES(target_tenant,target_property,target_user,target_role,'active',current_date,NULL,actor,now())
  ON CONFLICT(tenant_system_id,property_id,user_id) DO UPDATE
    SET tenant_role=EXCLUDED.tenant_role,status='active',effective_from=current_date,
      effective_to=NULL,assigned_by=actor,assigned_at=now();
  INSERT INTO property_agent_scope_events(
    tenant_system_id,property_id,user_id,actor_id,event_type,reason
  ) VALUES(target_tenant,target_property,target_user,actor,
    CASE WHEN previous_status='suspended' THEN 'reactivated'
      WHEN previous_status IS NULL THEN 'assigned' ELSE 'assigned' END,
    assignment_reason);
END;
$$;

CREATE OR REPLACE FUNCTION set_property_agent_scope_status(
  target_tenant uuid,
  target_property uuid,
  target_user uuid,
  next_status text,
  change_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE previous_status text;
BEGIN
  IF actor IS NULL OR actor=target_user
    OR app_property_tenant_system_id() IS DISTINCT FROM target_tenant
    OR NOT app_has_permission('property.tenancy.manage')
    OR NOT app_is_property_tenant_admin(target_tenant)
    OR next_status NOT IN ('suspended','ended')
    OR length(trim(change_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Property agent scope changes require tenant administrator authority and a documented reason'
      USING ERRCODE='42501';
  END IF;
  UPDATE property_agent_scopes
  SET status=next_status,effective_to=CASE WHEN next_status='ended' THEN current_date ELSE effective_to END
  WHERE tenant_system_id=target_tenant AND property_id=target_property AND user_id=target_user
    AND status='active'
  RETURNING status INTO previous_status;
  IF previous_status IS NULL THEN
    RAISE EXCEPTION 'An active property agent assignment was not found'
      USING ERRCODE='23514';
  END IF;
  INSERT INTO property_agent_scope_events(
    tenant_system_id,property_id,user_id,actor_id,event_type,reason
  ) VALUES(target_tenant,target_property,target_user,actor,next_status,change_reason);
END;
$$;

CREATE OR REPLACE FUNCTION guard_property_maintenance_assignee()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
BEGIN
  IF TG_OP='INSERT' AND app_role()='field_agent' THEN
    RAISE EXCEPTION 'Field agents cannot create maintenance requests; a supervisor must assign work'
      USING ERRCODE='42501';
  END IF;
  IF NEW.assigned_vendor_id IS NOT NULL THEN
    NEW.assigned_to_user_id := NULL;
    NEW.assigned_to := NULL;
    RETURN NEW;
  END IF;
  IF NEW.assigned_to_user_id IS NULL THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      RAISE EXCEPTION 'Internal maintenance assignees must be selected by user ID and have an active property assignment'
        USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM users user_row
    JOIN property_operating_tenant_members member
      ON member.user_id=user_row.id AND member.tenant_system_id=NEW.tenant_system_id
     AND member.status='active'
     AND member.tenant_role IN ('master_agent','field_agent')
    JOIN property_agent_scopes scope
      ON scope.tenant_system_id=NEW.tenant_system_id AND scope.property_id=NEW.property_id
     AND scope.user_id=user_row.id AND scope.status='active'
     AND scope.effective_from<=current_date
     AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
    WHERE user_row.id=NEW.assigned_to_user_id AND user_row.active=true
      AND app_property_tenant_role_matches(member.tenant_role,user_row.role)
  ) THEN
    RAISE EXCEPTION 'Maintenance assignee must be an active agent assigned to this property in the same tenant'
      USING ERRCODE='23514';
  END IF;
  NEW.assigned_to := NEW.assigned_to_user_id::text;
  RETURN NEW;
END;
$$;
CREATE TRIGGER maintenance_assignee_scope_guard
  BEFORE INSERT OR UPDATE OF assigned_to,assigned_to_user_id,assigned_vendor_id,property_id,tenant_system_id
  ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION guard_property_maintenance_assignee();
REVOKE ALL ON FUNCTION guard_property_maintenance_assignee() FROM PUBLIC;

CREATE OR REPLACE FUNCTION guard_property_field_agent_maintenance_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE allowed_changes text[] := ARRAY[
  'status','resolution_note','completion_submitted_by','completion_submitted_at',
  'review_note','reviewed_by','reviewed_at','updated_at'
];
BEGIN
  IF app_role()='field_agent' AND (
    (to_jsonb(NEW)-allowed_changes) IS DISTINCT FROM (to_jsonb(OLD)-allowed_changes)
    OR NOT (
      (OLD.status IN ('assigned','accepted','rework_required') AND NEW.status='in_progress')
      OR (OLD.status='in_progress' AND NEW.status='awaiting_review')
    )
    OR (
      NEW.status='awaiting_review'
      AND (
        NEW.completion_submitted_by IS DISTINCT FROM app_user_id()
        OR NEW.completion_submitted_at IS NULL
        OR NEW.review_note IS NOT NULL
        OR NEW.reviewed_by IS NOT NULL
        OR NEW.reviewed_at IS NOT NULL
      )
    )
    OR (
      NEW.status='in_progress'
      AND (
        NEW.completion_submitted_by IS DISTINCT FROM OLD.completion_submitted_by
        OR NEW.completion_submitted_at IS DISTINCT FROM OLD.completion_submitted_at
        OR NEW.review_note IS DISTINCT FROM OLD.review_note
        OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
        OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      )
    )
  ) THEN
    RAISE EXCEPTION 'Field agents may only start assigned work or submit it for review'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER property_field_agent_maintenance_update_guard
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION guard_property_field_agent_maintenance_update();
REVOKE ALL ON FUNCTION guard_property_field_agent_maintenance_update() FROM PUBLIC;

CREATE OR REPLACE FUNCTION app_property_agent_task_context(target_request uuid)
RETURNS TABLE(property_address text,unit_no text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT property.address,unit.unit_no
  FROM maintenance_requests maintenance
  JOIN properties property ON property.id=maintenance.property_id
  LEFT JOIN property_units unit ON unit.id=maintenance.unit_id
  WHERE maintenance.id=target_request
    AND app_role()='field_agent'
    AND maintenance.assigned_to_user_id=app_user_id()
    AND maintenance.tenant_system_id=app_property_tenant_system_id()
    AND EXISTS (
      SELECT 1 FROM property_agent_scopes scope
      WHERE scope.tenant_system_id=maintenance.tenant_system_id
        AND scope.property_id=maintenance.property_id AND scope.user_id=app_user_id()
        AND scope.status='active' AND scope.effective_from<=current_date
        AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
    )
$$;
REVOKE ALL ON FUNCTION app_property_agent_task_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_property_agent_task_context(uuid) TO "{{role}}";

ALTER TABLE property_agent_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_agent_scope_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_agent_scope_events FORCE ROW LEVEL SECURITY;
CREATE POLICY property_agent_scopes_tenant_boundary ON property_agent_scopes AS RESTRICTIVE FOR ALL
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());
CREATE POLICY property_agent_scopes_member_read ON property_agent_scopes FOR SELECT
  USING (user_id=app_user_id() OR app_is_property_tenant_admin(tenant_system_id));
CREATE POLICY property_operating_tenant_members_admin_read ON property_operating_tenant_members FOR SELECT
  USING (app_is_property_tenant_admin(tenant_system_id));
CREATE POLICY property_agent_scope_events_tenant_boundary ON property_agent_scope_events AS RESTRICTIVE FOR ALL
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());
CREATE POLICY property_agent_scope_events_admin_read ON property_agent_scope_events FOR SELECT
  USING (app_is_property_tenant_admin(tenant_system_id));
CREATE POLICY property_agent_scope_events_function_insert ON property_agent_scope_events FOR INSERT
  WITH CHECK (actor_id=app_user_id() AND app_is_property_tenant_admin(tenant_system_id));

GRANT SELECT ON property_agent_scopes,property_agent_scope_events TO "{{role}}";
GRANT USAGE,SELECT ON SEQUENCE property_agent_scope_events_id_seq TO "{{role}}";
REVOKE ALL ON FUNCTION assign_property_agent_scope(uuid,uuid,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_property_agent_scope_status(uuid,uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assign_property_agent_scope(uuid,uuid,uuid,text,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION set_property_agent_scope_status(uuid,uuid,uuid,text,text) TO "{{role}}";

CREATE POLICY properties_field_agent_assigned_scope_read ON properties FOR SELECT
  USING (app_role()='field_agent' AND EXISTS (
    SELECT 1 FROM property_agent_scopes scope
    WHERE scope.tenant_system_id=properties.tenant_system_id
      AND scope.property_id=properties.id AND scope.user_id=app_user_id()
      AND scope.status='active' AND scope.effective_from<=current_date
      AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
  ));
CREATE POLICY property_units_field_agent_assigned_scope_read ON property_units FOR SELECT
  USING (app_role()='field_agent' AND EXISTS (
    SELECT 1 FROM property_agent_scopes scope
    WHERE scope.tenant_system_id=app_property_tenant_system_id()
      AND scope.property_id=property_units.property_id AND scope.user_id=app_user_id()
      AND scope.status='active' AND scope.effective_from<=current_date
      AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
  ));
CREATE POLICY maintenance_requests_scoped_field_agent_read ON maintenance_requests FOR SELECT
  USING (app_role()='field_agent' AND assigned_to_user_id=app_user_id()
    AND EXISTS (
      SELECT 1 FROM property_agent_scopes scope
      WHERE scope.tenant_system_id=maintenance_requests.tenant_system_id
        AND scope.property_id=maintenance_requests.property_id
        AND scope.user_id=app_user_id() AND scope.status='active'
        AND scope.effective_from<=current_date
        AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
    ));
CREATE POLICY maintenance_requests_scoped_field_agent_update ON maintenance_requests FOR UPDATE
  USING (app_role()='field_agent' AND assigned_to_user_id=app_user_id()
    AND EXISTS (
        SELECT 1 FROM property_agent_scopes scope
        WHERE scope.tenant_system_id=maintenance_requests.tenant_system_id
          AND scope.property_id=maintenance_requests.property_id
          AND scope.user_id=app_user_id() AND scope.status='active'
          AND scope.effective_from<=current_date
          AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
    ))
  WITH CHECK (app_role()='field_agent' AND assigned_to_user_id=app_user_id()
    AND EXISTS (
        SELECT 1 FROM property_agent_scopes scope
        WHERE scope.tenant_system_id=maintenance_requests.tenant_system_id
          AND scope.property_id=maintenance_requests.property_id
          AND scope.user_id=app_user_id() AND scope.status='active'
          AND scope.effective_from<=current_date
          AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
    ));
CREATE POLICY maintenance_request_events_scoped_field_agent_read ON maintenance_request_events FOR SELECT
  USING (app_role()='field_agent' AND EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to_user_id=app_user_id()
      AND EXISTS (
        SELECT 1 FROM property_agent_scopes scope
        WHERE scope.tenant_system_id=maintenance.tenant_system_id
          AND scope.property_id=maintenance.property_id AND scope.user_id=app_user_id()
          AND scope.status='active' AND scope.effective_from<=current_date
          AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
      )
  ));
CREATE POLICY maintenance_request_events_scoped_field_agent_insert ON maintenance_request_events FOR INSERT
  WITH CHECK (actor_id=app_user_id() AND app_role()='field_agent' AND EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to_user_id=app_user_id()
      AND maintenance.status IN ('assigned','in_progress','awaiting_review','rework_required')
      AND EXISTS (
        SELECT 1 FROM property_agent_scopes scope
        WHERE scope.tenant_system_id=maintenance.tenant_system_id
          AND scope.property_id=maintenance.property_id AND scope.user_id=app_user_id()
          AND scope.status='active' AND scope.effective_from<=current_date
          AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
      )
  ));
CREATE POLICY maintenance_evidence_scoped_field_agent_read ON maintenance_evidence FOR SELECT
  USING (scan_status='clean' AND app_role()='field_agent' AND EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to_user_id=app_user_id()
      AND EXISTS (
        SELECT 1 FROM property_agent_scopes scope
        WHERE scope.tenant_system_id=maintenance.tenant_system_id
          AND scope.property_id=maintenance.property_id AND scope.user_id=app_user_id()
          AND scope.status='active' AND scope.effective_from<=current_date
          AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
      )
  ));
CREATE POLICY maintenance_evidence_scoped_field_agent_insert ON maintenance_evidence FOR INSERT
  WITH CHECK (uploaded_by=app_user_id() AND scan_status='clean' AND app_role()='field_agent' AND EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to_user_id=app_user_id()
      AND maintenance.status IN ('assigned','in_progress','rework_required')
      AND EXISTS (
        SELECT 1 FROM property_agent_scopes scope
        WHERE scope.tenant_system_id=maintenance.tenant_system_id
          AND scope.property_id=maintenance.property_id AND scope.user_id=app_user_id()
          AND scope.status='active' AND scope.effective_from<=current_date
          AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
      )
  ));

DROP POLICY maintenance_requests_field_agent_assigned_only ON maintenance_requests;
CREATE POLICY maintenance_requests_field_agent_assigned_only ON maintenance_requests AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent' OR (
    assigned_to_user_id=app_user_id()
    AND EXISTS (
      SELECT 1 FROM property_agent_scopes scope
      WHERE scope.tenant_system_id=maintenance_requests.tenant_system_id
        AND scope.property_id=maintenance_requests.property_id
        AND scope.user_id=app_user_id() AND scope.status='active'
        AND scope.effective_from<=current_date
        AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
    )
  ))
  WITH CHECK (app_role()<>'field_agent' OR (
    assigned_to_user_id=app_user_id()
    AND EXISTS (
      SELECT 1 FROM property_agent_scopes scope
      WHERE scope.tenant_system_id=maintenance_requests.tenant_system_id
        AND scope.property_id=maintenance_requests.property_id
        AND scope.user_id=app_user_id() AND scope.status='active'
        AND scope.effective_from<=current_date
        AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
    )
  ));

DROP POLICY maintenance_request_events_field_agent_minimum_access ON maintenance_request_events;
CREATE POLICY maintenance_request_events_field_agent_minimum_access ON maintenance_request_events AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent' OR EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    JOIN property_agent_scopes scope
      ON scope.tenant_system_id=maintenance.tenant_system_id
     AND scope.property_id=maintenance.property_id AND scope.user_id=app_user_id()
     AND scope.status='active' AND scope.effective_from<=current_date
     AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to_user_id=app_user_id()
  ))
  WITH CHECK (app_role()<>'field_agent' OR EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    JOIN property_agent_scopes scope
      ON scope.tenant_system_id=maintenance.tenant_system_id
     AND scope.property_id=maintenance.property_id AND scope.user_id=app_user_id()
     AND scope.status='active' AND scope.effective_from<=current_date
     AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to_user_id=app_user_id()
  ));
DROP POLICY maintenance_evidence_field_agent_minimum_access ON maintenance_evidence;
CREATE POLICY maintenance_evidence_field_agent_minimum_access ON maintenance_evidence AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent' OR EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    JOIN property_agent_scopes scope
      ON scope.tenant_system_id=maintenance.tenant_system_id
     AND scope.property_id=maintenance.property_id AND scope.user_id=app_user_id()
     AND scope.status='active' AND scope.effective_from<=current_date
     AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to_user_id=app_user_id()
  ))
  WITH CHECK (app_role()<>'field_agent' OR EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    JOIN property_agent_scopes scope
      ON scope.tenant_system_id=maintenance.tenant_system_id
     AND scope.property_id=maintenance.property_id AND scope.user_id=app_user_id()
     AND scope.status='active' AND scope.effective_from<=current_date
     AND (scope.effective_to IS NULL OR scope.effective_to>=current_date)
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to_user_id=app_user_id()
  ));
DO $$
BEGIN
  RAISE NOTICE 'MIGRATION_STAGE: agent-scope policies created';
END
$$;
