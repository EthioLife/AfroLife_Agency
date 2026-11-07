ALTER TABLE property_units
  DROP CONSTRAINT property_units_occupancy_check,
  ADD CONSTRAINT property_units_occupancy_check
    CHECK (occupancy IN ('vacant','occupied','maintenance','turnover'));

CREATE TABLE property_unit_turnover_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_id uuid NOT NULL REFERENCES property_units(id),
  completed_by uuid NOT NULL REFERENCES users(id),
  completion_note text NOT NULL CHECK (length(trim(completion_note)) BETWEEN 10 AND 1000),
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_unit_turnover_events_history_idx
  ON property_unit_turnover_events(unit_id,completed_at,id);

ALTER TABLE property_unit_turnover_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_unit_turnover_events FORCE ROW LEVEL SECURITY;
CREATE POLICY property_unit_turnover_events_read ON property_unit_turnover_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM property_units unit
    JOIN properties property ON property.id=unit.property_id
    WHERE unit.id=unit_id AND (
      app_can_access_agent(property.source_agent_id)
      OR property.owner_user_id=app_user_id()
      OR app_role() IN ('global_admin','super_admin','corporate_business_manager')
    )
  ));
CREATE POLICY property_unit_turnover_events_insert ON property_unit_turnover_events FOR INSERT
  WITH CHECK (
    completed_by=app_user_id()
    AND app_has_permission('property.maintenance.manage')
    AND EXISTS (
      SELECT 1 FROM property_units unit
      JOIN properties property ON property.id=unit.property_id
      WHERE unit.id=unit_id AND unit.occupancy='turnover'
        AND (app_can_access_agent(property.source_agent_id)
          OR property.owner_user_id=app_user_id()
          OR app_role() IN ('global_admin','super_admin','corporate_business_manager'))
    )
  );
GRANT SELECT ON property_unit_turnover_events TO "{{role}}";
GRANT USAGE,SELECT ON SEQUENCE property_unit_turnover_events_id_seq TO "{{role}}";

CREATE OR REPLACE FUNCTION guard_property_unit_turnover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE completion_note text;
DECLARE closeout_lease_id text;
BEGIN
  IF NEW.occupancy='turnover' AND OLD.occupancy IS DISTINCT FROM 'turnover' THEN
    closeout_lease_id := current_setting('app.unit_turnover_lease_id',true);
    IF OLD.occupancy<>'occupied'
      OR actor IS NULL
      OR NOT app_has_permission('property.tenancy.manage')
      OR NOT EXISTS (
        SELECT 1 FROM properties property
        WHERE property.id=NEW.property_id
          AND (app_can_access_agent(property.source_agent_id)
            OR property.owner_user_id=actor
            OR app_role() IN ('global_admin','super_admin','corporate_business_manager'))
      )
      OR NOT EXISTS (
        SELECT 1 FROM leases lease
        JOIN lease_move_out_inspections inspection ON inspection.lease_id=lease.id
        WHERE lease.id::text=closeout_lease_id AND lease.unit_id=OLD.id AND lease.status='ended'
          AND inspection.status='approved' AND inspection.actual_vacated_on=lease.ended_on
      ) THEN
      RAISE EXCEPTION 'A reviewed move-out inspection is required to place an occupied unit into turnover'
        USING ERRCODE='23514';
    END IF;
    IF EXISTS (SELECT 1 FROM leases lease WHERE lease.unit_id=OLD.id AND lease.status='active') THEN
      RAISE EXCEPTION 'A unit with an active lease cannot enter turnover'
        USING ERRCODE='23514';
    END IF;
  ELSIF OLD.occupancy='turnover' AND NEW.occupancy='vacant' THEN
    completion_note := current_setting('app.unit_turnover_completion_note',true);
    IF actor IS NULL OR NOT app_has_permission('property.maintenance.manage')
      OR length(trim(COALESCE(completion_note,''))) NOT BETWEEN 10 AND 1000
      OR NOT EXISTS (
        SELECT 1 FROM properties property
        WHERE property.id=NEW.property_id
          AND (app_can_access_agent(property.source_agent_id)
            OR property.owner_user_id=actor
            OR app_role() IN ('global_admin','super_admin','corporate_business_manager'))
      ) THEN
      RAISE EXCEPTION 'Unit turnover completion requires authorized access and a documented readiness note'
        USING ERRCODE='42501';
    END IF;
    INSERT INTO property_unit_turnover_events(unit_id,completed_by,completion_note)
    VALUES(NEW.id,actor,completion_note);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER property_unit_turnover_guard
  BEFORE UPDATE OF occupancy ON property_units
  FOR EACH ROW EXECUTE FUNCTION guard_property_unit_turnover();
REVOKE ALL ON FUNCTION guard_property_unit_turnover() FROM PUBLIC;
