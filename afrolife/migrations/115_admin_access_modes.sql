ALTER TABLE auth_sessions
  ADD COLUMN active_role text;

CREATE TABLE user_admin_role_grants (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_name text NOT NULL CHECK (role_name IN ('global_admin','super_admin')),
  module_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  all_tenants boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_name),
  CHECK (NOT all_tenants OR role_name='super_admin'),
  CHECK (module_keys <@ ARRAY[
    'leads','workers','requests','learning','properties','marketplace','contracts',
    'commissions','agents','rent','mfi','accounting','edir','insurance','privacy','global-bi'
  ]::text[])
);

ALTER TABLE user_admin_role_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_admin_role_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY user_admin_role_grants_read ON user_admin_role_grants FOR SELECT
  USING (user_id=app_user_id() OR current_setting('app.role',true)='global_admin');
CREATE POLICY user_admin_role_grants_global_admin_write ON user_admin_role_grants FOR ALL
  USING (current_setting('app.role',true)='global_admin')
  WITH CHECK (current_setting('app.role',true)='global_admin');
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE user_admin_role_grants TO "{{role}}";

ALTER TABLE platform_tenant_admins
  ADD COLUMN role_grant_managed boolean NOT NULL DEFAULT false;

WITH seeded_grant AS (
  INSERT INTO user_admin_role_grants(user_id,role_name,module_keys,all_tenants)
  SELECT id,'super_admin',ARRAY[
    'leads','workers','requests','learning','properties','marketplace','contracts',
    'commissions','agents','rent','mfi','accounting','edir','insurance','privacy','global-bi'
  ]::text[],true
  FROM users
  WHERE id='7bbe3bee-ca90-490c-818e-0b6bcc75c02a' AND role='global_admin'
  ON CONFLICT (user_id,role_name) DO NOTHING
  RETURNING user_id
)
INSERT INTO audit_logs(actor_id,action,entity,entity_id,old_value,new_value)
SELECT user_id,'administrator_access_granted','user_admin_role_grant',user_id::text,NULL,
  jsonb_build_object(
    'role_name','super_admin',
    'module_keys',ARRAY[
      'leads','workers','requests','learning','properties','marketplace','contracts',
      'commissions','agents','rent','mfi','accounting','edir','insurance','privacy','global-bi'
    ],
    'all_tenants',true,
    'source','administrator access bootstrap'
  )
FROM seeded_grant;

INSERT INTO platform_tenant_admins(tenant_id,user_id,assigned_by,role_grant_managed)
SELECT t.id,g.user_id,g.user_id,true
FROM platform_tenants t
JOIN user_admin_role_grants g ON g.role_name='super_admin' AND g.all_tenants
ON CONFLICT (tenant_id,user_id) DO NOTHING;
