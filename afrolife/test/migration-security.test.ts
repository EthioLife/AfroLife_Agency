import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessMigrationReadiness, assertMigrationChecksum, migrationChecksum } from '../src/migration-checksums.js';

const insuranceGrants = readFileSync(new URL('../migrations/039_insurance_ledger_runtime_grants.sql', import.meta.url), 'utf8');
const authSessions = readFileSync(new URL('../migrations/040_auth_sessions.sql', import.meta.url), 'utf8');
const mfiComplaints = readFileSync(new URL('../migrations/043_mfi_customer_complaints.sql', import.meta.url), 'utf8');
const mfiRiskFlags = readFileSync(new URL('../migrations/044_mfi_member_risk_controls.sql', import.meta.url), 'utf8');
const mfiDailyLimits = readFileSync(new URL('../migrations/045_mfi_daily_disbursement_limits.sql', import.meta.url), 'utf8');
const mfiKyc = readFileSync(new URL('../migrations/046_mfi_member_kyc_review.sql', import.meta.url), 'utf8');
const mfiDocuments = readFileSync(new URL('../migrations/047_mfi_loan_documents.sql', import.meta.url), 'utf8');
const mfiWriteoffs = readFileSync(new URL('../migrations/048_mfi_loan_writeoffs.sql', import.meta.url), 'utf8');
const mfiWriteoffActorControls = readFileSync(new URL('../migrations/049_mfi_writeoff_actor_controls.sql', import.meta.url), 'utf8');
const mfiRouter = readFileSync(new URL('../src/mfi.ts', import.meta.url), 'utf8');
const leadProtection = readFileSync(new URL('../migrations/052_lead_protection_and_attribution_history.sql', import.meta.url), 'utf8');
const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
const mfiSandbox = readFileSync(new URL('../migrations/053_mfi_sandbox_simulations.sql', import.meta.url), 'utf8');
const agentScopedStaffing = readFileSync(new URL('../migrations/054_agent_scoped_staffing_matches.sql', import.meta.url), 'utf8');
const agentFinancialFacilitation = readFileSync(new URL('../migrations/055_agent_financial_facilitation.sql', import.meta.url), 'utf8');
const rentRlsRecursionFix = readFileSync(new URL('../migrations/058_rent_rls_recursion_fix.sql', import.meta.url), 'utf8');
const userAccessHistory = readFileSync(new URL('../migrations/059_user_access_history.sql', import.meta.url), 'utf8');
const leaseLifecycle = readFileSync(new URL('../migrations/060_lease_lifecycle.sql', import.meta.url), 'utf8');
const leaseNoticeRecords = readFileSync(new URL('../migrations/061_lease_notice_records.sql', import.meta.url), 'utf8');
const financeAndIdentityControls = readFileSync(new URL('../migrations/064_finance_and_identity_controls.sql', import.meta.url), 'utf8');
const ownerRentTransactionRead = readFileSync(new URL('../migrations/065_owner_rent_transaction_read.sql', import.meta.url), 'utf8');
const readinessEvidence = readFileSync(new URL('../migrations/066_readiness_evidence.sql', import.meta.url), 'utf8');
const globalAdminReleaseApprovalRole = readFileSync(new URL('../migrations/067_global_admin_release_approval_role.sql', import.meta.url), 'utf8');
const insuranceAgentReferrals = readFileSync(new URL('../migrations/068_insurance_agent_referrals.sql', import.meta.url), 'utf8');
const insuranceBrokerageSandbox = readFileSync(new URL('../migrations/069_insurance_brokerage_sandbox.sql', import.meta.url), 'utf8');
const insuranceRequests = readFileSync(new URL('../src/insurance-requests.ts', import.meta.url), 'utf8');
const insuranceBrokerageSandboxRouter = readFileSync(new URL('../src/insurance-brokerage-sandbox.ts', import.meta.url), 'utf8');
const operations = readFileSync(new URL('../src/ops.ts', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../src/admin.ts', import.meta.url), 'utf8');
const publicApp = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const workforceWorkflows = readFileSync(new URL('../migrations/095_workforce_workflows.sql', import.meta.url), 'utf8');
const sessionDeviceManagement = readFileSync(new URL('../migrations/096_session_device_management.sql', import.meta.url), 'utf8');
const supportCases = readFileSync(new URL('../migrations/097_support_cases.sql', import.meta.url), 'utf8');
const supportCaseAccessHardening = readFileSync(new URL('../migrations/098_support_case_access_hardening.sql', import.meta.url), 'utf8');
const supportCaseAppealReview = readFileSync(new URL('../migrations/099_support_case_appeal_review.sql', import.meta.url), 'utf8');
const maintenanceCompletionReview = readFileSync(new URL('../migrations/100_maintenance_completion_review.sql', import.meta.url), 'utf8');
const maintenanceVendorFulfillment = readFileSync(new URL('../migrations/101_maintenance_vendor_fulfillment.sql', import.meta.url), 'utf8');
const maintenanceSlaDispatcher = readFileSync(new URL('../src/maintenance-sla.ts', import.meta.url), 'utf8');
const notificationDeliveryRetries = readFileSync(new URL('../migrations/102_notification_delivery_retries.sql', import.meta.url), 'utf8');
const payrollHandoffHistory = readFileSync(new URL('../migrations/103_workforce_payroll_handoff_history.sql', import.meta.url), 'utf8');
const payrollFailedRowRequeue = readFileSync(new URL('../migrations/112_workforce_payroll_failed_row_requeue.sql', import.meta.url), 'utf8');
const propertyRentalApplications = readFileSync(new URL('../migrations/104_property_rental_applications.sql', import.meta.url), 'utf8');
const propertyTenantSelfService = readFileSync(new URL('../migrations/105_property_tenant_self_service.sql', import.meta.url), 'utf8');
const propertyOwnerAuthorityReview = readFileSync(new URL('../migrations/106_property_owner_authority_review.sql', import.meta.url), 'utf8');
const leaseRentStartDate = readFileSync(new URL('../migrations/107_lease_rent_start_date.sql', import.meta.url), 'utf8');
const globalAdminPropertyAuthorityReview = readFileSync(new URL('../migrations/108_global_admin_property_authority_review.sql', import.meta.url), 'utf8');
const maintenanceSlaEscalationIndex = readFileSync(new URL('../migrations/109_maintenance_sla_escalation_index.sql', import.meta.url), 'utf8');
const workforceOffboardingSerialization = readFileSync(new URL('../migrations/110_workforce_offboarding_serialization.sql', import.meta.url), 'utf8');
const workforcePropertySupportAssistant = readFileSync(new URL('../migrations/113_workforce_property_support_assistant.sql', import.meta.url), 'utf8');
const marketplaceRouter = readFileSync(new URL('../services/marketplace/router.ts', import.meta.url), 'utf8');
const propertyManagementRouter = readFileSync(new URL('../services/property-management/router.ts', import.meta.url), 'utf8');
const propertyVendorPortal = readFileSync(new URL('../src/property-vendor-portal.ts', import.meta.url), 'utf8');
const notificationDispatcher = readFileSync(new URL('../src/dispatch.ts', import.meta.url), 'utf8');
const workforceOperations = readFileSync(new URL('../src/workforce-operations.ts', import.meta.url), 'utf8');
const coreMigrator = readFileSync(new URL('../src/migrate.ts', import.meta.url), 'utf8');
const aletcloudBootstrap = readFileSync(new URL('../src/aletcloud-bootstrap.ts', import.meta.url), 'utf8');
const accountingMigrator = readFileSync(new URL('../services/accounting/migrate.ts', import.meta.url), 'utf8');

test('migration runners persist and enforce immutable SQL checksums', () => {
  const checksum = migrationChecksum('SELECT 1;');
  assert.match(checksum, /^[0-9a-f]{64}$/);
  assert.doesNotThrow(() => assertMigrationChecksum('001_example.sql', checksum, checksum));
  assert.doesNotThrow(() => assertMigrationChecksum('001_legacy.sql', null, checksum));
  assert.throws(
    () => assertMigrationChecksum('001_example.sql', checksum, migrationChecksum('SELECT 2;')),
    /has changed since it was applied/,
  );
  const expected = [
    { name: '001_first.sql', checksum: migrationChecksum('SELECT 1;') },
    { name: '002_second.sql', checksum: migrationChecksum('SELECT 2;') },
  ];
  assert.deepEqual(assessMigrationReadiness(expected, expected), {
    current: true,
    applied: 2,
    expected: 2,
    checksumMismatches: 0,
    checksumsUnverified: 0,
    unexpectedMigrations: 0,
  });
  assert.deepEqual(
    assessMigrationReadiness(expected, [
      { name: '001_first.sql', checksum: migrationChecksum('SELECT 0;') },
      { name: '002_second.sql', checksum: null },
      { name: '003_unexpected.sql', checksum: migrationChecksum('SELECT 3;') },
    ]),
    {
      current: false,
      applied: 2,
      expected: 2,
      checksumMismatches: 1,
      checksumsUnverified: 1,
      unexpectedMigrations: 1,
    },
  );
  assert.match(coreMigrator, /ADD COLUMN IF NOT EXISTS checksum text/);
  assert.match(coreMigrator, /INSERT INTO schema_migrations \(name,checksum\)/);
  assert.match(coreMigrator, /pg_advisory_lock\(71924211,1\)/);
  assert.match(coreMigrator, /set_config\('app\.role', 'global_admin', false\)/);
  assert.match(coreMigrator, /MIGRATION_DATABASE_URL[\s\S]*ALTER TABLE IF EXISTS public\.support_cases NO FORCE ROW LEVEL SECURITY/);
  assert.match(coreMigrator, /ALTER TABLE IF EXISTS public\.support_case_access_requests NO FORCE ROW LEVEL SECURITY/);
  assert.match(aletcloudBootstrap, /runtime\.role\.slice\(0, 46\).*_afrolife_runtime/);
  assert.match(accountingMigrator, /ADD COLUMN IF NOT EXISTS checksum text/);
  assert.match(accountingMigrator, /INSERT INTO accounting_service_migrations\(version,checksum\)/);
  assert.match(accountingMigrator, /pg_advisory_lock\(71924211,2\)/);
  assert.match(server, /SELECT name, checksum FROM schema_migrations/);
  assert.match(server, /assessMigrationReadiness\(expectedMigrations, appliedRows\.rows\)/);
});

test('central Insurance ledger grants match service operations and identity sequences', () => {
  for (const revoke of [
    'REVOKE ALL ON TABLE insurance_ledger_accounts FROM "{{role}}"',
    'REVOKE ALL ON TABLE insurance_ledger_journals FROM "{{role}}"',
    'REVOKE ALL ON TABLE insurance_ledger_lines FROM "{{role}}"',
    'REVOKE ALL ON TABLE insurance_ledger_audit FROM "{{role}}"',
    'REVOKE ALL ON SEQUENCE insurance_ledger_lines_id_seq FROM "{{role}}"',
    'REVOKE ALL ON SEQUENCE insurance_ledger_audit_id_seq FROM "{{role}}"',
  ]) {
    assert.ok(insuranceGrants.includes(revoke), `missing least-privilege reset: ${revoke}`);
  }
  for (const grant of [
    'GRANT SELECT, INSERT ON TABLE insurance_ledger_accounts TO "{{role}}"',
    'GRANT SELECT, INSERT, UPDATE ON TABLE insurance_ledger_journals TO "{{role}}"',
    'GRANT SELECT, INSERT ON TABLE insurance_ledger_lines TO "{{role}}"',
    'GRANT SELECT, INSERT ON TABLE insurance_ledger_audit TO "{{role}}"',
    'GRANT USAGE, SELECT ON SEQUENCE insurance_ledger_lines_id_seq TO "{{role}}"',
    'GRANT USAGE, SELECT ON SEQUENCE insurance_ledger_audit_id_seq TO "{{role}}"',
  ]) {
    assert.ok(insuranceGrants.includes(grant), `missing expected least-privilege grant: ${grant}`);
  }
  assert.doesNotMatch(insuranceGrants, /ALL PRIVILEGES|GRANT .* DELETE ON TABLE insurance_ledger_/);
});

test('auth session storage is runtime-role scoped and records idle and absolute expiry', () => {
  assert.match(authSessions, /CREATE TABLE auth_sessions/);
  assert.match(authSessions, /user_id uuid NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(authSessions, /last_activity_at timestamptz NOT NULL/);
  assert.match(authSessions, /expires_at timestamptz NOT NULL/);
  assert.match(authSessions, /revoked_at timestamptz/);
  assert.match(authSessions, /REVOKE ALL ON TABLE auth_sessions FROM PUBLIC/);
  assert.match(authSessions, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth_sessions TO "\{\{role\}\}"/);
});

test('effective user access history captures role and activation changes and is append-only', () => {
  assert.match(userAccessHistory, /CREATE TABLE user_access_history/);
  assert.match(userAccessHistory, /role_after text NOT NULL/);
  assert.match(userAccessHistory, /INSERT INTO user_access_history[\s\S]*?SELECT id, role, active/);
  assert.match(userAccessHistory, /CREATE TRIGGER users_capture_initial_access/);
  assert.match(userAccessHistory, /CREATE TRIGGER users_record_access_history/);
  assert.match(userAccessHistory, /current_setting\('app\.user_id', true\)/);
  assert.match(userAccessHistory, /current_setting\('app\.access_change_reason', true\)/);
  assert.match(userAccessHistory, /SECURITY DEFINER[\s\S]*?SET search_path = pg_catalog, pg_temp/);
  assert.match(userAccessHistory, /user_access_history_owner_insert/);
  assert.match(userAccessHistory, /User access history is append-only/);
  assert.match(userAccessHistory, /GRANT SELECT ON TABLE user_access_history/);
  assert.match(userAccessHistory, /REVOKE ALL ON TABLE user_access_history FROM "\{\{role\}\}"/);
  assert.match(admin, /\/users\/:id\/access-history/);
  assert.match(admin, /\/role-access\/history/);
});

test('Insurance Agent referrals require separate customer consent and stay non-binding and hierarchy-scoped', () => {
  assert.match(insuranceAgentReferrals, /customer_consented_at timestamptz NOT NULL/);
  assert.match(insuranceAgentReferrals, /customer_withdrew/);
  assert.match(insuranceAgentReferrals, /insurance_agent_referral_customer_withdraw/);
  assert.match(insuranceAgentReferrals, /CREATE TABLE insurance_agent_referral_events/);
  assert.match(insuranceAgentReferrals, /Insurance agent referral events are append-only/);
  assert.match(insuranceAgentReferrals, /REVOKE ALL ON TABLE insurance_agent_referral_events FROM "\{\{role\}\}"/);
  assert.match(insuranceAgentReferrals, /insurance_agent_referral_read/);
  assert.match(insuranceAgentReferrals, /assigned_agent_id IS NOT NULL\s+AND app_can_access_agent\(assigned_agent_id\)/);
  assert.match(insuranceAgentReferrals, /insurance_agent_referral_staff_access\(\)/);
  assert.match(insuranceAgentReferrals, /Insurance agent referral history cannot be deleted/);
  assert.match(insuranceAgentReferrals, /Insurance referral updates are limited to the assigned Agent’s non-binding follow-up/);
  assert.match(insuranceAgentReferrals, /GRANT SELECT, INSERT, UPDATE ON insurance_agent_referrals/);
  assert.doesNotMatch(insuranceAgentReferrals, /GRANT .*DELETE ON insurance_agent_referrals/);
  assert.match(insuranceRequests, /agent_referral_consent: z\.boolean\(\)\.optional\(\)\.default\(false\)/);
  assert.match(insuranceRequests, /if \(body\.agent_referral_consent\)/);
  assert.match(insuranceRequests, /referred_to_insurance_team/);
});

test('Insurance brokerage lifecycle sandbox is synthetic-only, append-only, and disabled in production', () => {
  assert.match(insuranceBrokerageSandbox, /sandbox_only boolean NOT NULL DEFAULT true CHECK \(sandbox_only\)/);
  assert.match(insuranceBrokerageSandbox, /insurance_brokerage_sandbox_event_immutable/);
  assert.match(insuranceBrokerageSandbox, /Insurance brokerage sandbox events are append-only/);
  assert.match(insuranceBrokerageSandbox, /FORCE ROW LEVEL SECURITY/);
  assert.match(insuranceBrokerageSandbox, /REVOKE ALL ON TABLE insurance_brokerage_sandbox_cases FROM "\{\{role\}\}"/);
  assert.match(insuranceBrokerageSandbox, /REVOKE ALL ON TABLE insurance_brokerage_sandbox_events FROM "\{\{role\}\}"/);
  assert.match(insuranceBrokerageSandbox, /GRANT SELECT, INSERT ON insurance_brokerage_sandbox_events/);
  assert.doesNotMatch(insuranceBrokerageSandbox, /GRANT .*UPDATE ON insurance_brokerage_sandbox_events/);
  assert.doesNotMatch(insuranceBrokerageSandbox, /GRANT .*DELETE ON insurance_brokerage_sandbox/);
  assert.match(insuranceBrokerageSandboxRouter, /environment\.NODE_ENV !== 'production'/);
  assert.match(insuranceBrokerageSandboxRouter, /environment\.INSURANCE_BROKERAGE_MODE === 'sandbox'/);
  assert.match(insuranceBrokerageSandboxRouter, /production_activities_enabled: false/);
  for (const activity of [
    'advice_review_simulated','product_comparison_simulated','quote_generated_simulated',
    'policy_issuance_simulated','policy_change_simulated','premium_receipt_simulated',
    'commission_settlement_simulated','claim_decision_simulated',
  ]) {
    assert.ok(insuranceBrokerageSandboxRouter.includes(activity), `sandbox lifecycle missing ${activity}`);
  }
  assert.doesNotMatch(insuranceBrokerageSandboxRouter, /createServiceGateway|fetch\(|paymentWebhook|INSURANCE_SERVICE_URL/);
});

test('MFI customer complaints are tenant-scoped and require documented resolution to close', () => {
  assert.match(mfiComplaints, /CREATE TABLE mfi_customer_complaints/);
  assert.match(mfiComplaints, /FOREIGN KEY \(institution_id,member_id\)/);
  assert.match(mfiComplaints, /mfi_customer_complaint_scope/);
  assert.match(mfiComplaints, /resolution_due_at timestamptz/);
  assert.match(mfiComplaints, /status IN \('resolved','rejected'\) AND resolution IS NOT NULL/);
  assert.match(mfiComplaints, /GRANT SELECT,INSERT,UPDATE ON TABLE mfi_customer_complaints/);
});

test('MFI risk holds require independent review and immutable release evidence', () => {
  assert.match(mfiRiskFlags, /CREATE TABLE mfi_member_risk_flags/);
  assert.match(mfiRiskFlags, /mfi_member_risk_scope/);
  assert.match(mfiRiskFlags, /Risk flag review requires an independent actor and reason/);
  assert.match(mfiRiskFlags, /Risk hold release requires an independent actor and reason/);
  assert.match(mfiRiskFlags, /Member risk history cannot be deleted/);
});

test('MFI daily disbursement cap is versioned and checked at serialized posting', () => {
  assert.match(mfiDailyLimits,/CREATE TABLE mfi_disbursement_limit_versions/);
  assert.match(mfiDailyLimits,/Limit decision requires an independent reviewer and reason/);
  assert.match(mfiDailyLimits,/CREATE UNIQUE INDEX mfi_disbursement_limit_one_active_idx/);
  assert.match(mfiRouter,/mfi_disbursement_limit_versions WHERE institution_id=\$1 AND status='active'/);
  assert.match(mfiRouter,/approved daily institution disbursement limit would be exceeded/);
});

test('MFI trial balance supports formula-safe CSV exports', () => {
  assert.match(mfiRouter, /reports\/trial-balance/);
  assert.match(mfiRouter, /format.*enum\(\['json','csv'\]\)/);
  assert.match(mfiRouter, /toCsv\(rows, \['account_code','account_name','account_type','debits','credits','balance'\]\)/);
});

test('lead ownership protection and reassignment are configurable, reasoned, and append-only', () => {
  assert.match(leadProtection, /lead_protection_days', 90/);
  assert.match(leadProtection, /protected_until/);
  assert.match(leadProtection, /lead_attribution_history/);
  assert.match(leadProtection, /AFTER INSERT OR UPDATE ON leads/);
  assert.match(leadProtection, /Lead attribution history is append-only/);
  assert.match(leadProtection, /leads_platform_reassignment/);
  assert.match(server, /INSERT INTO leads \(lead_type, name, phone, source_agent_id, protected_until\)/);
  assert.match(server, /\/admin\/leads\/:id\/reassign/);
  assert.match(server, /target_agent_id: z\.string\(\)\.uuid\(\), reason: z\.string\(\)\.trim\(\)\.min\(10\)/);
  assert.match(leadProtection, /lead_has_non_cancelled_contract\(uuid\)/);
  assert.match(leadProtection, /Platform administrator access is required/);
  assert.match(server, /lead_has_non_cancelled_contract\(\$1\) AS has_contract/);
  assert.match(server, /contract\.rows\[0\]\.has_contract\) throw new HttpError\(409, 'A lead with a non-cancelled contract cannot be reassigned'/);
});

test('agent staffing lifecycle access is limited to the agent hierarchy', () => {
  assert.match(agentScopedStaffing, /workers_agent_reservation_update/);
  assert.match(agentScopedStaffing, /job_requests_agent_lifecycle_update/);
  assert.match(agentScopedStaffing, /CREATE POLICY matches_scope ON matches/);
  assert.match(agentScopedStaffing, /app_role\(\) IN \('master_agent','field_agent'\)/);
  assert.match(agentScopedStaffing, /app_can_access_agent\(source_agent_id\)/);
  assert.match(agentScopedStaffing, /app_can_access_agent\(r\.source_agent_id\)/);
  assert.doesNotMatch(agentScopedStaffing, /GRANT\s+ALL|BYPASSRLS/i);
});

test('agents can only submit scoped pending rent and deposit transactions', () => {
  assert.match(agentFinancialFacilitation, /rent_transactions_read_scope/);
  assert.match(agentFinancialFacilitation, /rent_transactions_staff_write/);
  assert.match(agentFinancialFacilitation, /rent_transactions_agent_facilitation/);
  assert.match(agentFinancialFacilitation, /FOR INSERT/);
  assert.match(agentFinancialFacilitation, /recorded_by = app_user_id\(\)/);
  assert.match(agentFinancialFacilitation, /status = 'pending'/);
  assert.match(agentFinancialFacilitation, /kind = 'rent'/);
  assert.match(agentFinancialFacilitation, /kind = 'deposit'/);
  assert.match(agentFinancialFacilitation, /app_can_access_agent\(l\.source_agent_id\)/);
  assert.match(operations, /ops\.post\('\/charges\/:id\/pay', requireActivity\('rent\.payments\.submit'\)/);
  assert.match(operations, /ops\.post\('\/leases\/:id\/deposit\/pay', requireActivity\('rent\.payments\.submit'\)/);
  assert.match(operations, /ops\.post\('\/leases\/:id\/deposit\/refund', requireActivity\('rent\.deposit\.refund_request'\)/);
  assert.match(operations, /ops\.post\('\/rent-transactions\/:id\/reconcile', requireActivity\('rent\.transactions\.reconcile'\)/);
});

test('property owners can read rent transactions only for their own statements', () => {
  assert.match(ownerRentTransactionRead, /CREATE POLICY rent_transactions_owner_read ON rent_transactions/);
  assert.match(ownerRentTransactionRead, /FOR SELECT/);
  assert.match(ownerRentTransactionRead, /app_role\(\) = 'property_owner'/);
  assert.match(ownerRentTransactionRead, /p\.owner_user_id = app_user_id\(\)/);
  assert.doesNotMatch(ownerRentTransactionRead, /FOR (?:ALL|INSERT|UPDATE|DELETE)/);
});

test('lease lifecycle evidence is scoped and append-only while the legacy lease route remains intact', () => {
  assert.match(leaseLifecycle, /CREATE TABLE lease_documents/);
  assert.match(leaseLifecycle, /CREATE TABLE lease_versions/);
  assert.match(leaseLifecycle, /CREATE TABLE lease_lifecycle_events/);
  assert.match(leaseLifecycle, /Lease lifecycle evidence is append-only/);
  assert.match(leaseLifecycle, /ENABLE ROW LEVEL SECURITY/);
  assert.match(leaseLifecycle, /FORCE ROW LEVEL SECURITY/);
  assert.match(leaseLifecycle, /lease_versions_scope/);
  assert.match(leaseLifecycle, /lease_lifecycle_events_insert/);
  assert.match(leaseLifecycle, /property_units_lifecycle_execute/);
  assert.match(leaseLifecycle, /rent_charges_lifecycle_insert/);
  assert.match(leaseLifecycle, /property\.tenancy\.approve/);
  assert.match(leaseLifecycle, /property\.tenancy\.execute/);
  assert.match(leaseLifecycle, /Existing lease state captured during additive lifecycle migration/);
  assert.match(leaseLifecycle, /Versioned lease terms are immutable/);
  assert.match(operations, /ops\.post\('\/leases\/workflow', requireActivity\('property\.tenancy\.manage'\)/);
  assert.match(operations, /ops\.post\('\/leases\/:id\/approve', requireActivity\('property\.tenancy\.approve'\)/);
  assert.match(operations, /ops\.post\('\/leases\/:id\/execute', requireActivity\('property\.tenancy\.execute'\)/);
  assert.match(operations, /ops\.post\('\/leases', requireActivity\('property\.tenancy\.manage'\)/);
  assert.match(operations, /signature_evidence_only: true/);
  const signatureDownloadRoute = operations.split("ops.get('/lease-signature-documents/:id/file'")[1]
    ?.split("ops.post('/leases/:id/execute'")[0] ?? '';
  assert.match(signatureDownloadRoute, /SELECT id,lease_id,storage_key,mime FROM lease_documents/);
  assert.match(signatureDownloadRoute, /lease_signature_evidence_downloaded/);
  assert.match(signatureDownloadRoute, /document_id: row\.id/);
});

test('lease notice records are scoped, append-only, idempotent, and non-terminating', () => {
  assert.match(leaseNoticeRecords, /CREATE TABLE lease_notices/);
  assert.match(leaseNoticeRecords, /UNIQUE \(lease_id, idempotency_key\)/);
  assert.match(leaseNoticeRecords, /ENABLE ROW LEVEL SECURITY/);
  assert.match(leaseNoticeRecords, /FORCE ROW LEVEL SECURITY/);
  assert.match(leaseNoticeRecords, /Lease notice records are append-only/);
  assert.match(leaseNoticeRecords, /GRANT SELECT, INSERT ON TABLE lease_notices/);
  assert.match(operations, /ops\.post\('\/leases\/:id\/notices', requireActivity\('property\.tenancy\.manage'\)/);
  assert.match(operations, /legal_effect: 'record_only'/);
  assert.match(operations, /ON CONFLICT \(lease_id,idempotency_key\) DO NOTHING/);
  assert.match(operations, /ops\.get\('\/leases\/:id\/notices'/);
});

test('service identity lifecycle evidence and release approvals are platform-admin scoped', () => {
  assert.match(financeAndIdentityControls, /service_identity_events/);
  assert.match(financeAndIdentityControls, /Service identity events are append-only/);
  assert.match(financeAndIdentityControls, /ALTER TABLE service_identities FORCE ROW LEVEL SECURITY/);
  assert.match(financeAndIdentityControls, /app_role\(\) IN \('global_admin','super_admin'\)/);
  assert.ok(financeAndIdentityControls.includes("secret_manager_reference ~ '^(vault|aws-sm|azure-kv)://[A-Za-z0-9._/-]+$'"));
  assert.match(financeAndIdentityControls, /ALTER TABLE release_approvals FORCE ROW LEVEL SECURITY/);
  assert.match(financeAndIdentityControls, /approver_role = app_role\(\)/);
  assert.match(financeAndIdentityControls, /approver_name = \(SELECT legal_name FROM users WHERE id=app_user_id\(\)\)/);
  assert.match(operations, /ops\.post\('\/service-identities\/:id\/rotate', requireRole\('super_admin', 'global_admin'\)/);
  assert.match(operations, /ops\.post\('\/service-identities\/:id\/retire', requireRole\('super_admin', 'global_admin'\)/);
});

test('production readiness evidence is append-only and platform-admin scoped', () => {
  assert.match(readinessEvidence, /CREATE TABLE release_readiness_evidence/);
  assert.match(readinessEvidence, /ENABLE ROW LEVEL SECURITY/);
  assert.match(readinessEvidence, /FORCE ROW LEVEL SECURITY/);
  assert.match(readinessEvidence, /Release readiness evidence is append-only/);
  assert.match(readinessEvidence, /recorded_by = app_user_id\(\)/);
  assert.match(readinessEvidence, /recorded_by_role = coalesce\(nullif\(current_setting\('app\.role', true\), ''\), ''\)/);
  assert.match(readinessEvidence, /REVOKE ALL ON TABLE release_readiness_evidence FROM "\{\{role\}\}"/);
  assert.match(readinessEvidence, /GRANT SELECT, INSERT ON TABLE release_readiness_evidence TO "\{\{role\}\}"/);
  assert.match(operations, /ops\.post\('\/readiness-evidence', requireRole\('super_admin','global_admin'\)/);
  assert.match(operations, /ops\.get\('\/readiness-evidence', requireRole\('super_admin','global_admin'\)/);
});

test('global admin release approvals compare the raw authenticated role', () => {
  assert.match(globalAdminReleaseApprovalRole, /DROP POLICY release_approvals_insert/);
  assert.match(globalAdminReleaseApprovalRole, /approver_role = coalesce\(nullif\(current_setting\('app\.role', true\), ''\), ''\)/);
  assert.match(globalAdminReleaseApprovalRole, /approver_name = \(SELECT legal_name FROM users WHERE id=app_user_id\(\)\)/);
});

test('rent submission RLS relies on unique indexes instead of recursive self-queries', () => {
  assert.match(rentRlsRecursionFix, /DROP POLICY rent_transactions_agent_facilitation ON rent_transactions/);
  assert.match(rentRlsRecursionFix, /DROP POLICY rent_transactions_activity_submit ON rent_transactions/);
  assert.doesNotMatch(rentRlsRecursionFix, /FROM rent_transactions prior/);
  assert.match(rentRlsRecursionFix, /app_can_access_agent\(l\.source_agent_id\)/);
});

test('MFI sandbox runs are tenant-scoped, append-only, and cannot carry real provider effects', () => {
  assert.match(mfiSandbox, /CREATE TABLE mfi_sandbox_runs/);
  assert.match(mfiSandbox, /ENABLE ROW LEVEL SECURITY/);
  assert.match(mfiSandbox, /FORCE ROW LEVEL SECURITY/);
  assert.match(mfiSandbox, /mfi_has_access\(institution_id\)/);
  assert.match(mfiSandbox, /production_side_effects'='false'/);
  assert.match(mfiSandbox, /real_customer_data_used'='false'/);
  assert.match(mfiSandbox, /SELECT,INSERT ON TABLE mfi_sandbox_runs/);
  assert.match(mfiSandbox, /Sandbox simulation records are append-only/);
  assert.match(mfiRouter, /mfi_sandbox_simulation_run/);
});

test('MFI loan application and disbursement require independently reviewed member KYC', () => {
  assert.match(mfiKyc,/CREATE FUNCTION mfi_guard_member_kyc_review/);
  assert.match(mfiKyc,/KYC review requires an independent reviewer and documented reason/);
  assert.match(mfiKyc,/mfi_journal_disbursement_kyc_guard/);
  assert.match(mfiRouter,/Member KYC must be independently verified before applying for credit/);
  assert.match(mfiRouter,/Member KYC must be independently verified before disbursement/);
  assert.match(mfiRouter,/members\/:memberId\/kyc-review/);
});

test('MFI identity documents require independent review and a verified national ID before KYC approval', () => {
  assert.match(mfiDocuments, /CREATE TABLE mfi_loan_documents/);
  assert.match(mfiDocuments, /size_bytes BETWEEN 1 AND 10485760/);
  assert.match(mfiDocuments, /mfi_loan_document_guard/);
  assert.match(mfiDocuments, /mfi_member_national_id_kyc_guard/);
  assert.match(mfiRouter, /members\/:memberId\/documents\/:documentType/);
  assert.match(mfiRouter, /documents\/:documentId\/review/);
});

test('MFI loan write-offs require an independent authorized decision and a linked balanced loss journal', () => {
  assert.match(mfiWriteoffs, /CREATE TABLE mfi_loan_writeoffs/);
  assert.match(mfiWriteoffs, /Loan write-off journal must match a pending independently reviewed request/);
  assert.match(mfiWriteoffs, /mfi_journals_writeoff_link_check/);
  assert.match(mfiWriteoffActorControls, /mfi_user_has_role\(NEW\.institution_id,ARRAY\['institution_admin','finance_manager','compliance'\]\)/);
  assert.match(mfiWriteoffActorControls, /Loan write-off decision requires an independent authorized reviewer and reason/);
  assert.match(mfiRouter, /mfi_loan_writeoffs/);
  assert.match(mfiRouter, /loan_writeoff/);
  assert.match(mfiRouter, /post\('\/institutions\/:institutionId\/loans\/:loanId\/writeoffs'/);
  assert.match(mfiRouter, /post\('\/institutions\/:institutionId\/writeoffs\/:writeoffId\/decision'/);
});

test('WF-D attendance, reviewed corrections, and payroll payloads enforce separate RLS boundaries', () => {
  assert.match(workforceWorkflows, /FORCE ROW LEVEL SECURITY/);
  assert.match(workforceWorkflows, /workforce_clock_events_immutable/);
  assert.match(workforceWorkflows, /NEW\.clock_in_at IS DISTINCT FROM source_clock_in/);
  assert.match(workforceWorkflows, /NEW\.clock_out_at IS DISTINCT FROM source_clock_out/);
  assert.match(workforceWorkflows, /workforce_reviewed_correction_immutable/);
  assert.match(workforceWorkflows, /workforce_approved_policy_immutable/);
  assert.match(workforceWorkflows, /workforce_exported_time_immutable/);
  assert.match(workforceWorkflows, /CREATE TABLE workforce_payroll_export_payloads/);
  assert.match(workforceWorkflows, /workforce_payroll_export_payloads_manager_all/);
  assert.match(workforceWorkflows, /workforce_time_corrections_one_pending_per_shift_idx/);
  assert.match(workforceWorkflows, /app_offboard_worker/);
  assert.match(workforceWorkflows, /UPDATE auth_sessions SET revoked_at=now\(\)/);
  assert.match(workforceWorkflows, /set_config\('app\.access_change_reason',trim\(reason\),true\)/);
  assert.match(workforceWorkflows, /AND status='scheduled' AND starts_at>now\(\)/);
});

test('WF-D shift acceptance serializes with offboarding without bypassing worker RLS', () => {
  const start = workforceOperations.indexOf("workforceOperations.post('/workforce/shifts/:id/response'");
  const end = workforceOperations.indexOf("workforceOperations.post('/workforce/shifts/:id/cancel'", start);
  const route = workforceOperations.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /pg_advisory_xact_lock\([\s\S]*?hashtextextended\('workforce-worker:'/);
  assert.match(route, /workerState\.employment_status !== 'active' \|\| workerState\.engagement_status !== 'active'/);
  assert.match(workforceOffboardingSerialization, /PERFORM pg_advisory_xact_lock\([\s\S]*?hashtextextended\('workforce-worker:'/);
  assert.match(workforceOffboardingSerialization, /UPDATE auth_sessions SET revoked_at=now\(\)/);
  assert.ok(route.indexOf('pg_advisory_xact_lock') < route.indexOf('SET worker_response='));
});

test('session device management records bounded browser metadata without storing network addresses', () => {
  assert.match(sessionDeviceManagement, /ADD COLUMN user_agent text CHECK \(user_agent IS NULL OR length\(user_agent\) <= 512\)/);
});

test('support cases preserve urgent escalation, independent access approval, and append-only history', () => {
  assert.match(supportCases,/category IN \('general','service','agent_complaint','financial','legal','privacy','safety','fraud'\)/);
  assert.match(supportCases,/category NOT IN \('safety','fraud','privacy','legal'\) OR priority='urgent'/);
  assert.match(supportCases,/support_case_events_immutable/);
  assert.match(supportCases,/record_support_case_status_transition/);
  assert.match(supportCases,/support_cases_owner_appeal/);
  assert.match(supportCases,/Resolved support cases are immutable except for a user appeal/);
  assert.match(supportCases,/reviewed_by<>requested_by/);
  assert.match(supportCases,/expires_at <= reviewed_at \+ interval '15 minutes'/);
  assert.match(supportCases,/formal_workflow_reference IS NOT NULL/);
  assert.match(supportCases,/Support case intake evidence is immutable/);
});

test('WPSA conversations isolate transcripts to owners and claimed support agents', () => {
  assert.match(workforcePropertySupportAssistant,/CREATE TABLE assistant_conversations/);
  assert.match(workforcePropertySupportAssistant,/CREATE TABLE assistant_messages/);
  assert.match(workforcePropertySupportAssistant,/CREATE POLICY assistant_conversations_owner_read/);
  assert.match(workforcePropertySupportAssistant,/assigned_to=app_user_id\(\)[\s\S]*?app_role\(\) IN \('global_admin','super_admin','compliance','corporate_business_manager'\)/);
  assert.match(workforcePropertySupportAssistant,/CREATE POLICY assistant_messages_authorized_read/);
  assert.match(workforcePropertySupportAssistant,/CREATE POLICY assistant_messages_owner_insert/);
  assert.match(workforcePropertySupportAssistant,/CREATE POLICY assistant_messages_staff_insert/);
  assert.match(workforcePropertySupportAssistant,/CREATE OR REPLACE FUNCTION app_claim_assistant_conversation/);
  assert.match(workforcePropertySupportAssistant,/WHERE id=target_conversation AND \(assigned_to IS NULL OR assigned_to=app_user_id\(\)\)/);
  assert.match(workforcePropertySupportAssistant,/CREATE OR REPLACE FUNCTION app_assistant_conversation_queue/);
  assert.match(workforcePropertySupportAssistant,/CREATE TABLE assistant_support_presence/);
  assert.match(workforcePropertySupportAssistant,/updated_at>now\(\)-interval '2 minutes'/);
  assert.match(workforcePropertySupportAssistant,/CREATE POLICY assistant_presence_staff_update/);
  assert.match(operations,/ops\.post\('\/assistant\/conversations\/:id\/claim', requireRole\(\.\.\.SUPPORT_STAFF\)/);
  assert.match(operations,/ops\.post\('\/assistant\/conversations\/:id\/messages'/);
  assert.match(operations,/sender_type: senderType/);
  assert.match(publicApp,/assistant-launcher/);
  assert.match(publicApp,/Your support request is private to you and the support agent who claims it/);
});

test('support case details and timelines require owner or active independent approval at the database boundary', () => {
  assert.match(supportCaseAccessHardening,/CREATE OR REPLACE FUNCTION app_support_case_can_access\(target_case uuid\)/);
  assert.match(supportCaseAccessHardening,/a\.status = 'approved'/);
  assert.match(supportCaseAccessHardening,/a\.expires_at > now\(\)/);
  assert.match(supportCaseAccessHardening,/CREATE POLICY support_cases_authorized_read ON support_cases/);
  assert.match(supportCaseAccessHardening,/CREATE POLICY support_case_events_authorized_read ON support_case_events/);
  assert.match(supportCaseAccessHardening,/CREATE OR REPLACE FUNCTION app_support_case_queue\(\)/);
  assert.match(supportCaseAccessHardening,/c\.id, c\.category, c\.priority, c\.status, c\.created_at, c\.updated_at/);
  assert.match(supportCaseAccessHardening,/app_role\(\) IN \('global_admin','super_admin','compliance','corporate_business_manager'\)/);
  assert.match(supportCaseAccessHardening,/REVOKE UPDATE ON support_case_access_requests FROM "\{\{role\}\}"/);
  assert.match(supportCaseAccessHardening,/GRANT UPDATE \(status, reviewed_by, review_reason, reviewed_at, expires_at\)/);
});

test('support case appeals have a private queue and independent append-only review outcomes', () => {
  assert.match(supportCaseAppealReview,/CREATE TABLE support_case_appeal_reviews/);
  assert.match(supportCaseAppealReview,/case_id uuid NOT NULL UNIQUE REFERENCES support_cases\(id\)/);
  assert.match(supportCaseAppealReview,/decision text NOT NULL CHECK \(decision IN \('upheld','overturned'\)\)/);
  assert.match(supportCaseAppealReview,/c\.resolved_by <> app_user_id\(\)/);
  assert.match(supportCaseAppealReview,/app_support_case_can_access\(case_id\)/);
  assert.match(supportCaseAppealReview,/app_support_case_can_request_access\(case_id\)/);
  assert.match(supportCaseAppealReview,/c\.resolved_by <> app_user_id\(\)/);
  assert.match(supportCaseAppealReview,/support_case_appeal_reviews_immutable/);
  assert.match(supportCaseAppealReview,/CREATE OR REPLACE FUNCTION app_support_appeal_queue\(\)/);
  assert.match(supportCaseAppealReview,/c\.status = 'appealed'/);
  assert.match(supportCaseAppealReview,/NOT EXISTS \([\s\S]*support_case_appeal_reviews/);
  assert.match(supportCaseAppealReview,/appeal_reviewed/);
  assert.match(operations,/support\/cases\/:id\/appeal-review/);
});

test('maintenance completion requires an independent authorized review', () => {
  assert.match(maintenanceCompletionReview,/completion_submitted_by uuid REFERENCES users\(id\)/);
  assert.match(maintenanceCompletionReview,/reviewed_by <> completion_submitted_by/);
  assert.match(maintenanceCompletionReview,/app_role\(\) NOT IN \('corporate_business_manager','super_admin','global_admin'\)/);
  assert.match(maintenanceCompletionReview,/CREATE TRIGGER maintenance_workflow_transition_guard/);
  assert.match(maintenanceCompletionReview,/Maintenance work submission is incomplete/);
  assert.match(maintenanceCompletionReview,/Maintenance cancellation requires a reason/);
  assert.match(operations,/canTransitionMaintenance\(m\.status, b\.status\)/);
  assert.match(operations,/requiresMaintenanceReview\(b\.status\)/);
});

test('maintenance vendor access is assignment-scoped and invoice mismatches require a decision', () => {
  assert.match(maintenanceVendorFulfillment,/CREATE TABLE property_vendor_memberships/);
  assert.match(maintenanceVendorFulfillment,/user_signups_account_type_check/);
  assert.match(maintenanceVendorFulfillment,/property_vendor.*national_id/s);
  assert.match(maintenanceVendorFulfillment,/user_signups_vendor_account_check/);
  assert.match(maintenanceVendorFulfillment,/UPDATE property_vendor_bills bill/);
  assert.match(maintenanceVendorFulfillment,/assigned_vendor_id IS NULL/);
  assert.match(admin,/INSERT INTO user_signups\(user_id,account_type,payment_status,vendor_id\)/);
  assert.match(admin,/INSERT INTO property_vendor_memberships\(vendor_id,user_id,created_by\)/);
  assert.match(operations,/!body\.assigned_to && !body\.assigned_vendor_id/);
  assert.match(maintenanceVendorFulfillment,/CREATE POLICY maintenance_vendor_assigned_read/);
  assert.match(maintenanceVendorFulfillment,/CREATE POLICY maintenance_vendor_assigned_update/);
  assert.match(maintenanceVendorFulfillment,/enforce_maintenance_vendor_update_scope/);
  assert.match(maintenanceVendorFulfillment,/completion_idempotency_key uuid UNIQUE/);
  assert.match(maintenanceVendorFulfillment,/CREATE TABLE maintenance_evidence/);
  assert.match(maintenanceVendorFulfillment,/CREATE TABLE maintenance_cost_change_requests/);
  assert.match(maintenanceVendorFulfillment,/property_vendor_bills_vendor_insert/);
  assert.match(maintenanceVendorFulfillment,/match_status IN \('unmatched','matched','mismatch','accepted_exception'\)/);
  assert.match(maintenanceVendorFulfillment,/CREATE TABLE maintenance_sla_escalations/);
  assert.match(maintenanceSlaEscalationIndex,/ON maintenance_requests \(sla_due_at, id\)/);
  assert.match(maintenanceSlaEscalationIndex,/status NOT IN \('completed','done','cancelled'\)/);
  assert.match(propertyVendorPortal,/maintenance\/vendor\/:id\/complete/);
  assert.match(operations,/maintenance\/sla\/overdue/);
  assert.match(server,/dispatchMaintenanceSlaEscalations\(pool\)/);
  assert.match(maintenanceSlaDispatcher,/ON CONFLICT \(maintenance_request_id,escalation_level,recipient_id\) DO NOTHING/);
  assert.match(maintenanceSlaDispatcher,/WITH eligible_recipients AS/);
  assert.match(maintenanceSlaDispatcher,/maintenance_sla_escalation/);
  assert.match(maintenanceSlaDispatcher,/property_vendor_memberships/);
  assert.match(maintenanceSlaDispatcher,/corporate_business_manager/);
  assert.match(maintenanceSlaDispatcher,/global_admin','super_admin/);
});

test('V11 rental applications require an approved vacant listing, explicit consent, human review, and private append-only history', () => {
  assert.match(propertyRentalApplications,/applicant_user_id uuid NOT NULL REFERENCES users\(id\)/);
  assert.match(propertyRentalApplications,/contact_consent boolean NOT NULL CHECK \(contact_consent\)/);
  assert.match(propertyRentalApplications,/CREATE UNIQUE INDEX property_rental_applications_one_open_idx/);
  assert.match(propertyRentalApplications,/p\.status='available'/);
  assert.match(propertyRentalApplications,/p\.listing_review_status='approved'/);
  assert.match(propertyRentalApplications,/p\.listing_mode IN \('rent','sale_or_rent'\)/);
  assert.match(propertyRentalApplications,/u\.occupancy='vacant'/);
  assert.match(propertyRentalApplications,/FORCE ROW LEVEL SECURITY/);
  assert.match(propertyRentalApplications,/applicant_user_id=app_user_id\(\) OR app_can_manage_rental_application\(property_id\)/);
  assert.match(propertyRentalApplications,/Only an authorized independent property reviewer may decide an application/);
  assert.match(propertyRentalApplications,/A reason is required for an adverse rental application decision/);
  assert.match(propertyRentalApplications,/Rental application history is append-only/);
  assert.match(marketplaceRouter,/Idempotency-Key was already used for a different rental application/);
  assert.match(marketplaceRouter,/Only an application requesting more information can receive a response/);
  assert.match(marketplaceRouter,/Only a submitted application can be reviewed/);
  assert.match(marketplaceRouter,/property_rental_application_events/);
  assert.match(marketplaceRouter,/scanWithClamAv\(file\)/);
  assert.match(marketplaceRouter,/Marketplace media upload is unavailable until the malware scanner is configured/);
  assert.match(propertyManagementRouter,/scanWithClamAv\(file\)/);
  assert.match(propertyManagementRouter,/Property media upload is unavailable until the malware scanner is configured/);
  assert.match(publicApp,/form\.dataset\.form === 'rental-application'/);
  assert.match(publicApp,/I agree to share my account name and this message/);
  assert.match(publicApp,/AfroLife does not run automated tenant screening/);
  assert.match(publicApp,/rental-application-review/);
});

test('resident lease self-service requires a one-time claim and scopes property, payment, document, and maintenance access', () => {
  assert.match(propertyTenantSelfService,/CREATE TABLE property_tenant_access_invitations/);
  assert.match(propertyTenantSelfService,/token_hash text NOT NULL UNIQUE/);
  assert.match(propertyTenantSelfService,/CREATE UNIQUE INDEX property_tenant_access_invitation_open_lease_idx/);
  assert.match(propertyTenantSelfService,/CREATE TABLE property_tenant_account_links/);
  assert.match(propertyTenantSelfService,/NEW\.user_id IS DISTINCT FROM actor OR app_role\(\)<>'customer'/);
  assert.match(propertyTenantSelfService,/account\.phone=tenant\.phone/);
  assert.match(propertyTenantSelfService,/FORCE ROW LEVEL SECURITY/);
  assert.match(propertyTenantSelfService,/token_hash=current_setting\('app\.property_tenant_invite_hash',true\)/);
  assert.match(propertyTenantSelfService,/CREATE POLICY leases_linked_resident_read/);
  assert.match(propertyTenantSelfService,/CREATE POLICY rent_charges_linked_resident_read/);
  assert.match(propertyTenantSelfService,/CREATE POLICY rent_transactions_linked_resident_read/);
  assert.match(propertyTenantSelfService,/CREATE POLICY lease_documents_linked_resident_read/);
  assert.match(propertyTenantSelfService,/CREATE POLICY maintenance_linked_resident_insert/);
  assert.match(operations,/ops\.post\('\/resident\/access\/claim', requireRole\('customer'\)/);
  assert.match(operations,/ops\.get\('\/resident\/property-workspace', requireRole\('customer'\)/);
  assert.match(operations,/ops\.post\('\/resident\/maintenance', requireRole\('customer'\)/);
  assert.match(operations,/randomBytes\(32\)\.toString\('hex'\)/);
  assert.match(operations,/createHash\('sha256'\)\.update\(claimCode\.toLowerCase\(\)\)/);
  assert.match(operations,/tenant access invitation is invalid, expired, or already used/i);
  assert.match(server,/api\.use\(\['\/resident'\], requireMiniAppAccess\('properties'\)\)/);
  assert.match(propertyVendorPortal,/req\.user\?\.role === 'customer'\) return requireMiniAppAccess\('properties'\)/);
  assert.match(publicApp,/Resident self-service/);
  assert.match(publicApp,/resident-access-claim/);
  assert.match(publicApp,/resident-maintenance/);
  assert.match(publicApp,/Issue one-time resident access code/);
});

test('property publication requires independent owner-authority review and scanned evidence', () => {
  assert.match(propertyOwnerAuthorityReview,/authority_review_status text NOT NULL DEFAULT 'pending_review'/);
  assert.match(propertyOwnerAuthorityReview,/CREATE TABLE property_authority_evidence/);
  assert.match(propertyOwnerAuthorityReview,/scan_status text NOT NULL CHECK \(scan_status = 'clean'\)/);
  assert.match(propertyOwnerAuthorityReview,/CREATE TRIGGER property_authority_evidence_immutable/);
  assert.match(propertyOwnerAuthorityReview,/CREATE TRIGGER property_authority_review_events_insert_guard/);
  assert.match(propertyOwnerAuthorityReview,/CREATE TRIGGER properties_authority_review_guard/);
  assert.match(propertyOwnerAuthorityReview,/Only an independent reviewer may decide a pending property authority review/);
  assert.match(propertyOwnerAuthorityReview,/Property authority approval requires malware-scanned evidence/);
  assert.match(propertyOwnerAuthorityReview,/subject\.active = true AND subject\.kyc_status = 'verified'/);
  assert.match(propertyOwnerAuthorityReview,/p\.listing_review_status = 'approved' AND p\.authority_review_status = 'approved'/);
  assert.match(propertyManagementRouter,/scanWithClamAv\(file\)/);
  assert.match(propertyManagementRouter,/authority-evidence/);
  assert.match(propertyManagementRouter,/authority-resubmit/);
  assert.match(propertyManagementRouter,/authority-review/);
  assert.match(propertyManagementRouter,/A different reviewer must decide this property authority review/);
  assert.match(propertyManagementRouter,/kyc_status='verified'/);
  assert.match(publicApp,/Submit ownership or delegated-authority evidence/);
  assert.match(publicApp,/property-authority-review/);
  assert.match(publicApp,/property-authority-file/);
  assert.match(publicApp,/Owner-authority review queue/);
});

test('global admins can independently review property authority evidence', () => {
  assert.match(globalAdminPropertyAuthorityReview,/app_role\(\) IN \('global_admin','super_admin','corporate_business_manager'\)/);
  assert.match(globalAdminPropertyAuthorityReview,/DROP POLICY property_authority_review_events_insert/);
  assert.match(globalAdminPropertyAuthorityReview,/Only an independent reviewer may decide a pending property authority review/);
  assert.match(globalAdminPropertyAuthorityReview,/actor = OLD\.created_by/);
  assert.match(propertyManagementRouter,/authority-review', requireRole\('global_admin', 'super_admin', 'corporate_business_manager'\)/);
  assert.match(publicApp,/state\.propertyAuthorityReviewQueue = \['global_admin','super_admin','corporate_business_manager'\]/);
  assert.match(publicApp,/if \(\['global_admin','super_admin','corporate_business_manager'\]\.includes\(state\.user\.role\)\) \{\s+const authorityQueue/);
});

test('lease rent commencement remains separate from term commencement and handover', () => {
  assert.match(leaseRentStartDate,/ADD COLUMN rent_start_on date/);
  assert.match(leaseRentStartDate,/SET rent_start_on = start_date/);
  assert.match(leaseRentStartDate,/rent_start_on >= start_date AND rent_start_on <= end_date/);
  assert.match(leaseRentStartDate,/Versioned lease rent commencement is immutable/);
  assert.match(operations,/rent_start_on: z\.string\(\)\.date\(\)\.optional\(\)/);
  assert.match(operations,/rentScheduleForPeriod\(lease\.rent_start_on, lease\.end_date/);
  assert.match(operations,/rent_commencement_recorded/);
  assert.match(publicApp,/field\('Rent commencement date', 'rent_start_on', 'date', true\)/);
  assert.match(publicApp,/Rent commencement date/);
  assert.match(publicApp,/Lease commencement, rent commencement, signature, and possession handover are recorded separately/);
});

test('notification delivery retries are bounded, idempotent, and operator-visible', () => {
  assert.match(notificationDeliveryRetries,/total_attempt_count integer/);
  assert.match(notificationDeliveryRetries,/status IN \('pending','sending','sent','read','dead'\)/);
  assert.match(notificationDispatcher,/idempotency-key/);
  assert.match(notificationDispatcher,/attempt_count >= 12/);
  assert.match(publicApp,/Webhook notification delivery/);
  assert.match(operations,/notifications\/:id\/retry/);
});

test('payroll handoff outcomes are retained as append-only evidence', () => {
  assert.match(payrollHandoffHistory,/CREATE TABLE workforce_payroll_export_events/);
  assert.match(payrollHandoffHistory,/BEFORE UPDATE OR DELETE/);
  assert.match(payrollHandoffHistory,/app_has_permission\('workforce\.payroll\.export'\)/);
  assert.match(workforceOperations,/INSERT INTO workforce_payroll_export_events/);
  assert.match(workforceOperations,/workforce\/payroll-exports\/:id\/events/);
});

test('failed payroll rows are retried only from authenticated, immutable source rows', () => {
  assert.match(payrollFailedRowRequeue,/row_number integer/);
  assert.match(payrollFailedRowRequeue,/DROP CONSTRAINT workforce_payroll_export_items_time_entry_id_key/);
  assert.match(payrollFailedRowRequeue,/PRIMARY KEY \(source_export_id,row_number\)/);
  assert.match(payrollFailedRowRequeue,/workforce_payroll_export_requeue_rows_validate/);
  assert.match(payrollFailedRowRequeue,/Payroll retry row is not part of the recorded failed-row selection/);
  assert.match(payrollFailedRowRequeue,/Only an export with recorded handoff status can be requeued/);
  assert.match(payrollFailedRowRequeue,/Previously exported time can only be reissued for explicitly failed rows/);
  assert.match(payrollFailedRowRequeue,/DEFERRABLE INITIALLY DEFERRED/);
  assert.match(payrollFailedRowRequeue,/exactly the explicitly failed source rows/);
  assert.match(payrollFailedRowRequeue,/Payroll failed-row requeue evidence is append-only/);
  assert.match(payrollFailedRowRequeue,/ENABLE ROW LEVEL SECURITY/);
  assert.match(workforceOperations,/workforce\/payroll-exports\/:id\/requeue-failed/);
  assert.match(workforceOperations,/FOR UPDATE/);
  assert.match(workforceOperations,/idempotency_key/);
  assert.match(workforceOperations,/readPayrollExportCsv\(payload\.encrypted_payload/);
  assert.match(workforceOperations,/selectCsvRows\(csv, rowNumbers\)/);
  assert.match(workforceOperations,/already been requeued from this export/);
  assert.match(workforceOperations,/INSERT INTO workforce_payroll_export_requeue_rows/);
});
