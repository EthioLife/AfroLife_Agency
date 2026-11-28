CREATE POLICY users_unscoped_super_admin_agent_insert ON users FOR INSERT
  WITH CHECK (
    id=app_user_creation_id()
    AND app_role()='super_admin'
    AND app_platform_tenant_id() IS NULL
    AND created_by=app_user_id()
    AND role IN ('master_agent','field_agent')
    AND active=false
  );
