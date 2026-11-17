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
  IF actor IS NULL OR target_tenant IS NULL OR target_user IS NULL OR target_role IS NULL
    OR (
      app_role() IS DISTINCT FROM 'global_admin'
      AND (
        target_role='tenant_admin'
        OR app_property_tenant_system_id() IS DISTINCT FROM target_tenant
        OR app_has_permission('property.tenancy.manage') IS NOT TRUE
        OR NOT EXISTS (
          SELECT 1 FROM property_operating_tenant_members member
          WHERE member.tenant_system_id=target_tenant AND member.user_id=actor
            AND member.tenant_role='tenant_admin' AND member.status='active'
        )
      )
    ) THEN
    RAISE EXCEPTION 'Tenant administrator membership may only be assigned by a Global Admin; other membership requires tenant administrator authority'
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

CREATE OR REPLACE FUNCTION set_property_operating_tenant_member_status(
  target_tenant uuid,
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
  IF actor IS NULL OR target_tenant IS NULL OR target_user IS NULL
    OR actor=target_user OR next_status IS NULL OR next_status NOT IN ('active','suspended','ended')
    OR change_reason IS NULL OR length(trim(change_reason)) NOT BETWEEN 10 AND 1000
    OR (
      app_role() IS DISTINCT FROM 'global_admin'
      AND (
        app_property_tenant_system_id() IS DISTINCT FROM target_tenant
        OR app_has_permission('property.tenancy.manage') IS NOT TRUE
        OR app_is_property_tenant_admin(target_tenant) IS NOT TRUE
      )
    ) THEN
    RAISE EXCEPTION 'Tenant membership changes require an administrator, a different target user, and a documented reason'
      USING ERRCODE='42501';
  END IF;
  SELECT status INTO previous_status FROM property_operating_tenant_members
  WHERE tenant_system_id=target_tenant AND user_id=target_user FOR UPDATE;
  IF previous_status IS NULL OR previous_status=next_status THEN
    RAISE EXCEPTION 'Tenant member does not exist or is already in the requested status'
      USING ERRCODE='23514';
  END IF;
  UPDATE property_operating_tenant_members
  SET status=next_status,assigned_by=actor,assigned_at=now()
  WHERE tenant_system_id=target_tenant AND user_id=target_user;
  INSERT INTO property_operating_tenant_events(tenant_system_id,actor_id,event_type,event_data)
  VALUES(target_tenant,actor,
    CASE next_status
      WHEN 'ended' THEN 'member_ended'
      WHEN 'active' THEN 'member_reactivated'
      ELSE 'member_suspended'
    END,
    jsonb_build_object('user_id',target_user,'from_status',previous_status,
      'to_status',next_status,'reason',trim(change_reason)));
END;
$$;

CREATE OR REPLACE FUNCTION decide_property_tenant_support_grant(
  target_grant uuid,
  approve boolean,
  decision_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE grant_row property_operating_tenant_support_grants%ROWTYPE;
BEGIN
  IF target_grant IS NULL OR approve IS NULL
    OR decision_reason IS NULL OR length(trim(decision_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Support grant approval requires a valid decision and documented reason'
      USING ERRCODE='23514';
  END IF;
  SELECT * INTO grant_row FROM property_operating_tenant_support_grants
  WHERE id=target_grant FOR UPDATE;
  IF app_role() IS DISTINCT FROM 'global_admin' OR actor IS NULL OR grant_row.id IS NULL
    OR grant_row.status<>'pending' OR grant_row.requested_by=actor
    OR grant_row.expires_at<=now() THEN
    RAISE EXCEPTION 'Support grant approval requires a different Global Admin and a valid pending request'
      USING ERRCODE='42501';
  END IF;
  UPDATE property_operating_tenant_support_grants
  SET status=CASE WHEN approve THEN 'active' ELSE 'rejected' END,
      approved_by=actor,approved_at=CASE WHEN approve THEN now() ELSE NULL END
  WHERE id=target_grant;
  INSERT INTO property_operating_tenant_events(tenant_system_id,actor_id,event_type,event_data)
  VALUES(grant_row.tenant_system_id,actor,
    CASE WHEN approve THEN 'support_grant_approved' ELSE 'support_grant_rejected' END,
    jsonb_build_object('grant_id',target_grant,'reason',trim(decision_reason)));
END;
$$;

CREATE OR REPLACE FUNCTION revoke_property_tenant_support_grant(
  target_grant uuid,
  revocation_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE grant_row property_operating_tenant_support_grants%ROWTYPE;
BEGIN
  IF target_grant IS NULL OR revocation_reason IS NULL
    OR length(trim(revocation_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Revoking support access requires a documented reason'
      USING ERRCODE='23514';
  END IF;
  SELECT * INTO grant_row FROM property_operating_tenant_support_grants
  WHERE id=target_grant FOR UPDATE;
  IF app_role() IS DISTINCT FROM 'global_admin' OR actor IS NULL OR grant_row.id IS NULL
    OR grant_row.status<>'active' THEN
    RAISE EXCEPTION 'Revoking support access requires a Global Admin and active grant'
      USING ERRCODE='42501';
  END IF;
  UPDATE property_operating_tenant_support_grants SET status='revoked'
  WHERE id=target_grant;
  INSERT INTO property_operating_tenant_events(tenant_system_id,actor_id,event_type,event_data)
  VALUES(grant_row.tenant_system_id,actor,'support_grant_revoked',
    jsonb_build_object('grant_id',target_grant,'reason',trim(revocation_reason)));
END;
$$;

REVOKE ALL ON FUNCTION assign_property_operating_tenant_member(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_property_operating_tenant_member_status(uuid,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION decide_property_tenant_support_grant(uuid,boolean,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION revoke_property_tenant_support_grant(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assign_property_operating_tenant_member(uuid,uuid,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION set_property_operating_tenant_member_status(uuid,uuid,text,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION decide_property_tenant_support_grant(uuid,boolean,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION revoke_property_tenant_support_grant(uuid,text) TO "{{role}}";
