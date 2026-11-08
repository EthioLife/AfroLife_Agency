import test from 'node:test';
import assert from 'node:assert/strict';
import { agencyDomainSchemaRequirements, assertAgencyDomainDatabaseReady, type AgencyDomain } from '../src/domain-database-readiness.js';

function databaseFor(
  domain: AgencyDomain,
  tables: string[],
  rlsTables: string[],
  privileges = {
    can_read_auth_secrets: false,
    can_create_schema: false,
    can_access_financial_data: false,
  },
  columns = agencyDomainSchemaRequirements[domain].requiredColumns,
) {
  return {
    async query(sql: string, values: unknown[]) {
      if (values.length === 0) {
        return { rows: [privileges] };
      }
      const required = values[0] as string[];
      if (sql.includes('pg_attribute')) {
        return {
          rows: required.map((column_key) => ({ column_key, missing: !columns.includes(column_key) })),
        };
      }
      return {
        rows: required.map((table_name) => ({
          table_name,
          missing: !tables.includes(table_name),
          rls_enabled: rlsTables.includes(table_name),
        })),
      };
    },
  };
}

const completeSchemas: Record<AgencyDomain, { tables: string[]; rls: string[] }> = {
  'workforce-management': {
    tables: ['agents', 'audit_logs', 'documents', 'notifications', 'territories', 'users', 'workers'],
    rls: ['agents', 'documents', 'workers'],
  },
  staffing: {
    tables: ['agents', 'audit_logs', 'config_rules', 'documents', 'job_requests', 'leads', 'matches', 'notifications', 'territories', 'users', 'workers'],
    rls: ['agents', 'documents', 'job_requests', 'leads', 'matches', 'workers'],
  },
  'property-management': {
    tables: [
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
    ],
    rls: [
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
    ],
  },
  marketplace: {
    tables: ['agents', 'audit_logs', 'marketplace_configuration', 'marketplace_listings', 'marketplace_media', 'notifications', 'territories', 'users', 'user_signups'],
    rls: ['agents', 'marketplace_configuration', 'marketplace_listings', 'marketplace_media'],
  },
};

for (const [domain, schema] of Object.entries(completeSchemas) as [AgencyDomain, typeof completeSchemas[AgencyDomain]][]) {
  test(`${domain} database readiness accepts its required tables and RLS policies`, async () => {
    await assertAgencyDomainDatabaseReady(domain, databaseFor(domain, schema.tables, schema.rls));
  });
}

test('database readiness rejects missing service tables', async () => {
  await assert.rejects(
    assertAgencyDomainDatabaseReady('workforce-management', databaseFor('workforce-management', ['users'], [])),
    /missing tables:.*workers/,
  );
  await assert.rejects(
    assertAgencyDomainDatabaseReady('worker-management', databaseFor('workforce-management', ['users'], [])),
    /workforce-management database schema is not ready/,
  );
});

test('database readiness rejects missing row-level security', async () => {
  await assert.rejects(
    assertAgencyDomainDatabaseReady('marketplace', databaseFor('marketplace', completeSchemas.marketplace.tables, ['agents'])),
    /RLS is disabled:.*marketplace_listings/,
  );
});

test('database readiness rejects an incomplete service schema column set', async () => {
  const requiredColumns = agencyDomainSchemaRequirements.staffing.requiredColumns;
  await assert.rejects(
    assertAgencyDomainDatabaseReady('staffing', databaseFor(
      'staffing', completeSchemas.staffing.tables, completeSchemas.staffing.rls,
      undefined, requiredColumns.slice(1),
    )),
    /missing columns:.*users\.id/,
  );
});

for (const [description, privileges] of [
  ['authentication secrets', { can_read_auth_secrets: true }],
  ['schema creation', { can_create_schema: true }],
  ['financial data', { can_access_financial_data: true }],
] as const) {
  test(`database readiness rejects service roles with access to ${description}`, async () => {
    const database = databaseFor(
      'marketplace',
      completeSchemas.marketplace.tables,
      completeSchemas.marketplace.rls,
      { can_read_auth_secrets: false, can_create_schema: false, can_access_financial_data: false, ...privileges },
    );
    await assert.rejects(
      assertAgencyDomainDatabaseReady('marketplace', database),
      /privileges outside its service boundary/,
    );
  });
}
