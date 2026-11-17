CREATE TABLE property_association_amenity_reservations (
  reservation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_system_id uuid NOT NULL,
  association_id uuid NOT NULL,
  property_id uuid NOT NULL,
  amenity_name text NOT NULL CHECK (length(trim(amenity_name)) BETWEEN 2 AND 120),
  requester_user_id uuid NOT NULL REFERENCES users(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  decision_by uuid REFERENCES users(id),
  decision_reason text,
  decided_at timestamptz,
  cancelled_by uuid REFERENCES users(id),
  cancel_reason text,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_system_id,reservation_id),
  CHECK (ends_at>starts_at),
  CHECK (ends_at-starts_at<=interval '24 hours'),
  CHECK (
    (status='pending' AND decision_by IS NULL AND decision_reason IS NULL AND decided_at IS NULL
      AND cancelled_by IS NULL AND cancel_reason IS NULL AND cancelled_at IS NULL)
    OR (status IN ('approved','rejected') AND decision_by IS NOT NULL
      AND decision_reason IS NOT NULL AND length(trim(decision_reason)) BETWEEN 10 AND 1000
      AND decided_at IS NOT NULL AND cancelled_by IS NULL AND cancel_reason IS NULL AND cancelled_at IS NULL)
    OR (status='cancelled' AND cancelled_by IS NOT NULL
      AND cancel_reason IS NOT NULL AND length(trim(cancel_reason)) BETWEEN 10 AND 1000
      AND cancelled_at IS NOT NULL
      AND (decision_by IS NULL OR (decision_reason IS NOT NULL
        AND length(trim(decision_reason)) BETWEEN 10 AND 1000 AND decided_at IS NOT NULL)))
  ),
  CHECK (decision_by IS NULL OR decision_by<>requester_user_id),
  FOREIGN KEY (tenant_system_id,association_id,property_id)
    REFERENCES property_association_properties(tenant_system_id,association_id,property_id)
    ON DELETE RESTRICT
);
CREATE INDEX property_association_amenity_reservations_schedule_idx
  ON property_association_amenity_reservations(
    tenant_system_id,property_id,lower(amenity_name),starts_at,ends_at
  ) WHERE status='approved';
CREATE INDEX property_association_amenity_reservations_requester_idx
  ON property_association_amenity_reservations(tenant_system_id,requester_user_id,created_at DESC);

DROP POLICY IF EXISTS property_associations_scoped_read ON property_associations;
CREATE POLICY property_associations_scoped_read
  ON property_associations FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND EXISTS (
      SELECT 1 FROM property_association_properties association_property
      WHERE association_property.tenant_system_id=property_associations.tenant_system_id
        AND association_property.association_id=property_associations.id
        AND (
          app_property_association_can_view(
            association_property.tenant_system_id,association_property.property_id
          )
          OR app_property_agent_can_manage(
            association_property.tenant_system_id,association_property.property_id
          )
        )
    )
  );
DROP POLICY IF EXISTS property_association_properties_scoped_read ON property_association_properties;
CREATE POLICY property_association_properties_scoped_read
  ON property_association_properties FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND (
      app_property_association_can_view(tenant_system_id,property_id)
      OR app_property_agent_can_manage(tenant_system_id,property_id)
    )
  );
DROP POLICY IF EXISTS property_association_amenity_policies_scoped_read
  ON property_association_amenity_policies;
CREATE POLICY property_association_amenity_policies_scoped_read
  ON property_association_amenity_policies FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND (
      app_property_association_can_view(tenant_system_id,property_id)
      OR app_property_agent_can_manage(tenant_system_id,property_id)
    )
  );

CREATE TABLE property_association_amenity_reservation_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_system_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL CHECK (
    event_type IN ('reservation_requested','reservation_approved','reservation_rejected','reservation_cancelled')
  ),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_system_id,reservation_id)
    REFERENCES property_association_amenity_reservations(tenant_system_id,reservation_id)
    ON DELETE RESTRICT
);
CREATE INDEX property_association_amenity_reservation_events_history_idx
  ON property_association_amenity_reservation_events(tenant_system_id,reservation_id,event_id);
CREATE TRIGGER property_association_amenity_reservation_events_immutable
  BEFORE UPDATE OR DELETE ON property_association_amenity_reservation_events
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

CREATE OR REPLACE FUNCTION guard_property_association_amenity_reservation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE actor uuid := app_user_id();
BEGIN
  IF NEW.reservation_id IS DISTINCT FROM OLD.reservation_id
    OR NEW.tenant_system_id IS DISTINCT FROM OLD.tenant_system_id
    OR NEW.association_id IS DISTINCT FROM OLD.association_id
    OR NEW.property_id IS DISTINCT FROM OLD.property_id
    OR NEW.amenity_name IS DISTINCT FROM OLD.amenity_name
    OR NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id
    OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
    OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Reservation requests are immutable; submit a new request to change a time'
      USING ERRCODE='42501';
  END IF;

  IF OLD.status='pending' AND NEW.status IN ('approved','rejected')
    AND NEW.decision_by=actor
    AND actor<>OLD.requester_user_id
    AND NEW.decision_reason IS NOT NULL
    AND length(trim(NEW.decision_reason)) BETWEEN 10 AND 1000
    AND NEW.decided_at IS NOT NULL
    AND NEW.cancelled_by IS NULL AND NEW.cancel_reason IS NULL AND NEW.cancelled_at IS NULL
    AND app_property_agent_can_manage(OLD.tenant_system_id,OLD.property_id) THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('pending','approved') AND NEW.status='cancelled'
    AND NEW.cancelled_by=actor
    AND NEW.cancel_reason IS NOT NULL
    AND length(trim(NEW.cancel_reason)) BETWEEN 10 AND 1000
    AND NEW.cancelled_at IS NOT NULL
    AND (actor=OLD.requester_user_id
      OR app_property_agent_can_manage(OLD.tenant_system_id,OLD.property_id)) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Reservation status changes require an authorized decision or documented cancellation'
    USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER property_association_amenity_reservations_update_guard
  BEFORE UPDATE ON property_association_amenity_reservations
  FOR EACH ROW EXECUTE FUNCTION guard_property_association_amenity_reservation_update();
CREATE TRIGGER property_association_amenity_reservations_immutable
  BEFORE DELETE ON property_association_amenity_reservations
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

ALTER TABLE property_association_amenity_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_amenity_reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_amenity_reservations_scoped_read
  ON property_association_amenity_reservations FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND (
      app_property_association_can_view(tenant_system_id,property_id)
      OR app_property_agent_can_manage(tenant_system_id,property_id)
    )
    AND (status='approved' OR requester_user_id=app_user_id()
      OR app_property_agent_can_manage(tenant_system_id,property_id))
  );
CREATE POLICY property_association_amenity_reservations_command_insert
  ON property_association_amenity_reservations FOR INSERT
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND requester_user_id=app_user_id()
    AND status='pending'
    AND decision_by IS NULL AND decided_at IS NULL
    AND cancelled_by IS NULL AND cancelled_at IS NULL
    AND app_property_association_can_view(tenant_system_id,property_id)
    AND EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=property_association_amenity_reservations.tenant_system_id
        AND member.user_id=app_user_id()
        AND member.status='active'
        AND member.tenant_role IN ('owner','resident')
    )
  );
CREATE POLICY property_association_amenity_reservations_command_update
  ON property_association_amenity_reservations FOR UPDATE
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND (requester_user_id=app_user_id()
      OR app_property_agent_can_manage(tenant_system_id,property_id))
  )
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND (requester_user_id=app_user_id()
      OR app_property_agent_can_manage(tenant_system_id,property_id))
  );
REVOKE ALL ON TABLE property_association_amenity_reservations FROM PUBLIC,"{{role}}";
GRANT SELECT ON TABLE property_association_amenity_reservations TO "{{role}}";

ALTER TABLE property_association_amenity_reservation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_association_amenity_reservation_events FORCE ROW LEVEL SECURITY;
CREATE POLICY property_association_amenity_reservation_events_scoped_read
  ON property_association_amenity_reservation_events FOR SELECT
  USING (
    tenant_system_id=app_property_tenant_system_id()
    AND EXISTS (
      SELECT 1 FROM property_association_amenity_reservations reservation
      WHERE reservation.tenant_system_id=property_association_amenity_reservation_events.tenant_system_id
        AND reservation.reservation_id=property_association_amenity_reservation_events.reservation_id
        AND (
          app_property_association_can_view(reservation.tenant_system_id,reservation.property_id)
          OR app_property_agent_can_manage(reservation.tenant_system_id,reservation.property_id)
        )
        AND (reservation.status='approved' OR reservation.requester_user_id=app_user_id()
          OR app_property_agent_can_manage(reservation.tenant_system_id,reservation.property_id))
    )
  );
CREATE POLICY property_association_amenity_reservation_events_command_insert
  ON property_association_amenity_reservation_events FOR INSERT
  WITH CHECK (
    tenant_system_id=app_property_tenant_system_id()
    AND actor_id=app_user_id()
    AND EXISTS (
      SELECT 1 FROM property_association_amenity_reservations reservation
      WHERE reservation.tenant_system_id=property_association_amenity_reservation_events.tenant_system_id
        AND reservation.reservation_id=property_association_amenity_reservation_events.reservation_id
        AND (
          (event_type='reservation_requested'
            AND reservation.requester_user_id=app_user_id()
            AND reservation.status IN ('pending','cancelled'))
          OR (event_type IN ('reservation_approved','reservation_rejected')
            AND reservation.decision_by=app_user_id())
          OR (event_type='reservation_cancelled'
            AND reservation.cancelled_by=app_user_id())
        )
    )
  );
REVOKE ALL ON TABLE property_association_amenity_reservation_events FROM PUBLIC,"{{role}}";
GRANT SELECT ON TABLE property_association_amenity_reservation_events TO "{{role}}";

CREATE OR REPLACE FUNCTION create_property_association_amenity_reservation(
  target_association uuid,
  target_property uuid,
  target_amenity_name text,
  target_starts_at timestamptz,
  target_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  reservation uuid;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL OR target_association IS NULL OR target_property IS NULL
    OR target_amenity_name IS NULL OR length(trim(target_amenity_name)) NOT BETWEEN 2 AND 120
    OR target_starts_at IS NULL OR target_ends_at IS NULL
    OR target_ends_at<=target_starts_at OR target_starts_at<=now()
    OR target_starts_at>now()+interval '8760 hours'
    OR NOT EXISTS (
      SELECT 1 FROM property_operating_tenant_members member
      WHERE member.tenant_system_id=tenant_id AND member.user_id=actor
        AND member.status='active' AND member.tenant_role IN ('owner','resident')
    )
    OR NOT app_property_association_can_view(tenant_id,target_property)
    OR NOT EXISTS (
      SELECT 1 FROM property_associations association
      JOIN property_association_properties association_property
        ON association_property.tenant_system_id=association.tenant_system_id
       AND association_property.association_id=association.id
      JOIN property_association_amenity_policies policy
        ON policy.tenant_system_id=association_property.tenant_system_id
       AND policy.association_id=association_property.association_id
       AND policy.property_id=association_property.property_id
      WHERE association.tenant_system_id=tenant_id
        AND association.id=target_association AND association.status='active'
        AND association_property.property_id=target_property
        AND policy.status='active'
        AND lower(trim(policy.amenity_name))=lower(trim(target_amenity_name))
        AND NOT EXISTS (
          SELECT 1 FROM property_association_amenity_policies newer
          WHERE newer.tenant_system_id=policy.tenant_system_id
            AND newer.association_id=policy.association_id
            AND newer.property_id=policy.property_id
            AND lower(trim(newer.amenity_name))=lower(trim(policy.amenity_name))
            AND newer.policy_version>policy.policy_version
        )
    ) THEN
    RAISE EXCEPTION 'An active linked owner or resident, property, and amenity policy are required'
      USING ERRCODE='42501';
  END IF;

  INSERT INTO property_association_amenity_reservations(
    tenant_system_id,association_id,property_id,amenity_name,requester_user_id,starts_at,ends_at
  ) VALUES (
    tenant_id,target_association,target_property,trim(target_amenity_name),actor,target_starts_at,target_ends_at
  ) RETURNING reservation_id INTO reservation;

  INSERT INTO property_association_amenity_reservation_events(
    tenant_system_id,reservation_id,actor_id,event_type,reason
  ) VALUES (
    tenant_id,reservation,actor,'reservation_requested','Reservation request submitted for review.'
  );
  RETURN reservation;
END;
$$;
REVOKE ALL ON FUNCTION create_property_association_amenity_reservation(uuid,uuid,text,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_property_association_amenity_reservation(uuid,uuid,text,timestamptz,timestamptz) TO "{{role}}";

CREATE OR REPLACE FUNCTION decide_property_association_amenity_reservation(
  target_reservation uuid,
  decision text,
  decision_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  reservation property_association_amenity_reservations%ROWTYPE;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL OR decision IS NULL
    OR decision NOT IN ('approved','rejected') OR decision_reason IS NULL
    OR length(trim(decision_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'A valid reservation decision and documented reason are required'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO reservation
  FROM property_association_amenity_reservations
  WHERE tenant_system_id=tenant_id AND reservation_id=target_reservation
  FOR UPDATE;
  IF reservation.reservation_id IS NULL OR reservation.status<>'pending'
    OR reservation.requester_user_id=actor
    OR NOT app_property_agent_can_manage(tenant_id,reservation.property_id) THEN
    RAISE EXCEPTION 'Only an independent tenant administrator or scoped property manager may decide a pending request'
      USING ERRCODE='42501';
  END IF;

  IF decision='approved' THEN
    IF reservation.starts_at<=now() THEN
      RAISE EXCEPTION 'A reservation cannot be approved after its start time'
        USING ERRCODE='23514';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(
      tenant_id::text||':'||reservation.property_id::text||':'||lower(reservation.amenity_name),0
    ));
    IF EXISTS (
      SELECT 1 FROM property_association_amenity_reservations existing
      WHERE existing.tenant_system_id=tenant_id
        AND existing.property_id=reservation.property_id
        AND lower(existing.amenity_name)=lower(reservation.amenity_name)
        AND existing.status='approved'
        AND existing.reservation_id<>reservation.reservation_id
        AND existing.starts_at<reservation.ends_at
        AND existing.ends_at>reservation.starts_at
    ) THEN
      RAISE EXCEPTION 'This amenity already has an approved reservation during that time'
        USING ERRCODE='23P01';
    END IF;
  END IF;

  UPDATE property_association_amenity_reservations
  SET status=decision,decision_by=actor,decision_reason=trim(decision_reason),decided_at=now(),updated_at=now()
  WHERE tenant_system_id=tenant_id AND reservation_id=reservation.reservation_id;

  INSERT INTO property_association_amenity_reservation_events(
    tenant_system_id,reservation_id,actor_id,event_type,reason
  ) VALUES (
    tenant_id,reservation.reservation_id,actor,
    CASE WHEN decision='approved' THEN 'reservation_approved' ELSE 'reservation_rejected' END,
    trim(decision_reason)
  );
END;
$$;
REVOKE ALL ON FUNCTION decide_property_association_amenity_reservation(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decide_property_association_amenity_reservation(uuid,text,text) TO "{{role}}";

CREATE OR REPLACE FUNCTION cancel_property_association_amenity_reservation(
  target_reservation uuid,
  cancellation_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := app_user_id();
  tenant_id uuid := app_property_tenant_system_id();
  reservation property_association_amenity_reservations%ROWTYPE;
BEGIN
  IF actor IS NULL OR tenant_id IS NULL OR cancellation_reason IS NULL
    OR length(trim(cancellation_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'A documented reservation cancellation reason is required'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO reservation
  FROM property_association_amenity_reservations
  WHERE tenant_system_id=tenant_id AND reservation_id=target_reservation
  FOR UPDATE;
  IF reservation.reservation_id IS NULL OR reservation.status NOT IN ('pending','approved')
    OR (reservation.requester_user_id<>actor
      AND NOT app_property_agent_can_manage(tenant_id,reservation.property_id)) THEN
    RAISE EXCEPTION 'Only the requester or an authorized property manager may cancel a pending or approved reservation'
      USING ERRCODE='42501';
  END IF;

  UPDATE property_association_amenity_reservations
  SET status='cancelled',cancelled_by=actor,cancel_reason=trim(cancellation_reason),
      cancelled_at=now(),updated_at=now()
  WHERE tenant_system_id=tenant_id AND reservation_id=reservation.reservation_id;

  INSERT INTO property_association_amenity_reservation_events(
    tenant_system_id,reservation_id,actor_id,event_type,reason
  ) VALUES (
    tenant_id,reservation.reservation_id,actor,'reservation_cancelled',trim(cancellation_reason)
  );
END;
$$;
REVOKE ALL ON FUNCTION cancel_property_association_amenity_reservation(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_property_association_amenity_reservation(uuid,text) TO "{{role}}";
