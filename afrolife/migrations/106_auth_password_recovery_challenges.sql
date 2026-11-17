-- Reserved for an approved SMS adapter; the disabled recovery endpoints never insert challenges.
CREATE TABLE auth_password_recovery_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  code_hash bytea NOT NULL CHECK (octet_length(code_hash) = 32),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  consumed_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + interval '5 minutes'),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX auth_password_recovery_active_phone_idx
  ON auth_password_recovery_challenges (phone, expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX auth_password_recovery_user_idx
  ON auth_password_recovery_challenges (user_id, created_at DESC);

REVOKE ALL ON TABLE auth_password_recovery_challenges FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth_password_recovery_challenges TO "{{role}}";
