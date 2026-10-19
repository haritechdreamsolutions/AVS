# Production checkpoint - 2026-10-19

Branch: feat/production-critical-fixes-2026-10-18 (date requested by the owner). Changes are uncommitted and have not been pushed. This checkpoint supersedes earlier claims of complete production hardening.

## Deployment decision

Use native OVH Ubuntu 24.04 services with Node 24, PostgreSQL 16 and Caddy. Target 2 vCPU, 4 GB RAM and at least 40-50 GB SSD. No Docker is needed on the VPS. Dockerfiles, Compose files, Docker ignore and container-only role initialization were removed. GitHub's isolated PostgreSQL CI service is retained; it is not VPS deployment infrastructure.

Start with a fresh production database and transfer no local business data. Reviewed migrations create the tables/indexes/constraints; separately initialize company/roles/owner. Create business masters through the UI. No production database, cloud service or customer financial data was accessed.

## Completed in this change

- Created the requested branch while preserving all existing modified/untracked user work. Unrelated user files remain untouched.
- Connected the existing authorization/ownership middleware; session requests revalidate active status, role and credential version. Login regenerates and saves the session. Password/PIN login is preserved; account lockout stays disabled and IP throttling remains enabled.
- Removed plaintext-password fallback and disabled legacy default-account bootstrap. Enforced production secrets, exact-origin CORS, security headers, safe JSON API errors and verified remote PostgreSQL certificates/hostnames.
- Added built React asset serving and JSON API fallbacks. Production startup verifies reviewed migration checksums and runtime privileges; it performs no migrations. Added graceful drain/pool shutdown.
- Restored authenticated actor propagation for receipt collections/settlements and connected the existing refund API. Restricted-runtime refunds no longer request unnecessary UPDATE privileges on immutable receipt allocations; shop/invoice locks serialize their access.
- Approved policy implemented: reject new refunds for finalized driver sessions or recorded settlements on the invoice/refund day. Preserve closed records and successful idempotent retries; serialize with driver finalization through the existing employee row lock.
- Fixed new invoice stock-conversion snapshots so cancellation can restore original stock. Removed unsafe sequence/INSERT fallbacks after PostgreSQL transaction errors. Reject excess old-credit amounts rather than silently clamping them; no valid old-credit UI workflow was redesigned.
- Added native app/backup systemd units, loopback Caddy proxy, fresh-database role setup, separate configuration examples and updated runbooks. No service was enabled or installed.
- Environment files, private keys, dump exports, secrets, temporary previews and generated test outputs are excluded from Git. Checked that current environment/preview/secret paths are ignored and not tracked. No commit/push was performed.

## Verification actually executed

All application/database tests below used explicitly guarded synthetic local databases, not customer data.

| Check | Result |
| --- | --- |
| Security regression: authentication, RBAC/BOLA, CSRF/CORS, session revocation, no account lockout and throttling | PASS - 13 tests |
| Billing: validation, ten concurrent invoice/retry requests, payments, stock, cancellation and settlement concurrency | PASS - 9 tests |
| Finalized refund policy, unchanged closed settlement, valid pre-finalization refund/idempotency and five concurrent settlement races | PASS - 4 tests |
| Restricted runtime: billing, collections, original/receipt refunds, denied financial rewriting and schema privilege check | PASS |
| Fresh migration, interrupted-DDL rollback, idempotency and checksum protection | PASS |
| Native API: session regeneration, sales report, receipt/refund totals, JSON errors, frontend assets and throttle response | PASS - 4 tests |
| Real Edge owner login and Sales & Bills navigation with same-origin JSON and local assets | PASS |
| Running local app on port 5000: actual owner browser login, Sales & Bills JSON and logout | PASS - no financial writes |
| Local PostgreSQL TLS and HTTPS: trusted CA acceptance, wrong CA/hostname rejection, secure regenerated cookie and HSTS | PASS - local test certificates only |
| Backup dump/encryption/upload/heartbeat failure handling and daily/weekly copies | PASS - local command stubs only; no remote storage |
| Relevant Node syntax checks and git diff whitespace check | PASS |
| Local UI on port 4000 and API health on port 5000 | HTTP 200; left running |
| Ubuntu backup shell syntax | PASS |
| Ubuntu systemd unit acceptance | NOT VERIFIED: verifier found /usr/bin/node absent; Node/PostgreSQL/Caddy are not installed in WSL |
| Actual OVH HTTPS/firewall/storage encryption/offsite restore/physical printer | NOT VERIFIED |

Windows checks ran on Node 22.23.2 and the local PostgreSQL test server, not target Ubuntu Node24/PostgreSQL16. No dependency installation, broad audit, unrelated build, benchmark or production migration was run.

## Remaining blockers and exact next steps

1. **Financial blocker:** the existing optional old-credit-in-bill path in backend/db_pg.js still directly changes dues without creating receipt allocations. Its positive-old-credit cash/split/credit cases were not accepted by the focused tests. Preserve the UI, but review the intended allocation and integrate this path with the receipt ledger transactionally before production billing. Do not claim that passing direct-payment tests resolves it.
2. On an isolated Ubuntu Node24/PostgreSQL16 environment, verify native service configuration (install units root-owned mode 0644), fresh role/migration/grants/owner enrollment, application restart/graceful shutdown and the focused workflow suite. Install no packages without authorization.
3. On the actual OVH host, verify domain/DNS/HTTPS renewal, SSH/firewall, private PostgreSQL, unique secrets, bounded logs, monitoring and disk encryption.
4. Configure immutable independently controlled offsite retention, failure/missing-backup alerts and recovery-key custody; execute and time an off-host restore. RPO is approximately one hour plus dump/upload lag; RTO remains unverified.
5. Complete physical printer acceptance and enter approved real opening stock/dues and masters. Historical reconciliation is unnecessary only while the production database remains genuinely fresh; importing any existing financial data requires separate approval/reconciliation.

Verdict: **NOT READY for production billing** until the financial blocker and target-host/recovery gates are verified. See docs/ovh-production.md and docs/production-runbook.md. Do not deploy automatically.

