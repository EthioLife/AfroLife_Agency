-- Keep RLS enabled for application roles while allowing the table-owner helper to bypass it.
ALTER TABLE property_tenant_account_links NO FORCE ROW LEVEL SECURITY;
