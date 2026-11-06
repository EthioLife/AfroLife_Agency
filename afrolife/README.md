# አፍሮ - ላይፍ ኤጀንሲ / AfroLife Agency

Same-origin TypeScript/Express API and installable web app for AfroLife agency operations, workforce onboarding, verified-worker matching, and role-scoped platform oversight.

## Requirements

- Node.js 22 or newer
- PostgreSQL 14 or newer
- A PostgreSQL database and login with migration privileges to initialize the schema
- Android Studio with the Android SDK to build/install the Android app
- macOS with Xcode 16 or later to build, run, sign, and distribute the iOS app

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Set up the isolated local PostgreSQL instance and apply the migrations:

   ```powershell
   npm run db:local:setup
   ```

   This initializes PostgreSQL 18 in `%LOCALAPPDATA%\AfroLife\postgresql` on port `5433` without changing the separate Windows PostgreSQL service on port `5432`. It creates the `afrolife` database, enables `pgcrypto`, applies all migrations, and grants the API a non-superuser `afrolife_app` role that does not bypass row-level security. Random credentials and application secrets are stored outside the project in `%LOCALAPPDATA%\AfroLife\afrolife.env`; do not share that file. Database files persist between restarts.

   To use an existing PostgreSQL instance instead, copy `.env.example` to `.env` and configure `DATABASE_URL` for the runtime role and `MIGRATION_DATABASE_URL` for a migration owner. Use distinct, randomly generated `JWT_SECRET` and `MFA_ENC_KEY` values of at least 32 characters. The runtime role must not own tables or have `BYPASSRLS`; apply schema changes with `npm run db:migrate`.

3. Create the first administrator with environment variables; the password is read from the environment and is never printed:

   ```powershell
   $env:SEED_ADMIN_NAME = "AfroLife Administrator"
   $env:SEED_ADMIN_PHONE = "+251911234567"
   $env:SEED_ADMIN_PASSWORD = "use-a-unique-password-of-12-or-more-characters"
   npm run seed:admin
   Remove-Item Env:SEED_ADMIN_PASSWORD
   ```

4. Run `npm run dev`, then open `http://localhost:3010`.

`http://localhost:3010` is the single client-facing local entry point for the
PWA and API. All configured services, including Accounting, are reached through
this gateway; their private listener ports are not browser-facing.
The optional local Nginx preview on `http://localhost:8080` only proxies to
that same app and is not needed for `npm run dev`. Users always open this
single app URL (or the single public hostname in deployment); they do not open
service-specific ports. Extracted backends remain private behind the central
API gateway, which routes each feature internally.

For a containerized local QA environment, start Docker Desktop and run
`npm run qa:docker:up` from `afrolife/`. This builds the application, starts an
isolated PostgreSQL database on loopback port 5433, applies migrations, grants
the restricted runtime role, and serves the app at `http://localhost:3010`.
Database and private uploads use Docker-managed named volumes; host `data/`
and any prior local database are not deleted or mounted. Locally generated
secrets are kept in the Git-ignored `.env.docker`. Run
`npm run qa:docker:seed` to create synthetic role accounts; credentials are
saved under the Git-ignored `.local-qa/` directory. Use
`npm run qa:docker:status` and `npm run qa:docker:logs` for diagnostics.
`npm run qa:docker:down` stops containers but intentionally preserves volumes
and credentials. Do not use this QA environment for production data.
This starts the core platform with its integrated Agency, MFI pilot, Insurance
ledger, and synthetic brokerage sandbox paths. Separate Edir, Accounting,
Global BI, and extracted domain-service deployments retain their own database,
secrets, and cutover requirements; this local stack does not claim to deploy
those independent service instances.

For local workflow testing, run `npm run seed:local-test-users`. This creates
synthetic active accounts for every AfroLife app role (including two Super
Admins for four-eyes workflows). Random passwords are saved in
`%LOCALAPPDATA%\AfroLife\local-test-users.txt`, outside the repository. These
accounts are marked KYC verified to support local workflow testing; never use
them or their credentials outside the isolated local database. Delete the
credential file when finished. SACCO/MFI roles are institution memberships,
not separate login roles; provision those through an institution's staff
workflow.

For a disposable MFI E2E clone, set `MFI_E2E_DATABASE_URL` to a loopback
`afrolife_test_*` database URL and `MFI_E2E_USERS_FILE` to a new temporary file,
then run `npm run seed:mfi:e2e:local`. The seeder refuses other database names,
hosts, ports, existing credential files, and non-superuser migration
connections. Run the core API and MFI service against that same clone, then run
`npm run test:mfi:e2e:local` with `MFI_E2E_USERS_FILE`, `MFI_E2E_DATABASE_URL`,
and `API_URL` set. Remove the temporary credential file afterward.

Before a shared or production launch, provision at least two Super Admin accounts with distinct names and phone numbers using the seed procedure. Repeat the seed command with the second administrator's details; the phone number must be unique. Account setup is deliberately four-eyes: a Super Admin cannot activate an account they created, and cannot reset their own password or MFA. Keep both sets of seed credentials outside the repository and remove them after use.

Global Admin is the Global System Admin role and is the only role for platform-wide configuration: tenant onboarding, service and package definitions, platform module availability, Super Admin onboarding and assignment, global identity, role templates, and operations controls. A Super Admin can administer only assigned business entities, choose a subset of the modules and services approved for each active entity, register its deployment reference, and onboard Master Agents or Field Agents they created. A Super Admin cannot create tenants, change shared service packages, alter global role templates, assign other Super Admins, or administer another tenant. Without an assigned active entity context, a Super Admin receives no business modules. Business Admin (`corporate_business_manager`) is limited to business-entity operations and agent onboarding; system configuration remains unavailable. Super Admin and Business Admin user lists are limited to accounts they created. An active, MFA-enabled Super Admin can nominate another active, MFA-enabled Super Admin; a second, different eligible Super Admin must approve the request with a reason. Request and decision events are recorded in the audit log. No role bypasses financial maker-checker approvals.

Super Admin business-service APIs independently check the selected tenant's active status, assignment, and service-package entitlement; filtering the launcher alone does not authorize API access.

The initial database migration creates a starter Ethiopia → Addis Ababa → Bole territory path and default pricing/matching rules. Additional territories are managed through the API by a Super Admin.
`/livez` confirms that the API process is running. `/healthz` checks PostgreSQL connectivity. `/readyz` is the deployment readiness probe: it checks the database, every workspace migration packaged with this release and its stored checksum, writable private-file storage, and all configured private services. It returns HTTP 503 if any required check fails and does not expose connection strings or exception details.
The Docker image health check uses `/readyz`; a container can therefore remain live while being marked unhealthy when its schema, storage, or configured services are not ready.
Core and standalone Accounting migration runners serialize migration execution with PostgreSQL advisory locks, record SHA-256 checksums, and stop if an already-checksummed migration file changes. Existing migration histories without checksums are baselined to the migration contents present at the first checksum-aware run; this cannot identify edits made before that baseline. Never edit an applied migration—add a new migration instead.

## Workspace navigation, search, and service status

After sign-in, the workspace loads data only for the selected panel. The Overview
loads its own activity summary; opening another panel fetches that panel's
authorized API data on demand. The workspace search is an explicit user action
and queries only panels visible to the signed-in user, through the same
role-checked endpoints used by those panels. Results are limited and may be
partial when an authorized endpoint is unavailable. Search does not grant
access, and opening a result still uses the ordinary panel and API permissions.

Panel links use the `?panel=<panel-id>` query parameter and participate in
browser Back/Forward navigation. A panel hidden by account permissions or
deployment configuration resolves to Overview rather than bypassing access
checks. `AFROLIFE_ENABLED_MODULES` optionally accepts a comma-separated list of
module panel IDs (for example `leads,workers,requests,marketplace`). Omit it or
leave it empty to show all modules. Overview, account security, and service
status remain in the shell; Admin remains subject to its role policy. This
deployment-level navigation switch is not an API authorization control. The
Global System Admin assigns each deployment its package; an assigned Super
Admin may further narrow that entity's available services but cannot add
services outside the approved package. Super Admin feature access requires an
assigned active deployment context, and the API verifies that assignment and
intersects package availability, entity configuration, and role/mini-app access
on every feature request. These settings never replace service-level API
authorization. Business Admin has business operations only and cannot access
the Global System Admin configuration surface.

The Super App uses one authenticated user identity across its mini-apps and
services. Platform Admins can keep a user's role-default app visibility or set
an explicit per-user module allowlist. A custom assignment only narrows the
user's existing role/activity permissions; it never grants role capabilities
or bypasses service, entity-membership, ownership, or territory checks.
Assignments are enforced on both shell visibility and matching API route
families, and every change is retained in an append-only access audit.

Global BI is a separate service and read-only analytics database. Its current
contract uses allowlisted aggregate metrics in 30-minute UTC buckets, retains
13 months of projections, and limits each query to a 31-day window. Only Global
Admin may query cross-tenant totals; no tenant identifiers, operational rows,
or credentials are returned. A Global Admin can assign tenant-scoped Database
Admin and Analytics Admin capability metadata to active eligible accounts;
these grants do not provide database connectivity, SQL execution, or Global BI
access. Migration, backup/restore, and database-change requests are audited
records only and never execute operations.

Each tenant operator owns any eventual local projector and scheduler. There is
currently no tenant source extractor, trusted remote ingestion endpoint, or
verified 30-minute schedule. Global BI reports projector/scheduler as not
configured and health as unconfirmed until trustworthy local evidence is
available; a recent import alone is not a health check. No sample values are
shown, and the central platform does not connect to tenant databases.

The authenticated Service status panel checks the core database-backed API and
configured service health endpoints. The Overview flags unavailable services.
An `integrated` service uses the central API process; `disabled` means it is not
configured or enabled; `available` and `unavailable` report the latest health
probe only. A healthy probe is not evidence of production, accounting, or
financial readiness. Global and Super Admins can also view bounded aggregate
API request/failure counts and response timings. Route-template aggregates
flush to PostgreSQL and survive process restarts; they do not include query
strings or record IDs. They are operational indicators, not external alerting,
an audit trail, or a substitute for durable infrastructure monitoring.

## Languages and public registration

- The sign-in page and implemented agent/admin workflows can be switched between English, Amharic, Afaan Oromo, and Tigrinya. The selected language is saved on the device.
- People can submit worker, customer, or agent registration requests. Staff KYC review and Super Admin activation are required before an applicant can sign in. Field agents must provide an active master agent's phone number and select the same territory.
- Worker applicants can attach a national ID and police-clearance document during registration. The upload token expires after 24 hours; documents are stored privately and must be reviewed by Compliance before KYC can be verified.
- Agent applicants can select Free, Pro, or Enterprise. This records a plan request only: no payment is collected and no subscription is activated. Paid billing requires a payment provider and subscription lifecycle before production use.
- Worker and customer self-service portals are not part of this MVP; approved accounts currently share the operations shell.
- The sign-up page presents AfroLife's proposed worker pension match (5%) and Edir options: ETB 2,000 joining + ETB 200 monthly, optional ETB 5,000 annual ETB 1 million member/spouse life cover, and optional ETB 200 per household for tenant/property-owner fire, accidental-damage and burglary cover. Applicants may record non-binding interests; no contribution is collected and no pension match or insurance is active. Confirm funding, eligibility, licensed insurer/underwriter, policy wording, claims process, and commencement date before accepting money or advertising active cover. Staff can see requested benefits in KYC review.

## AfroLife Edir standalone service

AfroLife Edir is a separately deployable member and group administration service
that reuses the central AfroLife sign-in through signed gateway assertions. It
uses its own PostgreSQL database and schema; user references are UUIDs, not
cross-database foreign keys. Configure `EDIR_DATABASE_URL` for a restricted
runtime role (not a superuser, table owner, or `BYPASSRLS` role),
`EDIR_MIGRATION_DATABASE_URL` for the isolated database migration owner, and
`EDIR_RUNTIME_DB_ROLE` to that runtime role's SQL identifier.
`EDIR_GATEWAY_SECRET` must be a random secret of at least 32 characters shared
only with the AfroLife API gateway. Set `EDIR_SERVICE_URL` on the main API to
enable its Edir entry in the shared Super App shell. Edir keeps its own backend,
database, member registry, and financial ledger; the shared shell does not move
or merge those records. Build with `npm run build:edir`, apply the isolated
schema with `npm run migrate:edir`, and start with `npm run start:edir`; the
standalone service listens on port 3200 by default. The versioned migration
chain adds member organizations and Edir governance hierarchies without
merging their member registries or financial ledgers. The AfroLife Master Edir
workspace can review independent Edir registrations and see consolidated
summary totals; each organization retains its own members, staff, products,
groups, and journals.

Inside the signed-in Super App, the role-aware service launcher is a separate
destination available from the shared header. It lists only modules that are
enabled and allowed for the current account; mini-app workspaces do not embed
cross-app launch lists. The Overview remains focused on role-scoped activity
and current work. Edir exposes focused shortcuts for membership,
groups/governance, savings/accounts, credit/servicing, and (for the umbrella
role) registration and aggregate reporting. These shortcuts only navigate to
existing workflows; they do not grant permissions or imply that planned
capabilities are live.

Platform Super Admins and Global Admins assign Edir staff from the Edir staff
workspace. Edir Admins manage member reviews and groups; Member Support can
view the registry and groups; Finance Managers and Treasurers manage proposed
financial products and cash transactions; Credit Officers assess applications;
Credit Managers and Edir Admins propose and independently review credit policy
versions and make loan decisions; Compliance and Auditors have scoped read
access. Staff changes, membership decisions,
financial product/transaction decisions, credit-policy changes, loan
assessments and decisions, servicing operations, and group operations are recorded in the immutable
Edir audit log. Member name, phone, and email are sourced from the verified
AfroLife identity assertion, not enrollment form input.

The financial pilot includes approved savings, share, and contribution
products, member accounts, ETB double-entry journal posting, idempotent
requests, available-balance checks, and separate-person maker/checker
decisions. Product terms must be proposed and independently approved before
members can open accounts; withdrawals are available only when explicitly
enabled for savings/share products, never contributions. Posted deposits and
withdrawals can be corrected only through a separately requested,
independently approved reversal, subject to account-balance and cash checks.
Every cash transaction is proposed by one person and posted only after another
authorized person approves it.

Migration v5 adds a versioned, per-Edir credit policy and member loan-request
workflow. Each Edir must explicitly configure and independently approve its own
principal, term, affordability, membership, savings, and scorecard limits;
there are no institution policy defaults. Applications may be recorded while
policy is pending but cannot be assessed or approved until an active policy
exists. Assessments record policy version and decision factors; approval checks
those same recorded factors against that policy and requires a different
reviewer from both the applicant and assessor. Migration v6 adds explicit member
consent to deposit an accepted offer into an active savings account, separately
maker-checker-approved internal disbursement, equal-principal monthly schedules,
and maker-checker-approved savings-funded principal repayments. Those postings
are balanced in the Edir ledger and update available savings balances atomically;
they do not move cash. Interest and fees remain fixed at zero. Cash, mobile
wallet, and third-party disbursements, collections, and mutual-aid/benefit payouts
remain later stages until their providers, settlement finality, eligibility,
accounting, and recovery/claims controls are defined and approved.
The Edir financial ledger remains isolated from the Agency, SACCO/MFI, and
insurance ledgers. Keep the mini-app disabled until the separate service is
deployed, migrated, and reachable.

## AfroLife Accounting standalone service

Accounting is available as a dedicated mini-app from the Super App catalog and the existing manual service-subscription request flow. Subscriber access remains gated by the existing Accounting entitlement and mini-app assignment; internal Accounting and Finance integrations continue to use their existing service route.

Accounting is a separately deployable multi-entity accounting backend and web workspace with its own PostgreSQL database, user mode, entity memberships, chart of accounts, periods, journals, and consolidation totals. See [services/accounting/README.md](./services/accounting/README.md) for standalone and AfroLife-connected deployment, credentials, migrations, and source-event mapping. The Super App exposes Accounting as a finance mini-app through the same client-facing port 3010 when `ACCOUNTING_SERVICE_URL` and the matching gateway secret are configured. The Accounting process listens privately on port 3301; clients must use the main app gateway, never that backend port directly. The Docker QA stack starts Accounting with a separate database and restricted runtime role, and routes requests through the core app on port 3010. Open the PWA at `http://localhost:3010`; Accounting API requests are routed beneath `/api/v1/accounting`. For local integration outside Docker QA, run `npm run db:accounting:local:setup`, start `npm run start:accounting:local`, then restart the core API so it loads the generated gateway configuration. Transactional source publishers are wired for property rent/deposit receipts, Agency contract fees, commission accruals and payouts, dispute refunds, approved MFI loan disbursements/write-offs, Edir transactions, and approved Insurance journals. Marketplace has local sandbox checkout only; real payment posting still requires a provider and entity/account mappings. Configure Accounting entity and account mappings before enabling delivery; historical entries are not backfilled. The core catalog service entry can be assigned through service packages; commercial subscription/payment fulfillment remains outstanding.

## Property listings and secure uploads

Agents and Super Admins can create and manage property listings, record unit and rental details, and attach JPEG or PNG property photos (up to 10 MB per image). Listing data and photo metadata are stored in PostgreSQL; the photo files and applicant KYC files are kept in private file storage, not served from the public web directory. Access to photos is checked against the listing owner's permissions, and downloads are marked private and non-cacheable.

Set `FILE_STORAGE_DIR` to a persistent, access-controlled directory outside `public/` before accepting real documents or photos. Back up that directory together with the database, and establish retention/deletion procedures for personal identity documents before production use. Property listing and photo management are available in the responsive operations workspace, including on the Capacitor Android WebView.

## Configurable business rules

Global Admins can review and update operational rules in **Admin & review → Business rules**. Updates are validated, saved to `config_rules`, and recorded in the audit log. The editable values cover contract fees and commissions, Pro/Enterprise display prices, matching weights and thresholds, optional verified reference/certificate requirements, rent due dates and maximum lease duration, invoice payment periods, and refund caps.

Pricing updates reprice contracts that are not yet signed, including contracts awaiting signature. Contracts at or beyond `payment_pending` keep their signed terms; recorded payments and ledger entries are never rewritten. Refund limits remain bounded by amounts actually collected or held. The Pro and Enterprise amounts are displayed on registration, but paid subscription billing is not active yet; the configurable renewal grace period is reserved for that future billing lifecycle.

Authorization and data-isolation safeguards remain fixed: role permissions, row-level security, mandatory identity and police-clearance verification, four-eyes payment approval, and ledger immutability cannot be disabled through the business-rules interface.

## SACCO / MFI operations pilot

See [SACCO_MFI_PILOT_RELEASE.md](./SACCO_MFI_PILOT_RELEASE.md) for the current
release-candidate scope, verification record, and deployment sequence.
See [SACCO_STANDARDS_ALIGNMENT.md](./SACCO_STANDARDS_ALIGNMENT.md) for the
international and local standards references, mapped controls, and release gaps.
See [SACCO_SERVICE_ROLLOUT.md](./SACCO_SERVICE_ROLLOUT.md) for each service's
current release state and the evidence required before it can be marked Live.

The **SACCO / MFI** workspace adds a separate institution-scoped operational area without replacing AfroLife's agency, marketplace, contract, rent, or workforce records. Run `npm run db:migrate` to apply the MFI schema. It is enabled by default in local development; production defaults to disabled and requires explicit `MFI_PILOT_ENABLED=1` plus a separately configured service URL and gateway secret. Institution operations remain limited to authorized staff with active institution membership and are checked against each user's institution role. Verified users can request membership; an independent institution administrator or compliance reviewer must approve it before the member record is linked. Linked members can view their own account balances, loan schedules, and posted transaction detail, read-only. These are not digital wallets, and no member payments or transfers are enabled. A Super Admin can register an institution; the creator becomes its first institution administrator. That administrator can provision existing active AfroLife finance/compliance staff by phone and assign an institution role.

The workspace now presents a service menu across institution governance, members/KYC, products, savings, shares, credit, IFB, payments, wallets, agent/field operations, collections, accounting, treasury, reconciliation, AML/compliance, risk/fraud, regulatory reporting, CRM, digital channels, analytics, documents, staff, audit/security, exceptions, and cooperative governance. Each service is labelled `Pilot`, `Partial`, or `Not live`; selecting a not-live service shows its baseline scope and explicitly does not accept or post activity. Platform Super Admins can access every institution and all currently implemented institution operations/configuration regardless of institution membership; each institution-scoped request is written to that institution's append-only audit trail. Super Admin access does not make unavailable SRS capabilities live. This menu is a capability map, not a claim that every SRS requirement is implemented.

The separate Super App launcher is the only signed-in cross-mini-app catalog.
Within SACCO/MFI, choose a service area and then its available submodule action;
within Edir, use the service shortcuts for the relevant workspace section.
These controls navigate within their service and preserve server-side role
checks and existing service boundaries.

The pilot supports member registration, lifecycle controls and separate-person review; ordinary savings and share accounts; deposits and withdrawals; loan applications with affordability inputs and explainable credit scores; versioned maker-checker credit and delinquency policies; cash-constrained disbursement; principal-only monthly installment schedules and repayments; assigned collection cases, promises to pay and case resolution; independently approved delinquency/NPL classifications; journal activity, audit history, and full transaction reversals. Each institution has tenant-scoped PostgreSQL row-level security, its own chart of accounts and products, ETB amounts stored to two decimal places, balanced double-entry posting, append-only posted journals/audits, per-institution idempotency keys, cash sufficiency checks, and distinct loan originator/approver/disburser controls.

This is a controlled functional pilot, not the complete attached SACCO/MFI baseline or production-ready regulated banking software. Installments and collections allocate principal only; the pilot does not calculate or accrue interest, charges, penalties, provisions, or dividends, nor implement write-off, restructuring, NPL cure, or Islamic finance terms. Credit and delinquency thresholds are institution-configured and require an approved policy; the app does not claim those values establish regulatory compliance. It does not yet provide document-backed member KYC, AML/CFT screening, regulatory or Sharia compliance decisions, deposits insurance, branch/agent operations, treasury/settlement, reconciliation imports, multi-currency, or formal period closing/reopening. Do not use it to accept public deposits or originate interest-bearing credit until those controls, institutional accounting policy, licensing, security review, operational procedures, and independent financial validation are completed. `MFI_PILOT_ENABLED=1` is only a route/workspace switch, not a compliance approval. Posted facts cannot be edited; corrections use a separately authorized full reversal with a reason and appropriate account/cash checks.

## Independent insurance ledger

SACCO/MFI accounting remains in its institution-scoped `mfi_journals` and
`mfi_journal_lines`. Insurance accounting uses the separate
`insurance_ledger_*` tables and never posts to either the SACCO books or
AfroLife's legacy `ledger_entries`. Apply migrations with `npm run db:migrate`.
Insurance ledger accounts are configured by a Super Admin. Finance managers
and Super Admins can submit balanced draft journals; a different authorized
finance manager or Super Admin must approve or reject them. Posted journals
are immutable, idempotent, audited, and correctable only by an independently
approved reversal.

Insurance benefit selections on signup remain non-binding interest only. They
are not premiums, receivables, policies, or claims and are not posted to any
ledger. The new journal is an accounting boundary, not an insurance
enrollment, collection, claims, or regulatory-approval workflow. Do not record
real insurance activity until the insurer, products, accounting policy,
authorization matrix, and operating controls have been approved.

The shared Insurance mini-app accepts consented information requests and shows
their review status. A response is informational only; it does not create an
application, quote, policy, coverage, claim, wallet, or loan. Marketplace
supports published listing discovery and listing activity only; buyer orders,
purchase transactions, and marketplace wallet balances are not implemented.

### Independent service deployment

See [SERVICE_BOUNDARIES.md](./SERVICE_BOUNDARIES.md) for current and proposed
domain ownership and the safe extraction sequence. AfroLife is currently a
hybrid modular platform: Edir, Insurance, and MFI/SACCO have separate service
processes behind the shared API, while Agency, Marketplace, Property
Management, workforce, privacy, and shared administration remain in the
central API. MFI and Insurance request records still have central database
dependencies during the no-data-move transition. Do not describe those
financial data stores as fully independent until their ownership and migration
boundaries have been verified.

The central AfroLife API image is built from this directory with
`docker build -t afrolife-api .`. It serves the `public/` application, listens
on private gateway port 3010, and runs as the unprivileged Node user. Configure its production
database, authentication, and storage settings through the deployment secret
manager, and mount persistent private storage at the configured
`FILE_STORAGE_DIR`, writable by the image's unprivileged `node` user (UID
1000); do not bake secrets or user uploads into the image. Apply the core schema
as a controlled release job using the same image. Its environment file must set
`MIGRATION_DATABASE_URL` to the migration owner and `DATABASE_URL` to the
restricted runtime role, which migrations use when granting runtime
permissions:
`docker run --rm --env-file <migration-env-file> --entrypoint node afrolife-api dist/src/migrate.js`.
Do not pass migration-owner credentials to the running API container.

The insurance ledger can be deployed independently while the existing AfroLife
API remains the identity authority and backward-compatible gateway. In
development only, with `INSURANCE_SERVICE_URL` unset, requests continue to use
the in-process ledger.
The service schema migration creates an empty ledger; it does not import or
reconcile records from the legacy in-process ledger. Do not cut over until a
separately approved historical-data migration has been completed, opening
balances and totals have been reconciled, rollback and recovery procedures have
been rehearsed, and the independent accounting owner has signed off. Production
startup requires both `INSURANCE_SERVICE_URL` and `INSURANCE_SERVICE_CUTOVER_READY=1`;
that flag is an operator attestation, not an automated reconciliation check.
Only set it after the required migration and reconciliation evidence has been
reviewed and retained.

To prepare a cutover, deploy the `services/insurance-ledger` container behind a private
network, provision a dedicated PostgreSQL database and restricted
runtime/migration roles, apply its schema with
`INSURANCE_MIGRATION_DATABASE_URL`, `INSURANCE_RUNTIME_DB_ROLE`, and
`npm run migrate:insurance`, then configure the gateway with the service URL
and the same randomly generated `INSURANCE_GATEWAY_SECRET` used by the service.
The gateway signs each authenticated identity and request; the service rejects
unsigned, modified, or expired assertions. Keep the service private and use
TLS between network boundaries.

Build the container from the `afrolife/` directory with
`docker build -f services/insurance-ledger/Dockerfile -t afrolife-insurance-ledger .`.
The service uses `INSURANCE_DATABASE_URL` for runtime access; the migration
connection and runtime role must be distinct, and the runtime role must neither
own its RLS-protected tables nor have superuser or `BYPASSRLS` privileges. The
service schema stores actor UUIDs as opaque identities and does not copy central
user records into its database. Do not point the service at the legacy shared
database if a database-per-service boundary is intended.

The Insurance service now includes the first control-complete brokerage
foundation at `/api/v1/insurance/brokerage`: platform-admin tenant provisioning
with contract/onboarding evidence references, head-office and branch records,
tenant-scoped staff grants and reasoned revocation, independent Compliance
activation gated by current broker-licence and professional-indemnity evidence,
insurer agreement records, immutable effective-dated product versions, consent-
tracked client records linked to active KYC-verified central identities, and
immutable versioned needs assessments. Advice intake requires recorded
brokerage-advice consent and customer confirmation, conflict and limitation
disclosure references; insurer-submission consent is a separate, revocable
record. Assessment data is intentionally limited to product objectives,
coverage gaps, budget, and broad exposure categories; do not place identity
documents, medical details, or payment credentials in these records. Evidence
references are opaque identifiers only (not filenames, URLs, or customer
details); this service does not upload, scan, or retrieve documents. Staff
assigned to a branch can only access its branches, clients,
consents, assessments, and their audit records; tenant-wide audit records are
visible only to tenant-wide administrators and Compliance/Auditors.
Brokerage Owner/Administrator roles are tenant-wide and cannot be assigned to
a single branch. The service can register insurer quote-submission references
against a consented assessment and active product, capture and normalize
manual insurer responses as immutable ETB offers, compare same-assessment
offers, and submit a suitability rationale for independent Compliance or
Brokerage Administrator approval. These records do not send requests to an
insurer or constitute binding offers, regulated recommendations, policy
placement, or customer-facing advice delivery. Schema versions
`insurance-brokerage-v1-foundation` and
`insurance-brokerage-v2-client-intake` are applied by `npm run migrate:insurance`
and packaged in the Insurance container.
The core API proxies the brokerage routes only through the signed Insurance
gateway.

`insurance-brokerage-v3-quotes-advice` is also applied by
`npm run migrate:insurance`. This remains an operational foundation, not a
production-ready brokerage. It does not yet implement secure KYC evidence
handling, insurer API/secure-file delivery and callbacks, customer-facing quote
presentation/advice acceptance, policy placement/endorsements, claims, premium
custody/reconciliation, or privacy-rights/retention workflows.
The existing brokerage training workflow remains synthetic-only. Do not accept
premiums, bind cover, represent quotes as offers, or enable regulated activities
until the remaining workflows, partner agreements, legal applicability review,
security validation, and release approvals are completed.
For local demonstrations, after local database setup, applying migrations
through `069_insurance_brokerage_sandbox.sql`, and creating an active local
Super Admin, run `npm run seed:insurance:sandbox:local`. This idempotently
creates one synthetic case with a complete lifecycle trace in the local
sandbox tables only; it refuses non-local databases and never populates the
operational brokerage ledger. Enable `INSURANCE_BROKERAGE_MODE=sandbox` in the
development environment to display the training workspace. The seeded case is
visible to Super Admins in that local environment.

## Android app

The Android app wraps the existing `public/` web UI with Capacitor. From this project directory:

```powershell
npm install
npm run android:add
npm run android:sync
npm run android:open
```

In Android Studio, build or run the `android` project on a device/emulator. To build a debug APK from PowerShell after Android Studio/SDK is installed:

```powershell
npm run android:build
```

After a successful build, the APK is published to
`artifacts/AfroLife-Agency-<versionName>-debug.apk`, and
`artifacts/AfroLife-Agency-debug-latest.apk` is refreshed as the convenience
download. The former `AfroLife-Agency-1.0-debug-latest.apk` path is also
refreshed for compatibility. The Android `versionCode` and `versionName` are tracked in
`android/app/version.properties`; increment `versionCode` for each distributable
APK so Android recognizes it as an update.

For an Android device on the same Wi-Fi as the development PC, start the local
API, then run this command from an elevated PowerShell:

Open PowerShell **as Administrator** and run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-local-android-lan.ps1
```

Before running it, start the current workspace on this PC with `PORT=3001`
and `HOST=127.0.0.1` (for PowerShell: `$env:PORT='3001'; $env:HOST='127.0.0.1'; npm run dev`).
The setup checks this API and creates
a short-lived, subnet-restricted HTTPS gateway to the API that remains bound
to loopback, and places a debug-only CA certificate at
`artifacts/EthioLife-LAN-Preview-CA.cer`. Install that CA on the test Android
device, install the debug APK, then enter the printed `https://<PC-Wi-Fi-IP>:8443`
address in the app. The debug APK trusts user-installed certificates; release
builds trust system certificates only. Stop the preview and remove its
firewall rule with `scripts/stop-local-android-lan.ps1` when testing ends.
This LAN preview is for synthetic data and internal testing only.

The native app prompts for the API server address on first launch; it does not bundle a temporary or potentially stale server URL. On a test device, enter the HTTPS address printed by the LAN preview setup above. The address is stored on-device, and a Super Admin can change it from the app after signing in. The API must allow the exact native WebView origin `https://localhost` in `CORS_ORIGINS`. Keep the Android app and API on HTTPS.

For a signed release APK, configure `AFROLIFE_RELEASE_STORE_FILE`,
`AFROLIFE_RELEASE_STORE_PASSWORD`, `AFROLIFE_RELEASE_KEY_ALIAS`, and
`AFROLIFE_RELEASE_KEY_PASSWORD` in the build environment before running
`npm run android:release`. Keep the keystore and passwords outside the
repository and in protected storage; release builds fail when signing values
are missing. Do not distribute APKs built with test or default signing keys.

## iOS app

The iOS app uses the same Capacitor shell and `public/` interface as Android.
It keeps the existing `com.afrolife.agency` app identifier, shared sign-in,
localized responsive UI, and same-origin API gateway; it does not introduce a
second backend or move legacy data. Install dependencies and generate/sync the
iOS project from the app directory:

```sh
npm install
npm run ios:add
npm run ios:sync
npm run ios:open
```

Run and debug on an iOS simulator or a connected iPhone in Xcode. The native
app is preconfigured to use
`https://integrating-devices-executive-springs.trycloudflare.com` as its API
origin and stores it on-device. This Cloudflare quick-tunnel address is for the
current deployment and is not a durable production hostname; replace the
bundled default and rebuild before production if the tunnel changes. A Super
Admin can change the server from the app after signing in. Configure the API
server's `CORS_ORIGINS` to include the exact native WebView origin
`https://localhost` as well as the trusted website origins. Keep service
backends private behind the existing API gateway.

Xcode, code signing, simulator runtimes, and App Store uploads require macOS;
they cannot be run from Windows. On a Mac, select the app target's signing team
in Xcode, verify the bundle identifier and app display name, and archive using
the Release configuration. Keep distribution certificates and provisioning
profiles out of the repository. Before App Store submission, provide an
accurate privacy policy and App Store privacy disclosures for the data the
deployed services actually collect; do not claim that the local mock data or a
successful simulator build constitutes production or privacy approval.

For Windows Server self-hosting, see the deployment configuration and release
gates in [PRODUCTION_HARDENING.md](./PRODUCTION_HARDENING.md). See
[QUALITY_ASSURANCE.md](./QUALITY_ASSURANCE.md) for automated checks, staging
scenarios, launch evidence, and pilot operations.

## Scripts

- `npm run dev` — run the API and static PWA with automatic TypeScript reload
- `npm run build` — compile the API to `dist/`
- `npm run build:workforce-management` — compile the Workforce Management service independently
- `npm run build:worker-management` — deprecated compatibility alias for the Workforce Management build
- `npm run build:staffing` — compile Staffing independently
- `npm run build:property-management` — compile Property Management independently
- `npm run build:marketplace` — compile Marketplace independently
- `npm run build:agency-domains` — compile all four Agency domain backends
- `npm start` — start the compiled API
- `npm run start:workforce-management` — start the private workforce/document API on port 3400
- `npm run start:worker-management` — deprecated compatibility alias for the Workforce Management service
- `npm run start:staffing` — start the private staffing request/matching API on port 3401
- `npm run start:property-management` — start the private property API on port 3402
- `npm run start:marketplace` — start the private marketplace API on port 3403
- `npm run db:local:setup` — initialize local PostgreSQL and apply migrations
- `npm run db:local:start` — start the isolated local PostgreSQL server
- `npm run db:local:stop` — stop the isolated local PostgreSQL server cleanly
- `npm run db:local:status` — check whether the isolated database accepts connections
- `npm run db:agency-domains:local:setup` — create four local service databases from the current legacy migration chain; no records are copied and routing is unchanged
- `npm run db:agency-domains:local:harden` — re-apply least-privilege grants to the four existing local service databases
- `npm run db:migrate` — apply unapplied SQL migrations in filename order
- `npm run seed:admin` — create the first Super Admin from environment values
- `npm run seed:local-test-users` — create synthetic test accounts in the isolated local database
- `npm run test:unit` — run database-independent tests
- `npm run seed:mfi:e2e:local` — create synthetic users in a disposable, loopback `afrolife_test_*` database
- `npm run test:mfi:e2e:local` — exercise the SACCO/MFI API journey against the running local app and isolated QA database
- `npm run test:ui:e2e:local` — headless Chrome smoke check for Super Admin login, SACCO forms, responsive layouts, and browser errors; requires local QA accounts and Chrome
- `npm run test:integration` — run API/database tests against a running local instance
- `npm run check:local-deployment` — check local WSL service state, loopback-only listeners, full `/readyz` status (database, migrations, storage, configured services), and whether the proxy serves the current checkout
- GitHub Actions runs browser syntax/config checks, service builds, and unit tests on relevant pushes and pull requests. A macOS runner also syncs and builds the iOS app for the simulator without signing; device signing and App Store distribution still require Apple signing credentials and release review.
- `npm run android:add` — generate the Capacitor Android project
- `npm run android:sync` — copy the web app into Android and sync native plugins
- `npm run android:open` — open the Android project in Android Studio
- `npm run android:build` — sync and build a debug APK
- `npm run ios:add` — generate the Capacitor iOS project
- `npm run ios:sync` — copy the web app into iOS and sync native plugins
- `npm run ios:open` — open the iOS project in Xcode (macOS)

The PWA is served by the same-origin Express app. For a separate web host, publish the contents of `public/` at the site root and configure `/api/v1` on the same HTTPS origin to reach the API. Service workers and PWA installation require HTTPS except on localhost; API responses are not cached.

To generate local signing/encryption secrets in PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Integration tests need a disposable database named `test_*` or `afrolife_test*`; never point them at production or ordinary development data. Run `npm run test:finance:e2e:local` to create a uniquely named temporary database on the isolated loopback PostgreSQL instance, apply migrations, create synthetic identities, and run the MFI/SACCO role journey, property-finance, staffing-accounting, and core HTTP integration suites. The runner uses the configured local migration administrator only to provision and migrate the disposable database, a non-superuser fixture role used only for test setup, and separate restricted application runtime roles for the core API and Staffing service. Both services use the same disposable database so test-created domain records are visible across the integration boundary, while role grants continue to enforce service-level access. The MFI E2E additionally requires its fixture and migration URLs to identify the same loopback `afrolife_test_*` database. The runner drops the database, roles, test credentials, and temporary file storage when finished. The local database setup intentionally does not set integration-test URLs because its `afrolife` database is persistent. Runtime commands load `%LOCALAPPDATA%\AfroLife\afrolife.env` when present, otherwise the project `.env`.

For manual integration runs, start the API with the restricted `DATABASE_URL` role and set `TEST_DATABASE_URL` to a disposable local database used only for fixtures. The test-only role may need bypass-RLS permissions to create synthetic fixtures, but it must not be a PostgreSQL superuser; API requests must always run through the restricted runtime role so the suite exercises row-level security.

## MVP workflows

- Use the authenticated Support & complaints workspace to submit and track cases, including urgent safety/fraud/privacy/legal escalation, independent review of sensitive case access, structured resolutions, and user appeals. Case conversations are not exposed to support staff before a separate authorized reviewer grants a 15-minute access window; financial/legal resolution requires a formal workflow reference. Notifications use the existing in-app/webhook path; SMS delivery remains unimplemented.
- Sign in with phone/password and complete first-login password changes or optional MFA setup.
- Review recent signed-in sessions in Account security and revoke sessions that are no longer recognized. The session list records browser user-agent strings (limited to 512 characters) but does not collect client IP addresses.
- Register attributable leads and prospective workers.
- Create property listings, upload private property photos, and review applicant KYC documents.
- Record skills, languages, experience, expected rate, availability, and territory.
- Create service requests from household/business leads.
- Compliance uploads and reviews identity documents; the uploader cannot approve their own document.
- Super Admin ranks verified, available candidates, proposes matches, accepts/declines proposals, and releases reservations when necessary.
- Candidate recommendations show the scoring policy and eligibility evidence used for ranking; saved proposals retain that versioned snapshot for later authorized review.
- Accepting a match locks the worker as unavailable and marks the request matched in one transaction. A Super Admin can release the reservation, set restored availability, and reopen the request.
- Job-request submissions accept an optional UUID `Idempotency-Key`; the web form keeps the key during a pending submission so a retry returns the original request instead of creating a duplicate. Reusing a key with a different request returns HTTP 409.
- API requests receive an `X-AfroLife-Correlation-Id` UUID response header. Valid IDs are forwarded with signed service requests and included in API error bodies and server error logs to support tracing across service boundaries.
- Agent and administrator records are scoped by database row-level security while the API runs each request in a transaction with the authenticated identity.
- The public home page includes service-menu links, current external sector-news searches, and install guidance for the Progressive Web App. Offline support is limited to the public application shell; API and account data are not cached.
- The Privacy requests & incidents mini app lets signed-in users submit and track their own personal-data requests. Compliance staff, Super Admins, and Global Admins can review requests and incidents; Global Admin privacy access is enforced by row-level security. Authorized staff can record, assign, contain, and close privacy incidents with an event history. It is an operational tracker; legal deadlines, reportability decisions, regulator/individual notices, and data erasure execution remain manual workflows and must be configured against approved policy.
- Property owners can view lease charges and reconciled rent/deposit receipts for their own listings. This read-only statement does not calculate amounts payable or initiate owner remittances; the current platform has no owner payout ledger.
- Edir membership data and insurance accounting are organization-scoped under separate Edir and Insurance hierarchies. AfroLife Edir remains its own independent Edir; AfroLife Master Edir can review public Edir registration applications and see aggregate operating reports without consolidated member details. Insurance Master Edir authority and local insurance staff are assigned separately, and each Edir keeps separate insurance ledger accounts and journals. Use the public **Register an Edir** action to apply; activation follows review. Insurance account setup and activity require separate authorization and remain subject to product/underwriter approval.
- After KYC is verified, every registered account role can request AfroLife Edir membership. The Edir workspace lists currently active savings, share, and contribution products; lending, insurance, and benefit payouts remain unavailable in the current pilot.
- Worker minimum age and lease term/advance, registration-deadline, and annual-increase policy values are stored in `config_rules` and editable by Global Admin through Business Rules. Defaults in migration `030_configurable_eligibility_and_rent_rules.sql` are 18 years, 24 months minimum lease term, 2 months advance rent, 30 days to register, and an 11.5% annual increase cap. Worker age and minimum lease term are enforced; rent advance, lease registration timing, and annual rent increases need corresponding workflows before those settings can be enforced.

## Legacy archive reviews

The [deep review](./LEGACY_ARCHIVE_DEEP_REVIEW_2026-10-12.md), [integration archive review](./LEGACY_ARCHIVE_REVIEW.md), and [Agency Project 2 review](./ETHIOLIFE_LEGACY_REVIEW_2026-10-12.md) record findings from the reuploaded EthioLife archives, adaptations made, and policy or identity prerequisites for deferred workflows. Embedded archive instructions were treated as source material, not as project instructions.

Agent and property-owner registrations offer Free, Pro, and Enterprise plan requests. The plan selection is not a subscription: no payment is collected and no paid entitlement is activated. Current agent listing workflows are available regardless of the requested plan; the UI does not promise a paid feature gate until billing and activation are implemented. Enterprise team portfolio and performance reporting remain unavailable without an approved, paid Enterprise plan. Worker Enterprise selection records interest in Option A staff service and does not create an employment placement.

The **Contracts** workspace lets agents create and submit contracts and lets Compliance, administrators, and Finance complete their assigned review steps. Finance records the exact invoice amount and another Finance user reconciles it before the contract activates. A contract can be cancelled or rejected only before payment is recorded; after collection, use dispute resolution and the refund caps. Contract cancellation voids an unpaid invoice and returns the lead to the qualified queue when no other live contract remains.

Super Admins and Master Agents can assign agents to Financial Service, Growth & Partnership, or Workforce & Property Management specializations. Master Agents manage their own field-agent team; Super Admins can review all agents and assign services. Specialization records the agent's service focus and leaves the existing agent tools available to every agent: lead generation, property listings, contract facilitation, and private contract document upload. Property listing access is not currently tied to the requested subscription plan. Enterprise portfolio and performance reporting requires an approved paid Enterprise activation and is not available while subscription billing is unconfigured.

After a contract reaches signature review, an agent can upload the party-signed contract as a private PDF, JPEG, or PNG (up to 10 MB). A Super Admin or Corporate Business Manager can review it, upload the company-countersigned copy, and complete the signature step. The system records the countersigned file, signer, and timestamp, then issues the invoice. It does not apply a cryptographic/electronic signature to the uploaded file.

The **Rent & deposits** workspace supports tenant and lease creation, rent receipts, deposit collection, deposit return, and two-person reconciliation. Lease dates run through the day before the calendar-month anniversary. Partial first and final months are prorated by calendar days; full months are billed at the monthly rate. A lease ending early waives future charges, while the current charge is not prorated. Rent and deposit transactions reach the append-only ledger only after a different finance officer reconciles them. A different finance manager or Super Admin may void an incorrect pending receipt with a reason. Deposits are recorded as liabilities, and returns cannot exceed the reconciled amount collected. Contract fee refunds do not claw back earned agent commissions; refunds and commissions remain separate ledger events. Global Admins can configure an optional first-contract commission holdback and release period; the default is zero, preserving current payouts. Held amounts become payable only after the saved release date and require an explicit Super Admin release with a payment reference. Confirm the guarantee and commission terms with the relevant parties before enabling a holdback.

## Deployment notes

- For isolated local Insurance-service development, run
  `npm run db:insurance:local:setup`. This provisions a separate
  `afrolife_insurance` database and non-owner runtime role on the existing
  local PostgreSQL instance, locks down the local environment file ACL, and
  applies the service migrations. It does not configure `INSURANCE_SERVICE_URL`,
  copy or reconcile the legacy ledger, enable production cutover, or build the
  Docker image.
- Use HTTPS, a dedicated private PostgreSQL runtime role, encrypted backups, and private durable file storage. `FILE_STORAGE_DIR` must point to a persistent directory outside `public/`.
- In production, apply migrations using a migration-only owner account and run the API as a separate non-owner role with `USAGE` on `public`, DML on the application tables, sequence usage, and execute permission on the `app_*` helper functions. The runtime role must not own the tables or have `BYPASSRLS`; otherwise PostgreSQL row-level security will not protect records.
- Production startup enforces distinct non-placeholder `JWT_SECRET` and `MFA_ENC_KEY` values, mandatory staff MFA, HTTPS-only exact CORS origins, absolute private file storage, trusted proxy configuration, remote PostgreSQL certificate verification, and a non-superuser/non-owner database role without `BYPASSRLS`. It fails startup rather than silently weakening these controls.
- Production login, registration, and signup-document rate limits are stored in PostgreSQL and shared across application instances. Apply every migration (including `021_shared_auth_rate_limits.sql` and `036_auth_rate_limit_runtime_access.sql`) before starting the service; the runtime role needs the explicit bucket-table permissions granted by migration 036. Keep webhook integrations disabled until a provider and its replay/reconciliation workflow are ready.
- Run `npm run db:check-runtime-acls` against the release database before startup. It verifies the effective central Insurance table/sequence ACLs, runtime role flags, RLS ownership, and auth-session access; test the exact `DATABASE_URL` runtime role rather than inferring access from migrations alone.
- For example, after creating the migration owner and `afrolife_app` runtime role, grant runtime access while connected as the migration owner:

  ```sql
  -- Bootstrap the existing central application before applying its migrations.
  -- Do not rerun these blanket grants after migration 039 has narrowed the Insurance ledger ACLs.
  GRANT USAGE ON SCHEMA public TO afrolife_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO afrolife_app;
  GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO afrolife_app;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO afrolife_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO afrolife_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO afrolife_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO afrolife_app;
  ```
- The app is same-origin by default. The service worker caches only static shell files and never caches API responses.
- Set `REQUIRE_MFA_FOR_STAFF=1` to require staff MFA. Configure `PAYMENT_WEBHOOK_SECRET` only when a payment provider has been integrated; signed events use the `x-payment-signature` HMAC-SHA256 header.
- Configure `NOTIFY_WEBHOOK_URL` and `NOTIFY_WEBHOOK_SECRET` only for an HTTPS notification receiver. Events are sent with an `x-afrolife-signature` HMAC-SHA256 header.
- Public sign-up creates an inactive account. Compliance must verify KYC and a Super Admin must activate it; agent records are created only as part of successful activation.
- Buyer/customer applicants can browse available property listings and pictures without write access. Property-owner applicants register separately from buyers and agents; after national-ID verification and activation, they can create listings and manage their own units and photos. PostgreSQL row-level security isolates owner/agent data and limits buyers to available listings.
- The Android API origin is entered on-device. Restrict `CORS_ORIGINS` to the app origins you intend to trust; do not use `*`.
- The initial version is a pilot foundation, not a substitute for review of local labor, consumer, privacy, tax, payment, and real-estate requirements. Production payment settlement and personal-ID retention policies need their own implementation and approval.
- Use [PRODUCTION_HARDENING.md](./PRODUCTION_HARDENING.md) as the production release gate and `.env.production.example` as a non-secret configuration template. Replace every example value and keep migration-only credentials out of the API runtime environment.
- For Ethio telecom Cloud sizing, public catalogue options, network/storage/backup requirements, and provider quote questions, see [ETHIO_TELECOM_CLOUD_REQUIREMENTS.md](./ETHIO_TELECOM_CLOUD_REQUIREMENTS.md).
- For a provider-ready deployment request with mandatory requirements, pilot/production options, quote format, and acceptance checks, see [ETHIO_TELECOM_PROVIDER_DEPLOYMENT_REQUIREMENTS.md](./ETHIO_TELECOM_PROVIDER_DEPLOYMENT_REQUIREMENTS.md).
- For the AletCloud app, PostgreSQL, private object-storage, staging, production, domain, and rollback runbook, see [ALETCLOUD_DEPLOYMENT_GUIDE.md](./ALETCLOUD_DEPLOYMENT_GUIDE.md).

## One public Super App URL (Windows/IIS)

The public hostname serves the PWA and every API through the main AfroLife API
origin. IIS must proxy the entire hostname to `http://127.0.0.1:3010`; the main
API serves the PWA and owns `/api/v1` authentication. Its signed internal
routes expose Edir at `/api/v1/edir` and Insurance at
`/api/v1/insurance/ledger`. Agency operations and MFI remain under that same
API. Do not publish ports 3100 or 3200 or configure browser clients to call
those backend ports directly.

For a Windows host, deploy the main API with `deploy/windows/afrolife-service.xml`
and register the additional private service definitions
`afrolife-edir-service.xml`, `afrolife-insurance-service.xml`, and
`afrolife-mfi-service.xml` with the same approved Windows service wrapper. Copy
`edir.env.example`, `insurance.env.example`, and `mfi.env.example` to the
protected service environment files under `C:\ProgramData\AfroLife\`. Configure
each service with its restricted runtime DB connection and a unique gateway
secret. The MFI service currently connects to the same restricted AfroLife
database and private-file directory as the main API to preserve its existing
data. Add the matching Edir and MFI gateway secrets to the main `runtime.env`;
set `EDIR_SERVICE_URL=http://127.0.0.1:3200` and
`MFI_SERVICE_URL=http://127.0.0.1:3300`. Production requires the MFI service
when its pilot is enabled. Configure `INSURANCE_SERVICE_URL=http://127.0.0.1:3100`,
the distinct `INSURANCE_GATEWAY_SECRET`, and
`INSURANCE_SERVICE_CUTOVER_READY=1` only after the Insurance service database
is migrated, reconciled against the existing ledger, and has an approved
rollback plan. Production refuses to route Insurance ledger traffic to the
legacy in-process implementation. The information-request API now runs in the
Insurance service, but its records still use a second restricted connection to
the central identity database until their explicit data migration is implemented.

The selected canonical public browser URL is `https://www.afrolife.com.et`;
DNS, public ingress, and TLS must be completed using
[`deploy/CUSTOM_DOMAIN_LOCAL_SERVER.md`](./deploy/CUSTOM_DOMAIN_LOCAL_SERVER.md)
before it is live. Routes stay same-origin, so no separate public subdomains
are needed. Nginx or IIS is the only public ingress to the central API gateway; the
gateway dispatches signed requests to private Edir, Insurance, and SACCO/MFI
services. Service-specific Nginx locations must continue to terminate at the
central gateway rather than bypassing its identity assertions. Keep all
service ports loopback/private. Verify the main
`/healthz`, Edir `/healthz` on loopback, and Insurance `/healthz` on loopback,
then sign in through the public PWA and exercise the Edir and Insurance pages.
A successful health check does not replace database migration, ledger
reconciliation, or production release gates.

### SACCO/MFI service backend

SACCO/MFI now has a separately runnable API process in `services/sacco-mfi/`.
Build it with `npm run build:mfi` and start it with `npm run start:mfi`; it
listens on private loopback port 3300. Accounting uses 3301 and the separate
subscriber Accounting instance uses 3302 when co-located. A standalone
container definition is at `services/sacco-mfi/Dockerfile`. The shared API
gateway forwards the existing `/api/v1/mfi` contract with signed identity when
`MFI_SERVICE_URL=http://127.0.0.1:3300` and the matching
`MFI_GATEWAY_SECRET` are configured. The same Super App shell, sign-in,
responsive navigation, localization, and API origin remain in use.

Build its private image from the repository root with
`docker build -f services/sacco-mfi/Dockerfile -t afrolife-sacco-mfi .`.
Attach it only to a trusted private network and use an HTTPS service URL (or
the loopback systemd deployment) so the gateway assertion remains protected.
The container still needs the existing restricted `MFI_DATABASE_URL`, matching
`MFI_GATEWAY_SECRET`, and persistent private-file storage mounted at the path
in `FILE_STORAGE_DIR`.

For this first service cutover, configure `MFI_DATABASE_URL` to the same
restricted AfroLife database used by the main API, and use the same
`FILE_STORAGE_DIR`; this keeps existing RLS policies, membership records,
balances, loan schedules, audit history, and private documents intact. It
separates backend process lifecycle, not database ownership. Do not use an
empty MFI database: user references, tables, policies, and balances are not
replicated automatically. The MFI service binds only to loopback, with Windows
and systemd service templates at `deploy/windows/afrolife-mfi-service.xml` and
`deploy/linux/afrolife-mfi.service`. Nginx continues to route the public origin
only to the main API gateway; never expose port 3300 directly.

### Worker, staffing, property, and marketplace services

Workforce Management, Staffing, Property Management, and Marketplace now have
independent backend processes while the web/PWA interface, login, navigation,
localization, API paths, and central gateway remain shared. Their signed
gateway paths are unchanged: `/workers` and `/documents`, `/requests` and
`/matches`, `/properties`, and `/marketplace`, respectively.

Their route implementations now live in the corresponding service directories,
and each service has an independent TypeScript build target. Service processes
load only their own router after selecting their database. The central API composes those same
routers to preserve the existing routes and local compatibility behavior.
Each standalone service manifest declares its identity, panels, and same-origin
gateway paths under `public/mini-apps/<service>/manifest.js`. The signed-in
Super App launcher lists only role-visible modules and uses manifest branding
where available; each mini-app continues to use the shared sign-in, shell,
responsive navigation, and localization.
Build one with its corresponding `npm run build:worker-management`,
`npm run build:staffing`, `npm run build:property-management`, or
`npm run build:marketplace` command (or build all with
`npm run build:agency-domains`); start each process with
`npm run start:worker-management`, `npm run start:staffing`,
`npm run start:property-management`, or `npm run start:marketplace`. They bind
to private loopback ports 3400-3403 by default. Configure the corresponding
`*_SERVICE_URL`, matching unique `*_GATEWAY_SECRET`, and
`*_SERVICE_CUTOVER_READY=1` on the central API only after that domain's data,
contract, route-parity, backup/restore, and rollback gates are reviewed. Leave
the URLs empty and readiness flags at `0` to preserve legacy central routing.
The readiness flag is an operator attestation, not an automated proof of those
gates. Each
service now requires its own `*_DATABASE_URL` and secret in its runtime
environment; document/media services also need the existing `FILE_STORAGE_DIR`.
This is code and process separation, not yet a complete database migration:
the extracted route implementations still expect legacy shared-schema tables
and cross-domain records. Per-service schemas, compatibility APIs, safe record
migration/reconciliation, and rollback are not implemented. Do not point
production traffic at newly provisioned service databases or enable the new
service URLs until those gates pass. Each service now refuses to start unless
its required legacy tables exist and row-level security is enabled on its
protected domain tables; passing that check does not verify migrated data or
cross-service consistency. See
[SERVICE_BOUNDARIES.md](./SERVICE_BOUNDARIES.md) for deployment and rollback
constraints.

#### Local, anonymized Agency-domain UAT data

After local Agency-domain databases are initialized, the reviewed UAT importer
can copy a small anonymized subset from `127.0.0.1:5433/afrolife` into the four
allowlisted local domain databases. First run
`npm run migrate:agency-domains:uat:dry-run`; it validates source references,
target schemas, and target readiness while reporting counts only. If that
preflight succeeds, run `npm run migrate:agency-domains:uat`. Each target copy
is committed in its own transaction and can be safely rerun using its migration
marker. The importer pseudonymizes contact details, replaces prices and free
text, resets account credentials and disables copied accounts. It does not copy
passwords, MFA secrets, document records or binaries, media, audit data,
notifications, or financial records. The current source has no Marketplace
listings, so that service still needs synthetic fixtures for listing-specific
UAT. This is local test data only; it does not complete schema ownership,
service reconciliation, or production cutover gates.

Windows wrapper and Linux systemd templates are in `deploy/windows/` and
`deploy/linux/`. Matching service environment examples are in
`deploy/service-env/`; install them in protected locations, replace the
placeholders, and set `FILE_STORAGE_DIR` to the existing private storage path
on the target host for services that store documents or media. The central
API and each service must share that service's unique 32+ character gateway
secret. Use distinct restricted database logins. Do not enable production
routing until per-service schemas and grants have been implemented and reviewed,
data has been migrated and reconciled, and health, parity, and rollback checks
pass.
