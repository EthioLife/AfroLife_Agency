CREATE TABLE property_operating_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key text NOT NULL UNIQUE CHECK (tenant_key ~ '^[a-z][a-z0-9-]{2,79}$'),
  legal_name text NOT NULL CHECK (length(trim(legal_name)) BETWEEN 2 AND 200),
  jurisdiction text NOT NULL DEFAULT 'ET',
  timezone text NOT NULL DEFAULT 'Africa/Addis_Ababa',
  currency text NOT NULL DEFAULT 'ETB' CHECK (currency ~ '^[A-Z]{3}$'),
  enabled_modules text[] NOT NULL DEFAULT ARRAY['properties','rent'],
  policy_version integer NOT NULL DEFAULT 1 CHECK (policy_version>0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('provisioning','active','suspended','offboarding','closed')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE property_operating_tenant_members (
  tenant_system_id uuid NOT NULL REFERENCES property_operating_tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  tenant_role text NOT NULL CHECK (tenant_role IN (
    'tenant_admin','tenant_accountant','master_agent','agent','field_agent',
    'owner','resident','vendor','board_member','inspector'
  )),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','ended')),
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_system_id,user_id)
);
CREATE INDEX property_operating_tenant_members_user_idx
  ON property_operating_tenant_members(user_id,tenant_system_id) WHERE status='active';

CREATE TABLE property_operating_tenant_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_system_id uuid NOT NULL REFERENCES property_operating_tenants(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL CHECK (event_type IN (
    'legacy_migration','tenant_created','member_assigned','member_suspended','tenant_status_changed',
    'support_grant_requested','support_grant_approved','support_grant_rejected','support_grant_revoked'
  )),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_data)='object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE property_operating_tenant_support_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_system_id uuid NOT NULL REFERENCES property_operating_tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  purpose text NOT NULL CHECK (length(trim(purpose)) BETWEEN 10 AND 1000),
  requested_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','rejected','expired','revoked')),
  CHECK (expires_at>requested_at),
  CHECK (approved_by IS NULL OR approved_by<>requested_by),
  CHECK ((status='active' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR (status<>'active' AND approved_at IS NULL))
);
CREATE INDEX property_operating_tenant_support_active_idx
  ON property_operating_tenant_support_grants(user_id,tenant_system_id,expires_at)
  WHERE status='active';
CREATE TRIGGER property_operating_tenant_events_immutable
  BEFORE UPDATE OR DELETE ON property_operating_tenant_events
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

INSERT INTO property_operating_tenants(tenant_key,legal_name,created_by)
SELECT 'legacy-property-operations','Legacy Property Operations',id
FROM users
ORDER BY created_at,id
LIMIT 1;

INSERT INTO property_operating_tenant_members(tenant_system_id,user_id,tenant_role,assigned_by)
SELECT tenant.id,user.id,
  CASE user.role
    WHEN 'super_admin' THEN 'tenant_admin'
    WHEN 'master_agent' THEN 'master_agent'
    WHEN 'field_agent' THEN 'field_agent'
    WHEN 'property_owner' THEN 'owner'
    WHEN 'customer' THEN 'resident'
    WHEN 'vendor' THEN 'vendor'
    WHEN 'finance' THEN 'tenant_accountant'
    WHEN 'finance_manager' THEN 'tenant_accountant'
    ELSE 'agent'
  END,
  user.id
FROM property_operating_tenants tenant
CROSS JOIN users
WHERE tenant.tenant_key='legacy-property-operations' AND users.active=true
  AND users.role<>'global_admin';

INSERT INTO property_operating_tenant_events(tenant_system_id,actor_id,event_type,event_data)
SELECT tenant.id,tenant.created_by,'legacy_migration',
  jsonb_build_object('strategy','all_existing_property_records_to_one_legacy_tenant')
FROM property_operating_tenants tenant
WHERE tenant.tenant_key='legacy-property-operations' AND tenant.created_by IS NOT NULL;

DO $$
BEGIN
  IF (EXISTS (SELECT 1 FROM properties)
    OR EXISTS (SELECT 1 FROM tenants)
    OR EXISTS (SELECT 1 FROM leases)
    OR EXISTS (SELECT 1 FROM maintenance_requests))
    AND NOT EXISTS (
    SELECT 1 FROM property_operating_tenant_members
    WHERE tenant_system_id=(SELECT id FROM property_operating_tenants WHERE tenant_key='legacy-property-operations')
      AND status='active'
  ) THEN
    RAISE EXCEPTION 'Cannot initialize property tenant isolation without an active legacy tenant member';
  END IF;
END;
$$;

ALTER TABLE properties ADD COLUMN tenant_system_id uuid REFERENCES property_operating_tenants(id);
ALTER TABLE tenants ADD COLUMN tenant_system_id uuid REFERENCES property_operating_tenants(id);
ALTER TABLE leases ADD COLUMN tenant_system_id uuid REFERENCES property_operating_tenants(id);
ALTER TABLE maintenance_requests ADD COLUMN tenant_system_id uuid REFERENCES property_operating_tenants(id);

UPDATE properties SET tenant_system_id=(
  SELECT id FROM property_operating_tenants WHERE tenant_key='legacy-property-operations'
);
UPDATE tenants SET tenant_system_id=(
  SELECT id FROM property_operating_tenants WHERE tenant_key='legacy-property-operations'
);
UPDATE leases SET tenant_system_id=(
  SELECT id FROM property_operating_tenants WHERE tenant_key='legacy-property-operations'
);
UPDATE maintenance_requests SET tenant_system_id=(
  SELECT id FROM property_operating_tenants WHERE tenant_key='legacy-property-operations'
);

ALTER TABLE properties ALTER COLUMN tenant_system_id SET NOT NULL;
ALTER TABLE tenants ALTER COLUMN tenant_system_id SET NOT NULL;
ALTER TABLE leases ALTER COLUMN tenant_system_id SET NOT NULL;
ALTER TABLE maintenance_requests ALTER COLUMN tenant_system_id SET NOT NULL;
CREATE INDEX properties_tenant_system_idx ON properties(tenant_system_id,id);
CREATE INDEX tenants_tenant_system_idx ON tenants(tenant_system_id,id);
CREATE INDEX leases_tenant_system_idx ON leases(tenant_system_id,id);
CREATE INDEX maintenance_requests_tenant_system_idx ON maintenance_requests(tenant_system_id,id);

CREATE OR REPLACE FUNCTION app_property_tenant_system_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT tenant.id
  FROM property_operating_tenants tenant
  WHERE tenant.id=nullif(current_setting('app.property_tenant_system_id',true),'')::uuid
    AND tenant.status='active'
    AND (
      EXISTS (
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
    )
$$;
REVOKE ALL ON FUNCTION app_property_tenant_system_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_property_tenant_system_id() TO "{{role}}";

CREATE OR REPLACE FUNCTION guard_property_tenant_system_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE active_tenant uuid := app_property_tenant_system_id();
BEGIN
  IF TG_OP='INSERT' THEN
    IF active_tenant IS NULL THEN
      RAISE EXCEPTION 'An active property tenant context is required'
        USING ERRCODE='42501';
    END IF;
    NEW.tenant_system_id := active_tenant;
  ELSIF NEW.tenant_system_id IS DISTINCT FROM OLD.tenant_system_id THEN
    RAISE EXCEPTION 'Property records cannot be transferred between tenants through ordinary updates'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER properties_tenant_system_guard BEFORE INSERT OR UPDATE OF tenant_system_id ON properties
  FOR EACH ROW EXECUTE FUNCTION guard_property_tenant_system_id();
CREATE TRIGGER tenants_tenant_system_guard BEFORE INSERT OR UPDATE OF tenant_system_id ON tenants
  FOR EACH ROW EXECUTE FUNCTION guard_property_tenant_system_id();
CREATE TRIGGER leases_tenant_system_guard BEFORE INSERT OR UPDATE OF tenant_system_id ON leases
  FOR EACH ROW EXECUTE FUNCTION guard_property_tenant_system_id();
CREATE TRIGGER maintenance_requests_tenant_system_guard BEFORE INSERT OR UPDATE OF tenant_system_id ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION guard_property_tenant_system_id();
REVOKE ALL ON FUNCTION guard_property_tenant_system_id() FROM PUBLIC;

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
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=initial_admin AND active=true) THEN
    RAISE EXCEPTION 'The initial tenant administrator must be an active user'
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
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=target_user AND active=true) THEN
    RAISE EXCEPTION 'Tenant members must be active users'
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
CREATE OR REPLACE FUNCTION request_property_tenant_support_grant(
  target_tenant uuid,
  target_user uuid,
  requested_purpose text,
  requested_expiry timestamptz
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE grant_id uuid;
BEGIN
  IF app_role()<>'global_admin' OR actor IS NULL OR target_user IS DISTINCT FROM actor
    OR requested_expiry<=now() OR requested_expiry>now()+interval '8 hours' THEN
    RAISE EXCEPTION 'Support access requests require a Global Admin, explicit purpose, and maximum eight-hour expiry'
      USING ERRCODE='42501';
  END IF;
  INSERT INTO property_operating_tenant_support_grants(
    tenant_system_id,user_id,purpose,requested_by,expires_at
  ) VALUES(target_tenant,target_user,requested_purpose,actor,requested_expiry)
  RETURNING id INTO grant_id;
  INSERT INTO property_operating_tenant_events(tenant_system_id,actor_id,event_type,event_data)
  VALUES(target_tenant,actor,'support_grant_requested',
    jsonb_build_object('grant_id',grant_id,'purpose',requested_purpose,'expires_at',requested_expiry));
  RETURN grant_id;
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
  SELECT * INTO grant_row FROM property_operating_tenant_support_grants
  WHERE id=target_grant FOR UPDATE;
  IF app_role()<>'global_admin' OR actor IS NULL OR grant_row.id IS NULL
    OR grant_row.status<>'pending' OR grant_row.requested_by=actor
    OR grant_row.expires_at<=now() OR length(trim(decision_reason))<10 THEN
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
    jsonb_build_object('grant_id',target_grant,'reason',decision_reason));
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
  SELECT * INTO grant_row FROM property_operating_tenant_support_grants
  WHERE id=target_grant FOR UPDATE;
  IF app_role()<>'global_admin' OR actor IS NULL OR grant_row.id IS NULL
    OR grant_row.status<>'active' OR length(trim(revocation_reason))<10 THEN
    RAISE EXCEPTION 'Revoking support access requires a Global Admin, active grant, and documented reason'
      USING ERRCODE='42501';
  END IF;
  UPDATE property_operating_tenant_support_grants SET status='revoked'
  WHERE id=target_grant;
  INSERT INTO property_operating_tenant_events(tenant_system_id,actor_id,event_type,event_data)
  VALUES(grant_row.tenant_system_id,actor,'support_grant_revoked',
    jsonb_build_object('grant_id',target_grant,'reason',revocation_reason));
END;
$$;
REVOKE ALL ON FUNCTION provision_property_operating_tenant(text,text,uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION assign_property_operating_tenant_member(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_property_tenant_support_grant(uuid,uuid,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION decide_property_tenant_support_grant(uuid,boolean,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION revoke_property_tenant_support_grant(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_property_operating_tenant(text,text,uuid,text,text,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION assign_property_operating_tenant_member(uuid,uuid,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION request_property_tenant_support_grant(uuid,uuid,text,timestamptz) TO "{{role}}";
GRANT EXECUTE ON FUNCTION decide_property_tenant_support_grant(uuid,boolean,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION revoke_property_tenant_support_grant(uuid,text) TO "{{role}}";

ALTER TABLE property_operating_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenant_members FORCE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenant_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenant_events FORCE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenant_support_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenant_support_grants FORCE ROW LEVEL SECURITY;

CREATE POLICY property_operating_tenants_member_read ON property_operating_tenants
  FOR SELECT USING (
    status='active'
    AND id=nullif(current_setting('app.property_tenant_system_id',true),'')::uuid
    AND EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=id AND member.user_id=app_user_id() AND member.status='active'
    )
  );
CREATE POLICY property_operating_tenant_members_self_read ON property_operating_tenant_members
  FOR SELECT USING (user_id=app_user_id());
CREATE POLICY property_operating_tenant_events_member_read ON property_operating_tenant_events
  FOR SELECT USING (tenant_system_id=app_property_tenant_system_id());
CREATE POLICY property_operating_tenant_support_grants_global_read ON property_operating_tenant_support_grants
  FOR SELECT USING (app_role()='global_admin');

GRANT SELECT ON property_operating_tenants,property_operating_tenant_members,property_operating_tenant_events,
  property_operating_tenant_support_grants TO "{{role}}";
GRANT USAGE,SELECT ON SEQUENCE property_operating_tenant_events_id_seq TO "{{role}}";

CREATE POLICY properties_operating_tenant_scope ON properties AS RESTRICTIVE FOR ALL
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());
CREATE POLICY tenants_operating_tenant_scope ON tenants AS RESTRICTIVE FOR ALL
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());
CREATE POLICY leases_operating_tenant_scope ON leases AS RESTRICTIVE FOR ALL
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());
CREATE POLICY maintenance_operating_tenant_scope ON maintenance_requests AS RESTRICTIVE FOR ALL
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());
CREATE POLICY property_units_operating_tenant_scope ON property_units AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=property_id AND property.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=property_id AND property.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY rent_charges_operating_tenant_scope ON rent_charges AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY rent_transactions_operating_tenant_scope ON rent_transactions AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY property_photos_operating_tenant_scope ON property_photos AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=property_id AND property.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=property_id AND property.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY lease_renewal_offers_operating_tenant_scope ON lease_renewal_offers AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY lease_move_out_inspections_operating_tenant_scope ON lease_move_out_inspections AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY lease_move_out_events_operating_tenant_scope ON lease_move_out_inspection_events AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM lease_move_out_inspections inspection
    WHERE inspection.id=inspection_id
      AND EXISTS (SELECT 1 FROM leases lease WHERE lease.id=inspection.lease_id
        AND lease.tenant_system_id=app_property_tenant_system_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lease_move_out_inspections inspection
    WHERE inspection.id=inspection_id
      AND EXISTS (SELECT 1 FROM leases lease WHERE lease.id=inspection.lease_id
        AND lease.tenant_system_id=app_property_tenant_system_id())
  ));
CREATE POLICY lease_move_out_evidence_operating_tenant_scope ON lease_move_out_inspection_evidence AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM lease_move_out_inspections inspection
    WHERE inspection.id=inspection_id
      AND EXISTS (SELECT 1 FROM leases lease WHERE lease.id=inspection.lease_id
        AND lease.tenant_system_id=app_property_tenant_system_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lease_move_out_inspections inspection
    WHERE inspection.id=inspection_id
      AND EXISTS (SELECT 1 FROM leases lease WHERE lease.id=inspection.lease_id
        AND lease.tenant_system_id=app_property_tenant_system_id())
  ));
