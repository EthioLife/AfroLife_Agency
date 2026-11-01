CREATE TABLE assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  owner_role text NOT NULL,
  assigned_to uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  CHECK (assigned_to IS NULL OR assigned_to <> owner_id)
);
CREATE INDEX assistant_conversations_owner_idx
  ON assistant_conversations(owner_id,last_message_at DESC);
CREATE INDEX assistant_conversations_queue_idx
  ON assistant_conversations(status,last_message_at DESC) WHERE assigned_to IS NULL;

CREATE TABLE assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES assistant_conversations(id),
  sender_id uuid NOT NULL REFERENCES users(id),
  sender_role text NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('user','staff')),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_messages_conversation_idx
  ON assistant_messages(conversation_id,created_at,id);

CREATE TABLE assistant_support_presence (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  available boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_conversations NO FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_conversations_owner_read ON assistant_conversations
  FOR SELECT USING (owner_id=app_user_id());
CREATE POLICY assistant_conversations_assigned_read ON assistant_conversations
  FOR SELECT USING (
    assigned_to=app_user_id()
    AND app_role() IN ('global_admin','super_admin','compliance','corporate_business_manager')
  );
CREATE POLICY assistant_conversations_owner_insert ON assistant_conversations
  FOR INSERT WITH CHECK (
    owner_id=app_user_id() AND owner_role=app_role() AND assigned_to IS NULL AND status='open'
  );
GRANT SELECT,INSERT ON assistant_conversations TO "{{role}}";

ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_messages_authorized_read ON assistant_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assistant_conversations c WHERE c.id=conversation_id
        AND (
          c.owner_id=app_user_id()
          OR (
            c.assigned_to=app_user_id()
            AND app_role() IN ('global_admin','super_admin','compliance','corporate_business_manager')
          )
        )
    )
  );
CREATE POLICY assistant_messages_owner_insert ON assistant_messages
  FOR INSERT WITH CHECK (
    sender_id=app_user_id() AND sender_role=app_role() AND sender_type='user'
    AND EXISTS (
      SELECT 1 FROM assistant_conversations c
      WHERE c.id=conversation_id AND c.owner_id=app_user_id()
    )
  );
CREATE POLICY assistant_messages_staff_insert ON assistant_messages
  FOR INSERT WITH CHECK (
    sender_id=app_user_id() AND sender_role=app_role() AND sender_type='staff'
    AND app_role() IN ('global_admin','super_admin','compliance','corporate_business_manager')
    AND EXISTS (
      SELECT 1 FROM assistant_conversations c
      WHERE c.id=conversation_id AND c.assigned_to=app_user_id()
    )
  );
GRANT SELECT,INSERT ON assistant_messages TO "{{role}}";

CREATE OR REPLACE FUNCTION app_touch_assistant_conversation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  UPDATE assistant_conversations SET last_message_at=NEW.created_at
  WHERE id=NEW.conversation_id;
  RETURN NEW;
END
$$;
CREATE TRIGGER assistant_message_touch_conversation
AFTER INSERT ON assistant_messages
FOR EACH ROW EXECUTE FUNCTION app_touch_assistant_conversation();
REVOKE ALL ON FUNCTION app_touch_assistant_conversation() FROM PUBLIC;

ALTER TABLE assistant_support_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_support_presence FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_presence_live_read ON assistant_support_presence
  FOR SELECT USING (
    (user_id=app_user_id() AND app_role() IN ('global_admin','super_admin','compliance','corporate_business_manager'))
    OR (app_user_id() IS NOT NULL AND available=true AND updated_at>now()-interval '2 minutes')
  );
CREATE POLICY assistant_presence_staff_insert ON assistant_support_presence
  FOR INSERT WITH CHECK (
    user_id=app_user_id()
    AND app_role() IN ('global_admin','super_admin','compliance','corporate_business_manager')
  );
CREATE POLICY assistant_presence_staff_update ON assistant_support_presence
  FOR UPDATE USING (
    user_id=app_user_id()
    AND app_role() IN ('global_admin','super_admin','compliance','corporate_business_manager')
  )
  WITH CHECK (
    user_id=app_user_id()
    AND app_role() IN ('global_admin','super_admin','compliance','corporate_business_manager')
  );
GRANT SELECT,INSERT,UPDATE (available,updated_at) ON assistant_support_presence TO "{{role}}";

CREATE OR REPLACE FUNCTION app_assistant_conversation_queue()
RETURNS TABLE (
  id uuid,
  owner_role text,
  status text,
  created_at timestamptz,
  last_message_at timestamptz,
  assigned_to uuid
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT c.id,c.owner_role,c.status,c.created_at,c.last_message_at,c.assigned_to
  FROM assistant_conversations c
  WHERE app_role() IN ('global_admin','super_admin','compliance','corporate_business_manager')
    AND (c.assigned_to IS NULL OR c.assigned_to=app_user_id())
  ORDER BY (c.assigned_to IS NOT NULL),c.last_message_at
  LIMIT 200
$$;
REVOKE ALL ON FUNCTION app_assistant_conversation_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_assistant_conversation_queue() TO "{{role}}";

CREATE OR REPLACE FUNCTION app_claim_assistant_conversation(target_conversation uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE claimed_id uuid;
BEGIN
  IF app_role() NOT IN ('global_admin','super_admin','compliance','corporate_business_manager') THEN
    RAISE EXCEPTION 'Role cannot claim assistant conversations';
  END IF;
  UPDATE assistant_conversations
  SET assigned_to=app_user_id(),status='assigned'
  WHERE id=target_conversation AND (assigned_to IS NULL OR assigned_to=app_user_id())
  RETURNING id INTO claimed_id;
  RETURN claimed_id;
END
$$;
REVOKE ALL ON FUNCTION app_claim_assistant_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_claim_assistant_conversation(uuid) TO "{{role}}";
