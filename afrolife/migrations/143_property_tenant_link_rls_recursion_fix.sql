ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY;
ALTER TABLE property_tenant_account_links
  ADD COLUMN tenant_system_id uuid;

UPDATE property_tenant_account_links link
SET tenant_system_id = tenant.tenant_system_id
FROM tenants tenant
WHERE tenant.id = link.tenant_id;

ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE property_tenant_account_links
  ALTER COLUMN tenant_system_id SET NOT NULL;

CREATE UNIQUE INDEX tenants_id_tenant_system_id_unique
  ON tenants(id, tenant_system_id);
ALTER TABLE property_tenant_account_links
  ADD CONSTRAINT property_tenant_account_links_tenant_scope_fk
  FOREIGN KEY (tenant_id, tenant_system_id)
  REFERENCES tenants(id, tenant_system_id);

CREATE OR REPLACE FUNCTION guard_property_tenant_account_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE actor uuid := app_user_id();
DECLARE invite_source_agent uuid;
DECLARE invite_owner_user uuid;
DECLARE invite_tenant_system_id uuid;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT invitation.source_agent_id,invitation.property_owner_user_id,tenant.tenant_system_id
      INTO invite_source_agent,invite_owner_user,invite_tenant_system_id
      FROM property_tenant_access_invitations invitation
      JOIN tenants tenant ON tenant.id=invitation.tenant_id
      JOIN users account ON account.id=NEW.user_id
      WHERE invitation.id=NEW.invitation_id
        AND invitation.tenant_id=NEW.tenant_id
        AND invitation.redeemed_by=NEW.user_id
        AND invitation.redeemed_at IS NOT NULL
        AND account.active AND account.role='customer'
        AND account.phone=tenant.phone;
    IF actor IS NULL OR NEW.user_id IS DISTINCT FROM actor OR app_role()<>'customer'
      OR NEW.revoked_by IS NOT NULL OR NEW.revoked_at IS NOT NULL
      OR NEW.revocation_reason IS NOT NULL OR invite_source_agent IS NULL THEN
      RAISE EXCEPTION 'Tenant accounts may only be linked by redeeming a matching active invitation'
        USING ERRCODE='42501';
    END IF;
    NEW.tenant_system_id := invite_tenant_system_id;
    NEW.source_agent_id := invite_source_agent;
    NEW.property_owner_user_id := invite_owner_user;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW)-'revoked_by'-'revoked_at'-'revocation_reason')
     <> (to_jsonb(OLD)-'revoked_by'-'revoked_at'-'revocation_reason') THEN
    RAISE EXCEPTION 'Tenant account links are immutable'
      USING ERRCODE='42501';
  END IF;
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
    AND NEW.revoked_by=actor AND NEW.revocation_reason IS NOT NULL
    AND length(trim(NEW.revocation_reason))>=10
    AND app_can_manage_property_tenant_scope(OLD.source_agent_id,OLD.property_owner_user_id) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Tenant account link cannot be changed'
    USING ERRCODE='42501';
END;
$$;

DROP POLICY property_tenant_links_operating_tenant_scope ON property_tenant_account_links;
CREATE POLICY property_tenant_links_operating_tenant_scope ON property_tenant_account_links
  AS RESTRICTIVE FOR ALL
  USING (tenant_system_id=app_property_tenant_system_id())
  WITH CHECK (tenant_system_id=app_property_tenant_system_id());
