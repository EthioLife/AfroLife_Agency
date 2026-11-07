ALTER TABLE leases
  ADD COLUMN ended_on date;

CREATE TABLE lease_move_out_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id),
  revision integer NOT NULL CHECK (revision > 0),
  actual_vacated_on date NOT NULL,
  inspected_on date NOT NULL,
  condition_notes text NOT NULL CHECK (length(trim(condition_notes)) BETWEEN 10 AND 4000),
  keys_returned boolean NOT NULL,
  deposit_deduction numeric(14,2) NOT NULL DEFAULT 0 CHECK (deposit_deduction >= 0),
  deduction_reason text,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected')),
  submitted_by uuid NOT NULL REFERENCES users(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lease_id,revision),
  CHECK (inspected_on >= actual_vacated_on),
  CHECK (deposit_deduction = 0 OR length(trim(COALESCE(deduction_reason,''))) BETWEEN 10 AND 1000),
  CHECK ((status='pending_review' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note IS NULL)
    OR (status IN ('approved','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
      AND reviewed_by<>submitted_by AND length(trim(COALESCE(review_note,''))) BETWEEN 10 AND 1000))
);
CREATE UNIQUE INDEX lease_move_out_one_pending_idx
  ON lease_move_out_inspections(lease_id) WHERE status='pending_review';
CREATE UNIQUE INDEX lease_move_out_one_approved_idx
  ON lease_move_out_inspections(lease_id) WHERE status='approved';

CREATE TABLE lease_move_out_inspection_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inspection_id uuid NOT NULL REFERENCES lease_move_out_inspections(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL CHECK (event_type IN ('submitted','approved','rejected')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lease_move_out_inspection_events_history_idx
  ON lease_move_out_inspection_events(inspection_id,created_at,id);

CREATE TABLE lease_move_out_inspection_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES lease_move_out_inspections(id),
  storage_key uuid NOT NULL UNIQUE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime text NOT NULL CHECK (mime IN ('application/pdf','image/jpeg','image/png')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lease_move_out_inspection_evidence_history_idx
  ON lease_move_out_inspection_evidence(inspection_id,created_at,id);

CREATE OR REPLACE FUNCTION prevent_lease_move_out_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Lease move-out inspection evidence is append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER lease_move_out_events_immutable
  BEFORE UPDATE OR DELETE ON lease_move_out_inspection_events
  FOR EACH ROW EXECUTE FUNCTION prevent_lease_move_out_history_mutation();
CREATE TRIGGER lease_move_out_evidence_immutable
  BEFORE UPDATE OR DELETE ON lease_move_out_inspection_evidence
  FOR EACH ROW EXECUTE FUNCTION prevent_lease_move_out_history_mutation();

CREATE OR REPLACE FUNCTION guard_lease_move_out_inspection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE actor uuid := app_user_id();
DECLARE lease_row leases%ROWTYPE;
DECLARE collected_deposit numeric(14,2);
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT * INTO lease_row FROM leases WHERE id=NEW.lease_id;
    IF actor IS NULL OR NEW.submitted_by IS DISTINCT FROM actor
      OR NEW.status<>'pending_review' OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
      OR NEW.review_note IS NOT NULL
      OR NOT app_has_permission('property.tenancy.manage')
      OR lease_row.id IS NULL OR lease_row.status<>'active'
      OR NOT app_can_access_agent(lease_row.source_agent_id)
      OR NEW.actual_vacated_on<lease_row.start_date
      OR NEW.actual_vacated_on>current_date
      OR NEW.inspected_on>current_date THEN
      RAISE EXCEPTION 'Move-out inspections require an authorized manager and an active lease'
        USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW)-'status'-'reviewed_by'-'reviewed_at'-'review_note')
     <> (to_jsonb(OLD)-'status'-'reviewed_by'-'reviewed_at'-'review_note') THEN
    RAISE EXCEPTION 'Submitted move-out inspection details are immutable' USING ERRCODE='42501';
  END IF;

  IF OLD.status='pending_review' AND NEW.status IN ('approved','rejected') THEN
    IF actor IS NULL OR actor=OLD.submitted_by
      OR NOT app_has_permission('property.tenancy.approve')
      OR NEW.reviewed_by IS DISTINCT FROM actor OR NEW.reviewed_at IS NULL
      OR length(trim(COALESCE(NEW.review_note,'')))<10 THEN
      RAISE EXCEPTION 'Move-out inspection review requires an independent authorized reviewer and reason'
        USING ERRCODE='42501';
    END IF;
    IF NEW.status='approved' THEN
      SELECT * INTO lease_row FROM leases WHERE id=OLD.lease_id FOR UPDATE;
      IF lease_row.status<>'active' THEN
        RAISE EXCEPTION 'Only an active lease can have an approved move-out inspection'
          USING ERRCODE='23514';
      END IF;
      SELECT COALESCE(sum(amount),0) INTO collected_deposit
      FROM rent_transactions
      WHERE lease_id=OLD.lease_id AND kind='deposit' AND status='reconciled';
      IF NEW.deposit_deduction>collected_deposit THEN
        RAISE EXCEPTION 'Proposed deposit deductions exceed the reconciled deposit'
          USING ERRCODE='23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Move-out inspection transition is not permitted' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER lease_move_out_inspection_guard
  BEFORE INSERT OR UPDATE ON lease_move_out_inspections
  FOR EACH ROW EXECUTE FUNCTION guard_lease_move_out_inspection();

CREATE OR REPLACE FUNCTION require_approved_move_out_before_lease_end()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status='ended' AND OLD.status<>'ended' AND NOT EXISTS (
    SELECT 1 FROM lease_move_out_inspections inspection
    WHERE inspection.lease_id=NEW.id AND inspection.status='approved'
      AND inspection.actual_vacated_on=NEW.ended_on
  ) THEN
    RAISE EXCEPTION 'A reviewed move-out inspection matching the lease end date is required'
      USING ERRCODE='23514';
  END IF;
  IF NEW.status='ended' AND OLD.status<>'ended'
    AND (NEW.ended_on IS NULL OR NEW.ended_on>current_date
      OR NEW.ended_on<NEW.start_date
      OR length(trim(COALESCE(NEW.termination_reason,'')))<10) THEN
    RAISE EXCEPTION 'Lease closeout requires a valid end date and documented reason'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER lease_end_requires_move_out_review
  BEFORE UPDATE OF status ON leases
  FOR EACH ROW EXECUTE FUNCTION require_approved_move_out_before_lease_end();

ALTER TABLE lease_move_out_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_move_out_inspections FORCE ROW LEVEL SECURITY;
CREATE POLICY lease_move_out_inspection_read ON lease_move_out_inspections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM leases lease WHERE lease.id=lease_id AND (
      app_can_access_agent(lease.source_agent_id)
      OR app_has_permission('property.tenancy.approve')
      OR app_has_permission('property.tenancy.execute')
      OR EXISTS (
        SELECT 1 FROM property_tenant_account_links link
        WHERE link.tenant_id=lease.tenant_id AND link.user_id=app_user_id() AND link.revoked_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM property_units unit JOIN properties property ON property.id=unit.property_id
        WHERE unit.id=lease.unit_id AND property.owner_user_id=app_user_id()
      )
    )
  ));
CREATE POLICY lease_move_out_inspection_insert ON lease_move_out_inspections FOR INSERT
  WITH CHECK (
    submitted_by=app_user_id()
    AND app_has_permission('property.tenancy.manage')
    AND EXISTS (SELECT 1 FROM leases lease WHERE lease.id=lease_id AND app_can_access_agent(lease.source_agent_id))
  );
CREATE POLICY lease_move_out_inspection_update ON lease_move_out_inspections FOR UPDATE
  USING (app_has_permission('property.tenancy.approve'))
  WITH CHECK (app_has_permission('property.tenancy.approve'));

ALTER TABLE lease_move_out_inspection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_move_out_inspection_events FORCE ROW LEVEL SECURITY;
CREATE POLICY lease_move_out_events_read ON lease_move_out_inspection_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM lease_move_out_inspections inspection WHERE inspection.id=inspection_id));
CREATE POLICY lease_move_out_events_insert ON lease_move_out_inspection_events FOR INSERT
  WITH CHECK (
    actor_id=app_user_id()
    AND EXISTS (SELECT 1 FROM lease_move_out_inspections inspection WHERE inspection.id=inspection_id)
  );

ALTER TABLE lease_move_out_inspection_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_move_out_inspection_evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY lease_move_out_evidence_read ON lease_move_out_inspection_evidence FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM lease_move_out_inspections inspection
    WHERE inspection.id=inspection_id
  ));
CREATE POLICY lease_move_out_evidence_insert ON lease_move_out_inspection_evidence FOR INSERT
  WITH CHECK (
    uploaded_by=app_user_id()
    AND EXISTS (
      SELECT 1 FROM lease_move_out_inspections inspection
      JOIN leases lease ON lease.id=inspection.lease_id
      WHERE inspection.id=inspection_id AND inspection.status='pending_review'
        AND lease.status='active' AND app_can_access_agent(lease.source_agent_id)
    )
  );

GRANT SELECT,INSERT,UPDATE ON lease_move_out_inspections TO "{{role}}";
GRANT SELECT,INSERT ON lease_move_out_inspection_events TO "{{role}}";
GRANT USAGE,SELECT ON SEQUENCE lease_move_out_inspection_events_id_seq TO "{{role}}";
GRANT SELECT,INSERT ON lease_move_out_inspection_evidence TO "{{role}}";
REVOKE ALL ON FUNCTION prevent_lease_move_out_history_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION guard_lease_move_out_inspection() FROM PUBLIC;
REVOKE ALL ON FUNCTION require_approved_move_out_before_lease_end() FROM PUBLIC;
