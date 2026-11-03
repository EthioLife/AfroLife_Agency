# Oracle Cloud Always Free VM deployment

This runbook targets one Ubuntu 24.04 ARM64 VM in Oracle Cloud's home region.
Oracle currently documents an Always Free allowance equivalent to 2 OCPUs and
12 GB of memory for Ampere A1, subject to tenancy and regional capacity. Free
instances can be reclaimed when idle. Account verification may request payment
card details; Oracle documents temporary authorization holds. Review Oracle's
current terms and the account's limits before creating resources. Compute
eligibility does not guarantee that every required resource (including public
IPv4, storage, or network use) is free. Check the current price estimate for
the whole configuration before creating anything; if the console shows any
charge, stop and get explicit approval. Do not upgrade to a paid account or
select resources marked as paid without explicitly approving the cost.

References: [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
and [Oracle Free Tier](https://www.oracle.com/cloud/free/).

The VM hosts the central AfroLife Node.js application, PostgreSQL, Nginx, and
TLS. The database and Node listener remain local to the VM; only SSH (restricted
to the administrator's IP), HTTP, and HTTPS are public. Do not expose ports
3010 or 5432. Insurance and Edir service extraction/cutover remains disabled
until their separate databases, historical-data validation, and service
readiness gates are completed.

## 1. Create the free VM

In Oracle Cloud Console:

1. Select the tenancy's **home region** and create an Ubuntu 24.04 ARM64
   instance using `VM.Standard.A1.Flex`, with 2 OCPUs and 12 GB memory or a
   smaller allocation within the Always Free allowance. Use a 50 GB boot
   volume so the total remains within the free block-volume allowance.
2. Create or select a public subnet with an Internet Gateway and a route to
   that gateway. Assign a public IPv4 address only if the total price estimate
   confirms it is free. Keep the VM instead of terminating/recreating it so its
   address remains associated; recheck the address after any replacement.
3. Add ingress rules for TCP 22 from the administrator's current public IP
   only, and TCP 80 and 443 from the Internet. Do not add ingress rules for
   3010 or 5432. Keep the private SSH key on the administrator's computer and
   never upload it to the repository or chat.
4. Record the public IPv4 address, subnet, and region. Confirm the VM shape and
   boot volume show no charge before clicking Create.

The default-free capacity can be unavailable in a region. Do not change to a
paid shape to work around an out-of-capacity error.

## 2. Point DuckDNS to the VM

From the Windows account that already has the DPAPI-protected DuckDNS
credential, run this after the VM has a reserved public IPv4 address:

```powershell
.\afrolife\deploy\windows\Update-DuckDns.ps1 -Ip 203.0.113.10
```

Replace the example address with the VM's actual public IPv4. The updater
validates IPv4 input and does not print the token. Use `-Ip` for the server
address; running the updater without `-Ip` intentionally restores automatic
detection of the current computer's public egress IP. Do not create an
automatic updater task on a developer PC when DNS should point at the VM.
After updating, verify the hostname's A record equals the reserved VM IP from
two public DNS resolvers.

## 3. Prepare Ubuntu

SSH to the VM using the private key locally. Use the distro's security updates
and firewall, allowing only SSH from the administrator's IP and public HTTP/S:

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git nginx postgresql postgresql-contrib \
  ufw certbot python3-certbot-nginx
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from <ADMIN_PUBLIC_IPV4>/32 to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

In the UFW command, replace `<ADMIN_PUBLIC_IPV4>` with the administrator's
current public IPv4 before running it; do not open SSH to the entire Internet.
Install Node.js 22 for ARM64 from the official Node.js distribution or a
verified signed package repository, then confirm `node --version` is 22 or
newer and `npm --version` succeeds. Keep
Ubuntu, Node.js, PostgreSQL, and Nginx patched. Create restricted
`afrolife` (runtime) and `afrolife-deploy` (release/migration) system accounts.
Create `/var/lib/afrolife/private-files` and `/var/log/afrolife`; grant write
access only to the runtime account. Keep the source release under
`/opt/afrolife/app` owned by the deploy account and readable, not writable, by
the runtime account.

## 4. Configure PostgreSQL and secrets

Keep PostgreSQL listening on loopback and create a dedicated migration owner,
database, and non-owner runtime login. Set role passwords interactively with
`psql`'s `\password` command; never place passwords directly in SQL, shell
history, or this repository. Bootstrap the application's schema/table/function
privileges before applying migrations as described in
[PRODUCTION_HARDENING.md](../../PRODUCTION_HARDENING.md). Do not repeat blanket
grants after migration 039 narrows Insurance ledger access.

Create root-protected `/etc/afrolife/runtime.env` with mode `0640`, owned by
`root:afrolife`. It must contain the production fields in
[`../../.env.production.example`](../../.env.production.example), with unique
random `JWT_SECRET` and `MFA_ENC_KEY` (at least 32 characters and different),
the exact origin `https://afrolife-agency.duckdns.org`, `TRUST_PROXY=loopback`,
and a local PostgreSQL `DATABASE_URL` for the restricted runtime role. Set
`FILE_STORAGE_DIR=/var/lib/afrolife/private-files`. Do not include the
migration-owner URL in this runtime file.

Keep a separate mode-`0600` migration environment file readable only by
`afrolife-deploy`. It contains both `MIGRATION_DATABASE_URL` (migration owner)
and `DATABASE_URL` (runtime role), because the migration runner uses the
runtime role name to apply role-specific grants. Do not run the migration owner
as the long-lived API service.

## 5. Build, migrate, and start

Clone the selected, reviewed commit to `/opt/afrolife/app` as the deploy
account; do not deploy uncommitted working-tree changes. Before the first
public startup, rehearse the release and every migration against a separate
disposable/staging database. For the production release:

```bash
cd /opt/afrolife/app
npm ci
npm run build
```

Remove development dependencies after the build. Load the protected migration
environment only into the one-off migration process and run migrations as
`afrolife-deploy`:

```bash
cd /opt/afrolife/app
npm prune --omit=dev
sudo -u afrolife-deploy env AFROLIFE_ENV_FILE=/etc/afrolife/migration.env \
  node /opt/afrolife/app/dist/src/migrate.js
sudo -u afrolife-deploy env AFROLIFE_ENV_FILE=/etc/afrolife/migration.env \
  node /opt/afrolife/app/scripts/check-runtime-acls.mjs
```

Verify the applied migration list. Both one-off operations use the restricted
migration file; the ACL checker needs the migration URL to inspect effective
runtime-role privileges. The long-running service must read only
`/etc/afrolife/runtime.env`, which must not contain migration credentials.
Apply changes to migrations only after a reviewed backup and a tested restore
procedure exist.

Install `deploy/linux/afrolife.service` as
`/etc/systemd/system/afrolife.service`, verify its environment file and private
storage permissions, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now afrolife
sudo systemctl --no-pager --full status afrolife
```

The service template binds Node to `127.0.0.1:3010`; it must not be reachable
from the public interface. Confirm `curl -fsS http://127.0.0.1:3010/healthz`
before configuring public ingress.

## 6. Configure Nginx and TLS

Install `deploy/linux/nginx-afrolife-production.conf` as
`/etc/nginx/sites-available/afrolife`, enable it, remove/disable the default
site, install `deploy/linux/afrolife-proxy-headers.conf` at
`/etc/nginx/snippets/afrolife-proxy-headers.conf`, run `nginx -t`, and reload
Nginx. The Edir, Insurance, and MFI path groups all forward to the authenticated
Super App API gateway; Nginx must never target the private service ports.
Verify DNS resolves to the VM and that
the OCI security list and UFW permit ports 80 and 443. Then request a
Let's Encrypt certificate:

```bash
sudo certbot --nginx -d afrolife-agency.duckdns.org
sudo certbot renew --dry-run
```

Verify HTTP redirects to HTTPS, the certificate hostname and chain are valid,
`https://afrolife-agency.duckdns.org/healthz` returns success, and the
application shell loads in a browser. Verify from a separate external network;
testing from inside the VM or its Wi-Fi does not prove public reachability.

## 7. Production gate

Do not use this pilot for public deposits, regulated lending, or live insurance
payments until legal/regulatory, privacy, security, accounting, KYC/AML, backup,
incident-response, and independent financial reviews are complete. Do not
enable Insurance service cutover or configure Edir/Insurance service URLs
without their separately provisioned databases, migrations, service identities,
and verified historical-data migration. Seed the initial administrator
interactively with `deploy/linux/Seed-AfroLifeAdmin.sh`; do not use a sample
account or share credentials.

Record the VM's monthly cost status, snapshots/backups, backup restore test,
monitoring and renewal alerts. Oracle notes that idle Always Free instances can
be reclaimed; Always Free is not an availability or backup guarantee.
