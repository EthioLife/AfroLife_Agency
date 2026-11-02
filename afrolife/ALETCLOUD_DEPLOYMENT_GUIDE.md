# AfroLife deployment guide for AletCloud

This runbook describes a staged deployment of the AfroLife Node.js API and web app on AletCloud. It uses the application configuration in this repository and the AletCloud app, database, and object-storage workflows. Confirm prices, limits, and current product behavior in the AletCloud console before purchase; catalogue values can change.

## Deployment shape and release gates

- **Application:** one Node.js 22+ app, built with `npm run build` and started with `npm start` (`node dist/src/aletcloud-bootstrap.js`). The one-time bootstrap provisions the restricted database role and applies migrations when its temporary owner URL is configured, then starts the API. The server reads `PORT` and listens on all interfaces when `HOST` is unset.
- **Database:** private managed PostgreSQL. The runtime database identity must remain a restricted, non-owner role without `BYPASSRLS`; migrations use a separate owner identity.
- **Documents and media:** private S3-compatible object storage. The current app configuration has `FILE_STORAGE_DIR`, which points to local disk. AletCloud app disk is not a durable shared document store. Implement and verify an S3 storage adapter before accepting real user uploads or running production workflows that depend on documents.
- **Availability and recovery:** AletCloud's published backup and recovery features may not meet AfroLife's proposed RPO <= 15 minutes and RTO <= 4 hours. Get written, service-specific commitments or formally approve revised targets before production.
- **External modules:** leave service cutovers disabled until each service is separately deployed, secured, and accepted. Do not point production at localhost service URLs.

The lowest published combination previously reviewed was App Hosting Max (ETB 3,600/month), PostgreSQL Ultra (ETB 500/month), and 50 GB object storage (ETB 400/month): ETB 4,500 before VAT, approximately ETB 5,175 including 15% VAT. Verify the present price, resource scope, tax, and billing period in the console. App Hosting Max was listed at 2 CPU / 2 GiB memory; PostgreSQL Ultra at 1 CPU / 2 GiB / 20 GiB / 100 connections. Start with staging and measure before choosing production size.

## 1. Secure the account and credentials

1. Revoke the AletCloud personal access token previously pasted into chat. Treat it as compromised. Do not reuse it or copy secrets into chat, Git, tickets, or this document.
2. The current MCP token documentation and stated scope behavior need provider clarification. Do not issue a replacement token until AletCloud confirms the effective scopes and intended endpoint. Use the AletCloud dashboard directly for this runbook.
3. Enable MFA on the AletCloud account. Use named accounts for staff, restrict administrator access, and record who owns billing, DNS, application releases, and database recovery.
4. Store generated credentials only in the provider's secret/environment settings or an approved secret manager. Use different secrets for staging and production.

## 2. Prepare the project and release branch

1. Push the reviewed application source to a private GitHub repository. Protect the production branch and require review before merging releases.
2. Confirm the deployable directory is `afrolife/`. In the AletCloud app configuration set the project/root directory to `afrolife` if that option is available. If the platform cannot build from a monorepo subdirectory, create a deployment repository containing this app or use the provider's documented monorepo setup; do not guess a root setting.
3. Confirm `package.json` has Node `>=22`, build command `npm run build`, and start command `npm start`. The API listens on the platform-provided `PORT`; do not hard-code port 3000 in the hosting settings.
4. Review the exact commit and ensure no `.env` files, local credential files, uploaded documents, database dumps, or access tokens are tracked by Git.
5. Create a separate staging app/environment. Give it a staging hostname and isolated database, bucket, and secrets. Do not use production data for initial verification.

## 3. Create and secure the staging database

1. In AletCloud, create a **paid PostgreSQL** database in the intended region. Avoid a free tier for any environment requiring managed backups.
2. Keep network access private and allow only the application to connect. Confirm PostgreSQL version compatibility with the repository and the app's TLS requirements.
3. Create two database identities: a migration owner used only for schema changes, and an application runtime identity with the restricted grants expected by the app. Never run the API as the database owner or a superuser.
4. Enable the longest practical automated backup retention for staging. Before production, confirm backup frequency, retention, restore workflow, and restore timing in writing.
5. Copy the provider connection values into the staging app's secret settings. Set `DATABASE_URL` for the runtime identity and `MIGRATION_DATABASE_URL` for the migration identity. Use the provider's CA/TLS instructions. For AletCloud's private `.svc.cluster.local` database endpoints with a provider self-signed certificate, use `sslmode=require&uselibpqcompat=true`; use `sslmode=verify-full` for other remote database hosts.
6. Apply migrations once as a controlled release operation from the app directory: `npm run db:migrate`. Do not make every app replica run migrations at startup.
7. Run the repository's runtime database ACL check (`npm run db:check-runtime-acls`) with the same runtime identity the app will use. Resolve any failure before proceeding.

## 4. Provision private document storage

1. Create a private S3-compatible bucket for staging. Enable versioning if available and appropriate; set a lifecycle/retention policy that matches business and legal requirements.
2. Create a least-privilege key scoped to this bucket. Keep the secret in AletCloud environment settings, never in the repository or browser code.
3. Configure the app's server-mediated S3 adapter with `S3_ENDPOINT`, `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` (plus `AWS_SESSION_TOKEN` when supplied). AletCloud's bucket connection injects these settings and redeploys the app. Enforce authorization for every document operation, including tenant/property boundaries; credentials remain server-side and are never exposed in browser responses.
4. Test upload, download, file type/size validation, and access denial across roles and tenants. Confirm no bucket listing or anonymous object read is possible. Objects use a UUID-only key and signed server-side S3 requests; replacing an existing key is refused, while retention/deletion follows the bucket's configured policy.
5. If existing documents must be moved, inventory them, copy with checksums and metadata, reconcile database references, and preserve an auditable rollback copy before switching reads/writes. Do not mix local filesystem objects and bucket objects without a separately verified migration.
6. Keep production uploads disabled until these checks pass. Do not point `FILE_STORAGE_DIR` at ephemeral app storage as a production substitute.

## 5. Configure and deploy staging

1. In the AletCloud dashboard choose **App Hosting → Create app**, connect the private repository, and select the staging branch.
2. Set root directory `afrolife` if supported, build command `npm run build`, and start command `npm start`. Select a Node runtime version 22 or newer. Confirm the platform injects `PORT` and routes traffic to the app's listener.
3. Add staging environment variables using `.env.production.example` as a reference. At minimum configure:

   - `NODE_ENV=production`
   - `PORT` only if AletCloud requires it to be declared; the app must use the value injected by the platform
   - `DATABASE_URL` and `MIGRATION_DATABASE_URL`
   - unique strong `JWT_SECRET` and `MFA_ENC_KEY`
   - `REQUIRE_MFA_FOR_STAFF=1`
   - `TRUST_PROXY=1` only when requests reach the app through AletCloud's trusted proxy
   - `CORS_ORIGINS` set to the exact staging origin(s)
   - a private AletCloud S3 bucket linked to the app, or a separately verified persistent `FILE_STORAGE_DIR`
   - service URLs/secrets only for separately deployed services that have passed their own readiness checks

   Keep optional service cutover flags off, including `MFI_PILOT_ENABLED=0`, `INSURANCE_SERVICE_CUTOVER_READY=0`, and `GLOBAL_BI_SERVICE_CUTOVER_READY=0`, until the related integrations are independently deployed and approved. With Insurance unset, its production workspace is hidden and its API routes return 503; the core platform can deploy without that integration. Set all real secrets in the dashboard's secret fields, not plain GitHub files.
4. For a database without a SQL console, the app's one-time AletCloud bootstrap can provision the restricted role and apply migrations. Set `DATABASE_URL` to the intended runtime username and password, set `ALETCLOUD_BOOTSTRAP_DATABASE_URL` to a database-owner connection with role-creation privileges, and configure distinct `JWT_SECRET` and `MFA_ENC_KEY` values. If the database has no Super Admin, also set `SEED_ADMIN_NAME`, `SEED_ADMIN_PHONE`, and a unique `SEED_ADMIN_PASSWORD` (12–72 UTF-8 bytes). On startup, the bootstrap reuses an existing runtime role only if its PostgreSQL privilege flags are restricted; otherwise it creates a separate role with the `_afrolife_runtime` suffix, runs checksummed migrations with a migration-session-only `app.role=global_admin` setting so RLS-protected catalog seeds can be applied, and seeds the initial Super Admin on the owner connection inside a transaction with a transaction-local policy context. With a separate `MIGRATION_DATABASE_URL`, the migration runner disables `FORCE ROW LEVEL SECURITY` on `support_cases`, `support_case_access_requests`, and `support_case_events` for the migration role so the support-case `SECURITY DEFINER` policies can operate without PostgreSQL superuser privileges; the restricted runtime role is not the table owner and remains subject to RLS. Migration 113 keeps RLS enabled on `assistant_conversations` without forcing the table owner through its policies, allowing its `SECURITY DEFINER` support functions to run; the restricted runtime role remains subject to RLS. If a separate runtime role was created, copy the exact role name from the startup log and update `DATABASE_URL` in AletCloud to use this username with the same password before removing bootstrap secrets. After `/readyz` succeeds with the updated runtime URL, remove `ALETCLOUD_BOOTSTRAP_DATABASE_URL` and all `SEED_ADMIN_*` values from AletCloud and redeploy so the owner credential is no longer present in the deployment configuration. Do not leave an owner/superuser URL in `DATABASE_URL` or as a permanent runtime secret.
   The migration runner grants the restricted runtime role SELECT/INSERT/UPDATE/DELETE on application tables, read-only access to `schema_migrations`, and sequence usage/updates. These SQL privileges do not bypass enabled row-level security policies.
   Migration 114 removes `FORCE ROW LEVEL SECURITY` from `property_tenant_account_links` so the table owner can use its narrowly scoped `SECURITY DEFINER` helper without requiring PostgreSQL `BYPASSRLS`; row-level security remains enabled and the restricted runtime role remains subject to its policies. Helper execution is revoked from `PUBLIC` and granted only to the configured runtime role.
5. Trigger deployment and inspect build logs and runtime logs. Correct build, database, or health errors before adding a public production domain.
6. Verify the staging app's `/healthz` returns healthy and confirms database connectivity. This endpoint alone is not a complete readiness or recovery check.
7. Validate sign-in, MFA, role-specific navigation and API authorization, property/listing workflows, matching/search, forms, reports, and upload access. Use synthetic accounts/data only. Confirm denied roles cannot access another role's or tenant's records.
8. Check logs do not contain passwords, session tokens, national IDs, document contents, or unnecessary personal data. Review resource, connection, storage, and response-time usage under representative load.

## 6. Complete production readiness checks

Before creating production traffic, record evidence for each item:

- S3/private document storage adapter is deployed and authorization tests pass.
- AletCloud has confirmed contractual availability, backups, restore time, data location, and support for the exact services purchased; recovery meets the approved RPO/RTO.
- Production uses a separate project/app, PostgreSQL database, bucket, credentials, and domain from staging.
- The migration and runtime database identities are separate; the runtime ACL/RLS check passes.
- Two distinct Super Admin accounts are provisioned through the documented seed process, and staff MFA is required. Seed credentials are handled out of band and removed from the release operator's temporary environment after use.
- No test seeders or test credentials are used in production. `npm run seed:local-test-users` is strictly local-only.
- Named owners are assigned for releases, security incidents, backups/restores, billing, and user support.
- Wallet balance and budget alerts are set. At zero/depleted balance the service may be suspended; confirm the alert and reactivation behavior.
- Monitoring/alerts cover uptime, latency/5xx, database health and capacity, storage, failed uploads, backup age/results, and authentication lockouts.
- A rollback and restore rehearsal has been completed and recorded.

## 7. Deploy production and attach the domain

1. Create a separate production app from the protected release branch. Reuse the tested build/start configuration, but set production-only database, storage, and secret values.
2. Take a database backup/snapshot before the first production migration. Apply `npm run db:migrate` once with the migration identity. Check the runtime ACLs with the production runtime identity.
3. Deploy the reviewed commit. Verify logs, `/healthz`, database connectivity, and a small authorized smoke workflow before public DNS cutover.
4. Add the custom domain in the AletCloud app settings. Publish the exact TXT ownership-verification record AletCloud provides (typically `_alet-challenge.<domain>`), wait for verification, then publish the exact A or CNAME record it specifies. Do not assume the target value.
5. Wait for AletCloud to issue TLS. Verify HTTPS, certificate validity/renewal status, redirect behavior, and the app's exact `CORS_ORIGINS`. If an external DNS proxy is enabled, follow AletCloud's instructions for DNS-only/proxied mode.
6. Route a small controlled group first. Watch health, errors, database connections, upload behavior, and business workflows. Expand only after the release owner accepts the evidence.
7. For a rollback, redeploy the previous known-good commit and follow the documented database compatibility plan. DNS rollback is useful only if the prior service is still operational. Do not restore a database backup without assessing data written since that backup.

## 8. Ongoing operations

- Every push to the connected deployment branch may trigger a deployment; protect the branch and review each change.
- Test migrations and releases in staging first. Promote a reviewed commit; do not use staging credentials in production.
- Check backup success and wallet/budget alerts regularly. Perform and document restore rehearsals at least quarterly and after material database/storage changes.
- Review account access, tokens, service keys, MFA, dependency updates, and audit logs on a defined schedule. Revoke unused or exposed credentials immediately.
- Size up only after measuring peak concurrent users, CPU/memory, database connections/IO, data growth, upload volume, and report/matching durations.

### Emergency Super Admin recovery

When no active Super Admin can sign in, a one-time recovery can be run at app startup by setting `ALETCLOUD_ADMIN_RECOVERY_ENABLED=1`, `ALETCLOUD_ADMIN_RECOVERY_CONFIRM=rotate-super-admin`, `ALETCLOUD_ADMIN_RECOVERY_PHONE`, and `ALETCLOUD_ADMIN_RECOVERY_PASSWORD` in that app's private environment. The password must be 16–72 UTF-8 bytes. Recovery only updates one active Super Admin/Global Admin matching the phone, revokes that account's sessions, and requires a password change at next sign-in; existing MFA settings remain unchanged. After the recovery success message, remove all four variables and redeploy immediately. Never put recovery values in source control or logs.

## Official provider references

- [AletCloud app deployment](https://aletcloud.com/docs/deploy-an-app)
- [AletCloud framework guides](https://aletcloud.com/docs/framework-guides)
- [AletCloud managed databases](https://aletcloud.com/docs/managed-databases)
- [AletCloud object storage](https://aletcloud.com/docs/object-storage)
- [AletCloud pricing](https://aletcloud.com/pricing)

## Repository references

- `.env.production.example` — deployment variable names and defaults
- `package.json` — Node version, build/start scripts, database scripts
- `README.md` — local setup, admin provisioning, and role/security behavior
- `ETHIO_TELECOM_CLOUD_REQUIREMENTS.md` — provider-independent infrastructure, backup, and recovery requirements
