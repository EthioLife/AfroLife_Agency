CREATE TABLE auth_trusted_devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  user_agent text CHECK (user_agent IS NULL OR length(user_agent) <= 512),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX auth_trusted_devices_user_active_idx
  ON auth_trusted_devices (user_id, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE auth_trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_trusted_devices FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_trusted_devices_self ON auth_trusted_devices
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id());
CREATE POLICY auth_trusted_devices_admin ON auth_trusted_devices
  USING (app_role() IN ('global_admin','super_admin'))
  WITH CHECK (app_role() IN ('global_admin','super_admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth_trusted_devices TO "{{role}}";
