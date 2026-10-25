-- Keep product references available to historical bills, returns and reports.
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Deleted products cannot be reactivated, including through a stale client.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'products'::regclass AND conname = 'product_deleted_inactive') THEN
    ALTER TABLE products ADD CONSTRAINT product_deleted_inactive
      CHECK (deleted_at IS NULL OR is_active = FALSE);
  END IF;
END $$;
