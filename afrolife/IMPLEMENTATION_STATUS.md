# Implementation status

Historical implementation notes below were reviewed on 5 October 2026. Current
scope and follow-up work were refreshed on 8 October 2026.

## Current review — 8 October 2026

- The active schema includes migrations through `021_shared_auth_rate_limits.sql`.
  Earlier references in this document to a 15-migration system are historical
  and should not be used as the current schema count.
- Plan selection is a request, not an active subscription. Agent property
  listing workflows are currently available regardless of requested plan;
  Enterprise reporting remains gated on paid activation. Signup plan copy and
  README wording were aligned to that behavior.
- Added `QUALITY_ASSURANCE.md` with CI/staging/release evidence gates, personal
  data handling prerequisites, pilot operations ownership, and a baseline-first
  business scorecard. Added a GitHub Actions workflow for build, syntax,
  configuration, and existing unit-suite checks.
- Added a local-only test-user seed command. Eleven synthetic accounts cover all
  ten AfroLife app roles (including a second Super Admin); every generated
  credential successfully signed in locally. Institution-scoped MFI roles still
  require an institution and staff membership assignment.
- Refreshed the PWA presentation with responsive desktop/tablet/mobile layouts,
  larger touch targets, accessible keyboard focus, reduced-motion handling, and
  safe-area support for edge-to-edge phones.
- Prepared `SACCO_MFI_PILOT_RELEASE.md` as a controlled pilot release candidate.
  The TypeScript build, all 42 unit tests, browser syntax/configuration checks,
  and local migration check passed. Staging, integration, public deployment,
  and a signed Android release remain unverified or unavailable.
- This documentation and workflow update does not verify that CI has run, that
  staging or production passed the release gates, or that privacy/legal review,
  backup recovery, translations, and device testing are complete.

## Current state

The AfroLife Agency MVP is implemented as a TypeScript/Express API, PostgreSQL
application, responsive PWA, and Capacitor Android wrapper. `npm run build`
completed successfully during this review. The isolated local PostgreSQL
instance is accepting connections on `127.0.0.1:5433`.

This continuation also closes the documented MFA code-replay gap. Successful
TOTP use now records its time step atomically, so a code cannot be used twice,
including across concurrent sign-ins. Migration
`009_totp_replay_protection.sql` is applied locally.

Contract cancellation and KYC rejection now have audited paths before payment.
Rent receipts and deposit collection/return require independent reconciliation
before posting to the ledger; partial first and final months use calendar-day
proration.
Contracts and rent are available in the staff/agent workspace.
Staff activation now requires a different Super Admin from the account creator;
password and MFA resets also require another Super Admin.

The codebase includes public registration and staff activation, agent and
property-owner records, property listings and private photos, KYC document
review, candidate matching and worker reservations, contracts and rent
operations, business-rule administration, MFA, audit records, database row
level security policies, and deployment templates. The README and migrations
are the implementation reference for the exact workflow scope.

The registration page now presents worker pension-match and AfroLife Edir
benefit options. Applicants can submit non-binding interests for the proposed
5% pension match, Edir membership, optional life cover, and household cover.
Migration `015_member_benefit_interests.sql` is applied to the isolated local
test database. These choices do not collect money or activate a fund, match,
or insurance policy; funding, eligibility, insurer terms, and claims operations
still need to be established before coverage is offered.

The attached `files.zip` was reviewed as source material. Its nested
`agent-platform-1.0.0-rc1.zip` is an earlier release candidate with six schema
migrations and a simulated demo. Its marketplace and operations features are
already present in the active system. No older application files
were substituted. Its release-gate and pilot guidance agrees with the existing
`PRODUCTION_HARDENING.md` checklist. The bundle's Docker/Caddy and backup
examples target that separate six-migration package, so they were not copied
into this app's different deployment and database layout.

## Not established by this review

- The parent Git repository has no commits; Git reports the entire `afrolife/`
  project as untracked, so there is no committed baseline for a normal diff.
- The local API runtime role was verified as `afrolife_app`, with neither
  superuser nor `BYPASSRLS` privileges; it can read the applied migrations.
  This verifies the local database only, not any staging or production server.
- The unit suite passed all 35 tests. Integration checks were not run because
  the configured test database is the local application database, not a
  separately provisioned disposable database.
- Production deployment is not complete. Public DNS, trusted TLS, ingress,
  restricted service identity, durable private storage, backups and a restore
  rehearsal, monitoring, and a staged pilot require deployment evidence.
- The Android debug APK builds successfully after correcting the wrapper
  invocation and increasing the Gradle download timeout. APK output is
  `%LOCALAPPDATA%\AfroLife\android-build\_app\outputs\apk\debug\app-debug.apk`.
  Its SHA-256 is `6888E2164A3D183E09878BEBFA49BA6E007FD9D7DA2184CA03383737D53F40F1`.
  A device install was not checked because ADB is unavailable here. A signed
  release APK was not built because no release keystore credentials are set.

## Known product scope and decisions

- Paid subscriptions are plan requests only; payment collection and subscription
  lifecycle are not implemented. Customer and worker self-service portals are
  outside the current MVP.
- Payment settlement through a provider and payment webhooks are not enabled.
- The new pension and Edir selections record interest only; contributions,
  pension matching, premium collection, insurance enrollment, and claims are
  not yet implemented.
- `CHANGES.md` contains earlier review notes on those gaps; the current choices
  are documented in the README. Local behavior still needs scenario validation
  before production.
- A full independent security review, personal-data retention policy,
  backup/restore rehearsal, and legal review remain production gates.
- The production checklist in `PRODUCTION_HARDENING.md` remains the release
  gate for security, operations, legal review, and launch readiness.

## Verification performed

- The prior runtime database check confirmed `afrolife_app`, `rolsuper=false`,
  and `rolbypassrls=false`; `015_member_benefit_interests.sql` then applied cleanly.
  Rent-table RLS and runtime DML grants are enabled.

- `npm run build` — passed.
- `npm run android:build` — passed; Gradle reports `BUILD SUCCESSFUL`.
- `npm run db:local:status` — PostgreSQL accepted connections on
  `127.0.0.1:5433`.
- `node --check public/app.js` passed.
- `npm run test:unit` passed: 35 tests, 0 failures.
- Source scan found no explicit unfinished implementation markers; matches
  were UI placeholders and the intentional dummy password hash.

## Finalization update — 5 October 2026

The current build adds searchable territory suggestions with localized type labels and parent-area context. Territory submissions still resolve to a valid server territory ID. The registration header and mobile layout have been aligned, and the PWA now offers installation in supported browsers and caches only its static shell.

Agent and property-owner registrations offer Free, Pro, and Enterprise plan requests. No subscription payment or paid entitlement is active. Current agent property-listing routes permit listing workflows regardless of the requested plan; Enterprise team reporting remains gated on paid activation. Worker Enterprise selection records interest in Option A staff service and does not create an employment placement.

The language selector offers English, Amharic, Afaan Oromoo, Tigrinya, Somali, Arabic, and Kiswahili. Static text and generated interface text refresh when the locale changes, Arabic uses right-to-left layout, and the new benefit, plan, territory, and install copy has been translated. **Translation coverage is not yet complete across every operational workspace phrase in Somali, Arabic, and Kiswahili; missing catalog entries fall back to English.**

The following installable/test artifacts were generated from this source:

- Android debug APK: `%LOCALAPPDATA%\AfroLife\android-build\_app\outputs\apk\debug\app-debug.apk`
- PWA static package: `%LOCALAPPDATA%\AfroLife\web-build\afrolife-pwa.zip`

The PWA archive contains an install guide. It needs to be hosted over HTTPS with the AfroLife API reachable on the same origin at `/api/v1`. The APK is debug-signed for internal testing. A signed release APK and public deployment were not produced: no release keystore or configured public host is available. No Android device install was performed because ADB is unavailable.

Verification for this continuation: TypeScript build passed; migration `016_agent_seller_worker_service_plans.sql` applied to the isolated local database; JavaScript syntax and web manifest JSON parsing passed; Android Gradle debug build completed successfully. The unit suite was not rerun during this continuation.


Current artifact checksums (latest builds):

- APK SHA-256: `0C93CCE36747814EFB20DCA4AE0BDDC4C363740F1F9780CDC5A09634D5F40270`
- PWA ZIP SHA-256: `89BA28FF0B6B8EBF56DCADAD59835354C660A974C3A71AE148E20E5D52D86434`

## Domain configuration check — 10 October 2026

The saved DuckDNS credential was used successfully to update
`afrolife-agency.duckdns.org`. Public DNS now resolves to this network's current
public egress address. This confirms DNS is no longer the blocker.

The app is not configured as a public web site on this host. WSL Nginx serves
the staging app only on `127.0.0.1:8080`, and the Node API listens only on
`127.0.0.1:3010`. Windows IIS responds locally on HTTP with its stock landing
page rather than the AfroLife app; no HTTPS binding is configured. Windows
Firewall has no enabled inbound allow rule for ports 80/443, the host uses a
private LAN address behind a gateway, and external checks cannot reach TCP
80/443. No port-proxy rule is configured. Thus, a router/firewall inbound route
or a public host/tunnel is still required, as are an app reverse-proxy binding
and trusted TLS. Do not forward database/API internal ports directly.

## Oracle Cloud Always Free deployment preparation — 10 October 2026

Prepared `deploy/linux/ORACLE_ALWAYS_FREE.md` for a central-app pilot on an
Ubuntu ARM64 VM, added a production Nginx site template, and constrained the
Linux systemd service's Node listener to loopback. The DuckDNS updater can now
set an explicitly supplied IPv4 address without revealing the saved token;
this is needed to point the hostname at a VM rather than the current PC's
hotspot egress. No Oracle account, VM, public ingress, certificate, database,
or deployment was created. Oracle's free compute quota does not guarantee
that public IPv4 and all network/storage resources are free, so review the
complete estimate and stop if any charge is shown.

The developer host also has VMware Workstation Pro 16.2.3. Prepared a
NAT-only Ubuntu Server VM configuration with a growable virtual disk under
`%USERPROFILE%\Documents\Virtual Machines\AfroLife-Ubuntu`; no guest OS has
been installed or started yet. See `deploy/linux/VMWARE_LOCAL_PILOT.md`.
