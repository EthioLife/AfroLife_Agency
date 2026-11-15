DELETE FROM role_activity_defaults
WHERE role_name = 'field_agent'
  AND activity_key IN ('property.tenancy.manage','rent.payments.submit');
