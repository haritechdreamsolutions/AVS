# Production checkpoint - 2026-10-19

## Product image compression - 2026-10-23

- New/replacement owner uploads accept JPG/PNG/WebP up to 50 MB and 40 megapixels (finite browser-memory safety limits). Asynchronous encoding retains up to 512x512 detail, aspect ratio and WebP transparency; quality/dimensions adapt only as needed. Output is at most 72 KiB encoded image / 100 KiB including the stored Base64 URL, with JPEG fallback when WebP encoding is unavailable. A 2-5 KiB target is not forced at the expense of clarity.
- PostgreSQL products.image_url remains the storage location. Backend size/format checks reject oversized new inline images; existing unchanged images are preserved, not recompressed or migrated. Save waits for processing; replacement uploads synchronize image/image_url so the new picture actually persists.
- PASS: isolated real Edge owner create/edit/reload workflow, PNG/JPEG/WebP, transparency/aspect checks, JPEG fallback, invalid/oversized rejection, preserved prices/stock and unchanged legacy-image updates. Measured 3,608,670-byte source -> 69,242-byte WebP -> 92,347-byte stored Data URL. Frontend build and syntax/diff checks passed; no real product data changed, new dependencies, migrations or deployment.

## Same-day driver trips - 2026-10-21

- Return submission clears the selected driver and forms. The next stock allocation starts a new session on the driver's currently assigned route; it never reopens a finalized session. New-trip stock, sales, expenses, damages and visit counts are session-scoped. Receipt collections are bounded by serialized trip opening/closing timestamps; daily settlement totals remain cumulative.
- Closed-trip expense/damage edits and stale-session submissions are rejected even while a newer trip is open. Finalized daily settlements still block another trip. Leftover legacy vehicle stock blocks allocation for reconciliation rather than being reset or merged. No historical financial records were changed and no new schema migration is required.
- PASS: isolated two-route/same-day database and real Edge return/expense-form workflow, five concurrent allocation retries, payment/stock totals, duplicate return rejection, immutable first-trip snapshots and daily-settlement lock; existing return atomicity suite (58 tests) and billing regression suite passed. Frontend build and backend syntax checks passed. No deployment performed.

## Automatic employee codes - 2026-10-21

- Step 1 reserves and displays its actual EMP-prefixed code. Create and edit code fields are disabled. The pending reservation is retained across cancel/reopen, navigation and reload in the same browser tab, scoped to the signed-in owner. Only successful employee creation advances to a new reservation; retries retain the same code.
- Follow-up verification: five focused employee-code tests PASS, including Edge cancel/reopen and page reload retaining the same code, successful saves advancing it, and disabled edit codes. Frontend build and diff check passed; existing localhost:5000 health returned HTTP 200.
- The owner-only reservation API reuses the existing operation_requests table and employee-ID sequence. Reservations and employee-save retries are idempotent and company-scoped; client code tampering is rejected. Employee updates reject code changes. Existing records are not renumbered, no schema migration is required, and cancelled forms can leave intentional code gaps.
- Employee creation serializes per company, skips occupied IDs/codes/reservations, and saves profile/route assignment transactionally. Explicit manual-code creation remains compatible for existing API callers, but cannot claim a reserved code.
- PASS: five focused employee-code tests and four user-update tests, including ten-way concurrency/reservation/save retries, company isolation, unchanged codes on edits, and actual Edge creation of two employee/user accounts with displayed-before-save codes matching saved codes. Frontend build, syntax/diff checks and local API health passed. No production/customer records, passwords or migrations were changed.

## Users Master update correction - 2026-10-21

- Preserve null/blank employee links as NULL when editing an unlinked owner; reject zero, negative and nonnumeric employee IDs. Profile-only edits retain the current session. Linked employee/route updates use the selected validated employee.
- Users Master uses the shared API URL and distinguishes expired sessions/owner-access failures from load failures, offering Sign in again. Role/password/status-change session revocation remains enforced.
- PASS: four focused synthetic tests, including actual Edge owner profile editing, successful users reload, invalid-ID rejection, other-account revocation and self-role-change sign-in handling. Frontend build, backend syntax/diff checks and running local API health passed. No existing account/password/financial data was reset or migrated; no deployment or push occurred.

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

