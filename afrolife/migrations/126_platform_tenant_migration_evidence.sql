-- Records external migration evidence only; no tenant database operations run here.
CREATE TABLE platform_tenant_migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform_tenants(id),
  created_by uuid NOT NULL REFERENCES users(id),
  source_reference text NOT NULL CHECK (
    length(trim(source_reference)) BETWEEN 2 AND 200
    AND source_reference !~* '(password|secret|token|credential|://|postgres(ql)?)'
  ),
  target_reference text NOT NULL CHECK (
    length(trim(target_reference)) BETWEEN 2 AND 200
    AND target_reference !~* '(password|secret|token|credential|://|postgres(ql)?)'
  ),
  summary text NOT NULL CHECK (
    length(trim(summary)) BETWEEN 10 AND 1000
    AND summary !~* '(password|secret|token|credential|://|postgres(ql)?)'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_reference<>target_reference)
);

CREATE TABLE platform_tenant_migration_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES platform_tenant_migration_runs(id),
  tenant_id uuid NOT NULL REFERENCES platform_tenants(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  stage text NOT NULL CHECK (stage IN (
    'planned','dry_run','staged','reconciled','cutover_approved','cutover_completed','aborted'
  )),
  manifest_sha256 text CHECK (manifest_sha256 IS NULL OR manifest_sha256 ~ '^[0-9a-f]{64}$'),
  source_record_count bigint CHECK (source_record_count IS NULL OR source_record_count>=0),
  staged_record_count bigint CHECK (staged_record_count IS NULL OR staged_record_count>=0),
  unresolved_count bigint NOT NULL DEFAULT 0 CHECK (unresolved_count>=0),
  validation_error_count bigint NOT NULL DEFAULT 0 CHECK (validation_error_count>=0),
  evidence_reference text NOT NULL CHECK (
    length(trim(evidence_reference)) BETWEEN 2 AND 200
    AND evidence_reference !~* '(password|secret|token|credential|://|postgres(ql)?)'
  ),
  notes text NOT NULL CHECK (
    length(trim(notes)) BETWEEN 10 AND 1000
    AND notes !~* '(password|secret|token|credential|://|postgres(ql)?)'
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_tenant_migration_events_latest_idx
  ON platform_tenant_migration_events(run_id,id DESC);

CREATE OR REPLACE FUNCTION guard_platform_tenant_migration_run()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE tenant_status text;
BEGIN
  IF NEW.created_by IS DISTINCT FROM app_user_id() THEN
    RAISE EXCEPTION 'Migration plans must be created by the authenticated actor'
      USING ERRCODE='42501';
  END IF;
  SELECT status INTO tenant_status
  FROM platform_tenants WHERE id=NEW.tenant_id FOR UPDATE;
  IF tenant_status IS DISTINCT FROM 'active'
    OR NOT EXISTS (
      SELECT 1 FROM platform_tenant_capability_grants grant_row
      WHERE grant_row.user_id=NEW.created_by AND grant_row.tenant_id=NEW.tenant_id
        AND grant_row.capability='database_admin'
    ) THEN
    RAISE EXCEPTION 'Migration plans require an active tenant and a database administrator assignment'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM platform_tenant_migration_runs run
    WHERE run.tenant_id=NEW.tenant_id
      AND COALESCE((
        SELECT event.stage FROM platform_tenant_migration_events event
        WHERE event.run_id=run.id ORDER BY event.id DESC LIMIT 1
      ),'planned') NOT IN ('cutover_completed','aborted')
  ) THEN
    RAISE EXCEPTION 'Another property-data migration is still active for this tenant'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_platform_tenant_migration_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE run_tenant uuid;
DECLARE run_creator uuid;
DECLARE previous_stage text;
DECLARE previous_actor uuid;
DECLARE previous_unresolved bigint;
DECLARE previous_errors bigint;
BEGIN
  IF NEW.actor_id IS DISTINCT FROM app_user_id() THEN
    RAISE EXCEPTION 'Migration evidence must be recorded by the authenticated actor'
      USING ERRCODE='42501';
  END IF;
  SELECT tenant_id,created_by INTO run_tenant,run_creator
  FROM platform_tenant_migration_runs WHERE id=NEW.run_id FOR UPDATE;
  IF run_tenant IS NULL OR NEW.tenant_id IS DISTINCT FROM run_tenant
    OR NOT EXISTS (
      SELECT 1 FROM platform_tenant_capability_grants grant_row
      JOIN platform_tenants tenant ON tenant.id=grant_row.tenant_id
      WHERE grant_row.user_id=NEW.actor_id AND grant_row.tenant_id=run_tenant
        AND grant_row.capability='database_admin' AND tenant.status='active'
    ) THEN
    RAISE EXCEPTION 'Migration evidence requires an active database administrator assignment for the same tenant'
      USING ERRCODE='42501';
  END IF;

  SELECT stage,actor_id,unresolved_count,validation_error_count
  INTO previous_stage,previous_actor,previous_unresolved,previous_errors
  FROM platform_tenant_migration_events
  WHERE run_id=NEW.run_id
  ORDER BY id DESC LIMIT 1;

  IF previous_stage IS NULL THEN
    IF NEW.stage<>'planned' OR NEW.actor_id IS DISTINCT FROM run_creator THEN
      RAISE EXCEPTION 'A migration run must begin with a plan from its creator'
        USING ERRCODE='23514';
    END IF;
  ELSIF (previous_stage='planned' AND NEW.stage='dry_run')
    OR (previous_stage='dry_run' AND NEW.stage='dry_run')
    OR (previous_stage='dry_run' AND NEW.stage='staged'
      AND previous_unresolved=0 AND previous_errors=0)
    OR (previous_stage='staged' AND NEW.stage='staged')
    OR (previous_stage='staged' AND NEW.stage='reconciled')
    OR (previous_stage='reconciled' AND NEW.stage='cutover_approved'
      AND NEW.actor_id IS DISTINCT FROM run_creator
      AND NEW.actor_id IS DISTINCT FROM previous_actor
      AND previous_unresolved=0 AND previous_errors=0
      AND NEW.unresolved_count=0 AND NEW.validation_error_count=0)
    OR (previous_stage='reconciled' AND NEW.stage='reconciled')
    OR (previous_stage='cutover_approved' AND NEW.stage='cutover_completed'
      AND NEW.actor_id IS DISTINCT FROM run_creator
      AND NEW.actor_id IS DISTINCT FROM previous_actor
      AND NEW.unresolved_count=0 AND NEW.validation_error_count=0)
    OR (previous_stage IN ('planned','dry_run','staged','reconciled') AND NEW.stage='aborted') THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Migration evidence stage transition is not permitted'
      USING ERRCODE='23514';
  END IF;

  IF NEW.stage IN ('planned','dry_run','staged','reconciled','cutover_completed')
    AND NEW.manifest_sha256 IS NULL THEN
    RAISE EXCEPTION 'This migration stage requires a verified manifest SHA-256'
      USING ERRCODE='23514';
  END IF;
  IF NEW.stage IN ('dry_run','staged','reconciled')
    AND (NEW.source_record_count IS NULL OR NEW.staged_record_count IS NULL) THEN
    RAISE EXCEPTION 'Dry-run, staging, and reconciliation evidence require source and staged record counts'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER platform_tenant_migration_events_guard
  BEFORE INSERT ON platform_tenant_migration_events
  FOR EACH ROW EXECUTE FUNCTION guard_platform_tenant_migration_event();
CREATE TRIGGER platform_tenant_migration_runs_guard
  BEFORE INSERT ON platform_tenant_migration_runs
  FOR EACH ROW EXECUTE FUNCTION guard_platform_tenant_migration_run();
CREATE TRIGGER platform_tenant_migration_events_immutable
  BEFORE UPDATE OR DELETE ON platform_tenant_migration_events
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();
CREATE TRIGGER platform_tenant_migration_runs_immutable
  BEFORE UPDATE OR DELETE ON platform_tenant_migration_runs
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_control_event_mutation();

REVOKE ALL ON FUNCTION guard_platform_tenant_migration_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION guard_platform_tenant_migration_run() FROM PUBLIC;

ALTER TABLE platform_tenant_migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_tenant_migration_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_tenant_migration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_tenant_migration_events FORCE ROW LEVEL SECURITY;

CREATE POLICY platform_tenant_migration_runs_read ON platform_tenant_migration_runs
  FOR SELECT USING (
    app_role()='global_admin'
    OR EXISTS (
      SELECT 1 FROM platform_tenant_capability_grants grant_row
      JOIN platform_tenants tenant ON tenant.id=grant_row.tenant_id
      WHERE grant_row.user_id=app_user_id()
        AND grant_row.tenant_id=platform_tenant_migration_runs.tenant_id
        AND grant_row.capability='database_admin' AND tenant.status='active'
    )
  );
CREATE POLICY platform_tenant_migration_runs_create ON platform_tenant_migration_runs
  FOR INSERT WITH CHECK (
    created_by=app_user_id()
    AND EXISTS (
      SELECT 1 FROM platform_tenant_capability_grants grant_row
      JOIN platform_tenants tenant ON tenant.id=grant_row.tenant_id
      WHERE grant_row.user_id=app_user_id()
        AND grant_row.tenant_id=platform_tenant_migration_runs.tenant_id
        AND grant_row.capability='database_admin' AND tenant.status='active'
    )
  );
CREATE POLICY platform_tenant_migration_events_read ON platform_tenant_migration_events
  FOR SELECT USING (
    app_role()='global_admin'
    OR EXISTS (
      SELECT 1 FROM platform_tenant_capability_grants grant_row
      JOIN platform_tenants tenant ON tenant.id=grant_row.tenant_id
      WHERE grant_row.user_id=app_user_id()
        AND grant_row.tenant_id=platform_tenant_migration_events.tenant_id
        AND grant_row.capability='database_admin' AND tenant.status='active'
    )
  );
CREATE POLICY platform_tenant_migration_events_create ON platform_tenant_migration_events
  FOR INSERT WITH CHECK (
    actor_id=app_user_id()
    AND EXISTS (
      SELECT 1 FROM platform_tenant_capability_grants grant_row
      JOIN platform_tenants tenant ON tenant.id=grant_row.tenant_id
      WHERE grant_row.user_id=app_user_id()
        AND grant_row.tenant_id=platform_tenant_migration_events.tenant_id
        AND grant_row.capability='database_admin' AND tenant.status='active'
    )
  );

GRANT SELECT,INSERT ON platform_tenant_migration_runs,platform_tenant_migration_events TO "{{role}}";
GRANT USAGE,SELECT ON SEQUENCE platform_tenant_migration_events_id_seq TO "{{role}}";
