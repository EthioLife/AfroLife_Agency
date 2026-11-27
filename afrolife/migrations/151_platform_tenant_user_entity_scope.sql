ALTER TABLE platform_business_tenants
  ADD COLUMN platform_tenant_id uuid REFERENCES platform_tenants(id);

CREATE INDEX platform_business_tenants_platform_tenant_idx
  ON platform_business_tenants(platform_tenant_id,tenant_type,status);

CREATE TABLE platform_tenant_users (
  tenant_id uuid NOT NULL REFERENCES platform_tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  assigned_by uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,user_id)
);
CREATE INDEX platform_tenant_users_user_idx ON platform_tenant_users(user_id,tenant_id);

CREATE FUNCTION guard_platform_tenant_user_assignment() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_role text;
  tenant_status text;
BEGIN
  IF current_setting('app.role',true)='super_admin' AND NEW.status='active' THEN
    SELECT role INTO target_role FROM users WHERE id=NEW.user_id;
    IF target_role IS NULL OR target_role NOT IN (
      'corporate_business_manager','master_agent','field_agent','customer','worker','property_owner','property_vendor'
    ) THEN
      RAISE EXCEPTION 'Only tenant business and agent roles may be assigned';
    END IF;
    SELECT status INTO tenant_status FROM platform_tenants WHERE id=NEW.tenant_id;
    IF tenant_status IS DISTINCT FROM 'active' OR NOT EXISTS (
      SELECT 1 FROM platform_tenant_admins a
      WHERE a.tenant_id=NEW.tenant_id AND a.user_id=app_user_id()
    ) THEN
      RAISE EXCEPTION 'Only active assigned tenants may receive user assignments';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER platform_tenant_users_assignment_guard
  BEFORE INSERT OR UPDATE ON platform_tenant_users
  FOR EACH ROW EXECUTE FUNCTION guard_platform_tenant_user_assignment();
REVOKE ALL ON FUNCTION guard_platform_tenant_user_assignment() FROM PUBLIC;

CREATE POLICY users_assigned_platform_tenant_read ON users FOR SELECT
  USING (
    current_setting('app.role',true)='super_admin'
    AND EXISTS (
      SELECT 1 FROM platform_tenant_users member
      JOIN platform_tenant_admins assigned ON assigned.tenant_id=member.tenant_id
      WHERE member.user_id=users.id AND member.status='active' AND assigned.user_id=app_user_id()
    )
  );

ALTER TABLE platform_tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_tenant_users FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_tenant_users_scoped_read ON platform_tenant_users FOR SELECT
  USING (
    current_setting('app.role',true)='global_admin'
    OR user_id=app_user_id()
    OR (current_setting('app.role',true)='super_admin' AND EXISTS (
      SELECT 1 FROM platform_tenant_admins a
      WHERE a.tenant_id=platform_tenant_users.tenant_id AND a.user_id=app_user_id()
    ))
  );
CREATE POLICY platform_tenant_users_scoped_insert ON platform_tenant_users FOR INSERT
  WITH CHECK (
    current_setting('app.role',true)='global_admin'
    OR (current_setting('app.role',true)='super_admin' AND EXISTS (
      SELECT 1 FROM platform_tenant_admins a
      JOIN platform_tenants t ON t.id=a.tenant_id AND t.status='active'
      WHERE a.tenant_id=platform_tenant_users.tenant_id AND a.user_id=app_user_id()
    ))
  );
CREATE POLICY platform_tenant_users_scoped_update ON platform_tenant_users FOR UPDATE
  USING (
    current_setting('app.role',true)='global_admin'
    OR (current_setting('app.role',true)='super_admin' AND EXISTS (
      SELECT 1 FROM platform_tenant_admins a
      WHERE a.tenant_id=platform_tenant_users.tenant_id AND a.user_id=app_user_id()
    ))
  )
  WITH CHECK (
    current_setting('app.role',true)='global_admin'
    OR (current_setting('app.role',true)='super_admin' AND EXISTS (
      SELECT 1 FROM platform_tenant_admins a
      WHERE a.tenant_id=platform_tenant_users.tenant_id AND a.user_id=app_user_id()
    ))
  );
GRANT SELECT,INSERT,UPDATE ON TABLE platform_tenant_users TO "{{role}}";

ALTER TABLE property_vendors
  ADD COLUMN platform_tenant_id uuid REFERENCES platform_tenants(id);
CREATE INDEX property_vendors_platform_tenant_idx
  ON property_vendors(platform_tenant_id,active);
DROP POLICY property_vendors_staff ON property_vendors;
CREATE POLICY property_vendors_staff ON property_vendors FOR ALL
  USING (
    app_role() IN ('finance','finance_manager','global_admin')
    OR (app_role()='super_admin' AND EXISTS (
      SELECT 1 FROM platform_tenant_admins a
      WHERE a.tenant_id=property_vendors.platform_tenant_id AND a.user_id=app_user_id()
    ))
  )
  WITH CHECK (
    app_role() IN ('finance','finance_manager','global_admin')
    OR (app_role()='super_admin' AND EXISTS (
      SELECT 1 FROM platform_tenant_admins a
      WHERE a.tenant_id=property_vendors.platform_tenant_id AND a.user_id=app_user_id()
    ))
  );
GRANT SELECT,INSERT,UPDATE ON TABLE property_vendors TO "{{role}}";

CREATE POLICY platform_business_tenants_assigned_read ON platform_business_tenants FOR SELECT
  USING (
    current_setting('app.role',true)='super_admin'
    AND (
      platform_business_tenants.owner_user_id=app_user_id()
      OR
      EXISTS (
        SELECT 1 FROM platform_tenant_admins a
        WHERE a.tenant_id=platform_business_tenants.platform_tenant_id AND a.user_id=app_user_id()
      )
      OR EXISTS (
        SELECT 1 FROM platform_tenant_users member
        JOIN platform_tenant_admins a ON a.tenant_id=member.tenant_id
        WHERE member.user_id=platform_business_tenants.owner_user_id
          AND member.status='active' AND a.user_id=app_user_id()
      )
    )
  );
CREATE POLICY platform_business_tenants_assigned_update ON platform_business_tenants FOR UPDATE
  USING (
    current_setting('app.role',true)='super_admin'
    AND (
      platform_business_tenants.owner_user_id=app_user_id()
      OR
      EXISTS (
        SELECT 1 FROM platform_tenant_admins a
        WHERE a.tenant_id=platform_business_tenants.platform_tenant_id AND a.user_id=app_user_id()
      )
      OR EXISTS (
        SELECT 1 FROM platform_tenant_users member
        JOIN platform_tenant_admins a ON a.tenant_id=member.tenant_id
        WHERE member.user_id=platform_business_tenants.owner_user_id
          AND member.status='active' AND a.user_id=app_user_id()
      )
    )
  )
  WITH CHECK (
    current_setting('app.role',true)='super_admin'
    AND (
      platform_business_tenants.platform_tenant_id IS NULL
      OR EXISTS (
        SELECT 1 FROM platform_tenant_admins a
        WHERE a.tenant_id=platform_business_tenants.platform_tenant_id AND a.user_id=app_user_id()
      )
    )
  );

CREATE POLICY platform_business_tenant_members_assigned_read ON platform_business_tenant_members FOR SELECT
  USING (
    current_setting('app.role',true)='super_admin'
    AND EXISTS (
      SELECT 1 FROM platform_business_tenants entity
      JOIN platform_tenant_admins assigned ON assigned.tenant_id=entity.platform_tenant_id
      WHERE entity.id=platform_business_tenant_members.tenant_id AND assigned.user_id=app_user_id()
    )
  );

CREATE OR REPLACE FUNCTION limit_business_tenant_super_admin_updates() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.role',true)='super_admin'
    AND (
      NEW.tenant_key IS DISTINCT FROM OLD.tenant_key OR
      NEW.display_name IS DISTINCT FROM OLD.display_name OR
      NEW.tenant_type IS DISTINCT FROM OLD.tenant_type OR
      NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR
      NEW.status IS DISTINCT FROM OLD.status OR
      NEW.created_at IS DISTINCT FROM OLD.created_at OR
      (NEW.platform_tenant_id IS NOT NULL AND NEW.platform_tenant_id IS DISTINCT FROM OLD.platform_tenant_id AND NOT EXISTS (
        SELECT 1 FROM platform_tenant_admins a
        WHERE a.tenant_id=NEW.platform_tenant_id AND a.user_id=app_user_id()
      ))
    ) THEN
    RAISE EXCEPTION 'Super Admins may only link an entity to an assigned platform tenant';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER platform_business_tenants_super_admin_guard
  BEFORE UPDATE ON platform_business_tenants
  FOR EACH ROW EXECUTE FUNCTION limit_business_tenant_super_admin_updates();
REVOKE ALL ON FUNCTION limit_business_tenant_super_admin_updates() FROM PUBLIC;

ALTER TABLE platform_tenant_events DROP CONSTRAINT platform_tenant_events_event_type_check;
ALTER TABLE platform_tenant_events ADD CONSTRAINT platform_tenant_events_event_type_check CHECK (
  event_type IN (
    'tenant_created','tenant_updated','deployment_registered','deployment_verified',
    'tenant_suspended','tenant_reactivated','tenant_retired','service_package_assigned',
    'tenant_modules_updated','tenant_user_assigned','tenant_user_unassigned',
    'business_entity_assigned','business_entity_unassigned'
  )
);
ALTER TABLE platform_business_tenant_events DROP CONSTRAINT platform_business_tenant_events_event_type_check;
ALTER TABLE platform_business_tenant_events ADD CONSTRAINT platform_business_tenant_events_event_type_check CHECK (
  event_type IN (
    'agent_network_created','member_added','member_deactivated','tenant_activated',
    'tenant_suspended','tenant_retired','platform_tenant_assigned','platform_tenant_unassigned'
  )
);
CREATE POLICY platform_tenant_events_assigned_insert ON platform_tenant_events FOR INSERT
  WITH CHECK (
    actor_id=app_user_id()
    AND current_setting('app.role',true)='super_admin'
    AND EXISTS (
      SELECT 1 FROM platform_tenant_admins a
      WHERE a.tenant_id=platform_tenant_events.tenant_id AND a.user_id=app_user_id()
    )
  );

CREATE POLICY platform_business_tenant_events_assigned_insert ON platform_business_tenant_events FOR INSERT
  WITH CHECK (
    actor_id=app_user_id()
    AND current_setting('app.role',true)='super_admin'
    AND EXISTS (
      SELECT 1 FROM platform_business_tenants tenant
      JOIN platform_tenant_admins a ON a.tenant_id=tenant.platform_tenant_id
      WHERE tenant.id=platform_business_tenant_events.tenant_id AND a.user_id=app_user_id()
    )
  );

GRANT SELECT,UPDATE ON TABLE platform_business_tenants TO "{{role}}";
GRANT SELECT,INSERT ON TABLE platform_tenant_events TO "{{role}}";
GRANT SELECT,INSERT ON TABLE platform_business_tenant_events TO "{{role}}";
GRANT USAGE,SELECT ON SEQUENCE platform_tenant_events_id_seq TO "{{role}}";
GRANT USAGE,SELECT ON SEQUENCE platform_business_tenant_events_id_seq TO "{{role}}";
GRANT EXECUTE ON FUNCTION limit_business_tenant_super_admin_updates() TO "{{role}}";
GRANT EXECUTE ON FUNCTION guard_platform_tenant_user_assignment() TO "{{role}}";
