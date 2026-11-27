CREATE OR REPLACE FUNCTION app_platform_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.platform_tenant_id',true),'')::uuid
$$;

CREATE OR REPLACE FUNCTION app_is_platform_tenant_scoped() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role()='super_admin' AND app_platform_tenant_id() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('super_admin','compliance','finance','finance_manager')
    AND NOT app_is_platform_tenant_scoped()
$$;

CREATE OR REPLACE FUNCTION app_can_access_agent(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
SET row_security=off AS $$
  SELECT CASE
    WHEN app_is_platform_tenant_scoped() THEN EXISTS (
      SELECT 1 FROM platform_tenant_users member
      WHERE member.tenant_id=app_platform_tenant_id()
        AND member.user_id=target AND member.status='active'
      UNION
      SELECT 1 FROM platform_business_tenants entity
      WHERE entity.platform_tenant_id=app_platform_tenant_id()
        AND entity.owner_user_id=target
      UNION
      SELECT 1 FROM platform_business_tenant_members member
      JOIN platform_business_tenants entity ON entity.id=member.tenant_id
      WHERE entity.platform_tenant_id=app_platform_tenant_id()
        AND member.user_id=target AND member.status='active'
    )
    ELSE target=app_user_id()
      OR app_is_staff()
      OR EXISTS (SELECT 1 FROM agents a WHERE a.id=target AND a.parent_id=app_user_id())
  END
$$;

CREATE OR REPLACE FUNCTION app_platform_tenant_has_user(target_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
SET row_security=off AS $$
  SELECT app_is_platform_tenant_scoped() AND (
    EXISTS (
      SELECT 1 FROM platform_tenant_users member
      WHERE member.tenant_id=app_platform_tenant_id()
        AND member.user_id=target_user AND member.status='active'
    )
    OR EXISTS (
      SELECT 1 FROM platform_business_tenant_members member
      JOIN platform_business_tenants entity ON entity.id=member.tenant_id
      WHERE entity.platform_tenant_id=app_platform_tenant_id()
        AND member.user_id=target_user AND member.status='active'
    )
    OR EXISTS (
      SELECT 1 FROM platform_business_tenants entity
      WHERE entity.platform_tenant_id=app_platform_tenant_id()
        AND entity.owner_user_id=target_user
    )
  )
$$;

CREATE OR REPLACE FUNCTION app_can_access_platform_property_tenant(target_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
SET row_security=off AS $$
  SELECT app_is_platform_tenant_scoped() AND EXISTS (
    SELECT 1
    FROM property_operating_tenant_members property_member
    JOIN platform_tenant_users deployment_member
      ON deployment_member.user_id=property_member.user_id
     AND deployment_member.tenant_id=app_platform_tenant_id()
     AND deployment_member.status='active'
    WHERE property_member.tenant_system_id=target_tenant
      AND property_member.status='active'
  )
$$;

CREATE OR REPLACE FUNCTION app_property_tenant_system_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
SET row_security=off AS $$
  SELECT tenant.id
  FROM property_operating_tenants tenant
  WHERE tenant.id=nullif(current_setting('app.property_tenant_system_id',true),'')::uuid
    AND tenant.status='active'
    AND CASE
      WHEN app_is_platform_tenant_scoped() THEN app_can_access_platform_property_tenant(tenant.id)
      ELSE EXISTS (
        SELECT 1 FROM property_operating_tenant_members member
        WHERE member.tenant_system_id=tenant.id AND member.user_id=app_user_id()
          AND member.status='active'
      )
      OR EXISTS (
        SELECT 1 FROM property_operating_tenant_support_grants grant_row
        WHERE grant_row.tenant_system_id=tenant.id AND grant_row.user_id=app_user_id()
          AND grant_row.status='active' AND grant_row.expires_at>now()
          AND grant_row.purpose=current_setting('app.property_tenant_purpose',true)
          AND app_role()='global_admin'
      )
    END
$$;

REVOKE ALL ON FUNCTION app_platform_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_is_platform_tenant_scoped() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_platform_tenant_has_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_can_access_platform_property_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_platform_tenant_id(),app_is_platform_tenant_scoped() TO "{{role}}";
GRANT EXECUTE ON FUNCTION app_platform_tenant_has_user(uuid),app_can_access_platform_property_tenant(uuid) TO "{{role}}";

CREATE POLICY agents_platform_tenant_scope ON agents AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR app_can_access_agent(id))
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR app_can_access_agent(id));

DO $$
DECLARE
  scoped_table record;
  scope_expressions text[];
  expression text;
BEGIN
  FOR scoped_table IN
    SELECT c.relname,
           array_agg(DISTINCT a.attname ORDER BY a.attname) AS scope_columns
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
      AND a.attnum>0 AND NOT a.attisdropped
      AND a.attname IN ('source_agent_id','agent_id','tenant_system_id','platform_tenant_id')
      AND c.relname NOT IN ('agents','property_operating_tenants')
    GROUP BY c.relname
  LOOP
    scope_expressions := ARRAY[]::text[];
    FOREACH expression IN ARRAY scoped_table.scope_columns
    LOOP
      IF expression IN ('source_agent_id','agent_id') THEN
        scope_expressions := array_append(scope_expressions,format('app_can_access_agent(%I)',expression));
      ELSIF expression='tenant_system_id' THEN
        scope_expressions := array_append(scope_expressions,'app_can_access_platform_property_tenant(tenant_system_id)');
      ELSIF expression='platform_tenant_id' THEN
        scope_expressions := array_append(scope_expressions,'platform_tenant_id=app_platform_tenant_id()');
      END IF;
    END LOOP;
    EXECUTE format(
      'CREATE POLICY platform_tenant_scope ON %I AS RESTRICTIVE FOR ALL USING (NOT app_is_platform_tenant_scoped() OR (%s)) WITH CHECK (NOT app_is_platform_tenant_scoped() OR (%s))',
      scoped_table.relname,array_to_string(scope_expressions,' AND '),array_to_string(scope_expressions,' AND ')
    );
  END LOOP;
END
$$;

CREATE POLICY property_operating_tenants_platform_scope ON property_operating_tenants AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR app_can_access_platform_property_tenant(id))
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR app_can_access_platform_property_tenant(id));

CREATE POLICY users_platform_tenant_scope ON users AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR app_can_access_agent(id))
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR app_can_access_agent(id));

CREATE POLICY platform_tenant_users_platform_scope ON platform_tenant_users AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR tenant_id=app_platform_tenant_id())
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR tenant_id=app_platform_tenant_id());

CREATE POLICY platform_tenant_admins_platform_scope ON platform_tenant_admins AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR tenant_id=app_platform_tenant_id())
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR tenant_id=app_platform_tenant_id());

CREATE POLICY platform_tenant_events_platform_scope ON platform_tenant_events AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR tenant_id=app_platform_tenant_id())
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR tenant_id=app_platform_tenant_id());

CREATE POLICY platform_business_tenant_members_platform_scope ON platform_business_tenant_members AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM platform_business_tenants entity
    WHERE entity.id=platform_business_tenant_members.tenant_id
      AND entity.platform_tenant_id=app_platform_tenant_id()
  ))
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM platform_business_tenants entity
    WHERE entity.id=platform_business_tenant_members.tenant_id
      AND entity.platform_tenant_id=app_platform_tenant_id()
  ));

CREATE POLICY platform_business_tenant_events_platform_scope ON platform_business_tenant_events AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM platform_business_tenants entity
    WHERE entity.id=platform_business_tenant_events.tenant_id
      AND entity.platform_tenant_id=app_platform_tenant_id()
  ))
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM platform_business_tenants entity
    WHERE entity.id=platform_business_tenant_events.tenant_id
      AND entity.platform_tenant_id=app_platform_tenant_id()
  ));

CREATE POLICY marketplace_listings_platform_tenant_scope ON marketplace_listings AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR app_platform_tenant_has_user(seller_user_id))
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR app_platform_tenant_has_user(seller_user_id));

CREATE POLICY marketplace_media_platform_tenant_scope ON marketplace_media AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM marketplace_listings listing
    WHERE listing.id=marketplace_media.listing_id
      AND app_platform_tenant_has_user(listing.seller_user_id)
  ))
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM marketplace_listings listing
    WHERE listing.id=marketplace_media.listing_id
      AND app_platform_tenant_has_user(listing.seller_user_id)
  ));

CREATE POLICY marketplace_service_requests_platform_tenant_scope ON marketplace_service_requests AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped()
    OR app_platform_tenant_has_user(buyer_user_id)
    OR app_platform_tenant_has_user(seller_user_id))
  WITH CHECK (NOT app_is_platform_tenant_scoped()
    OR app_platform_tenant_has_user(buyer_user_id)
    OR app_platform_tenant_has_user(seller_user_id));

CREATE POLICY documents_platform_tenant_scope ON documents AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM workers w
    WHERE w.id=documents.worker_id AND app_can_access_agent(w.source_agent_id)
  ))
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM workers w
    WHERE w.id=documents.worker_id AND app_can_access_agent(w.source_agent_id)
  ));

CREATE POLICY matches_platform_tenant_scope ON matches AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM job_requests r
    WHERE r.id=matches.request_id AND app_can_access_agent(r.source_agent_id)
  ))
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM job_requests r
    WHERE r.id=matches.request_id AND app_can_access_agent(r.source_agent_id)
  ));

CREATE POLICY property_units_platform_tenant_scope ON property_units AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id=property_units.property_id AND app_can_access_agent(p.source_agent_id)
  ))
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id=property_units.property_id AND app_can_access_agent(p.source_agent_id)
  ));

CREATE POLICY rent_charges_platform_tenant_scope ON rent_charges AS RESTRICTIVE FOR ALL
  USING (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM leases l
    WHERE l.id=rent_charges.lease_id AND app_can_access_agent(l.source_agent_id)
  ))
  WITH CHECK (NOT app_is_platform_tenant_scoped() OR EXISTS (
    SELECT 1 FROM leases l
    WHERE l.id=rent_charges.lease_id AND app_can_access_agent(l.source_agent_id)
  ));
