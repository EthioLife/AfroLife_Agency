CREATE OR REPLACE FUNCTION app_worker_owns_phone(target_phone text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT app_role() = 'worker'
    AND EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = app_user_id() AND u.phone = target_phone
    )
$$;
REVOKE ALL ON FUNCTION app_worker_owns_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_worker_owns_phone(text) TO "{{role}}";

DROP POLICY workforce_worker_self_read ON workers;
CREATE POLICY workforce_worker_self_read ON workers
  FOR SELECT USING (app_worker_owns_phone(phone));

DROP POLICY staffing_work_period_worker_read ON staffing_work_periods;
CREATE POLICY staffing_work_period_worker_read ON staffing_work_periods
  FOR SELECT USING (
    app_role() = 'worker'
    AND EXISTS (
      SELECT 1
      FROM staffing_engagements e
      JOIN workers w ON w.id = e.worker_id
      WHERE e.id = engagement_id AND app_worker_owns_phone(w.phone)
    )
  );

DROP POLICY staffing_work_period_worker_submit ON staffing_work_periods;
CREATE POLICY staffing_work_period_worker_submit ON staffing_work_periods
  FOR INSERT WITH CHECK (
    app_role() = 'worker'
    AND recorded_by = app_user_id()
    AND EXISTS (
      SELECT 1
      FROM staffing_engagements e
      JOIN workers w ON w.id = e.worker_id
      WHERE e.id = engagement_id
        AND e.status = 'active'
        AND app_worker_owns_phone(w.phone)
    )
  );

DROP POLICY staffing_settlement_worker_read ON staffing_settlements;
CREATE POLICY staffing_settlement_worker_read ON staffing_settlements
  FOR SELECT USING (
    app_role() = 'worker'
    AND kind = 'worker_payment'
    AND EXISTS (
      SELECT 1
      FROM staffing_engagements e
      JOIN workers w ON w.id = e.worker_id
      WHERE e.id = engagement_id AND app_worker_owns_phone(w.phone)
    )
  );
