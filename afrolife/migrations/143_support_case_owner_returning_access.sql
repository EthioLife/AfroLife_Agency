DROP POLICY support_cases_authorized_read ON support_cases;
CREATE POLICY support_cases_authorized_read ON support_cases
  FOR SELECT USING (
    user_id = app_user_id()
    OR app_support_case_can_access(id)
  );
