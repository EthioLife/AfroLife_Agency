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
    SELECT 1 FROM users WHERE id=initial_admin AND active=true AND role<>'global_admin'
  ) THEN
    RAISE EXCEPTION 'The initial tenant administrator must be an active, non-Global-Admin user other than the provisioning administrator'
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
    SELECT 1 FROM users WHERE id=target_user AND active=true AND role<>'global_admin'
  ) THEN
    RAISE EXCEPTION 'Tenant members must be active non-Global-Admin users; Global Admin access requires an approved support grant'
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

REVOKE ALL ON FUNCTION provision_property_operating_tenant(text,text,uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION assign_property_operating_tenant_member(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_property_operating_tenant(text,text,uuid,text,text,text) TO "{{role}}";
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
          WHERE member.tenant_system_id=tenant.id AND member.user_id=app_user_id()
            AND member.status='active'
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
