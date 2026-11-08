CREATE OR REPLACE FUNCTION app_property_agent_can_manage(
  target_tenant uuid,
  target_property uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT app_property_tenant_system_id()=target_tenant
    AND (
      app_is_property_tenant_admin(target_tenant)
      OR (
        app_role()='master_agent'
        AND EXISTS (
          SELECT 1 FROM property_agent_scopes manager_scope
          WHERE manager_scope.tenant_system_id=target_tenant
            AND manager_scope.property_id=target_property
            AND manager_scope.user_id=app_user_id()
            AND manager_scope.tenant_role='master_agent'
            AND manager_scope.status='active'
            AND manager_scope.effective_from<=current_date
            AND (manager_scope.effective_to IS NULL OR manager_scope.effective_to>=current_date)
        )
      )
    )
$$;
REVOKE ALL ON FUNCTION app_property_agent_can_manage(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_property_agent_can_manage(uuid,uuid) TO "{{role}}";

CREATE OR REPLACE FUNCTION list_property_agent_candidates(
  target_tenant uuid,
  target_property uuid DEFAULT NULL
)
RETURNS TABLE(user_id uuid,legal_name text,tenant_role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
BEGIN
  IF app_property_tenant_system_id() IS DISTINCT FROM target_tenant
    OR (NOT app_is_property_tenant_admin(target_tenant)
      AND (target_property IS NULL OR NOT app_property_agent_can_manage(target_tenant,target_property))) THEN
    RAISE EXCEPTION 'Agent candidates are available only to tenant administrators or a master agent assigned to the property'
      USING ERRCODE='42501';
  END IF;
  IF target_property IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=target_property AND property.tenant_system_id=target_tenant
  ) THEN
    RAISE EXCEPTION 'Property is not part of the selected tenant'
      USING ERRCODE='23514';
  END IF;
  RETURN QUERY
    SELECT member.user_id,user_row.legal_name,member.tenant_role
    FROM property_operating_tenant_members member
    JOIN users user_row ON user_row.id=member.user_id
    WHERE member.tenant_system_id=target_tenant AND member.status='active'
      AND user_row.active=true
      AND member.tenant_role IN ('master_agent','field_agent')
      AND app_property_tenant_role_matches(member.tenant_role,user_row.role)
      AND (
        app_is_property_tenant_admin(target_tenant)
        OR (
          member.tenant_role='field_agent'
          AND app_property_agent_can_manage(target_tenant,target_property)
        )
      )
    ORDER BY user_row.legal_name,member.user_id;
END;
$$;
REVOKE ALL ON FUNCTION list_property_agent_candidates(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_property_agent_candidates(uuid,uuid) TO "{{role}}";

CREATE POLICY properties_master_agent_scope_read ON properties FOR SELECT
  USING (
    app_role()='master_agent'
    AND app_property_agent_can_manage(tenant_system_id,id)
  );
CREATE POLICY property_units_master_agent_scope_read ON property_units FOR SELECT
  USING (
    app_role()='master_agent'
    AND EXISTS (
      SELECT 1 FROM properties property
      WHERE property.id=property_units.property_id
        AND app_property_agent_can_manage(property.tenant_system_id,property.id)
    )
  );

DROP POLICY property_agent_scopes_member_read ON property_agent_scopes;
CREATE POLICY property_agent_scopes_member_read ON property_agent_scopes FOR SELECT
  USING (
    user_id=app_user_id()
    OR app_property_agent_can_manage(tenant_system_id,property_id)
  );
DROP POLICY property_agent_scope_events_admin_read ON property_agent_scope_events;
CREATE POLICY property_agent_scope_events_admin_read ON property_agent_scope_events FOR SELECT
  USING (app_property_agent_can_manage(tenant_system_id,property_id));
DROP POLICY property_agent_scope_events_function_insert ON property_agent_scope_events;
CREATE POLICY property_agent_scope_events_function_insert ON property_agent_scope_events FOR INSERT
  WITH CHECK (
    actor_id=app_user_id()
    AND app_property_agent_can_manage(tenant_system_id,property_id)
  );

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
    OR NOT app_property_agent_can_manage(target_tenant,target_property)
    OR target_user=actor
    OR target_role NOT IN ('master_agent','field_agent')
    OR length(trim(assignment_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Property agent assignments require tenant administrator or scoped master-agent authority, a different active member, and a documented reason'
      USING ERRCODE='42501';
  END IF;
  IF NOT app_is_property_tenant_admin(target_tenant)
    AND (app_role()<>'master_agent' OR target_role<>'field_agent') THEN
    RAISE EXCEPTION 'Master agents may assign only field agents to properties in their active scope'
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
    OR NOT app_property_agent_can_manage(target_tenant,target_property)
    OR next_status NOT IN ('suspended','ended')
    OR length(trim(change_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Property agent scope changes require tenant administrator or scoped master-agent authority and a documented reason'
      USING ERRCODE='42501';
  END IF;
  IF NOT app_is_property_tenant_admin(target_tenant) AND (
    app_role()<>'master_agent'
    OR NOT EXISTS (
      SELECT 1 FROM property_agent_scopes target_scope
      WHERE target_scope.tenant_system_id=target_tenant
        AND target_scope.property_id=target_property AND target_scope.user_id=target_user
        AND target_scope.tenant_role='field_agent'
    )
  ) THEN
    RAISE EXCEPTION 'Master agents may change only field-agent scopes in their active property assignment'
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
