ALTER POLICY users_platform_tenant_scope ON users
  USING (
    NOT app_is_platform_tenant_scoped()
    OR app_can_access_agent(id)
    OR id=app_user_id()
    OR id=app_user_creation_id()
    OR (app_role()='super_admin' AND role='super_admin')
    OR (
      app_role()='super_admin'
      AND app_platform_tenant_id() IS NOT NULL
      AND app_user_phone_lookup(phone)
    )
  );
