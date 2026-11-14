ALTER TABLE property_vendor_memberships NO FORCE ROW LEVEL SECURITY;
ALTER TABLE property_vendors NO FORCE ROW LEVEL SECURITY;

ALTER TABLE property_vendors
  ADD CONSTRAINT property_vendors_tenant_id_id_unique UNIQUE (tenant_system_id,id);
ALTER TABLE property_vendor_memberships
  ADD COLUMN tenant_system_id uuid REFERENCES property_operating_tenants(id);

UPDATE property_vendor_memberships membership
SET tenant_system_id=vendor.tenant_system_id
FROM property_vendors vendor
WHERE vendor.id=membership.vendor_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM property_vendor_memberships WHERE tenant_system_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot assign property vendor memberships to a tenant';
  END IF;
END;
$$;

ALTER TABLE property_vendor_memberships
  ALTER COLUMN tenant_system_id SET NOT NULL,
  ADD CONSTRAINT property_vendor_memberships_tenant_vendor_fk
    FOREIGN KEY (tenant_system_id,vendor_id)
    REFERENCES property_vendors(tenant_system_id,id);
CREATE INDEX property_vendor_memberships_tenant_vendor_idx
  ON property_vendor_memberships(tenant_system_id,vendor_id,user_id);

DROP POLICY property_vendor_memberships_operating_tenant_scope ON property_vendor_memberships;
CREATE POLICY property_vendor_memberships_operating_tenant_scope ON property_vendor_memberships AS RESTRICTIVE FOR ALL
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());

ALTER TABLE property_vendors FORCE ROW LEVEL SECURITY;
ALTER TABLE property_vendor_memberships FORCE ROW LEVEL SECURITY;
