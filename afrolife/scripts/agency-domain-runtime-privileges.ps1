function Set-AgencyDomainRuntimePrivileges([string]$Database, [string]$Role, [string]$Domain) {
  $tableGrants = @{
    'workforce-management' = @(
      'GRANT SELECT ON TABLE public.workers TO {0};'
      'GRANT INSERT (name, phone, national_id, sector, skills, languages, experience_years, rate_expected, availability, territory_id, source_agent_id) ON TABLE public.workers TO {0};'
      'GRANT UPDATE (verification) ON TABLE public.workers TO {0};'
      'GRANT SELECT ON TABLE public.documents TO {0};'
      'GRANT INSERT (worker_id, doc_type, storage_key, sha256, expires_on, mime, size_bytes) ON TABLE public.documents TO {0};'
      'GRANT UPDATE (status, reviewer_id, reviewed_at, review_note) ON TABLE public.documents TO {0};'
      'GRANT INSERT (actor_id, action, entity, entity_id, old_value, new_value) ON TABLE public.audit_logs TO {0};'
      'GRANT INSERT (user_id, channel, template, payload, status) ON TABLE public.notifications TO {0};'
    )
    staffing = @(
      'GRANT SELECT ON TABLE public.config_rules, public.leads, public.territories TO {0};'
      'GRANT SELECT ON TABLE public.job_requests TO {0};'
      'GRANT INSERT (lead_id, sector, skills_required, languages_required, min_experience, rate_offered, territory_id, source_agent_id, idempotency_user_id, idempotency_key, payload_hash) ON TABLE public.job_requests TO {0};'
      'GRANT UPDATE (status) ON TABLE public.job_requests TO {0};'
      'GRANT SELECT ON TABLE public.matches TO {0};'
      'GRANT INSERT (request_id, worker_id, score, score_breakdown, created_by) ON TABLE public.matches TO {0};'
      'GRANT UPDATE (status) ON TABLE public.matches TO {0};'
      'GRANT SELECT ON TABLE public.documents TO {0};'
      'GRANT SELECT ON TABLE public.workers TO {0};'
      'GRANT UPDATE (availability) ON TABLE public.workers TO {0};'
      'GRANT INSERT (actor_id, action, entity, entity_id, old_value, new_value) ON TABLE public.audit_logs TO {0};'
      'GRANT INSERT (user_id, channel, template, payload, status) ON TABLE public.notifications TO {0};'
    )
    'property-management' = @(
      'GRANT SELECT ON TABLE public.properties, public.property_units, public.property_photos TO {0};'
      'GRANT INSERT (address, description, ptype, listing_mode, sale_price, rent_period, territory_id, owner_lead_id, source_agent_id, owner_user_id, created_by) ON TABLE public.properties TO {0};'
      'GRANT INSERT (property_id, unit_no, floor, ptype, rent) ON TABLE public.property_units TO {0};'
      'GRANT INSERT (id, property_id, storage_key, sha256, mime, size_bytes, caption, uploaded_by) ON TABLE public.property_photos TO {0};'
      'GRANT SELECT ON TABLE public.marketplace_configuration TO {0};'
      'GRANT SELECT (id, role, active) ON TABLE public.users TO {0};'
      'GRANT SELECT (user_id, status, payment_status, requested_plan) ON TABLE public.user_signups TO {0};'
      'GRANT INSERT (actor_id, action, entity, entity_id, old_value, new_value) ON TABLE public.audit_logs TO {0};'
    )
    marketplace = @(
      'GRANT SELECT ON TABLE public.marketplace_configuration TO {0};'
      'GRANT UPDATE (config_value, updated_by, updated_at) ON TABLE public.marketplace_configuration TO {0};'
      'GRANT SELECT ON TABLE public.marketplace_listings TO {0};'
      'GRANT INSERT (seller_user_id, source_agent_id, created_by, domain, category_key, title, description, transaction_mode, price, rent_period, condition, territory_id) ON TABLE public.marketplace_listings TO {0};'
      'GRANT UPDATE (status, review_note, reviewed_by, reviewed_at, updated_at) ON TABLE public.marketplace_listings TO {0};'
      'GRANT SELECT ON TABLE public.marketplace_media TO {0};'
      'GRANT INSERT (listing_id, storage_key, sha256, mime, size_bytes, caption, uploaded_by) ON TABLE public.marketplace_media TO {0};'
      'GRANT SELECT (id, legal_name, role, phone, active) ON TABLE public.users TO {0};'
      'GRANT SELECT (user_id, status, payment_status, requested_plan) ON TABLE public.user_signups TO {0};'
      'GRANT INSERT (actor_id, action, entity, entity_id, old_value, new_value) ON TABLE public.audit_logs TO {0};'
    )
  }
  $sequenceTables = @{
    'workforce-management' = @('audit_logs', 'notifications')
    staffing = @('audit_logs', 'notifications')
    'property-management' = @('audit_logs', 'property_units')
    marketplace = @('audit_logs')
  }

  if ($Domain -eq 'worker-management') { $Domain = 'workforce-management' }
  if (-not $tableGrants.ContainsKey($Domain)) { throw "Unknown agency domain: $Domain." }
  if ($Role -notmatch '^[a-z][a-z0-9_]*$') { throw 'Runtime role is not a valid expected PostgreSQL identifier.' }

  $preflight = & $psql -X -A -t -F '|' -h 127.0.0.1 -p 5433 -U $adminUser -d $Database -w -v ON_ERROR_STOP=1 `
    -c "SELECT r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolbypassrls, d.datdba=(SELECT oid FROM pg_roles WHERE rolname='$Role') FROM pg_roles r CROSS JOIN pg_database d WHERE r.rolname='$Role' AND d.datname=current_database()"
  if ($LASTEXITCODE -ne 0 -or -not $preflight) { throw "Could not verify the runtime role for $Domain." }
  if ($preflight.Trim() -ne 'f|f|f|f|f') { throw "Runtime role $Role is privileged or owns database $Database; refusing to grant service privileges." }

  $statements = @(
    "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM $Role;"
    "REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM $Role;"
    "REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM $Role;"
    "REVOKE CREATE ON SCHEMA public FROM $Role;"
    'REVOKE CREATE ON SCHEMA public FROM PUBLIC;'
    "GRANT USAGE ON SCHEMA public TO $Role;"
    "GRANT EXECUTE ON FUNCTION public.app_platform_tenant_id(), public.app_is_platform_tenant_scoped(), public.app_user_creation_id(), public.app_user_phone_lookup(text), public.app_is_pending_global_admin_promotion(uuid) TO $Role;"
  )
  if ($Domain -eq 'marketplace') {
    $statements += "GRANT EXECUTE ON FUNCTION public.app_platform_tenant_has_user(uuid) TO $Role;"
  }
  if ($Domain -eq 'property-management') {
    $statements += "GRANT EXECUTE ON FUNCTION public.app_can_access_platform_property_tenant(uuid), public.app_property_tenant_system_id() TO $Role;"
  }
  foreach ($grant in $tableGrants[$Domain]) {
    $statements += ($grant -f $Role)
  }
  $sequenceTableList = ($sequenceTables[$Domain] | ForEach-Object { "'$_'" }) -join ','
  $statements += @"
DO `$grant_sequences`$
DECLARE sequence_record record;
BEGIN
  FOR sequence_record IN
    SELECT sequence_namespace.nspname AS schema_name, sequence_relation.relname AS sequence_name
    FROM pg_class sequence_relation
    JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_relation.relnamespace
    JOIN pg_depend dependency ON dependency.objid = sequence_relation.oid
      AND dependency.classid = 'pg_class'::regclass AND dependency.refclassid = 'pg_class'::regclass
      AND dependency.deptype IN ('a', 'i')
    JOIN pg_class table_relation ON table_relation.oid = dependency.refobjid
    WHERE sequence_relation.relkind = 'S'
      AND sequence_namespace.nspname = 'public'
      AND table_relation.relname = ANY (ARRAY[$sequenceTableList]::text[])
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I.%I TO %I',
      sequence_record.schema_name, sequence_record.sequence_name, '$Role');
  END LOOP;
END
`$grant_sequences`$;
"@
  & $psql -X -h 127.0.0.1 -p 5433 -U $adminUser -d $Database -w -v ON_ERROR_STOP=1 -c ($statements -join "`n")
  if ($LASTEXITCODE -ne 0) { throw "Could not apply least-privilege grants to $Role." }

  $verification = & $psql -X -A -t -F '|' -h 127.0.0.1 -p 5433 -U $adminUser -d $Database -w -v ON_ERROR_STOP=1 -c @"
SELECT
  has_column_privilege('$Role', 'public.users', 'password_hash', 'SELECT')
  OR has_column_privilege('$Role', 'public.users', 'mfa_secret', 'SELECT')
  OR has_schema_privilege('$Role', 'public', 'CREATE')
  OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND (c.relname LIKE 'mfi_%' OR c.relname LIKE 'insurance_ledger_%')
      AND (has_table_privilege('$Role', c.oid, 'SELECT')
        OR has_table_privilege('$Role', c.oid, 'INSERT')
        OR has_table_privilege('$Role', c.oid, 'UPDATE')
        OR has_table_privilege('$Role', c.oid, 'DELETE'))
  )
"@
  if ($LASTEXITCODE -ne 0 -or $verification.Trim() -ne 'f') {
    throw "Least-privilege verification failed for $Role."
  }
  Write-Output "Applied and verified $Domain runtime grants for $Database."
}
