CREATE OR REPLACE FUNCTION app_resident_has_active_lease_on_property(target_property_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM leases lease
    JOIN property_tenant_account_links link ON link.tenant_id = lease.tenant_id
    JOIN property_units unit ON unit.id = lease.unit_id
    WHERE unit.property_id = target_property_id
      AND link.user_id = app_user_id()
      AND link.revoked_at IS NULL
      AND lease.status = 'active'
  )
$$;
REVOKE ALL ON FUNCTION app_resident_has_active_lease_on_property(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_resident_has_active_lease_on_property(uuid) TO "{{role}}";

DROP POLICY properties_linked_resident_read ON properties;
CREATE POLICY properties_linked_resident_read ON properties FOR SELECT
  USING (app_resident_has_active_lease_on_property(id));
