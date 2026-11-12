CREATE TABLE user_telegram_links (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  telegram_user_id text NOT NULL UNIQUE CHECK (telegram_user_id ~ '^[0-9]{1,24}$'),
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE telegram_link_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL CHECK (octet_length(token_hash) = 32),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + interval '10 minutes'),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX telegram_link_challenges_user_idx
  ON telegram_link_challenges (user_id, created_at DESC);

ALTER TABLE user_telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_telegram_links FORCE ROW LEVEL SECURITY;
CREATE POLICY user_telegram_links_self_or_webhook ON user_telegram_links
  USING (user_id=app_user_id() OR app_service()='messaging_webhook')
  WITH CHECK (user_id=app_user_id() OR app_service()='messaging_webhook');

ALTER TABLE telegram_link_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_link_challenges FORCE ROW LEVEL SECURITY;
CREATE POLICY telegram_link_challenges_self_or_webhook ON telegram_link_challenges
  USING (user_id=app_user_id() OR app_service()='messaging_webhook')
  WITH CHECK (user_id=app_user_id() OR app_service()='messaging_webhook');

REVOKE ALL ON TABLE user_telegram_links, telegram_link_challenges FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_telegram_links, telegram_link_challenges TO "{{role}}";
