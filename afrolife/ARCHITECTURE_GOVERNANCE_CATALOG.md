# AfroLife Architecture Governance Catalog

This catalog records the governed application and service boundaries used by quality checks.

| Component | Responsibility | Build target | Database boundary |
|---|---|---|---|
| Core API | Authentication, shared administration, platform APIs | `npm run build` | Shared PostgreSQL runtime with restricted role grants |
| Workforce management | Worker profiles and verified document workflows | `npm run build:workforce-management` | Workforce tables and worker document storage |
| Staffing | Staffing requests, matches, engagements and settlements | `npm run build:staffing` | Staffing service database boundary |
| Property management | Listings, leases, maintenance and resident workflows | `npm run build:property-management` | Property tenant and platform role boundaries |
| Marketplace | Listings and sandbox commerce | `npm run build:marketplace` | Marketplace tenant boundary |
| Accounting | Journals, outbox and controlled finance workflows | `npm run build:accounting` | Accounting service and ledger boundary |
| Insurance ledger | Insurance policy and ledger operations | `npm run build:insurance` | Insurance ledger service boundary |
| Global BI | Reporting projections and data exports | `npm run build:global-bi` | Reporting read boundary |
| Edir | Community savings and credit workflows | `npm run build:edir` | Edir service boundary |
| SACCO/MFI | MFI lending and customer controls | `npm run build:mfi` | MFI service boundary |

## Governance rules

- Changes to a service must remain within that service's documented role and database grants.
- Upload workflows fail closed when malware scanning is unavailable or returns an invalid result.
- Integration suites run only against disposable loopback PostgreSQL databases.
- CI generates and retains an npm-generated CycloneDX SBOM for each quality build.
- Production dependency changes require `npm audit --omit=dev --audit-level=high` to pass.
