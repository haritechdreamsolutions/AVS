-- Apply only to the database selected by the migration connection.
DO $$ BEGIN
  EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO avs_runtime,avs_backup', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO avs_runtime,avs_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO avs_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO avs_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO avs_backup;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO avs_runtime;
GRANT INSERT ON operation_requests,sales,sale_items,audit_logs,stock_transactions,inventory_movements,receipts,receipt_allocations,payment_reversals,reversal_allocations TO avs_runtime;
GRANT INSERT,UPDATE,DELETE ON companies,roles,employees,user_accounts,routes,villages,route_assignments,categories,products,product_uoms,shops,employee_stock,driver_sessions,damages,expenses,driver_returns,suppliers,supplier_product_rates,settlements,notifications,product_price_history,freezer_models,shop_freezers,session TO avs_runtime;
GRANT UPDATE(status) ON sales TO avs_runtime;

