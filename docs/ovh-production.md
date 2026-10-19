# OVH Ubuntu preparation - no Docker

Target: fresh Ubuntu 24.04 amd64, 2 vCPU, 4 GB RAM and at least 40-50 GB SSD. Run Node 24, PostgreSQL 16 and Caddy as native Linux services. No server setup or deployment has been executed.

## Release and services

Install the reviewed release under /opt/avs, owned by the deployment administrator and readable by a non-login avs user. The service user must not rewrite application source. Install deploy/avs.service as a root-owned system unit with mode 0644; apply the same unit permissions to the backup service and Caddy drop-in.

Store app settings in /etc/avs/app.env, root-owned mode 0600; systemd loads them before switching to avs. Use .env.example as the template. Replace all placeholders. Node is expected at /usr/bin/node; verify the path before enabling the service. The application has a 512 MiB heap and 768 MiB memory cap.

Use PostgreSQL max_connections=40, shared_buffers=256MB and work_mem=4MB as starting settings. Measure actual memory/disk headroom. Configure bounded journald storage, for example SystemMaxUse=200M and MaxRetentionSec=14day, and external availability/disk/memory alerts.

## Fresh database

Do not transfer local test accounts, masters, bills, payments or stock.

1. A PostgreSQL administrator reviews deploy/init-database.sql and applies it only to a new installation where those database/role names do not exist. It creates an empty database plus restricted migration/runtime/backup roles. No passwords or default accounts are supplied.
2. Set separate role passwords interactively using psql's password command. Do not put passwords in shell history. Bind PostgreSQL to 127.0.0.1 and require SCRAM TCP authentication; never publish 5432.
3. Using only the migration identity, run backend/database/preflight.js, then backend/database/migrate.js --apply-reviewed. Set AVS_APPLY_RUNTIME_GRANTS=1 for this maintenance process only. Migrations create tables, indexes and constraints and record their checksums. The application uses avs_runtime and never creates/migrates tables at startup.
4. Enroll the first company/owner with backend/scripts/set-credential.js --apply-reviewed and a restricted AVS_CREDENTIAL_FILE. Its JSON requires role OWNER, login_id, password, create=true, create_company=true and company_name. No default owner password exists. Retain the chosen password securely and remove the enrollment file.
5. Create business masters through the existing UI. Opening stock/dues must be independently approved. Do not fabricate historical transactions.

If existing business data is ever imported, stop and follow the restored-copy/preflight/reconciliation procedure in production-runbook.md first.

## HTTPS and networking

Install dependencies from the reviewed lockfiles and build frontend assets with VITE_API_URL=/api. Express serves frontend/dist and /api on 127.0.0.1:5000. Do not run Vite in production.

Copy deploy/Caddyfile to /etc/caddy/Caddyfile, deploy/caddy.env.example to /etc/avs/caddy.env with real values, and deploy/caddy.service.d/avs.conf to the Caddy service drop-in directory. Caddy owns ports 80/443 and proxies to loopback. FRONTEND_URL must be the exact public HTTPS origin; TRUST_PROXY=1 trusts the local proxy only.

Verify SSH keys and a second admin session before disabling root/password SSH. Restrict SSH to administration addresses and keep 5000/5432 private. Verify actual DNS, certificate issuance/renewal and firewall behaviour.

PG_LOCAL_PRIVATE=1 permits unencrypted PostgreSQL only on same-host loopback. Off-host database connections require verified TLS; use PG_SSL_CA for a private CA. Never disable certificate or hostname verification.

## Encrypted backups

Use a separate non-login avs-backup OS user. Install deploy/avs-backup.service and configure /etc/avs/backup.env from deploy/backup.env.example. Keep backup.pgpass and rclone.conf owned by avs-backup, mode 0600.

The existing backup script dumps/encrypts/uploads hourly; it exits on failure and systemd restarts it. Configure independent failure and missing-success heartbeat alerts. Backup memory is capped at 256 MiB; measure the largest expected archive.

Use an independent offsite account with immutable retention, upload credentials without delete/retention bypass, and lifecycle expiry for 48 hourly, at least 7 daily and 4 weekly restore points. At 100 MB/archive, 48 hourly + 8 daily + 5 weekly points use about 6.1 GB before version overhead. Pricing and provider protections are not verified here.

The uploader receives only an age public recipient. Keep two independent copies of the private recovery key off the VPS. Verify host storage encryption: plaintext dumps exist briefly in the private temporary directory before encryption. OVH snapshots are supplementary.

## Go-live gates

Verify native Ubuntu/Node24/PostgreSQL16 execution, migrations/grants/owner enrollment, login, invoice/stock/payment/report totals, blocked finalized refunds and physical printing. Verify service restart/shutdown, HTTPS, monitoring and an actual offsite restore. Hourly dumps imply about one hour plus upload lag of potential loss; RTO requires a measured replacement-host drill.

The optional old-credit-in-bill path remains a separate financial blocker: existing behaviour was preserved, but it does not create receipt allocations. Do not enable production billing until that path is reconciled with the receipt ledger and its intended allocation is verified.
