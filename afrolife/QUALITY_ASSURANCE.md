# AfroLife quality and release workflow

This workflow separates repeatable code checks from the operational evidence
needed to accept real users, identity documents, or financial activity.

## Automated checks

The `AfroLife quality checks` GitHub Actions workflow runs on pushes and pull
requests that touch `afrolife/`. It installs the locked dependencies, checks
browser JavaScript syntax and application JSON configuration, compiles the
TypeScript API and every separately buildable service (including Accounting
and Global BI), and runs the database-independent unit suite. A second job
provisions disposable PostgreSQL and runs the finance, property, staffing,
MFI, and core API integration workflows. These checks improve regression
coverage; a green workflow does not establish production readiness or replace
staging, recovery, and external review.

Role activity defaults are maintained in the application catalog and mirrored
in migration `057_role_activity_defaults.sql` for PostgreSQL row-level
security. The unit suite checks that both grant sets match and that request
overrides take precedence. Verify role visibility and write restrictions on a
fresh disposable database using its restricted runtime role before accepting
role-access changes; never substitute a production or shared development DB.

For local role-based workflow checks, `npm run seed:local-test-users` creates
synthetic accounts for every AfroLife app role and stores random credentials
outside the repository under `%LOCALAPPDATA%\AfroLife\local-test-users.txt`.
The script refuses databases other than the isolated local `afrolife` database
on port 5433. These accounts are marked active and KYC verified for testing;
never seed or use them in staging or production. Delete the credential file
when local testing is complete. Institution-specific SACCO/MFI roles must be
assigned through the chosen institution's staff workflow.

With the local server running, `npm run test:mfi:e2e:local` runs a full SACCO/MFI
API journey using those accounts. It creates synthetic institution, member,
staff membership, account, loan, audit, and ledger data in the isolated local
database. It covers member suspend/reactivate, credit-policy maker-checker
approval, affordability scoring and teller redaction, principal installment
allocation, repayment reversal, configured delinquency bands, independent NPL
approval, assigned collections and promises to pay, idempotent posting,
withdrawal reversal, cash-constrained disbursement, balanced journals, and
role denials. It also verifies that non-administrator credit/finance roles
cannot list institution staff or submit credit-policy configuration.

When Google Chrome is installed, `npm run test:ui:e2e:local` starts an isolated
headless browser profile and verifies Super Admin sign-in, SACCO tab visibility,
member/staff, credit policy, loan affordability, collections and NPL forms, and
mobile/tablet/desktop horizontal overflow. Set
`AFROLIFE_CHROME_PATH` if Chrome is installed at a non-default path.
The SACCO workspace shows service submodules, readiness and accountable roles;
administrator-only configuration shortcuts are presented only to administrators.

The browser smoke now checks the login and Super Admin overview for document
language, a single visible main heading, accessible names on visible controls,
and alternative text on visible images. It still does not establish
accessibility conformance. Use
`SACCO_STANDARDS_ALIGNMENT.md` as the release checklist for a version-pinned
OWASP ASVS assessment, WCAG 2.2 AA review, consumer-protection review, AML/CFT
applicability, accounting validation, and jurisdiction-specific regulatory
mapping. Record independent reviewer, scope, findings, remediation, and retest
evidence for the actual deployment.

For a bounded local performance smoke, run `npm run perf:v7:local`. It targets
only loopback addresses, defaults to 500 requests at 25 concurrent workers
against `/healthz`, and reports p50/p95/p99, status counts and failures. Use
the workload and service targets in `V7_RELEASE_BASELINES_AND_POLICY.md` to
design a representative staging test; do not treat this local health probe as
a capacity or production SLO report.

Integration tests write to a database. Run them only against an isolated,
disposable database, never production or a shared user-data database. Provision
the test database and API runtime separately, then follow the integration test
setup in the README. Save the migration result and test output with the release
record.

The agency API UAT covers the in-place lease workflow: draft, independent
approval, tenant/owner signature-evidence files, and activation only after
handover and move-in inspection. It also checks the legacy immediate-activation
route for compatibility in non-production and verifies that an explicit
`LEGACY_IMMEDIATE_LEASES_ENABLED=0` setting rejects that route. Signature files
are not identity verification or proof of a legally valid electronic
signature. Run these checks after migrations through the release migration on
the same disposable schema as the API.

Lease notice records are operational evidence only. Integration UAT verifies
that notice creation requires lease-management permission, replays with the
same idempotency key do not duplicate the record, conflicting replays fail,
records are append-only, and recording a notice does not alter lease status.
This does not verify legal service or notice-period compliance.

## Release evidence

For each release candidate, record the commit or source archive checksum, build
version, migration set, operator, date, and results below. Do not mark a gate
complete from a local development check alone.

- [ ] Apply the Ethiopia market defaults and owner-approval gates in
  [ETHIOPIAN_MARKET_RELEASE_DECISIONS_2026-10-14.md](ETHIOPIAN_MARKET_RELEASE_DECISIONS_2026-10-14.md).
  The document records conservative platform decisions, not legal advice,
  provider authorization or production acceptance.
- [ ] Assign and exercise the incident, service-identity rotation, recovery,
  financial-integrity and release procedures in
  [PRODUCTION_OPERATIONS_RUNBOOK.md](PRODUCTION_OPERATIONS_RUNBOOK.md).
- [ ] Apply `066_readiness_evidence.sql` and
  `067_global_admin_release_approval_role.sql` after migration 065. Run the
  platform-admin readiness-evidence API acceptance test and global-admin
  release-approval acceptance test. Confirm list/insert attribution, denied
  non-admin access, append-only database behavior and no secret or
  personal-data content in evidence notes.
- [ ] For a restricted-runtime database rehearsal, apply the one-time base
  runtime grants before migrations as documented in `README.md`; do not apply
  blanket grants after migration 039. Run
  `npm run db:check-runtime-acls` against the exact runtime role and record
  the result separately from test-fixture grants.
- [ ] Record separate evidence entries for workforce, Insurance, MFI/SACCO,
  Edir, property, marketplace and shared platform gates in
  [PRODUCTION_ACCEPTANCE_PACK.md](PRODUCTION_ACCEPTANCE_PACK.md). A recorded
  reference is not an approval; obtain the required external owner sign-off
  before enabling that module's gated activity.
- [ ] Build the main app and each separately deployable domain service
  (`npm run build`, `npm run build:insurance`, `npm run build:edir`,
  `npm run build:mfi`, and `npm run build:agency-domains`) for the release
  source. Keep local build evidence separate from staging acceptance.
- [ ] Create a service-identity inventory and rotate at least one non-production
  credential using the documented procedure. Confirm `service_identities` exists
  in the schema and that the inventory records owner, environment, expiry and
  rotation evidence.
- [ ] Produce an owner rent-statement and reconciliation export for at least
  one property owner using `/owner/statements` and reconcile a pending receipt
  into the ledger using the existing `rent-transactions` flow. Attach the
  CSV/JSON outputs to the release record.
- [ ] Run the owner statement integration acceptance case and confirm both JSON
  and CSV amounts match reconciled and pending transactions. The export is
  owner-scoped and is not evidence of a payout or trust-account balance.
- [ ] Review the draft ETB chart-of-accounts template with the entity Finance
  owner. It preserves current posting labels, remains non-operative until
  approved and does not establish IFRS recognition, tax or custody policy.
- [ ] Run the read-only property period-close checks for a staging period and
  attach the exception report and Finance sign-off. A clear result means ready
  for Finance review only; it does not close or lock the period.
- [ ] Exercise service identity create, independent rotate and retire paths;
  verify the external secret manager credential was rotated and no secret
  material was entered into EthioLife. Attach append-only lifecycle evidence.
- [ ] For a disposable restore rehearsal, capture source control totals with
  `$env:AFROLIFE_CONTROL_DATABASE_URL='<loopback test database>'; node scripts\property-restore-verify.mjs capture | Tee-Object control-totals.json`,
  restore to a different `test_*` database, then set
  `AFROLIFE_RESTORE_DATABASE_URL` and `AFROLIFE_RESTORE_EXPECTED_FILE` and run
  `node scripts\property-restore-verify.mjs verify`. Have the release owner sign or
  otherwise approve the captured JSON manifest outside this script; the
  verifier checks content and database identity, not a digital signature.
  Never point this check at the production database. A staging rehearsal requires a separately approved,
  isolated target and named operator.
- [ ] Run `npm run perf:v7:local` against loopback with representative
  authorized paths and a non-production token. Local load evidence is not a
  staging capacity or SLO acceptance result.
- [ ] CI checks pass for the exact release source.
- [ ] All migrations apply to a fresh staging database and an upgrade copy of
  the prior schema; schema version and migration logs are recorded.
- [ ] Role activity SQL defaults match the application catalog, and database
  checks verify default grants, explicit denials, Super Admin-only updates,
  learning-content audience isolation, and append-only access audits.
- [ ] Integration scenarios pass against disposable staging data, including
  sign-up/activation, role boundaries, RLS isolation, four-eyes approval,
  lease draft-to-activation workflow and production-default legacy-route
  rejection, scoped/idempotent append-only notice capture without implied
  legal effect, contract and rent ledger flows, refunds, private upload
  authorization, and MFI transaction reversal. Also verify authenticated
  session inactivity expiry, absolute expiry, logout revocation, and session
  replacement after password or MFA changes.
- [ ] The test API and fixture database use the exact same disposable schema
  migrated through the release's latest migration. Confirm runtime role
  identity and explicit central Insurance table/sequence privileges before
  accepting integration results.
- [ ] A second user/role cannot access another agent's or institution's data;
  check API responses as well as database RLS using the runtime role.
- [ ] HTTPS, CORS, proxy trust, staff MFA, rate limits, secret storage, and
  security headers are checked at the deployed ingress.
- [ ] Database and private files are backed up together. A restore rehearsal
  confirms records and files can be recovered and that permissions remain
  private.
- [ ] Personal-data retention periods and deletion triggers are approved by
  legal/privacy owners, implemented, and exercised. Do not accept real KYC
  documents until this gate is complete.
- [ ] English, Amharic, Afaan Oromoo, Tigrinya, Somali, Arabic, and Kiswahili
  signup, plan, benefits, errors, and core operational workflows are reviewed
  by fluent speakers. Record known untranslated areas and resolve high-risk
  money, coverage, consent, and security wording before launch.
- [ ] Marketplace and plan descriptions match API behavior. Test Free, Pro,
  Enterprise, agent, property-owner, and staff roles against the release.
- [ ] Android release is signed with protected release credentials and tested
  on a physical device for server setup, sign-in, uploads, reconnect, and
  upgrade behavior. A debug APK is not a release artifact.
- [ ] Product, financial, consumer, labor, privacy, and regulated-finance
  reviews are complete for the markets and activities enabled in this release.

## Safe pilot and business operations

Start with staff and a small invited cohort. Use synthetic data until storage,
access, retention, support, and recovery procedures have been proven. Assign a
named owner and escalation contact to each queue: KYC, listing review, worker
matching, contracts, finance reconciliation, disputes, rent, and incidents.

Review a short weekly operations scorecard: registration-to-activation time,
KYC queue age, listing review time, qualified-request-to-match time, contract
cycle time, unreconciled receipts, overdue rent, unresolved disputes, failed
notifications, and support incidents. Set target values only after collecting a
baseline; investigate queue growth and stale work rather than optimizing raw
account or transaction counts.

When a financial, identity, or access-control incident occurs, pause the
affected workflow, preserve audit and transaction records, notify the named
incident owner, and reconcile any downstream ledger or customer impact before
resuming. Posted financial facts are corrected through the system's authorized
reversal workflow, not by editing database rows.
