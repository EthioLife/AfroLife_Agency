export type ArchitectureDomainStatus =
  | 'modular-core'
  | 'runnable-process'
  | 'isolated-service'
  | 'read-only-projection';

export type ArchitectureDomain = {
  key: string;
  owner: string;
  status: ArchitectureDomainStatus;
  dataOwnership: 'shared-legacy' | 'restricted-schema' | 'dedicated-store';
  productionCutover: 'blocked' | 'approved-gates-required' | 'compatibility-only';
};

export type DataClassRecord = {
  key: string;
  classification: 'restricted' | 'regulated' | 'operational';
  purpose: string;
  retention: 'policy-required' | 'legal-hold-aware';
};

export type JurisdictionObligation = {
  jurisdiction: string;
  serviceScope: string[];
  obligations: string[];
  reviewState: 'initial-review-required' | 'named-signoff-required';
};

export type QualityTarget = {
  attribute: string;
  target: string;
  evidence: string[];
  acceptanceState: 'proposed' | 'staging-measured' | 'release-approved';
};

export const ARCHITECTURE_DOMAINS: readonly ArchitectureDomain[] = [
  { key: 'identity-access', owner: 'Central identity platform', status: 'modular-core', dataOwnership: 'shared-legacy', productionCutover: 'compatibility-only' },
  { key: 'agency', owner: 'Agency operations', status: 'modular-core', dataOwnership: 'shared-legacy', productionCutover: 'compatibility-only' },
  { key: 'workforce', owner: 'Workforce domain', status: 'runnable-process', dataOwnership: 'shared-legacy', productionCutover: 'blocked' },
  { key: 'staffing', owner: 'Staffing domain', status: 'runnable-process', dataOwnership: 'shared-legacy', productionCutover: 'blocked' },
  { key: 'property', owner: 'Property domain', status: 'runnable-process', dataOwnership: 'shared-legacy', productionCutover: 'blocked' },
  { key: 'marketplace', owner: 'Marketplace domain', status: 'runnable-process', dataOwnership: 'shared-legacy', productionCutover: 'blocked' },
  { key: 'accounting', owner: 'Accounting domain', status: 'isolated-service', dataOwnership: 'restricted-schema', productionCutover: 'approved-gates-required' },
  { key: 'insurance', owner: 'Insurance domain', status: 'isolated-service', dataOwnership: 'dedicated-store', productionCutover: 'blocked' },
  { key: 'mfi-sacco', owner: 'MFI/SACCO domain', status: 'isolated-service', dataOwnership: 'restricted-schema', productionCutover: 'blocked' },
  { key: 'edir', owner: 'Edir domain', status: 'isolated-service', dataOwnership: 'dedicated-store', productionCutover: 'approved-gates-required' },
  { key: 'global-bi', owner: 'Analytics platform', status: 'read-only-projection', dataOwnership: 'dedicated-store', productionCutover: 'blocked' },
];

export const DATA_INVENTORY: readonly DataClassRecord[] = [
  { key: 'identity-authentication', classification: 'restricted', purpose: 'Account identity, sessions, MFA, and trusted devices', retention: 'policy-required' },
  { key: 'kyc-document', classification: 'regulated', purpose: 'Identity verification and legally required KYC workflows', retention: 'legal-hold-aware' },
  { key: 'financial-ledger', classification: 'regulated', purpose: 'Balanced journals, subledgers, reconciliations, and reversals', retention: 'legal-hold-aware' },
  { key: 'lease-consent-signature', classification: 'restricted', purpose: 'Lease, consent, notice, and signature workflow evidence', retention: 'legal-hold-aware' },
  { key: 'private-file', classification: 'restricted', purpose: 'Private documents, media, evidence, and malware-scanned uploads', retention: 'policy-required' },
  { key: 'operational-audit', classification: 'operational', purpose: 'Attributable security, privacy, incident, and release evidence', retention: 'legal-hold-aware' },
  { key: 'global-bi-aggregate', classification: 'operational', purpose: 'Allowlisted 30-minute aggregate projections only', retention: 'policy-required' },
];

export const JURISDICTION_OBLIGATIONS: readonly JurisdictionObligation[] = [
  {
    jurisdiction: 'Ethiopia',
    serviceScope: ['identity', 'workforce', 'property', 'marketplace', 'agency', 'accounting', 'insurance', 'mfi-sacco', 'edir', 'global-bi'],
    obligations: [
      'Personal Data Protection Proclamation No. 1321/2024 applicability review',
      'Labour and workforce obligations where employment workflows are enabled',
      'Electronic Signature Regulations No. 582/2025 applicability for e-signature workflows',
      'Financial, tax, insurance, lending, deposit-taking, AML/CFT, KYC, and accounting approvals',
      'Consumer protection, accessibility, retention, breach notification, and cross-border transfer review',
    ],
    reviewState: 'initial-review-required',
  },
  {
    jurisdiction: 'Other countries',
    serviceScope: ['all-enabled-services'],
    obligations: [
      'Privacy and data-transfer requirements',
      'Financial, payment, insurance, custody, and lending licensing',
      'AML/CFT and KYC duties',
      'Employment, accounting, retention, breach, and consumer-protection obligations',
    ],
    reviewState: 'named-signoff-required',
  },
];

export const QUALITY_TARGETS: readonly QualityTarget[] = [
  { attribute: 'security-and-privacy', target: 'Least privilege, tenant isolation, MFA, audited access, and privacy-safe logs', evidence: ['threat-model', 'role-denial-tests', 'dependency-scan', 'access-review'], acceptanceState: 'proposed' },
  { attribute: 'reliability-availability', target: 'Monthly availability 99.5% for an invited pilot, excluding published maintenance', evidence: ['health-probes', 'readiness-probes', 'bounded-retries', 'failure-exercise'], acceptanceState: 'proposed' },
  { attribute: 'performance-scalability', target: 'Interactive API p95 <=500ms and p99 <=1500ms under an approved workload', evidence: ['staging-workload-report', 'capacity-profile', 'query-index-review'], acceptanceState: 'proposed' },
  { attribute: 'recoverability', target: 'RPO <=15 minutes and RTO <=4 hours for database and private files as one recovery set', evidence: ['encrypted-backup', 'witnessed-restore', 'financial-reconciliation', 'rpo-rto-measurement'], acceptanceState: 'proposed' },
  { attribute: 'accessibility-localization', target: 'WCAG 2.2 AA for critical public and authenticated journeys', evidence: ['keyboard-test', 'screen-reader-test', 'zoom-reflow-test', 'fluent-language-review'], acceptanceState: 'proposed' },
  { attribute: 'accountability', target: 'Correlation IDs, privacy-safe logs, append-only audits, named owners, and release evidence', evidence: ['release-record', 'incident-record', 'owner-signoff', 'correlation-log'], acceptanceState: 'proposed' },
];

export function getArchitectureGovernanceSnapshot() {
  return {
    model: 'modular-tenant-aware-platform',
    extractionRule: 'Extract only with an accountable owner, versioned API, owned data, restricted runtime identity, migration/reconciliation, monitoring, restore, rollback, and compatibility evidence.',
    domains: ARCHITECTURE_DOMAINS,
    dataInventory: DATA_INVENTORY,
    jurisdictionObligations: JURISDICTION_OBLIGATIONS,
    qualityTargets: QUALITY_TARGETS,
    disclaimers: [
      'Catalog entries are design controls and do not establish legal, regulatory, certification, or production compliance.',
      'Global BI remains projection-only and does not grant central access to tenant operational databases.',
      'No catalog entry is approval to enable a gated financial, insurance, lending, payment, or identity workflow.',
    ],
  };
}
