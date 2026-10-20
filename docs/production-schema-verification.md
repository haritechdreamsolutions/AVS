# Local production schema review

Reviewed 2026-10-20. No deployment or database connections were made. No environment files or credentials were read or changed. No applicable AGENTS.md files were found in the repository or its parent directories.

## Effective schema

The reviewed chain is `000 -> 004 -> 005 -> 006 -> 007 -> 008`. Legacy `001`, `002`, and `003` are comparison sources only; do not replay them. Existing migration contents and checksums remain unchanged.

- All legacy tables and columns are represented after 008. The baseline already contains price-history `buy_rate_uom` and `selling_rate_uom`. Only legacy `product_price_history.effective_from` was missing; 008 adds it with `NOT NULL DEFAULT NOW()`.
- 002's movement reference/receiver and shop credit/opening columns already exist. 003's UOM table, flags, conversion, rates, and product packaging columns already exist.
- 008 adds **45 constraints: 34 foreign keys, five UNIQUE constraints** (category code/name, product SKU, route code, shop code), and **six CHECK constraints**. Foreign-key delete actions follow 001/003.
- Existing 004 indexes already cover employee code, normalized global login, bill number, product UOM, employee stock, supplier rates, route/day, settlement, active sessions and request keys. They remain authoritative. Existing restrictive sale-item and stock parent foreign keys are retained rather than adding conflicting legacy cascading rules.
- 008 restores seven legacy lookup indexes. The legacy sales-date index is covered by the leading columns of `production_sales_date`, so no redundant copy is added.
- Account/assignment statuses, nonnegative product prices/expenses, valid inventory movement types, positive UOM conversion and nonnegative UOM rates are restored. Warehouse/employee stock and payment checks already exist in 004.

## Backend compatibility and deliberate differences

Inspected PostgreSQL connection/preflight/runner/grants code, runtime database functions, payments, reports, reconciliation and existing tests. A connection-free contract test checks every legacy table/column and every literal INSERT column in `db_pg.js`, `payments.js`, `index.js`, and `performance-reports.js`; this is source coverage, not SQL execution or proof that every dynamic query is valid.

Current defaults are retained: company IDs default to 1; categories/routes/shops allow nullable codes; UOM conversion defaults to 1; expense amount defaults to zero; units differ between historical and current tables. The backend permits omitted master codes and supplies operational units. Restoring legacy NOT NULL codes or changing unit defaults would alter runtime behavior. Stock precision remains NUMERIC(20,8). Role descriptions are optional and no legacy role seed replay is needed.

The optional runtime-grants script now quotes `current_database()` rather than targeting the hard-coded legacy database name. Existing table/sequence grants and financial write restrictions are unchanged. Roles must already exist; migration-owner privileges and runtime schema CREATE revocation must still be provisioned separately. The grants path was checked statically, not executed.

## Verification executed

From the repository root:

```
node --test backend/test/schema-contract.test.js backend/test/return-submit-atomicity.test.js backend/test/stock-allocation-units.test.js
node backend/test/unit.test.js
node backend/test/split_payment_calc_test.js
node --check backend/database/migrate.js
node --check backend/test/production-migrations.test.js
node --check backend/test/schema-contract.test.js
```

Results: 65/65 Node test-runner cases; 7/7 financial/stock calculation checks; 9/9 split-payment examples; all syntax checks passed. An initial contract run failed its grants assertion because the first edit had not replaced CRLF text; corrected and rerun successfully.

PostgreSQL integration tests were **not run**: psql/pg_ctl/initdb were unavailable on PATH and no installation was found in the standard Windows PostgreSQL directory. No existing database was probed. Existing billing/refund/stock integration suites require an explicitly isolated test database and were not run. The extended `production-migrations.test.js` is likewise unexecuted; it creates a new synthetic database, verifies catalog constraints, rejects orphan/duplicate/negative records, applies 008 twice directly, and checks runner reruns/checksum failures.

## Remaining deployment risks

- Execute the full chain and financial/stock integration suites on a newly created disposable PostgreSQL database before deployment; static/fake-client tests cannot validate PostgreSQL DDL, locks, grants or all backend queries.
- Added UNIQUE/FK/CHECK constraints validate existing rows and fail atomically on violations. No rows are repaired/deleted automatically. Existing preflight checks do not enumerate every new violation. A populated installation needs explicit reconciliation and a maintenance window for constraint/index locks.
- Legacy single-column foreign keys enforce parent existence, not same-company ownership. Existing application company filters remain necessary; this patch does not introduce tenant policies or composite foreign keys.
- Constraint guards support repeated 008 execution by table/name; they do not repair a manually altered same-name constraint. Startup verification checks migration checksums, not independent catalog drift.
- On a populated database, the new effective_from default records migration time for historical rows, not their original price-effective time. Historical backfill requires a separate reviewed decision.
- No server roles, configuration, staging or production state were inspected or changed. The reported empty production state was supplied by the user and was not independently verified.
