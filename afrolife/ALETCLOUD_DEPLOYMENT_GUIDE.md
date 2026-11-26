# AfroLife deployment guide for AletCloud

This runbook describes a staged deployment of the AfroLife Node.js API and web app on AletCloud. Confirm current prices, limits, and product behavior in the AletCloud console before purchase.

## Deployment shape and release gates

- **Application:** Node.js 22+, built with `npm run build` and started with `npm start`. The API uses the platform-provided `PORT`.
- **Database:** private managed PostgreSQL. Runtime and migration identities must be separate; the runtime identity is restricted, is not the table owner, and does not have `BYPASSRLS`.
- **Documents:** use private, durable S3-compatible storage in hosted environments. Keep uploads disabled until authorization, malware scanning, storage access, and recovery have been tested. Do not rely on ephemeral app disk.
- **Recovery:** obtain written, service-specific backup and restore commitments and approve RPO/RTO targets before production.
- **External modules:** leave service cutovers disabled until each separately deployed service is secured and accepted.

The previously reviewed lowest published combination was App Hosting Max, PostgreSQL Ultra, and 50 GB object storage at ETB 4,500 before VAT (about ETB 5,175 including 15% VAT). Verify current pricing, resources, taxes, and billing periods in the console.

## 1. Secure the account and credentials

1. Revoke any access token previously exposed in chat. Never put secrets in source control, tickets, logs, or this guide.
2. Use named accounts, enable account MFA, restrict administrator access, and assign owners for billing, DNS, releases, and database recovery.
3. Store credentials only in provider secret settings or an approved secret manager. Use distinct secrets and resources for Development, UAT, and Production.
4. Rotate MFA encryption keys through the one-time `npm run db:mfa:rotate-key` operation; do not replace `MFA_ENC_KEY` alone. Deploy compatibility code first. In a controlled maintenance window, set a new `MFA_ENC_KEY`, the prior dedicated key as `MFA_ENC_KEY_PREVIOUS`, and keep `JWT_SECRET` unchanged during re-encryption. If legacy records require it, provide `MFA_LEGACY_JWT_SECRET` only to the one-time operator process.
5. Run `npm run db:mfa:rotate-key`, then `npm run db:mfa:verify-key` with the correct runtime and owner database URLs and active keys. Require a passing verification and confirm representative MFA sign-ins. Only then remove previous/legacy keys. Rotate `JWT_SECRET` separately afterward. Take and verify a restorable backup first.

The rotation locks the users table and re-encrypts stored MFA secrets in one transaction; undecryptable data aborts and rolls back the operation. Supply secrets only through the approved operator environment, never command-line arguments or logs.

## 2. Prepare the project and environments

1. Protect release branches and require review. Confirm the deployable directory is `afrolife/`; configure it as the app root if supported.
2. Use Node 22 or newer, build command `npm run build`, and start command `npm start`. Do not hard-code the listening port.
3. Check that `.env` files, credentials, uploads, and database dumps are not tracked.
4. Create isolated Development, UAT, and Production apps, databases, buckets, hostnames, and credentials. Use synthetic data for initial validation.

## 3. Create and secure the database

1. Create private managed PostgreSQL in the intended region. Confirm version, TLS, backups, retention, restore workflow, and restore timing.
2. Use separate migration-owner and restricted runtime identities. Do not run the API as an owner or superuser.
3. Set `DATABASE_URL` to the runtime identity and `MIGRATION_DATABASE_URL` to the migration identity. For AletCloud private `.svc.cluster.local` endpoints use `sslmode=require&uselibpqcompat=true`; use `sslmode=verify-full` for other remote hosts.
4. Apply migrations as a controlled operation with `npm run db:migrate`, then run `npm run db:check-runtime-acls` using the runtime identity.

For initial setup where no SQL console is available, the one-time bootstrap may use `ALETCLOUD_BOOTSTRAP_DATABASE_URL` with owner privileges to provision the restricted role and apply migrations. Keep `DATABASE_URL` on the intended runtime identity and use distinct `JWT_SECRET` and `MFA_ENC_KEY`. Remove bootstrap and seed variables after `/readyz` passes with the runtime URL; never leave an owner URL as a runtime secret.

The migration runner applies checksummed migrations with a migration-session-only policy context. With a separate `MIGRATION_DATABASE_URL`, it disables `FORCE ROW LEVEL SECURITY` on support-case tables for the migration role; migration 113 keeps RLS enabled on `assistant_conversations` without forcing the table owner through its policies. Migration 114 removes `FORCE ROW LEVEL SECURITY` from `property_tenant_account_links` so its narrowly scoped `SECURITY DEFINER` helper works without `BYPASSRLS`. RLS remains enabled, the restricted runtime role remains subject to its policies, and helper execution is limited to that role.

### Recover an existing app with unapplied migrations

Take a database snapshot and verify both URLs target the same database. Temporarily set `ALETCLOUD_BOOTSTRAP_DATABASE_URL` to the migration owner and `ALETCLOUD_BOOTSTRAP_MIGRATIONS_ONLY=1`. Keep `DATABASE_URL` restricted and retain the required distinct JWT and MFA secrets. Redeploy once, inspect every migration result, and stop at the first failure. Remove both temporary variables after `/readyz` confirms expected migrations with no checksum or unverified-migration errors. This mode skips administrator seeding.

## 4. Provision private document storage

1. Create a private S3-compatible bucket. Configure versioning and lifecycle/retention to meet business and legal requirements.
2. Create a least-privilege key scoped to this bucket. Keep credentials server-side.
3. Configure `S3_ENDPOINT`, `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` (and `AWS_SESSION_TOKEN` if supplied).
4. For marker-based readiness, provision a private zero-byte health-marker object and set `S3_HEALTHCHECK_OBJECT_KEY` to its UUID key. Readiness attempts a signed marker `PUT`, then checks the marker with signed `HEAD` retries; it falls back to a signed bucket `HEAD` and fails closed if neither works. Without the marker setting, readiness uses the legacy bucket `HEAD`.
5. Test upload, download, size/type validation, and role/tenant authorization—including denied access. Confirm no anonymous reads or bucket listing. Private object keys are UUIDs and uploads refuse overwrites.
6. Configure a private ClamAV service with `CLAMAV_HOST`, `CLAMAV_PORT`, and `CLAMAV_TIMEOUT_MS`. Upload routes fail closed unless scanning is configured and clean.
7. Test backup/restore and retention independently. `/readyz` confirms storage connectivity, not upload authorization, malware scanning, or recovery. Keep production uploads disabled until those checks pass.

If existing documents must be moved, inventory them, copy with checksums and metadata, reconcile database references, and retain an auditable rollback copy. Do not mix local filesystem objects and bucket objects without a separately verified migration.

## 5. Configure and validate staging

Configure `NODE_ENV=production`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, distinct strong `JWT_SECRET` and `MFA_ENC_KEY`, `REQUIRE_MFA_FOR_STAFF=1`, exact `CORS_ORIGINS`, and the trusted proxy setting only for the actual AletCloud proxy. Add private storage and scanning settings above. Keep optional service cutover flags off until the related services are independently approved; do not point Production at localhost services.

For initial Super Admin bootstrap, set `SEED_ADMIN_NAME`, `SEED_ADMIN_PHONE`, and a unique `SEED_ADMIN_PASSWORD` only when needed. Remove all seed and owner-bootstrap values after confirming the app uses the restricted runtime identity.

Deploy staging and verify `/healthz` and `/readyz`. Test sign-in, MFA, role-specific UI and API access, tenant boundaries, upload/download, malware rejection, representative workflows, and denied access using synthetic accounts. Review logs for secrets, tokens, document contents, and unnecessary personal data. Monitor resource use and errors.

### Automatically apply Development migrations

The `migrate-development` job in `AfroLife quality checks` runs after quality jobs pass for a push to `aletcloud-development` that changes `afrolife/migrations/`. It runs the exact tested commit, serializes runs, and fails closed if the push base cannot be verified. Configure the protected `afrolife-development` GitHub Environment for that branch and store only the Development runtime and migration-owner URLs there. Never use UAT or Production credentials. This workflow does not migrate UAT or Production.

## 6. Production readiness evidence

Before any Production release, record evidence that:

- The exact release SHA is in both `main` and UAT, required CI passed, and UAT `/readyz` is healthy.
- A database backup reference is verified restorable before migration.
- Production runtime and migration credentials have been rotated as required; session revocation and credential rotation are confirmed.
- Private storage marker behavior, signed upload/download, role/tenant authorization, malware scanning, and backup/restore have been independently tested.
- The runtime ACL/RLS check passes; separate Super Admin accounts and staff MFA are configured.
- The provider has confirmed backup, restore, data location, availability, and support for the purchased services against approved RPO/RTO targets.
- Production resources and credentials are isolated from Development and UAT; automatic Production deploy-on-push is disabled.
- Owners, monitoring, budget alerts, rollback procedures, and a restore rehearsal are documented.

Do not treat a bucket URL as a database backup reference. Do not proceed while any required evidence is missing.

## 7. Promote to UAT and release Production

### UAT

The `Promote AfroLife Development to UAT` workflow runs after `AfroLife quality checks` succeeds for a push to `aletcloud-development`. It promotes the exact tested commit to `aletcloud-prod-disabled-insurance`, which must be the UAT app's deployment branch. A merge conflict, missing commit, or branch-protection rejection fails closed and needs operator review. Promotion transfers source only; keep UAT database, bucket, and environment secrets separate.

### Production release gate

Keep AletCloud automatic Production deployments disabled. Configure the protected `afrolife-production` GitHub Environment with required human reviewers and only Production runtime/migration secrets. The dedicated private-network runner must reach the Production database and must not run untrusted pull-request jobs. Restrict who can dispatch the gate.

1. Dispatch the Production release gate with operation `diagnose`. It reads migration state using only the restricted runtime role and reports missing, mismatched, unverified, or unexpected migrations without printing checksums or connection data.
2. Verify the restorable backup reference and rotated Production credentials. Dispatch `migrate` for the exact reviewed SHA after build, disposable-database tests, healthy UAT readiness, same-database/separate-role checks, and runtime ACL checks pass. This phase checks schema only and does not require the deployed storage check to pass.
3. Provision the private marker and configure `S3_HEALTHCHECK_OBJECT_KEY`, then deploy that exact reviewed commit. Dispatch `verify` with evidence for private upload/download and role/tenant authorization. Require Production `/healthz` and full `/readyz`, including storage, plus malware-scan and business smoke tests.
4. Keep public traffic gated until the release owner accepts all evidence. Then attach the custom domain using only the exact DNS records supplied by AletCloud; verify TLS, redirects, and `CORS_ORIGINS` before controlled traffic rollout.

For rollback, redeploy the previous known-good commit and follow the database compatibility plan. Assess writes since the backup before restoring it.

## 8. Ongoing operations and emergency recovery

- Protect every connected deployment branch; review each push that can trigger deployment.
- Test migrations and releases in staging first. Production migrations never run automatically on source push.
- Check backup results and budget alerts regularly; conduct and document restore rehearsals at least quarterly and after material storage/database changes.
- Review accounts, tokens, service keys, MFA, dependencies, and audit logs. Revoke exposed credentials immediately.
- Monitor uptime, latency/5xx, database health/capacity, storage, failed uploads, backup age/results, and authentication lockouts.

When no active Super Admin can sign in, one-time startup recovery requires `ALETCLOUD_ADMIN_RECOVERY_ENABLED=1`, `ALETCLOUD_ADMIN_RECOVERY_CONFIRM=rotate-super-admin`, a recovery phone, and a unique password. It proceeds only for exactly one active Super Admin/Global Admin, revokes that account's sessions, and requires a password change. Remove recovery variables and redeploy immediately after success. Never commit or log recovery values.

## References

- [AletCloud app deployment](https://aletcloud.com/docs/deploy-an-app)
- [AletCloud managed databases](https://aletcloud.com/docs/managed-databases)
- [AletCloud object storage](https://aletcloud.com/docs/object-storage)
- `package.json`, `.env.production.example`, `README.md`, and `ETHIO_TELECOM_CLOUD_REQUIREMENTS.md`
