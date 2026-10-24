# Production operations and recovery

The target is native OVH Ubuntu services: Node 24, PostgreSQL 16 and Caddy. Follow docs/ovh-production.md. Docker deployment files have been removed. Local development remains npm run dev: Vite on 4000, API on 5000.

## Fresh installation

Use an empty PostgreSQL database; transfer no local test data. Review deploy/init-database.sql for fresh database/role creation and set separate role passwords interactively. Bind PostgreSQL to loopback with SCRAM TCP authentication.

Run preflight and the reviewed migration runner with the separate migration identity. The executable chain is 000_production_baseline, 004_production_hardening, 005_payment_reversals, 006_schema_compatibility and 007_operation_requests. Older 001-003 files are historical references. Do not edit applied migration checksums. Set AVS_APPLY_RUNTIME_GRANTS=1 only for reviewed maintenance.

Migrations create tables/indexes/constraints; production startup only verifies schema checksums and runtime privileges. Enroll the first company/owner using the explicit credential-file tool. Default-account bootstrap is disabled. Create masters and approved opening balances/stock through the UI.

For any future existing-data import: take and restore-test an encrypted backup, stop writers, run read-only preflight, rehearse migrations on the restored copy, and run company-scoped reconciliation. Duplicates, orphans, missing history or unapproved openings require human review. Never reset or renumber existing financial records.

## Releases and services

Place reviewed releases under /opt/avs and private configuration under /etc/avs. Use deploy/avs.service, deploy/avs-backup.service and the Caddy configuration/drop-in. Verify native binary paths and units before enabling them. Node runs as avs; backups run as avs-backup. Only Caddy is public.

Build the frontend with VITE_API_URL=/api. Backend releases require an application-service restart. Review migration compatibility before restarting. Never change the local development database configuration for deployment.

The app stops accepting requests on SIGTERM/SIGINT, drains for up to 30 seconds and closes the PostgreSQL pool. Systemd allows 35 seconds. Configure bounded journald logs and independent availability, disk/memory and backup-age alerts.

## Financial rules

Refunds are authorized, idempotent records of an externally completed cash/UPI reversal. The app cannot verify a bank refund.

Reject new refunds linked to CLOSED, COMPLETED, RECONCILED or RETURN_VERIFIED driver sessions. Reject them when the driver's invoice day or current refund day already has a settlement. Refunds serialize with settlement/session finalization on the employee row. Previously completed identical refund retries replay the saved result even after closure.

Never amend closed settlements or financial history. Cancellation requires full payment reversal and an eligible driver session. New invoice items retain original stock conversions for safe reversal; legacy invoices without reviewed metadata remain protected.

The existing optional old-credit-in-bill UI remains unchanged. Excess requested old-credit amounts are rejected instead of silently clamped. This path still changes dues without receipt allocations and needs approved ledger integration/acceptance before go-live. Separate collection APIs use receipt allocations. Do not treat a passing direct-payment regression as acceptance of inline old-credit accounting.

## Backup and recovery

Run the existing hourly pg_dump/age/rclone script through the backup service. Use a restricted read-only PostgreSQL account, protected pgpass/rclone files and an age public recipient only. Keep two independent private-key recovery copies off the VPS.

Verify encrypted host storage: a plaintext dump briefly exists in the service's private temporary directory. Measure backup memory/disk headroom. Configure immutable independent offsite retention, credentials without delete/retention bypass and lifecycle expiry: 48 hourly, at least 7 daily and 4 weekly points. Restarts may create extra daily/weekly copies. Configure failure and missing-heartbeat alerts externally.

Before go-live and monthly thereafter, download an object, decrypt off-host and restore into a new empty database of the same PostgreSQL major version using pg_restore --exit-on-error --no-owner --no-acl. Never use --clean against an existing database. Recreate restricted roles/grants separately and invalidate sessions.

Verify invoice/receipt/refund counts and totals, balances, stock and representative prints. Record archive timestamp, restored business date and measured recovery duration. A dump listing is not a restore test.

Hourly dumps risk approximately one hour plus upload lag of lost data; daily-only dumps risk about 24 hours. RTO requires a measured recovery drill and available replacement capacity. Provider costs, public TLS and offsite controls are not verified by local tests.

## Rollback

Keep the previous release and a verified backup. Do not point an old writable app at the new financial schema. Stop writes on failure and fix forward, or restore into a separate database and switch only after reconciliation. Never drop financial records to downgrade.
