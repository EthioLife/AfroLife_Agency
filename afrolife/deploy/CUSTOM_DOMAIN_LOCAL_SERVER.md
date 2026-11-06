# Custom domain on a locally hosted server

This runbook uses `https://www.afrolife.com.et` as the canonical public URL.
The apex URL `https://afrolife.com.et` should redirect to `www`.

## Before changing DNS

Confirm that the server has a stable public IPv4 address and that the ISP does
not place it behind carrier-grade NAT (CGNAT). A private LAN address or a
dynamic public address that changes without a DNS updater will not support
reliable public hosting. If the ISP uses CGNAT, request a public/static address
or use an approved hosting/tunnel service.

On the Ethiotelecom DNS control panel, create records equivalent to:

| Name | Type | Value |
| --- | --- | --- |
| `@` | `A` | The server's public IPv4 address |
| `www` | `CNAME` | `afrolife.com.et` |

If CNAME is unavailable for `www`, use an `A` record to the same public IPv4.
Do not add an `AAAA` record unless the server has working public IPv6 and its
firewall and reverse proxy are configured for IPv6.

On the Internet router, forward inbound TCP ports 80 and 443 to the server's
reverse proxy. Permit these ports in the host firewall. Keep the application
port 3010, PostgreSQL port 5432, and all private service ports inaccessible
from the Internet. The application service should continue binding to
`127.0.0.1:3010`; Nginx or IIS is the only public ingress.

## HTTPS and reverse proxy

Use the Linux Nginx site in
[`linux/nginx-afrolife-production.conf`](./linux/nginx-afrolife-production.conf)
with both domain names. After DNS resolves publicly and port 80 reaches the
proxy, request a trusted certificate covering both `afrolife.com.et` and
`www.afrolife.com.et` (for example, with Certbot's Nginx integration). Enable
HTTP-to-HTTPS redirection for `www`, while keeping the apex-to-`www` redirect
in place. Renew the certificate automatically and test renewal before launch.
The Node application must receive the original host and HTTPS forwarding
headers from the trusted reverse proxy.

For Windows/IIS, configure HTTPS bindings and a renewable certificate for both
hostnames in IIS. The rules in [`windows/web.config`](./windows/web.config)
redirect HTTP traffic to the canonical `www` hostname and proxy requests to
`127.0.0.1:3010`; install and validate the required IIS URL Rewrite and ARR
components. Do not expose port 3010 directly.

Production environment templates allow the exact origins
`https://www.afrolife.com.et` and `https://afrolife.com.et` in `CORS_ORIGINS`.
Use the template matching the host operating system, retain `https://localhost`
only if a native app needs it, and keep production secrets in the protected
runtime environment file, not in the repository.

## Verify before launch

1. Verify the public A record for `afrolife.com.et` matches the stable server
   address and that `www` resolves to the same address.
2. From a separate external network, verify both TCP 80 and 443 reach the
   reverse proxy and that HTTP redirects to `https://www.afrolife.com.et`.
3. Verify the certificate covers both names, is trusted, and renews.
4. Verify `https://www.afrolife.com.et/healthz` and `/readyz`; confirm login,
   session cookies, API requests, file uploads, and mini-app gateway routes.
5. Confirm externally that ports 3010 and 5432 are closed.

DNS changes, router forwarding, certificate issuance, firewall configuration,
and production deployment must be performed on the DNS provider, router, and
server. Repository configuration alone does not publish the site.
