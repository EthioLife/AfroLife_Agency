ALTER TABLE leases NO FORCE ROW LEVEL SECURITY;
ALTER TABLE property_units NO FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_resident_has_active_lease_on_unit(target_unit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM leases lease
    JOIN property_tenant_account_links link ON link.tenant_id = lease.tenant_id
    WHERE lease.unit_id = target_unit_id
      AND link.user_id = app_user_id()
      AND link.revoked_at IS NULL
      AND lease.status = 'active'
  )
$$;
REVOKE ALL ON FUNCTION app_resident_has_active_lease_on_unit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_resident_has_active_lease_on_unit(uuid) TO "{{role}}";

DROP POLICY property_units_linked_resident_read ON property_units;
CREATE POLICY property_units_linked_resident_read ON property_units FOR SELECT
  USING (app_resident_has_active_lease_on_unit(id));
