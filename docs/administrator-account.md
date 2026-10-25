# Protected Administrator

The single Administrator account uses login ID `administrator`. It has no linked employee and retains the existing OWNER permissions so billing, inventory and other role checks keep their current behavior. Its protected identity appears as Administrator in the interface.

Migration `010_protected_administrator.sql` adds the protected account flag, singleton index and database triggers. User management cannot edit, deactivate, delete or reset its credentials. Login bookkeeping remains writable. Ordinary employee accounts are independent of this account.

Apply the reviewed migration chain before provisioning on a new deployment. Supply `AVS_ADMIN_COMPANY_ID` and `AVS_ADMIN_PASSWORD` through the process environment, then run:

```text
node backend/scripts/provision-administrator.js
```

The script stores a bcrypt hash. No password is embedded in the application or migration. Repeating provisioning with the same company and password makes no changes; differing credentials fail without changing an existing account.

To run the PostgreSQL regression test, set `AVS_ADMINISTRATOR_DB_TEST=1` and run `node --test backend/test/protected-administrator.test.js`. Fixtures use temporary tables and verify that Administrator can log in after all ordinary fixture accounts are removed.
