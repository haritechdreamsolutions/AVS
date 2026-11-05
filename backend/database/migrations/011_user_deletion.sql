-- Keep historical references intact when an owner removes a user.
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
