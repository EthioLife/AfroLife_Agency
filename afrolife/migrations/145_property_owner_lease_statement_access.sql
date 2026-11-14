CREATE POLICY leases_property_owner_statement_read ON leases
  FOR SELECT
  USING (
    app_role() = 'property_owner'
    AND EXISTS (
      SELECT 1
      FROM property_units unit
      JOIN properties property ON property.id = unit.property_id
      WHERE unit.id = leases.unit_id
        AND property.owner_user_id = app_user_id()
    )
  );
