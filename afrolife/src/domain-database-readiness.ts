export type AgencyDomain = 'workforce-management' | 'staffing' | 'property-management' | 'marketplace';
type LegacyAgencyDomain = 'worker-management';

type DatabaseMetadata = {
  table_name: string;
  column_key?: string;
  missing: boolean;
  rls_enabled: boolean;
  can_read_auth_secrets?: boolean;
  can_create_schema?: boolean;
  can_access_financial_data?: boolean;
};

type Queryable = {
  query(sql: string, values: unknown[]): Promise<{ rows: DatabaseMetadata[] }>;
};

export const agencyDomainSchemaRequirements: Record<AgencyDomain, {
  required: string[];
  rowLevelSecurity: string[];
  requiredColumns: string[];
}> = {
  'workforce-management': {
    required: ['agents', 'audit_logs', 'documents', 'notifications', 'territories', 'users', 'workers'],
    rowLevelSecurity: ['agents', 'documents', 'workers'],
    requiredColumns: [
      'users.id', 'users.active', 'users.role', 'users.legal_name', 'users.phone',
      'agents.id', 'agents.parent_id', 'agents.territory_id',
      'workers.id', 'workers.name', 'workers.phone', 'workers.national_id', 'workers.sector',
      'workers.skills', 'workers.languages', 'workers.experience_years', 'workers.rate_expected',
      'workers.availability', 'workers.verification', 'workers.territory_id', 'workers.source_agent_id',
      'documents.id', 'documents.worker_id', 'documents.doc_type', 'documents.storage_key',
      'documents.sha256', 'documents.expires_on', 'documents.mime', 'documents.size_bytes',
      'documents.status', 'documents.uploaded_by', 'documents.reviewer_id', 'documents.reviewed_at',
      'documents.review_note',
    ],
  },
  staffing: {
    required: [
      'agents', 'audit_logs', 'config_rules', 'documents', 'job_requests', 'leads',
      'matches', 'notifications', 'territories', 'users', 'workers',
    ],
    rowLevelSecurity: ['agents', 'documents', 'job_requests', 'leads', 'matches', 'workers'],
    requiredColumns: [
      'users.id', 'users.active', 'users.role', 'users.legal_name', 'users.phone',
      'agents.id', 'agents.parent_id', 'agents.territory_id',
      'leads.id', 'leads.source_agent_id',
      'workers.id', 'workers.name', 'workers.sector', 'workers.skills', 'workers.languages',
      'workers.experience_years', 'workers.rate_expected', 'workers.availability',
      'workers.verification', 'workers.territory_id', 'workers.source_agent_id',
      'documents.worker_id', 'documents.doc_type', 'documents.status', 'documents.expires_on',
      'job_requests.id', 'job_requests.lead_id', 'job_requests.sector', 'job_requests.skills_required',
      'job_requests.languages_required', 'job_requests.min_experience', 'job_requests.rate_offered',
      'job_requests.territory_id', 'job_requests.source_agent_id', 'job_requests.status',
      'job_requests.idempotency_user_id', 'job_requests.idempotency_key', 'job_requests.payload_hash',
      'matches.id', 'matches.request_id', 'matches.worker_id', 'matches.score',
      'matches.score_breakdown', 'matches.status', 'matches.created_by',
    ],
  },
  'property-management': {
    required: [
      'agents', 'audit_logs', 'leads', 'marketplace_configuration', 'maintenance_requests',
      'notifications', 'properties', 'property_photos', 'property_units', 'rent_charges',
      'tenants', 'territories', 'users', 'user_signups', 'leases',
      'property_tenant_access_invitations', 'property_tenant_account_links',
      'property_authority_evidence', 'property_authority_review_events',
      'maintenance_sla_escalations',
      'rent_transactions', 'property_vendors', 'property_vendor_bills',
      'maintenance_request_events', 'maintenance_evidence',
      'property_rental_applications', 'property_rental_application_events',
      'lease_documents', 'lease_versions', 'lease_lifecycle_events', 'lease_notices',
      'lease_renewal_offers', 'lease_renewal_offer_events',
      'lease_move_out_inspections', 'lease_move_out_inspection_events',
      'lease_move_out_inspection_evidence', 'property_unit_turnover_events',
      'property_operating_tenants', 'property_operating_tenant_members',
      'property_operating_tenant_events', 'property_operating_tenant_support_grants',
      'property_agent_scopes', 'property_agent_scope_events',
      'property_tenant_export_requests', 'property_tenant_export_events',
    ],
    rowLevelSecurity: [
      'agents', 'marketplace_configuration', 'maintenance_requests', 'properties', 'property_photos',
      'property_units', 'rent_charges', 'leases', 'property_tenant_access_invitations',
      'property_tenant_account_links', 'property_authority_evidence', 'property_authority_review_events',
      'maintenance_sla_escalations',
      'rent_transactions', 'property_vendors', 'property_vendor_bills',
      'maintenance_request_events', 'maintenance_evidence',
      'property_rental_applications', 'property_rental_application_events',
      'lease_documents', 'lease_versions', 'lease_lifecycle_events', 'lease_notices',
      'lease_renewal_offers', 'lease_renewal_offer_events',
      'lease_move_out_inspections', 'lease_move_out_inspection_events',
      'lease_move_out_inspection_evidence', 'property_unit_turnover_events',
      'property_operating_tenants', 'property_operating_tenant_members',
      'property_operating_tenant_events', 'property_operating_tenant_support_grants',
      'property_agent_scopes', 'property_agent_scope_events',
      'property_tenant_export_requests', 'property_tenant_export_events',
    ],
    requiredColumns: [
      'users.id', 'users.role', 'users.active', 'users.kyc_status', 'agents.id', 'agents.territory_id',
      'leads.id', 'leads.source_agent_id',
      'properties.id', 'properties.address', 'properties.description', 'properties.ptype',
      'properties.tenant_system_id',
      'properties.listing_mode', 'properties.sale_price', 'properties.rent_period',
      'properties.territory_id', 'properties.owner_lead_id', 'properties.source_agent_id',
      'properties.owner_user_id', 'properties.created_by', 'properties.status',
      'properties.authority_review_status', 'properties.authority_review_note',
      'properties.authority_reviewed_by', 'properties.authority_reviewed_at',
      'property_units.id', 'property_units.property_id', 'property_units.unit_no',
      'property_units.floor', 'property_units.ptype', 'property_units.rent', 'property_units.occupancy',
      'property_photos.id', 'property_photos.property_id', 'property_photos.storage_key',
      'property_photos.sha256', 'property_photos.mime', 'property_photos.size_bytes',
      'property_photos.caption', 'property_photos.uploaded_by',
      'marketplace_configuration.scope', 'marketplace_configuration.config_key',
      'marketplace_configuration.config_value',
      'user_signups.user_id', 'user_signups.account_type', 'user_signups.requested_plan',
      'user_signups.status', 'tenants.id', 'tenants.name', 'tenants.phone',
      'tenants.source_agent_id', 'leases.id', 'leases.unit_id', 'leases.tenant_id',
      'tenants.tenant_system_id', 'leases.tenant_system_id',
      'leases.rent', 'leases.deposit', 'leases.start_date', 'leases.rent_start_on', 'leases.end_date',
      'leases.source_agent_id', 'leases.status', 'rent_charges.id', 'rent_charges.lease_id',
      'rent_charges.period', 'rent_charges.due_on', 'rent_charges.amount', 'rent_charges.status',
      'maintenance_requests.id', 'maintenance_requests.property_id', 'maintenance_requests.unit_id',
      'maintenance_requests.description', 'maintenance_requests.priority',
      'maintenance_requests.status', 'maintenance_requests.source_agent_id',
      'maintenance_requests.tenant_system_id',
      'maintenance_requests.assigned_to_user_id',
      'property_agent_scopes.tenant_system_id', 'property_agent_scopes.property_id',
      'property_agent_scopes.user_id', 'property_agent_scopes.tenant_role',
      'property_agent_scopes.status', 'property_agent_scopes.effective_from',
      'property_agent_scopes.effective_to',
      'property_tenant_export_requests.id', 'property_tenant_export_requests.request_sequence',
      'property_tenant_export_requests.tenant_system_id',
      'property_tenant_export_requests.artifact_reference', 'property_tenant_export_requests.sha256',
      'property_tenant_export_requests.size_bytes', 'property_tenant_export_requests.record_count',
      'property_tenant_export_requests.requested_by', 'property_tenant_export_events.export_request_id',
      'property_tenant_export_events.tenant_system_id',
      'property_tenant_export_events.decision', 'property_tenant_export_events.actor_id',
      'maintenance_requests.lease_id', 'maintenance_requests.resident_user_id',
      'property_tenant_access_invitations.lease_id', 'property_tenant_access_invitations.tenant_id',
      'property_tenant_access_invitations.token_hash', 'property_tenant_access_invitations.expires_at',
      'property_tenant_account_links.tenant_id', 'property_tenant_account_links.user_id',
      'property_tenant_account_links.invitation_id', 'property_tenant_account_links.revoked_at',
      'property_authority_evidence.id', 'property_authority_evidence.property_id',
      'property_authority_evidence.evidence_type', 'property_authority_evidence.storage_key',
      'property_authority_evidence.sha256', 'property_authority_evidence.mime',
      'property_authority_evidence.size_bytes', 'property_authority_evidence.scan_status',
      'property_authority_evidence.uploaded_by',
      'property_authority_review_events.id', 'property_authority_review_events.property_id',
      'property_authority_review_events.actor_id', 'property_authority_review_events.event_type',
      'property_authority_review_events.from_status', 'property_authority_review_events.to_status',
      'property_authority_review_events.reason',
    ],
  },
  marketplace: {
    required: [
      'agents', 'audit_logs', 'marketplace_configuration', 'marketplace_listings',
      'marketplace_media', 'notifications', 'territories', 'users', 'user_signups',
    ],
    rowLevelSecurity: ['agents', 'marketplace_configuration', 'marketplace_listings', 'marketplace_media'],
    requiredColumns: [
      'users.id', 'users.active', 'users.role', 'users.legal_name', 'users.phone',
      'agents.id', 'agents.territory_id',
      'marketplace_configuration.scope', 'marketplace_configuration.config_key',
      'marketplace_configuration.config_value',
      'marketplace_listings.id', 'marketplace_listings.seller_user_id',
      'marketplace_listings.source_agent_id', 'marketplace_listings.created_by',
      'marketplace_listings.domain', 'marketplace_listings.category_key',
      'marketplace_listings.title', 'marketplace_listings.description',
      'marketplace_listings.transaction_mode', 'marketplace_listings.price',
      'marketplace_listings.rent_period', 'marketplace_listings.condition',
      'marketplace_listings.territory_id', 'marketplace_listings.status',
      'marketplace_listings.review_note', 'marketplace_listings.reviewed_by',
      'marketplace_listings.reviewed_at', 'marketplace_listings.updated_at',
      'marketplace_media.id', 'marketplace_media.listing_id', 'marketplace_media.storage_key',
      'marketplace_media.sha256', 'marketplace_media.mime', 'marketplace_media.size_bytes',
      'marketplace_media.caption', 'marketplace_media.uploaded_by',
      'user_signups.user_id', 'user_signups.account_type', 'user_signups.status',
    ],
  },
};

export async function assertAgencyDomainDatabaseReady(domain: AgencyDomain | LegacyAgencyDomain, database: Queryable): Promise<void> {
  const canonicalDomain = domain === 'worker-management' ? 'workforce-management' : domain;
  const requirements = agencyDomainSchemaRequirements[canonicalDomain];
  const result = await database.query(
    `SELECT requested.table_name,
            to_regclass(format('%I.%I', 'public', requested.table_name)) IS NULL AS missing,
            coalesce(relation.relrowsecurity, false) AS rls_enabled
     FROM unnest($1::text[]) AS requested(table_name)
     LEFT JOIN pg_class relation
       ON relation.oid = to_regclass(format('%I.%I', 'public', requested.table_name))`,
    [requirements.required],
  );
  const rowByTable = new Map(result.rows.map((row) => [row.table_name, row]));
  const missing = requirements.required.filter((table) => rowByTable.get(table)?.missing !== false);
  const unprotected = requirements.rowLevelSecurity.filter((table) => rowByTable.get(table)?.rls_enabled !== true);
  if (missing.length || unprotected.length) {
    const problems = [
      ...(missing.length ? [`missing tables: ${missing.join(', ')}`] : []),
      ...(unprotected.length ? [`RLS is disabled: ${unprotected.join(', ')}`] : []),
    ];
    throw new Error(`${canonicalDomain} database schema is not ready (${problems.join('; ')})`);
  }

  const columns = await database.query(
    `SELECT requested.column_key,
            NOT EXISTS (
              SELECT 1 FROM pg_attribute actual
              WHERE actual.attrelid=to_regclass(format('%I.%I','public',split_part(requested.column_key,'.',1)))
                AND actual.attname=split_part(requested.column_key,'.',2)
                AND actual.attnum>0 AND NOT actual.attisdropped
            ) AS missing
     FROM unnest($1::text[]) AS requested(column_key)`,
    [requirements.requiredColumns],
  );
  const missingColumns = requirements.requiredColumns.filter((column) =>
    columns.rows.find((row) => row.column_key === column)?.missing !== false);
  if (missingColumns.length) {
    throw new Error(`${canonicalDomain} database schema is not ready (missing columns: ${missingColumns.join(', ')})`);
  }

  const privileges = await database.query(
    `SELECT
       (has_column_privilege(current_user, 'public.users', 'password_hash', 'SELECT')
         OR has_column_privilege(current_user, 'public.users', 'mfa_secret', 'SELECT')) AS can_read_auth_secrets,
       has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema,
       EXISTS (
         SELECT 1 FROM pg_class relation
         JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
         WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p')
           AND (relation.relname LIKE 'mfi_%' OR relation.relname LIKE 'insurance_ledger_%')
           AND (has_table_privilege(current_user, relation.oid, 'SELECT')
             OR has_table_privilege(current_user, relation.oid, 'INSERT')
             OR has_table_privilege(current_user, relation.oid, 'UPDATE')
             OR has_table_privilege(current_user, relation.oid, 'DELETE'))
       ) AS can_access_financial_data`,
    [],
  );
  const unsafe = privileges.rows[0];
  if (!unsafe || unsafe.can_read_auth_secrets || unsafe.can_create_schema || unsafe.can_access_financial_data) {
    throw new Error(`${canonicalDomain} database role has privileges outside its service boundary`);
  }
}
