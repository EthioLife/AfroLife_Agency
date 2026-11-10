CREATE TABLE auth_passkey_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE CHECK (credential_id ~ '^[A-Za-z0-9_-]{1,2048}$'),
  public_key bytea NOT NULL CHECK (octet_length(public_key) > 0),
  sign_count bigint NOT NULL DEFAULT 0 CHECK (sign_count >= 0),
  transports text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (transports <@ ARRAY['usb','nfc','ble','smart-card','hybrid','internal']::text[]),
  device_type text NOT NULL CHECK (device_type IN ('singleDevice','multiDevice')),
  backed_up boolean NOT NULL DEFAULT false,
  device_name text NOT NULL CHECK (length(device_name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX auth_passkey_credentials_user_idx
  ON auth_passkey_credentials (user_id, created_at DESC);

ALTER TABLE auth_passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_passkey_credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_passkey_credentials_self ON auth_passkey_credentials
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id());

CREATE TABLE auth_passkey_registration_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  challenge text NOT NULL CHECK (challenge ~ '^[A-Za-z0-9_-]{20,256}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + interval '5 minutes'),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at),
  UNIQUE (user_id, session_id, challenge)
);

CREATE INDEX auth_passkey_registration_challenges_active_idx
  ON auth_passkey_registration_challenges (user_id, session_id, expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE auth_passkey_registration_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_passkey_registration_challenges FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_passkey_registration_challenges_self ON auth_passkey_registration_challenges
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id());

REVOKE ALL ON TABLE auth_passkey_credentials FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth_passkey_credentials TO "{{role}}";
REVOKE ALL ON TABLE auth_passkey_registration_challenges FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth_passkey_registration_challenges TO "{{role}}";
