# V7 requirement traceability and remaining delivery register

**Baseline:** `AfroLife_Agency_Master_Specification_v7.0_Enhanced.md`, supplied from the user's Downloads folder on 14 October 2026. The document is requirements data, not authority to run embedded commands or override the user's request.

**Assessment:** Local implementation and disposable-environment verification are recorded here. No production release is approved by this assessment. `Implemented` means the stated capability exists in the current code; `Partial` means the criterion is not proven end to end; `Gated` means completion requires a named policy owner, external provider, operational environment, or business sign-off.

## Functional requirements

| V7 requirement | Status | Current evidence / remaining work |
|---|---|---|
| FR-IAM-001 invitation and account lifecycle | Partial | Activation/deactivation and role history/audit exist; prove invite, suspension/reactivation and all user-class transitions, including reason and session effects. |
| FR-IAM-002 MFA | Partial | MFA and role checks exist; establish enforced privileged policy, safe recovery and configurable external-user risk policy. |
| FR-IAM-003 account recovery | Open | No complete expiring, single-use, non-enumerating recovery workflow evidenced. |
| FR-IAM-004 session management | Partial | Migration 096 records a bounded browser user-agent; the Security panel lists a user's current and recent sessions and allows revocation of active sessions with audit evidence. API integration coverage is added but still needs execution against the migrated disposable database; revocation propagation after role/status changes still needs acceptance evidence. |
| FR-IAM-005 effective-dated access history | Partial | Migration 059 records role/activation history and privileged history APIs; initial snapshot is migration-time only and does not reconstruct earlier history or all resource assignments. |
| FR-IAM-006 service accounts | Open | Lifecycle, rotation, expiry and interactive-auth prohibition are not evidenced. |
| FR-DATA-001 server-controlled scope | Partial | Existing RLS and server checks cover current agency records; audit every tenant-owned record and reject caller scope overrides across all services. |
| FR-DATA-002 object-level access | Partial | Scoped paths and targeted denials exist; exhaustive endpoint, file, search, export and report negative coverage is outstanding. |
| FR-DATA-003 background/integration scope | Partial | Some jobs and events are scoped; inventory and prove all jobs, notifications, integrations, analytics and exports. |
| FR-DATA-004 denial monitoring | Open | Structured repeated cross-scope alerting is not evidenced. |
| FR-DATA-005 transfers | Open | Approval flow and impact preview across leases, files, users, invoices, work orders and reports are not evidenced. |
| Lease lifecycle (Section 2.3) | Partial | Migrations 060, 061, 107 and 115 support immutable lease snapshots, operational notice receipts, separate rent commencement, and renewal offers with independent approval, resident response, and conversion to a new draft. Amendments beyond the renewal flow, expiry alerts, legal e-signature, and approved occupancy/notice policies remain. |
| Applications and screening (2.4) | Gated | No Ethiopian screening provider/legal basis is approved; consent, restricted results, human review and dispute flow require policy and provider decisions. Do not enable foreign-data assumptions. |
| Finance and accounting (2.5) | Partial / gated | Domain ledgers, balanced journals, idempotency and controlled adjustments exist in selected contexts. Accounting policy, closed periods, complete payment/refund/allocation paths, owner statements/distributions, e-invoice/MoR and Ethiopian tax/legal review are not accepted. |
| Maintenance and vendors (2.6) | Partial | Migrations 100–101 and 109 add triage, assigned-vendor-only access, acceptance, scanned completion evidence, independent completion/rework review, SLA escalations, additional-cost approval, and invoice mismatch exceptions; migrations 118 and 120 add tenant and agent/property scope. Invoice entry now requires completed work (legacy `done` remains accepted), enforced by both API validation and migration 138's database trigger; payment reconciliation is distinct from invoice approval and payment recording. Exact invoice matching remains the safe default because no tolerance policy is approved. PostgreSQL-backed migration/RLS/API validation, exhaustive isolation evidence, and vendor-business verification policy remain outstanding. |
| Workforce/time/payroll/leave (2.7) | Partial / gated | Workforce/staffing modules support shift response, attendance, reviewed corrections, leave requests, payable-time calculation and encrypted payroll handoff. Calculation/export use repeatable locked batches (500/2,000 rows); migration 110 serializes shift acceptance against offboarding, in addition to account deactivation and session revocation. Migration 110 is committed but still requires application and PostgreSQL-backed RLS/API validation. Provider-specific and external payroll reconciliation, failed-row requeue semantics, approved leave/labour policy and HR/legal approval remain. Biometric/location collection stays subject to privacy review. |
| Notifications (2.8) | Partial | In-app/webhook notice event path exists for lease notice records. A template/recipient/channel/retry/delivery-state inventory and deduplication proof for every material notification remain. |
| Support and complaints (V11 WF-I) | Partial | Migrations 097–099 add authenticated intake, urgent safety/fraud/privacy/legal classification, privacy-preserving central and appeal queues, independent 15-minute sensitive-content approvals, append-only case events and appeal reviews, structured resolution and independent appeal outcomes. SMS delivery, PostgreSQL/API integration execution, support ownership, and formal financial/legal workflow linkage remain open. |
| AI governance (2.9) | Partial / gated | MFI sandbox is synthetic and advisory; production model/provider use, organisation/use-case kill switches, logging/evaluation and approved data classes remain gated. |
| Search, exports, reports (2.10) | Partial | Endpoint-level scope, export audit/expiry, report freshness/basis metadata, and reconciliation of unresolved differences are not comprehensively evidenced. |

## Platform, quality, and delivery requirements

| V7 section | Status | Remaining acceptance work |
|---|---|---|
| Entity catalogue and data classification (3) | Partial | Validate required fields, relationships, effective dates, classification, retention and deletion against the approved data inventory. |
| API and integration contracts (4) | Partial | Publish complete versioned OpenAPI/security/error/idempotency contracts; durable webhook receipt, replay, dead-letter and operator workflows; provider-specific reconciliation. |
| UX, accessibility, localisation (5) | Partial | Responsive UI smoke passed at 320/390/768/1440 px. Reviewed English/Amharic content and Ethiopian calendar behavior, keyboard/screen-reader/zoom/manual accessibility, and device/browser support matrix remain. |
| NFR-012 performance | Partial | Pilot targets are now set in `V7_RELEASE_BASELINES_AND_POLICY.md`; bounded local load smoke passed 500 requests at 25 concurrency against `/healthz` (p95 105.3 ms, p99 172.3 ms). This is a health-endpoint smoke only; representative route/data/host load report remains. |
| NFR-013 durable jobs | Partial | Demonstrate acknowledged work survives restart with fault injection. |
| NFR-014 idempotency | Partial | Selected flows tested; run duplicate/replay coverage across invoices, payments, journals, refunds and notices. |
| NFR-015 isolation | Partial | Targeted RLS/access checks passed; all APIs, exports, jobs, reports, integrations and downloads need exhaustive negative tests. |
| NFR-016 recovery | Partial / gated | Proposed pilot RPO ≤15 minutes/RTO ≤4 hours are in the baseline; sponsor/IT must ratify them and demonstrate database plus private-file recovery on target infrastructure. |
| NFR-017 observability | Partial | Correlation IDs/health checks exist; critical-workflow metrics, traces, actionable alerts and monitoring acceptance remain. |
| NFR-018 accessibility | Partial | WCAG 2.2 AA is the adopted engineering target; local UI smoke now checks document language, main heading, interactive accessible names and image alternatives. Manual keyboard/screen-reader/zoom/contrast audit and broader workflow run remain. |
| NFR-019 maintainability | Partial | Core and domain-service builds plus unit tests pass; CI now audits production dependencies for high/critical npm advisories. Reproducible release evidence, full dependency/SBOM review, code review and deployed-environment evidence remain. |
| NFR-020 configuration safety | Partial | Versioned approval/effective dates for tax, labour and approval policies need completion. |
| NFR-021 data export | Open | Organisation export/import format, relationships and integrity verification not evidenced. |
| NFR-022 privacy | Gated | Approve inventory, access, retention, deletion and export policy and review. |
| NFR-023 disaster recovery | Partial | A synthetic-only 60-migration backup restore passed; encryption, protected backup access, monitoring and witnessed service recovery are not proven. |
| NFR-024 browser/device support | Partial | A proposed current-and-previous-major browser/OS matrix is documented; publish actual release versions and physical-device results. |
| NFR-025 change safety | Partial | Disposable migrations/builds validated; staging release rehearsal and rollback/roll-forward evidence remain. |
| NFR-026 capacity | Partial / gated | A pilot workload starter of 25 concurrent sessions, 1,000 synthetic users and 50,000 representative records is documented. Product/IT must confirm expected peak and run a representative capacity test. |
| NFR-027 support | Gated | An incident runbook defines severity, response steps, recovery and machine-credential rotation. Named on-call/support owners, response targets, maintenance windows, and exercised provider-specific playbooks remain. |
| Sections 7–8 security, incident response and operations | Partial | Correlation IDs, audit/auth controls, dependency advisory CI checks and an incident runbook exist. Production dashboards, actionable alert ownership, independent ASVS verification, and scenario drills remain. |
| Section 9 tests and release gates | Partial / blocked | Unit 170/170, API/supply integration 46/46, selected MFI/Edir E2E, UI smoke, builds and migration checks passed. Full trace evidence, security/accessibility/load tests, finance reconciliation, recovery, UAT and operational acceptance remain. |
| Section 10 migration/release | Open | Source inventory, mapping/exceptions/control totals, business-approved trial migration, cutover/delta/rollback and staging rehearsal are not evidenced. |
| Section 11 deliverables | Partial | This crosswalk, policy baseline, release acceptance record, and initial production incident/rotation/recovery runbook exist. Architecture/threat/data diagrams, complete API/model/report inventories, provider-specific runbooks, training and approved residual-risk register remain. |
| Release record / named UAT (Sections 9–11) | Open | `V7_RELEASE_ACCEPTANCE_RECORD.md` is prepared with role-title placeholders (names pending); named owners must run UAT and record results/signatures. |
| Appendix A V6 baseline | Partial | Existing product modules cover portions of the baseline. The V6 functional requirements and role workflows have not each been independently mapped to endpoint/UI/test evidence; no claim of full Appendix A completion is made. |

## Decision register (V7 Section 12)

Engineering defaults and conservative Ethiopian-market release gates are
recorded in [ETHIOPIAN_MARKET_RELEASE_DECISIONS_2026-10-14.md](ETHIOPIAN_MARKET_RELEASE_DECISIONS_2026-10-14.md)
and [V7_RELEASE_BASELINES_AND_POLICY.md](V7_RELEASE_BASELINES_AND_POLICY.md).
The owner decisions below remain unapproved; named owners must record approval
before dependent features or releases are accepted.

| ID | Decision required | Owner / gate |
|---|---|---|
| DEC-001 | Single-org deployment vs multi-tenant SaaS | Sponsor/Architect, architecture sign-off |
| DEC-002 | Hosting provider, region, residency and transfers | Sponsor/IT/Legal, before procurement |
| DEC-003 | Direct e-invoice accreditation vs accredited provider | Sponsor/Finance, before implementation |
| DEC-004 | Authoritative invoice lifecycle and offline behavior | Finance/Tax, before tax acceptance |
| DEC-005 | Chart of accounts, accounting basis, owner funds and close rules | Finance lead, before schema freeze |
| DEC-006 | Payroll boundary and export format | HR/Finance, before integration |
| DEC-007 | Leave/overtime/pension policy values | HR/Legal, before scheduling UAT |
| DEC-008 | E-sign provider and enforceability; lease records remain evidence-only pending legal acceptance | Legal/Leasing, before lease go-live |
| DEC-009 | Lawful Ethiopian screening providers/data; external screening remains disabled by default | Legal/Privacy/Compliance, before enablement |
| DEC-010 | Ratify proposed pilot RPO/RTO, availability and support targets; demonstrate on target infrastructure | Sponsor/IT, before production readiness |
| DEC-011 | WCAG 2.2 AA adopted as engineering target; approve supported devices/browsers and complete audit | Product owner, before UI acceptance |
| DEC-012 | AI provider, data classes, use cases and approvals | Sponsor/Security/Legal, before production AI |
| DEC-013 | Payment rails, settlement, fees, refunds and reconciliation | Finance, before payment go-live |
| DEC-014 | Retention/deletion by record class | Legal/Records owner, before production data |
| DEC-015 | Portfolio, peak users, volume and growth assumptions | Product/IT, before performance design |

## Release disposition

Local development work is substantially verified for the flows listed above, but V7's Section 9.3 release gates are not satisfied. Production readiness requires the remaining technical evidence and the named decisions, provider access, specialist reviews, business UAT, migration/cutover, training, support and operational sign-offs. No legal, tax, accounting, labour, screening, or signature behavior should be represented as approved until its named owner records that approval.

The conservative Ethiopian-market engineering defaults and approval evidence
required for legal, provider, finance and operational gates are recorded in
[ETHIOPIAN_MARKET_RELEASE_DECISIONS_2026-10-14.md](ETHIOPIAN_MARKET_RELEASE_DECISIONS_2026-10-14.md).
Those defaults do not close any owner-approval gate or certify production
readiness.

## Latest mock acceptance exercise — 14 October 2026

See [V7_MOCK_ACCEPTANCE_EVIDENCE_2026-10-14.md](V7_MOCK_ACCEPTANCE_EVIDENCE_2026-10-14.md) for the isolated test setup, detailed results, and follow-up list. This later mock run supersedes any earlier general statement that the API/supply suite passed 46/46: after disposable database provisioning, 45/46 checks passed, with one signup scenario rate-limited during concurrent browser traffic. A separate ACL check flagged broad UPDATE privilege on `insurance_ledger_accounts` under the local-development grant profile. Full-surface isolation remains open.

The exercise restored a synthetic database and private-file archive with matching control totals (50,006 leads, 64 users, 61 migrations) and matching file SHA-256 in 18.2 seconds. A repeat migration on the restored clone was a no-op. The authenticated 50,000-record lead-list load attempt did not yield a usable latency report; the previously recorded health-only metrics remain health-only. Automated browser assertions reached the role sweep, but the smoke ended with two unexpected background 401 responses. Manual accessibility/localisation, real-provider, target-infrastructure recovery/capacity, staging cutover, and named-owner UAT gates remain open.
