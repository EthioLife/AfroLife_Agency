CREATE OR REPLACE FUNCTION app_user_creation_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_creation_id',true),'')::uuid
$$;

CREATE OR REPLACE FUNCTION app_user_phone_lookup(target_phone text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    has_column_privilege(current_user,'public.users','password_hash','SELECT')
    AND target_phone = ANY(ARRAY(
      SELECT jsonb_array_elements_text(
        COALESCE(NULLIF(current_setting('app.user_lookup_phones',true),''),'[]')::jsonb
      )
    )),
    false
  )
$$;

REVOKE ALL ON FUNCTION app_user_creation_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_user_phone_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_user_creation_id(),app_user_phone_lookup(text) TO "{{role}}";

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY users_platform_tenant_scope ON users;
CREATE POLICY users_platform_tenant_scope ON users AS RESTRICTIVE FOR ALL
  USING (
    NOT app_is_platform_tenant_scoped()
    OR app_can_access_agent(id)
    OR id=app_user_id()
    OR id=app_user_creation_id()
  )
  WITH CHECK (
    NOT app_is_platform_tenant_scoped()
    OR app_can_access_agent(id)
    OR id=app_user_id()
    OR id=app_user_creation_id()
  );

CREATE POLICY users_application_read ON users FOR SELECT
  USING (
    id=app_user_id()
    OR id=app_user_creation_id()
    OR app_user_phone_lookup(phone)
    OR app_role() IN ('global_admin','compliance','finance','finance_manager')
    OR (app_role()='super_admin' AND app_platform_tenant_id() IS NULL AND created_by=app_user_id())
    OR (app_role()='corporate_business_manager' AND created_by=app_user_id())
    OR (app_role() IN ('super_admin','corporate_business_manager','master_agent')
      AND app_can_access_agent(id))
  );

CREATE POLICY users_application_insert ON users FOR INSERT
  WITH CHECK (
    id=app_user_creation_id()
    AND (
      (
        current_setting('app.service',true)='public_signup'
        AND created_by IS NULL
        AND active=false
        AND role IN ('master_agent','field_agent','customer','worker','property_owner')
      )
      OR (
        created_by=app_user_id()
        AND (
          app_role()='global_admin'
          OR (
            app_role()='super_admin'
            AND app_is_platform_tenant_scoped()
            AND role IN (
              'corporate_business_manager','master_agent','field_agent',
              'customer','worker','property_owner','property_vendor'
            )
            AND EXISTS (
              SELECT 1 FROM platform_tenant_admins assignment
              JOIN platform_tenants tenant ON tenant.id=assignment.tenant_id
              WHERE assignment.user_id=app_user_id()
                AND assignment.tenant_id=app_platform_tenant_id()
                AND tenant.status='active'
            )
          )
          OR (app_role()='corporate_business_manager' AND role IN ('master_agent','field_agent'))
          OR (app_role()='master_agent' AND role='field_agent')
        )
      )
    )
  );

CREATE POLICY users_application_update ON users FOR UPDATE
  USING (
    id=app_user_id()
    OR app_role() IN ('global_admin','compliance')
    OR (
      app_role()='super_admin'
      AND app_is_platform_tenant_scoped()
      AND app_can_access_agent(id)
    )
  )
  WITH CHECK (
    id=app_user_id()
    OR app_role() IN ('global_admin','compliance')
    OR (
      app_role()='super_admin'
      AND app_is_platform_tenant_scoped()
      AND app_can_access_agent(id)
    )
  );
