CREATE OR REPLACE FUNCTION set_property_operating_tenant_status(
  target_tenant uuid,
  next_status text,
  change_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE previous_status text;
DECLARE latest_export uuid;
BEGIN
  IF app_role() IS DISTINCT FROM 'global_admin' OR actor IS NULL OR target_tenant IS NULL
    OR next_status IS NULL OR next_status NOT IN ('active','suspended','offboarding','closed')
    OR change_reason IS NULL OR length(trim(change_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Tenant lifecycle changes require a Global Admin and documented reason'
      USING ERRCODE='42501';
  END IF;
  SELECT status INTO previous_status FROM property_operating_tenants
  WHERE id=target_tenant FOR UPDATE;
  IF previous_status IS NULL OR NOT (
    (previous_status='active' AND next_status IN ('suspended','offboarding'))
    OR (previous_status='suspended' AND next_status IN ('active','offboarding'))
    OR (previous_status='offboarding' AND next_status='closed')
  ) THEN
    RAISE EXCEPTION 'Property tenant lifecycle transition is not permitted'
      USING ERRCODE='23514';
  END IF;
  IF next_status IN ('offboarding','closed') THEN
    SELECT request.id INTO latest_export
    FROM property_tenant_export_requests request
    WHERE request.tenant_system_id=target_tenant
    ORDER BY request.request_sequence DESC
    LIMIT 1;
    IF latest_export IS NULL OR NOT EXISTS (
      SELECT 1 FROM property_tenant_export_events event
      WHERE event.export_request_id=latest_export
        AND event.tenant_system_id=target_tenant
        AND event.decision='verified'
    ) THEN
      RAISE EXCEPTION 'Tenant offboarding requires an independently verified export for the latest archive request'
        USING ERRCODE='23514';
    END IF;
  END IF;
  UPDATE property_operating_tenants SET status=next_status,updated_at=now()
  WHERE id=target_tenant;
  IF next_status IN ('suspended','offboarding','closed') THEN
    UPDATE property_operating_tenant_support_grants
    SET status='revoked'
    WHERE tenant_system_id=target_tenant AND status='active';
  END IF;
  INSERT INTO property_operating_tenant_events(tenant_system_id,actor_id,event_type,event_data)
  VALUES(target_tenant,actor,'tenant_status_changed',
    jsonb_build_object('from_status',previous_status,'to_status',next_status,'reason',trim(change_reason)));
END;
$$;

CREATE OR REPLACE FUNCTION decide_property_tenant_export(
  target_tenant uuid,
  target_export uuid,
  decision text,
  decision_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := app_user_id();
DECLARE requester uuid;
DECLARE tenant_status text;
BEGIN
  IF app_role() IS DISTINCT FROM 'global_admin' OR actor IS NULL
    OR target_tenant IS NULL OR target_export IS NULL
    OR decision IS NULL OR decision NOT IN ('verified','rejected')
    OR decision_reason IS NULL OR length(trim(decision_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Export verification requires a Global Admin, a valid decision, and documented evidence review'
      USING ERRCODE='42501';
  END IF;
  SELECT tenant.status INTO tenant_status
  FROM property_operating_tenants tenant
  WHERE tenant.id=target_tenant
  FOR UPDATE;
  IF tenant_status IS NULL OR tenant_status NOT IN ('active','suspended') THEN
    RAISE EXCEPTION 'Export review must be for an active or suspended tenant'
      USING ERRCODE='23514';
  END IF;
  SELECT request.requested_by INTO requester
  FROM property_tenant_export_requests request
  WHERE request.id=target_export AND request.tenant_system_id=target_tenant
  FOR UPDATE;
  IF requester IS NULL OR requester=actor OR EXISTS (
    SELECT 1 FROM property_tenant_export_events event
    WHERE event.export_request_id=target_export
  ) THEN
    RAISE EXCEPTION 'Export review must be independent and pending'
      USING ERRCODE='23514';
  END IF;
  INSERT INTO property_tenant_export_events(
    tenant_system_id,export_request_id,actor_id,decision,reason
  ) VALUES(target_tenant,target_export,actor,decision,trim(decision_reason));
END;
$$;
