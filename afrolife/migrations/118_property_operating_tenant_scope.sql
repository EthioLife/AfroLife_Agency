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
    'legacy_migration','tenant_created','member_assigned','member_suspended','member_reactivated',
    'member_ended','tenant_status_changed',
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
  CHECK ((status IN ('active','revoked') AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR (status IN ('pending','rejected','expired') AND approved_at IS NULL))
);
CREATE INDEX property_operating_tenant_support_active_idx
  ON property_operating_tenant_support_grants(user_id,tenant_system_id,expires_at)
  WHERE status='active';
CREATE TRIGGER property_operating_tenant_events_immutable
  BEFORE UPDATE OR DELETE ON property_operating_tenant_events
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE active=true) THEN
    RAISE EXCEPTION 'Create an active administrator account before applying property tenant isolation';
  END IF;
END;
$$;

INSERT INTO property_operating_tenants(tenant_key,legal_name,created_by)
SELECT 'legacy-property-operations','Legacy Property Operations',id
FROM users
ORDER BY created_at,id
LIMIT 1;

INSERT INTO property_operating_tenant_members(tenant_system_id,user_id,tenant_role,assigned_by)
SELECT tenant.id,user_row.id,
  CASE user_row.role
    WHEN 'super_admin' THEN 'tenant_admin'
    WHEN 'corporate_business_manager' THEN 'tenant_admin'
    WHEN 'master_agent' THEN 'master_agent'
    WHEN 'field_agent' THEN 'field_agent'
    WHEN 'property_owner' THEN 'owner'
    WHEN 'customer' THEN 'resident'
    WHEN 'property_vendor' THEN 'vendor'
    WHEN 'vendor' THEN 'vendor'
    WHEN 'finance' THEN 'tenant_accountant'
    WHEN 'finance_manager' THEN 'tenant_accountant'
    ELSE 'agent'
  END,
  user_row.id
FROM property_operating_tenants tenant
CROSS JOIN users AS user_row
WHERE tenant.tenant_key='legacy-property-operations' AND user_row.active=true
  AND user_row.role IN (
    'super_admin','corporate_business_manager','master_agent','field_agent',
    'property_owner','customer','property_vendor','vendor','finance','finance_manager'
  );

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
ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS lease_id uuid REFERENCES leases(id),
  ADD COLUMN IF NOT EXISTS resident_user_id uuid REFERENCES users(id);
ALTER TABLE rent_transactions ADD COLUMN tenant_system_id uuid REFERENCES property_operating_tenants(id);
ALTER TABLE property_vendors ADD COLUMN tenant_system_id uuid REFERENCES property_operating_tenants(id);
ALTER TABLE property_vendor_bills
  ADD COLUMN tenant_system_id uuid REFERENCES property_operating_tenants(id);

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
UPDATE rent_transactions transaction_row SET tenant_system_id=lease.tenant_system_id
FROM leases lease WHERE lease.id=transaction_row.lease_id;
UPDATE rent_transactions SET tenant_system_id=(
  SELECT id FROM property_operating_tenants WHERE tenant_key='legacy-property-operations'
) WHERE tenant_system_id IS NULL;
UPDATE property_vendors SET tenant_system_id=(
  SELECT id FROM property_operating_tenants WHERE tenant_key='legacy-property-operations'
);
UPDATE property_vendor_bills bill SET tenant_system_id=maintenance.tenant_system_id
FROM maintenance_requests maintenance
WHERE maintenance.id=bill.maintenance_request_id;

ALTER TABLE properties ALTER COLUMN tenant_system_id SET NOT NULL;
ALTER TABLE tenants ALTER COLUMN tenant_system_id SET NOT NULL;
ALTER TABLE leases ALTER COLUMN tenant_system_id SET NOT NULL;
ALTER TABLE maintenance_requests ALTER COLUMN tenant_system_id SET NOT NULL;
ALTER TABLE rent_transactions ALTER COLUMN tenant_system_id SET NOT NULL;
ALTER TABLE property_vendors ALTER COLUMN tenant_system_id SET NOT NULL;
ALTER TABLE property_vendor_bills ALTER COLUMN tenant_system_id SET NOT NULL;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_phone_key;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_national_id_key;
CREATE UNIQUE INDEX tenants_tenant_phone_unique ON tenants(tenant_system_id,phone);
CREATE UNIQUE INDEX tenants_tenant_national_id_unique
  ON tenants(tenant_system_id,national_id) WHERE national_id IS NOT NULL;
ALTER TABLE rent_transactions DROP CONSTRAINT IF EXISTS rent_transactions_reference_key;
CREATE UNIQUE INDEX rent_transactions_tenant_reference_unique
  ON rent_transactions(tenant_system_id,reference);
DROP INDEX IF EXISTS properties_address_territory_unique;
CREATE UNIQUE INDEX properties_tenant_address_territory_unique
  ON properties(tenant_system_id,lower(address),territory_id);
DROP INDEX IF EXISTS property_vendors_tax_id_unique;
DROP INDEX IF EXISTS property_vendors_name_unique;
CREATE UNIQUE INDEX property_vendors_tenant_tax_id_unique
  ON property_vendors(tenant_system_id,tax_id) WHERE tax_id IS NOT NULL;
CREATE UNIQUE INDEX property_vendors_tenant_name_unique
  ON property_vendors(tenant_system_id,lower(name));
ALTER TABLE property_vendor_bills
  DROP CONSTRAINT IF EXISTS property_vendor_bills_payment_reference_key;
CREATE UNIQUE INDEX property_vendor_bills_tenant_payment_reference_unique
  ON property_vendor_bills(tenant_system_id,payment_reference) WHERE payment_reference IS NOT NULL;
CREATE INDEX properties_tenant_system_idx ON properties(tenant_system_id,id);
CREATE INDEX tenants_tenant_system_idx ON tenants(tenant_system_id,id);
CREATE INDEX leases_tenant_system_idx ON leases(tenant_system_id,id);
CREATE INDEX maintenance_requests_tenant_system_idx ON maintenance_requests(tenant_system_id,id);
CREATE INDEX rent_transactions_tenant_system_idx ON rent_transactions(tenant_system_id,id);
CREATE INDEX property_vendors_tenant_system_idx ON property_vendors(tenant_system_id,id);
CREATE INDEX property_vendor_bills_tenant_system_idx ON property_vendor_bills(tenant_system_id,id);

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

CREATE OR REPLACE FUNCTION app_is_property_tenant_admin(target_tenant uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM property_operating_tenant_members member
    WHERE member.tenant_system_id=target_tenant AND member.user_id=app_user_id()
      AND member.tenant_role='tenant_admin' AND member.status='active'
  )
$$;
REVOKE ALL ON FUNCTION app_is_property_tenant_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_is_property_tenant_admin(uuid) TO "{{role}}";

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
CREATE TRIGGER rent_transactions_tenant_system_guard BEFORE INSERT OR UPDATE OF tenant_system_id ON rent_transactions
  FOR EACH ROW EXECUTE FUNCTION guard_property_tenant_system_id();
CREATE TRIGGER property_vendors_tenant_system_guard BEFORE INSERT OR UPDATE OF tenant_system_id ON property_vendors
  FOR EACH ROW EXECUTE FUNCTION guard_property_tenant_system_id();
REVOKE ALL ON FUNCTION guard_property_tenant_system_id() FROM PUBLIC;

CREATE OR REPLACE FUNCTION guard_property_record_tenant_relationships()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE property_tenant uuid;
DECLARE resident_tenant uuid;
BEGIN
  IF TG_TABLE_NAME='leases' THEN
    SELECT property.tenant_system_id INTO property_tenant
    FROM property_units unit JOIN properties property ON property.id=unit.property_id
    WHERE unit.id=NEW.unit_id;
    SELECT tenant.tenant_system_id INTO resident_tenant FROM tenants tenant WHERE tenant.id=NEW.tenant_id;
    IF property_tenant IS NULL OR resident_tenant IS DISTINCT FROM property_tenant
      OR property_tenant IS DISTINCT FROM app_property_tenant_system_id() THEN
      RAISE EXCEPTION 'Lease, resident, and unit must belong to the same property tenant'
        USING ERRCODE='23514';
    END IF;
    IF TG_OP='INSERT' THEN
      NEW.tenant_system_id := property_tenant;
    ELSIF NEW.tenant_system_id IS DISTINCT FROM property_tenant THEN
      RAISE EXCEPTION 'Lease tenant scope must match its unit and resident'
        USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='maintenance_requests' THEN
    IF NEW.unit_id IS NOT NULL THEN
      SELECT property.tenant_system_id INTO property_tenant
      FROM property_units unit JOIN properties property ON property.id=unit.property_id
      WHERE unit.id=NEW.unit_id AND property.id=NEW.property_id;
    ELSE
      SELECT tenant_system_id INTO property_tenant FROM properties WHERE id=NEW.property_id;
    END IF;
    IF property_tenant IS NULL OR property_tenant IS DISTINCT FROM app_property_tenant_system_id() THEN
      RAISE EXCEPTION 'Maintenance request and property must belong to the same property tenant'
        USING ERRCODE='23514';
    END IF;
    IF TG_OP='INSERT' THEN
      NEW.tenant_system_id := property_tenant;
    ELSIF NEW.tenant_system_id IS DISTINCT FROM property_tenant THEN
      RAISE EXCEPTION 'Maintenance tenant scope must match its property'
        USING ERRCODE='23514';
    END IF;
    IF NEW.lease_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM leases lease
      WHERE lease.id=NEW.lease_id AND lease.tenant_system_id=property_tenant
        AND lease.unit_id=NEW.unit_id
    ) THEN
      RAISE EXCEPTION 'Maintenance request lease must belong to the same property tenant and unit'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER leases_tenant_relationship_guard BEFORE INSERT OR UPDATE OF unit_id,tenant_id,tenant_system_id ON leases
  FOR EACH ROW EXECUTE FUNCTION guard_property_record_tenant_relationships();
CREATE TRIGGER maintenance_tenant_relationship_guard BEFORE INSERT OR UPDATE OF property_id,unit_id,lease_id,tenant_system_id ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION guard_property_record_tenant_relationships();
CREATE OR REPLACE FUNCTION guard_property_transaction_tenant_relationship()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE lease_tenant uuid;
BEGIN
  SELECT tenant_system_id INTO lease_tenant FROM leases WHERE id=NEW.lease_id;
  IF lease_tenant IS NULL OR lease_tenant IS DISTINCT FROM app_property_tenant_system_id() THEN
    RAISE EXCEPTION 'Rent transaction and lease must belong to the same property tenant'
      USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.tenant_system_id := lease_tenant;
  ELSIF NEW.tenant_system_id IS DISTINCT FROM lease_tenant THEN
    RAISE EXCEPTION 'Rent transaction tenant scope must match its lease'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER rent_transactions_tenant_relationship_guard
  BEFORE INSERT OR UPDATE OF lease_id,tenant_system_id ON rent_transactions
  FOR EACH ROW EXECUTE FUNCTION guard_property_transaction_tenant_relationship();
REVOKE ALL ON FUNCTION guard_property_transaction_tenant_relationship() FROM PUBLIC;
REVOKE ALL ON FUNCTION guard_property_record_tenant_relationships() FROM PUBLIC;

CREATE OR REPLACE FUNCTION guard_property_vendor_bill_tenant()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE parent_tenant uuid;
DECLARE vendor_tenant uuid;
BEGIN
  SELECT tenant_system_id INTO parent_tenant
  FROM maintenance_requests WHERE id=NEW.maintenance_request_id;
  SELECT tenant_system_id INTO vendor_tenant
  FROM property_vendors WHERE id=NEW.vendor_id;
  IF parent_tenant IS NULL OR vendor_tenant IS NULL
    OR parent_tenant IS DISTINCT FROM vendor_tenant
    OR parent_tenant IS DISTINCT FROM app_property_tenant_system_id() THEN
    RAISE EXCEPTION 'Vendor bill, vendor, and maintenance request must belong to the active property tenant'
      USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.tenant_system_id := parent_tenant;
  ELSIF NEW.tenant_system_id IS DISTINCT FROM parent_tenant THEN
    RAISE EXCEPTION 'Vendor bill tenant scope must match its maintenance request'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER property_vendor_bills_tenant_guard
  BEFORE INSERT OR UPDATE OF maintenance_request_id,vendor_id,tenant_system_id ON property_vendor_bills
  FOR EACH ROW EXECUTE FUNCTION guard_property_vendor_bill_tenant();
REVOKE ALL ON FUNCTION guard_property_vendor_bill_tenant() FROM PUBLIC;

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
  IF NOT (
    app_role()='global_admin'
    OR (
      app_property_tenant_system_id()=target_tenant
      AND app_has_permission('property.tenancy.manage')
      AND app_is_property_tenant_admin(target_tenant)
    )
  ) OR actor IS NULL OR actor=target_user
    OR next_status NOT IN ('active','suspended','ended')
    OR length(trim(change_reason))<10 THEN
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
      'to_status',next_status,'reason',change_reason));
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
CREATE OR REPLACE FUNCTION set_property_operating_tenant_status(
  target_tenant uuid,
  next_status text,
  change_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE previous_status text;
BEGIN
  IF app_role()<>'global_admin' OR actor IS NULL
    OR next_status NOT IN ('active','suspended','offboarding','closed')
    OR length(trim(change_reason))<10 THEN
    RAISE EXCEPTION 'Tenant lifecycle changes require a Global Admin and documented reason'
      USING ERRCODE='42501';
  END IF;
  SELECT status INTO previous_status FROM property_operating_tenants
  WHERE id=target_tenant FOR UPDATE;
  IF previous_status IS NULL OR NOT (
    (previous_status='active' AND next_status IN ('suspended','offboarding'))
    OR (previous_status='suspended' AND next_status IN ('active','offboarding'))
    OR (previous_status='offboarding' AND next_status='closed')
  ) THEN
    RAISE EXCEPTION 'Property tenant lifecycle transition is not permitted'
      USING ERRCODE='23514';
  END IF;
  UPDATE property_operating_tenants SET status=next_status,updated_at=now()
  WHERE id=target_tenant;
  IF next_status IN ('suspended','offboarding','closed') THEN
    UPDATE property_operating_tenant_support_grants
    SET status='revoked'
    WHERE tenant_system_id=target_tenant AND status='active';
  END IF;
  INSERT INTO property_operating_tenant_events(tenant_system_id,actor_id,event_type,event_data)
  VALUES(target_tenant,actor,'tenant_status_changed',
    jsonb_build_object('from_status',previous_status,'to_status',next_status,'reason',change_reason));
END;
$$;
REVOKE ALL ON FUNCTION provision_property_operating_tenant(text,text,uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION assign_property_operating_tenant_member(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_property_operating_tenant_member_status(uuid,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_property_tenant_support_grant(uuid,uuid,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION decide_property_tenant_support_grant(uuid,boolean,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION revoke_property_tenant_support_grant(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_property_operating_tenant_status(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_property_operating_tenant(text,text,uuid,text,text,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION assign_property_operating_tenant_member(uuid,uuid,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION set_property_operating_tenant_member_status(uuid,uuid,text,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION request_property_tenant_support_grant(uuid,uuid,text,timestamptz) TO "{{role}}";
GRANT EXECUTE ON FUNCTION decide_property_tenant_support_grant(uuid,boolean,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION revoke_property_tenant_support_grant(uuid,text) TO "{{role}}";
GRANT EXECUTE ON FUNCTION set_property_operating_tenant_status(uuid,text,text) TO "{{role}}";

ALTER TABLE property_operating_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenant_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenant_events FORCE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenant_support_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_operating_tenant_support_grants FORCE ROW LEVEL SECURITY;

CREATE POLICY property_operating_tenants_member_read ON property_operating_tenants
  FOR SELECT USING (
    status='active'
    AND (
      EXISTS (
        SELECT 1 FROM property_operating_tenant_members member
        WHERE member.tenant_system_id=id AND member.user_id=app_user_id() AND member.status='active'
      )
      OR EXISTS (
        SELECT 1 FROM property_operating_tenant_support_grants grant_row
        WHERE grant_row.tenant_system_id=id AND grant_row.user_id=app_user_id()
          AND grant_row.status='active' AND grant_row.expires_at>now()
          AND grant_row.purpose=current_setting('app.property_tenant_purpose',true)
          AND app_role()='global_admin'
      )
    )
  );
CREATE POLICY property_operating_tenants_global_admin ON property_operating_tenants
  FOR ALL USING (app_role()='global_admin')
  WITH CHECK (app_role()='global_admin');
CREATE POLICY property_operating_tenant_members_assign ON property_operating_tenant_members
  FOR INSERT WITH CHECK (
    app_role()='global_admin' OR app_is_property_tenant_admin(tenant_system_id)
  );
CREATE POLICY property_operating_tenant_events_write ON property_operating_tenant_events
  FOR INSERT WITH CHECK (
    actor_id=app_user_id()
    AND (
      app_role()='global_admin'
      OR EXISTS (
        SELECT 1 FROM property_operating_tenant_members member
        WHERE member.tenant_system_id=property_operating_tenant_events.tenant_system_id
          AND member.user_id=app_user_id() AND member.tenant_role='tenant_admin'
          AND member.status='active'
      )
    )
  );
CREATE POLICY property_operating_tenant_members_self_read ON property_operating_tenant_members
  FOR SELECT USING (user_id=app_user_id());
CREATE POLICY property_operating_tenant_events_member_read ON property_operating_tenant_events
  FOR SELECT USING (tenant_system_id=app_property_tenant_system_id());
CREATE POLICY property_operating_tenant_support_grants_global_admin ON property_operating_tenant_support_grants
  FOR ALL USING (app_role()='global_admin')
  WITH CHECK (app_role()='global_admin');

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
CREATE POLICY maintenance_evidence_operating_tenant_scope ON maintenance_evidence AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY property_vendor_bills_operating_tenant_scope ON property_vendor_bills AS RESTRICTIVE FOR ALL
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());
CREATE POLICY property_vendor_memberships_operating_tenant_scope ON property_vendor_memberships AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM property_vendors vendor
    WHERE vendor.id=vendor_id AND vendor.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM property_vendors vendor
    WHERE vendor.id=vendor_id AND vendor.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY property_rental_applications_operating_tenant_scope ON property_rental_applications AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=property_id AND property.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=property_id AND property.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY property_rental_application_events_operating_tenant_scope ON property_rental_application_events AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM property_rental_applications application
    JOIN properties property ON property.id=application.property_id
    WHERE application.id=application_id AND property.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM property_rental_applications application
    JOIN properties property ON property.id=application.property_id
    WHERE application.id=application_id AND property.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY property_unit_turnover_events_operating_tenant_scope ON property_unit_turnover_events AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM property_units unit
    JOIN properties property ON property.id=unit.property_id
    WHERE unit.id=property_unit_turnover_events.unit_id
      AND property.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM property_units unit
    JOIN properties property ON property.id=unit.property_id
    WHERE unit.id=property_unit_turnover_events.unit_id
      AND property.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY tenants_field_agent_minimum_access ON tenants AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY maintenance_requests_field_agent_assigned_only ON maintenance_requests AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent' OR assigned_to=app_user_id()::text)
  WITH CHECK (app_role()<>'field_agent' OR assigned_to=app_user_id()::text);
CREATE POLICY leases_field_agent_minimum_access ON leases AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY rent_charges_field_agent_minimum_access ON rent_charges AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY rent_transactions_field_agent_minimum_access ON rent_transactions AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY lease_documents_field_agent_minimum_access ON lease_documents AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY lease_notices_field_agent_minimum_access ON lease_notices AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY move_out_inspections_field_agent_minimum_access ON lease_move_out_inspections AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY move_out_inspection_events_field_agent_minimum_access ON lease_move_out_inspection_events AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY move_out_inspection_evidence_field_agent_minimum_access ON lease_move_out_inspection_evidence AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY renewal_offers_field_agent_minimum_access ON lease_renewal_offers AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY renewal_events_field_agent_minimum_access ON lease_renewal_offer_events AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY rental_applications_field_agent_minimum_access ON property_rental_applications AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent')
  WITH CHECK (app_role()<>'field_agent');
CREATE POLICY maintenance_request_events_field_agent_minimum_access ON maintenance_request_events AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent' OR EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to=app_user_id()::text
  ))
  WITH CHECK (app_role()<>'field_agent' OR EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to=app_user_id()::text
  ));
CREATE POLICY maintenance_evidence_field_agent_minimum_access ON maintenance_evidence AS RESTRICTIVE FOR ALL
  USING (app_role()<>'field_agent' OR EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to=app_user_id()::text
  ))
  WITH CHECK (app_role()<>'field_agent' OR EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.assigned_to=app_user_id()::text
  ));
CREATE POLICY property_authority_evidence_operating_tenant_scope ON property_authority_evidence AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=property_id AND property.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=property_id AND property.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY property_authority_events_operating_tenant_scope ON property_authority_review_events AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=property_id AND property.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties property
    WHERE property.id=property_id AND property.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY lease_documents_operating_tenant_scope ON lease_documents AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY lease_versions_operating_tenant_scope ON lease_versions AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY lease_lifecycle_events_operating_tenant_scope ON lease_lifecycle_events AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY lease_notices_operating_tenant_scope ON lease_notices AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY property_tenant_invitations_operating_tenant_scope ON property_tenant_access_invitations AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY maintenance_request_events_operating_tenant_scope ON maintenance_request_events AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM maintenance_requests maintenance
    WHERE maintenance.id=maintenance_request_id
      AND maintenance.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY property_tenant_links_operating_tenant_scope ON property_tenant_account_links AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenants tenant
    WHERE tenant.id=tenant_id AND tenant.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenants tenant
    WHERE tenant.id=tenant_id AND tenant.tenant_system_id=app_property_tenant_system_id()
  ));
CREATE POLICY lease_renewal_events_operating_tenant_scope ON lease_renewal_offer_events AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM lease_renewal_offers offer JOIN leases lease ON lease.id=offer.lease_id
    WHERE offer.id=offer_id AND lease.tenant_system_id=app_property_tenant_system_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lease_renewal_offers offer JOIN leases lease ON lease.id=offer.lease_id
    WHERE offer.id=offer_id AND lease.tenant_system_id=app_property_tenant_system_id()
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
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());
CREATE POLICY property_vendors_operating_tenant_scope ON property_vendors AS RESTRICTIVE FOR ALL
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());
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

ALTER TABLE properties FORCE ROW LEVEL SECURITY;
ALTER TABLE property_units FORCE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE leases FORCE ROW LEVEL SECURITY;
ALTER TABLE rent_charges FORCE ROW LEVEL SECURITY;
ALTER TABLE rent_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE property_photos FORCE ROW LEVEL SECURITY;
ALTER TABLE property_rental_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE property_rental_application_events FORCE ROW LEVEL SECURITY;
ALTER TABLE property_authority_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE property_authority_review_events FORCE ROW LEVEL SECURITY;
ALTER TABLE lease_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE lease_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE lease_lifecycle_events FORCE ROW LEVEL SECURITY;
ALTER TABLE lease_notices FORCE ROW LEVEL SECURITY;
ALTER TABLE property_tenant_access_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE lease_renewal_offers FORCE ROW LEVEL SECURITY;
ALTER TABLE lease_renewal_offer_events FORCE ROW LEVEL SECURITY;
ALTER TABLE lease_move_out_inspections FORCE ROW LEVEL SECURITY;
ALTER TABLE lease_move_out_inspection_events FORCE ROW LEVEL SECURITY;
ALTER TABLE lease_move_out_inspection_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE property_unit_turnover_events FORCE ROW LEVEL SECURITY;
ALTER TABLE maintenance_request_events FORCE ROW LEVEL SECURITY;
ALTER TABLE maintenance_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE property_vendors FORCE ROW LEVEL SECURITY;
ALTER TABLE property_vendor_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE property_vendor_bills FORCE ROW LEVEL SECURITY;
