CREATE TABLE lease_renewal_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id),
  proposed_rent numeric(14,2) NOT NULL CHECK (proposed_rent > 0),
  proposed_deposit numeric(14,2) NOT NULL CHECK (proposed_deposit >= 0),
  proposed_start_date date NOT NULL,
  proposed_end_date date NOT NULL,
  term_months integer NOT NULL CHECK (term_months BETWEEN 1 AND 120),
  due_day integer NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  expires_on date NOT NULL,
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  request_reason text NOT NULL CHECK (length(trim(request_reason)) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval','offered','accepted','declined','rejected','expired')),
  created_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  responded_by uuid REFERENCES users(id),
  responded_at timestamptz,
  review_reason text,
  response_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (proposed_end_date >= proposed_start_date),
  CHECK (expires_on < proposed_start_date),
  CHECK ((approved_by IS NULL) = (approved_at IS NULL)),
  CHECK ((responded_by IS NULL) = (responded_at IS NULL)),
  CHECK (approved_by IS NULL OR approved_by <> created_by),
  CHECK (status NOT IN ('offered','accepted','declined') OR (approved_by IS NOT NULL AND expires_on IS NOT NULL)),
  CHECK (status NOT IN ('accepted','declined') OR responded_by IS NOT NULL),
  CHECK (review_reason IS NULL OR length(trim(review_reason)) BETWEEN 10 AND 1000),
  CHECK (response_note IS NULL OR length(trim(response_note)) BETWEEN 5 AND 1000),
  CHECK (status <> 'rejected' OR review_reason IS NOT NULL),
  CHECK (status <> 'declined' OR response_note IS NOT NULL)
);

CREATE UNIQUE INDEX lease_renewal_offer_idempotency_idx
  ON lease_renewal_offers(lease_id,created_by,idempotency_key);
CREATE UNIQUE INDEX lease_renewal_offer_open_lease_idx
  ON lease_renewal_offers(lease_id)
  WHERE status IN ('pending_approval','offered','accepted');
CREATE INDEX lease_renewal_offer_queue_idx
  ON lease_renewal_offers(status,created_at,id);

ALTER TABLE leases
  ADD COLUMN renewal_of_lease_id uuid REFERENCES leases(id),
  ADD COLUMN renewal_offer_id uuid UNIQUE REFERENCES lease_renewal_offers(id);

CREATE TABLE lease_renewal_offer_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES lease_renewal_offers(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL
    CHECK (event_type IN ('created','offered','rejected','accepted','declined','expired','converted')),
  from_status text CHECK (from_status IS NULL OR from_status IN ('pending_approval','offered','accepted','declined','rejected','expired')),
  to_status text NOT NULL
    CHECK (to_status IN ('pending_approval','offered','accepted','declined','rejected','expired')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lease_renewal_offer_events_history_idx
  ON lease_renewal_offer_events(offer_id,created_at,id);

CREATE OR REPLACE FUNCTION prevent_lease_renewal_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Lease renewal history is append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER lease_renewal_offer_events_immutable
  BEFORE UPDATE OR DELETE ON lease_renewal_offer_events
  FOR EACH ROW EXECUTE FUNCTION prevent_lease_renewal_event_mutation();

CREATE OR REPLACE FUNCTION guard_lease_renewal_offer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE actor uuid := app_user_id();
BEGIN
  IF TG_OP='INSERT' THEN
    IF actor IS NULL OR NEW.created_by IS DISTINCT FROM actor
      OR NEW.status<>'pending_approval' OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL
      OR NEW.responded_by IS NOT NULL OR NEW.responded_at IS NOT NULL
      OR NEW.expires_on<current_date
      OR NOT app_has_permission('property.tenancy.manage')
      OR NOT EXISTS (
        SELECT 1 FROM leases lease
        WHERE lease.id=NEW.lease_id AND lease.status='active'
          AND NEW.proposed_start_date>lease.end_date
          AND app_can_access_agent(lease.source_agent_id)
      ) THEN
      RAISE EXCEPTION 'Lease renewal offers must be created by an authorized manager for an active lease'
        USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW)-'status'-'approved_by'-'approved_at'-'responded_by'-'responded_at'
      -'review_reason'-'response_note'-'updated_at')
     <> (to_jsonb(OLD)-'status'-'approved_by'-'approved_at'-'responded_by'-'responded_at'
      -'review_reason'-'response_note'-'updated_at') THEN
    RAISE EXCEPTION 'Lease renewal terms and offer identity are immutable after submission'
      USING ERRCODE='42501';
  END IF;

  IF OLD.status='pending_approval' AND NEW.status IN ('offered','rejected') THEN
    IF actor IS NULL OR actor=OLD.created_by
      OR NOT app_has_permission('property.tenancy.approve')
      OR NEW.approved_by IS DISTINCT FROM actor OR NEW.approved_at IS NULL
      OR NEW.responded_by IS DISTINCT FROM OLD.responded_by
      OR NEW.responded_at IS DISTINCT FROM OLD.responded_at
      OR NEW.response_note IS DISTINCT FROM OLD.response_note
      OR (NEW.status='rejected' AND length(trim(COALESCE(NEW.review_reason,'')))<10)
      OR (NEW.status='offered' AND NEW.review_reason IS DISTINCT FROM OLD.review_reason)
      OR (NEW.status='offered' AND NEW.expires_on<current_date)
      THEN
      RAISE EXCEPTION 'Lease renewal approval requires an independent authorized reviewer and decision evidence'
        USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status='offered' AND NEW.status='expired' THEN
    IF actor IS NULL OR NOT app_has_permission('property.tenancy.manage')
      OR NEW.expires_on>=current_date
      OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.responded_by IS DISTINCT FROM OLD.responded_by
      OR NEW.responded_at IS DISTINCT FROM OLD.responded_at
      OR NEW.review_reason IS DISTINCT FROM OLD.review_reason
      OR NEW.response_note IS DISTINCT FROM OLD.response_note THEN
      RAISE EXCEPTION 'Only an authorized manager may expire an elapsed lease renewal offer'
        USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status='offered' AND NEW.status IN ('accepted','declined') THEN
    IF actor IS NULL OR app_role()<>'customer'
      OR NEW.responded_by IS DISTINCT FROM actor OR NEW.responded_at IS NULL
      OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.review_reason IS DISTINCT FROM OLD.review_reason
      OR OLD.expires_on<current_date
      OR NOT EXISTS (
        SELECT 1 FROM leases lease
        JOIN property_tenant_account_links link ON link.tenant_id=lease.tenant_id
        WHERE lease.id=OLD.lease_id AND lease.status='active'
          AND link.user_id=actor AND link.revoked_at IS NULL
      )
      OR (NEW.status='declined' AND length(trim(COALESCE(NEW.response_note,'')))<10) THEN
      RAISE EXCEPTION 'Only a linked resident may respond to a current lease renewal offer'
        USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Lease renewal offer transition is not permitted' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER lease_renewal_offer_guard
  BEFORE INSERT OR UPDATE ON lease_renewal_offers
  FOR EACH ROW EXECUTE FUNCTION guard_lease_renewal_offer();

ALTER TABLE lease_renewal_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_renewal_offers FORCE ROW LEVEL SECURITY;
CREATE POLICY lease_renewal_offer_read
  ON lease_renewal_offers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM leases lease
    WHERE lease.id=lease_id AND (
      (app_has_permission('property.tenancy.manage') AND app_can_access_agent(lease.source_agent_id))
      OR (app_has_permission('property.tenancy.approve') AND app_can_access_agent(lease.source_agent_id))
      OR EXISTS (
        SELECT 1 FROM property_tenant_account_links link
        WHERE link.tenant_id=lease.tenant_id AND link.user_id=app_user_id() AND link.revoked_at IS NULL
      )
    )
  ));
CREATE POLICY lease_renewal_offer_insert
  ON lease_renewal_offers FOR INSERT
  WITH CHECK (
    created_by=app_user_id() AND status='pending_approval'
    AND app_has_permission('property.tenancy.manage')
    AND EXISTS (
      SELECT 1 FROM leases lease
      WHERE lease.id=lease_id AND lease.status='active'
        AND app_can_access_agent(lease.source_agent_id)
    )
  );
CREATE POLICY lease_renewal_offer_update
  ON lease_renewal_offers FOR UPDATE
  USING (
    ((app_has_permission('property.tenancy.approve') OR app_has_permission('property.tenancy.manage')) AND EXISTS (
      SELECT 1 FROM leases lease
      WHERE lease.id=lease_id AND app_can_access_agent(lease.source_agent_id)
    ))
    OR EXISTS (
      SELECT 1 FROM leases lease
      JOIN property_tenant_account_links link ON link.tenant_id=lease.tenant_id
      WHERE lease.id=lease_id AND link.user_id=app_user_id() AND link.revoked_at IS NULL
    )
  )
  WITH CHECK (
    ((app_has_permission('property.tenancy.approve') OR app_has_permission('property.tenancy.manage')) AND EXISTS (
      SELECT 1 FROM leases lease
      WHERE lease.id=lease_id AND app_can_access_agent(lease.source_agent_id)
    ))
    OR EXISTS (
      SELECT 1 FROM leases lease
      JOIN property_tenant_account_links link ON link.tenant_id=lease.tenant_id
      WHERE lease.id=lease_id AND link.user_id=app_user_id() AND link.revoked_at IS NULL
    )
  );

ALTER TABLE lease_renewal_offer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_renewal_offer_events FORCE ROW LEVEL SECURITY;
CREATE POLICY lease_renewal_offer_events_read
  ON lease_renewal_offer_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM lease_renewal_offers offer WHERE offer.id=offer_id
  ));
CREATE POLICY lease_renewal_offer_events_insert
  ON lease_renewal_offer_events FOR INSERT
  WITH CHECK (
    actor_id=app_user_id()
    AND EXISTS (SELECT 1 FROM lease_renewal_offers offer WHERE offer.id=offer_id)
  );

GRANT SELECT,INSERT,UPDATE ON lease_renewal_offers TO "{{role}}";
GRANT SELECT,INSERT ON lease_renewal_offer_events TO "{{role}}";
GRANT USAGE,SELECT ON SEQUENCE lease_renewal_offer_events_id_seq TO "{{role}}";
