# Users Master audit - 2026-10-24

## Outcome and limits

A driver-edit defect is reproduced and fixed locally: an existing assigned route can be displayed in the user list but omitted from the required Edit route selector. The browser then blocks Save before any PUT request. This occurs when the saved route is absent from the active-routes API response. Whether this is Akash's production condition is **not yet established**.

Deletion has a separate, intentional rule: `deleteUser` retains and deactivates an account whose linked employee has sales. Repeating Delete on such an already inactive account can leave the visible row unchanged. Whether Akash has qualifying sales is **not yet established**. This audit does not change that business rule or bypass constraints.

No users or employees were inserted, seeded, edited, activated, deactivated or deleted, locally or in production. No production authentication, database connection, credential change, migrations, commit, push, deployment or production service restart was performed. The only database access used an explicit READ ONLY transaction on the configured loopback database. Tests use intercepted queries and browser API mocks, not a database. Existing modified and untracked files were retained.

## Evidence

- `UsersMaster.jsx:69`: component state starts with an empty users array; `loadData` obtains `/users`, `/employees` and `/routes` through the shared authenticated API client. There is no user fallback/cache. Session storage in this component holds employee-code reservation keys, not user records.
- `UsersMaster.jsx:157`: Edit copies the selected API record and derives its saved route from `route_id`, `routeId` or the linked employee. The route selector is required for DRIVER accounts.
- `db_pg.js:151`: `getUsers` selects `ua.id` as the user-account ID, `ua.employee_id` separately, and LEFT JOINs employee code and saved route details. It does not filter inactive accounts or inactive saved routes out of this list.
- `db_pg.js:2578`: `getRoutes` returns only routes with `is_active=TRUE`. Before the fix the Edit selector rendered only this response, even when the selected user retained a different saved route.
- Browser reproduction before the fix: an INACTIVE synthetic driver with a saved route missing from `/routes` opened with a required selector whose `checkValidity()` was false. The same scenario passes after adding the saved route as an option. Normal active-route editing also passes.
- Anonymous, read-only inspection of the deployed public assets resolved `index-mbd7dDpI.js` -> `OwnerSidebarLayout-B2qNiDD6.js` -> `UsersMaster-ZE0s56Mo.js`. The deployed Users Master module contains neither `akash` nor `EMP004`, and uses selected-record `.id` in both PUT and DELETE URLs. It has the same active-options-only Edit selector. Public code evidence is not authenticated API or database evidence.
- No Akash, EMP004, Durga or Seenu special case was found in the frontend/backend runtime source search. Other historical demo data exists in the obsolete MySQL `backend/db.js`; the live Express router imports `db_pg.js`, not that file. No evidence connects those demo records to this issue.
- The configured loopback database does not contain the described Akash record; IDs 4/5/7 do not match the reported production trio. It must not be used as proof of production contents.

## Identifier and request mapping

| Stage | Identifier |
| --- | --- |
| List key and displayed ID | API `u.id`, originating from `user_accounts.id` |
| Edit/update URL | `/users/` + `selectedUser.id` |
| Delete URL | `/users/` + `u.id` |
| Backend route parameter | `req.params.id`, passed as `uid` |
| Account lookup/update/delete predicate | `user_accounts.id = uid AND company_id = cid` |
| Employee changes | Separate `employee_id`, checked against the company on update |
| Route details | `employees.route_id` -> `routes.id` |

The mock browser deliberately uses user-account ID 4 and employee ID 104, and verifies `/users/4` is requested while employee ID 104 remains a separate payload field. The backend mock uses account 404 and employee 904. Neither test inserts records.

## Backend validation, relationships and risks reviewed

- All Users API CRUD routes remain protected by `requireAuth` and `requireRole('OWNER')` (`routes.js:496-524`, `security.js:4-20`). No authorization was changed.
- `addUser` requires an employee for driver/employee roles, rejects existing employee accounts and duplicate login IDs, checks the employee belongs to the company and is active, and validates credentials. Password/PIN values were not retrieved or reported.
- `updateUser` targets account/company IDs, validates employee IDs and company membership, checks duplicate logins, and separately updates the linked employee and route assignment. It accepts ACTIVE/INACTIVE/SUSPENDED under the inspected local status constraint. The UI currently displays non-ACTIVE states as INACTIVE; this is existing behavior, not an Akash-specific branch.
- `deleteUser` checks the only-active-owner protection, then checks linked employee sales. Sales cause deactivation; otherwise the account is deleted and the employee deactivated. Account removal is not employee deletion. Foreign-key errors reach the API as failures. The frontend already shows the API message, but its previous confirmation falsely promised permanent deletion in every case; that text is corrected.
- The inspected local schema has an account -> employee FK with ON DELETE SET NULL, role/company FKs, employee -> route FK with ON DELETE SET NULL, and route-assignment -> employee/route FKs. User-account login uniqueness is company/login in this local database. Reviewed production migration code additionally defines a global normalized login index and a route/day unique index. Production constraints were not inspected and may differ.
- Existing add/update/delete helpers perform multiple statements without a surrounding transaction. A later employee/route/audit failure can therefore occur after an earlier write. Updates also write route assignments whenever a route field is supplied, even when unchanged. These are residual code risks; they have not been attributed to Akash or changed speculatively in this focused patch.
- `/employees` returns active employees only. This does not remove an inactive user from `/users`, which joins the employee independently. Missing active employee options are not evidence of a hardcoded user.
- Production backend logs, authenticated `/users` and error responses were unavailable. No mutating production request was used to obtain them.

## Changes made in this audit

1. `frontend/src/components/Owner/UsersMaster.jsx`: preserve the selected user's existing saved route in Edit when the active-routes response omits it. This option is derived from the selected API record, not hardcoded data. Update payload IDs and backend permissions are unchanged. Update delete confirmation to explain the existing sales-history deactivation rule.
2. `backend/test/users-crud-mock.test.js`: eight backend query-mock and role-authorization checks; every pool connection is intercepted, with no actual database queries.
3. `backend/test/users-master-mock-browser.test.js`: seven real-component browser checks using an isolated page and in-memory API responses. No login or actual Users API mutation is performed; unexpected external requests are blocked.
4. This report. No backend runtime, schema, product, image-normalization or existing documentation changes were made by this audit.

Existing changes present before this audit remain in `backend/db_pg.js`, `docs/production-status.md`, `AdminProductsMasterView.jsx`, `imageNormalizer.js`, and the existing untracked product image/delete files. They are outside this patch and must be separated/reviewed before any eventual release.

## Validation

- `node --test backend/test/users-crud-mock.test.js`: 8 passed, 0 failed.
- `node backend/test/users-master-mock-browser.test.js`: 7 passed, 0 failed.
- `npm --prefix frontend run build`: passed; existing empty vendor-react chunk warning.
- `git diff --check`: passed.
- The route regression failed before the fix and passed afterward. Initial browser harness import failures were corrected before running the product regression; they were test harness setup failures, not application findings.

Coverage: API-sourced list and employee/route mapping; Edit hydration; correct account IDs in update/delete; permitted update reflected by a refreshed in-memory response; valid create request and duplicate/credential errors; delete cancel/confirm; backend history-deactivation and unreferenced-delete branches; selected-record isolation; API errors without false success; owner-only middleware. Mock refresh verifies client handling of persisted fixture state, **not PostgreSQL persistence**. Actual database CRUD persistence and production behavior are not verified, because no user/employee creation or modification was permitted.

## Proposed production verification - approval required before access/deployment

1. With an existing authorized Owner session, inspect only GET `/api/users`, `/api/employees`, `/api/routes` and the Edit modal; do not press Save, status, Reset PIN, Create or confirm Delete. Compare account ID 4, its separate employee ID and saved route ID. Check whether the saved route is absent from `/routes`. Keep tokens, credentials and personal fields out of reports.
2. Using an approved read-only production connection, run the bounded transaction below. It selects identifiers/flags/counts only and proves whether the described account is linked consistently, whether its route is active and whether sales explain retention. Inspect production FK/index definitions separately with catalog SELECTs. Do not infer production schema from the local schema.
3. Review existing redacted logs for prior `/api/users/4` errors and correlate them with the deployed backend revision. Do not generate new writes to reproduce an error.
4. If route omission is confirmed, review the small frontend patch and approve a release separately. If it is not confirmed, obtain the actual prior error evidence before expanding the fix. Deployment and any future production record change each require explicit approval.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT ua.id AS account_id,
       ua.employee_id,
       r.role_name,
       ua.account_status,
       (e.id IS NOT NULL) AS employee_exists,
       (e.company_id = ua.company_id) AS employee_same_company,
       e.is_active AS employee_active,
       e.route_id,
       (rt.id IS NOT NULL) AS route_exists,
       rt.is_active AS route_active,
       (rt.company_id = ua.company_id) AS route_same_company,
       (SELECT COUNT(*) FROM sales s
        WHERE s.employee_id = ua.employee_id) AS sales_count_used_by_delete,
       (SELECT COUNT(*) FROM user_accounts other
        WHERE other.employee_id = ua.employee_id) AS accounts_linked_to_employee
FROM user_accounts ua
JOIN roles r ON r.id = ua.role_id
LEFT JOIN employees e ON e.id = ua.employee_id
LEFT JOIN routes rt ON rt.id = e.route_id
WHERE ua.id IN (4, 5, 7)
ORDER BY ua.id;
ROLLBACK;
```
