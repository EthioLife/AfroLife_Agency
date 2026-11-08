CREATE TABLE property_association_amenity_policies (
  policy_version_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_system_id uuid NOT NULL,
  association_id uuid NOT NULL,
  property_id uuid NOT NULL,
  amenity_name text NOT NULL CHECK (length(trim(amenity_name)) BETWEEN 2 AND 120),
  policy_version integer NOT NULL CHECK (policy_version>0),
  rules text NOT NULL CHECK (length(trim(rules)) BETWEEN 10 AND 3000),
  status text NOT NULL CHECK (status IN ('active','retired')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_system_id,association_id,property_id,amenity_name,policy_version),
  FOREIGN KEY (tenant_system_id,association_id,property_id)
    REFERENCES property_association_properties(tenant_system_id,association_id,property_id)
    ON DELETE RESTRICT
);
CREATE INDEX property_association_amenity_policies_history_idx
  ON property_association_amenity_policies(
    tenant_system_id,association_id,property_id,lower(amenity_name),policy_version DESC
  );
CREATE TRIGGER property_association_amenity_policies_immutable
  BEFORE UPDATE OR DELETE ON property_association_amenity_policies
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

CREATE OR REPLACE FUNCTION record_property_association_amenity_policy(
  target_association uuid,
  target_property uuid,
  target_amenity_name text,
  target_rules text,
  target_status text
)
RETURNS TABLE(policy_version_id bigint,policy_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  next_version integer;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL
    OR target_association IS NULL OR target_property IS NULL
    OR target_amenity_name IS NULL
    OR length(trim(target_amenity_name)) NOT BETWEEN 2 AND 120
    OR target_rules IS NULL OR length(trim(target_rules)) NOT BETWEEN 10 AND 3000
    OR target_status IS NULL
    OR target_status NOT IN ('active','retired')
    OR NOT EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=tenant_id
        AND member.user_id=actor
        AND member.tenant_role='tenant_admin'
        AND member.status='active'
    ) THEN
    RAISE EXCEPTION 'An active tenant administrator and valid amenity policy are required'
      USING ERRCODE='42501';
  END IF;

  PERFORM 1 FROM property_associations association
  WHERE association.tenant_system_id=tenant_id
    AND association.id=target_association
    AND association.status='active'
  FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM property_association_properties association_property
    WHERE association_property.tenant_system_id=tenant_id
      AND association_property.association_id=target_association
      AND association_property.property_id=target_property
  ) THEN
    RAISE EXCEPTION 'Amenity policy property must belong to an active tenant association'
      USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(max(policy.policy_version),0)+1 INTO next_version
  FROM property_association_amenity_policies policy
  WHERE policy.tenant_system_id=tenant_id
    AND policy.association_id=target_association
    AND policy.property_id=target_property
    AND lower(policy.amenity_name)=lower(trim(target_amenity_name));

  RETURN QUERY
  INSERT INTO property_association_amenity_policies(
    tenant_system_id,association_id,property_id,amenity_name,policy_version,
    rules,status,created_by
  )
  VALUES (
    tenant_id,target_association,target_property,trim(target_amenity_name),
    next_version,trim(target_rules),target_status,actor
  )
  RETURNING property_association_amenity_policies.policy_version_id,
            property_association_amenity_policies.policy_version;
END;
$$;
REVOKE ALL ON FUNCTION record_property_association_amenity_policy(uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_property_association_amenity_policy(uuid,uuid,text,text,text) TO "{{role}}";

ALTER TABLE property_association_amenity_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_amenity_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_amenity_policies_scoped_read
  ON property_association_amenity_policies FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND app_property_association_can_view(tenant_system_id,property_id)
  );
CREATE POLICY property_association_amenity_policies_command_insert
  ON property_association_amenity_policies FOR INSERT
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND created_by=app_user_id()
    AND EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=property_association_amenity_policies.tenant_system_id
        AND member.user_id=app_user_id()
        AND member.tenant_role='tenant_admin'
        AND member.status='active'
    )
    AND EXISTS (
      SELECT 1 FROM property_association_properties association_property
      WHERE association_property.tenant_system_id=property_association_amenity_policies.tenant_system_id
        AND association_property.association_id=property_association_amenity_policies.association_id
        AND association_property.property_id=property_association_amenity_policies.property_id
    )
  );

REVOKE ALL ON TABLE property_association_amenity_policies FROM PUBLIC,"{{role}}";
GRANT SELECT ON TABLE property_association_amenity_policies TO "{{role}}";
