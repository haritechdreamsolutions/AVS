ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS is_system_administrator BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS single_system_administrator
  ON user_accounts(is_system_administrator) WHERE is_system_administrator;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='user_accounts'::regclass AND conname='system_administrator_identity') THEN
    ALTER TABLE user_accounts ADD CONSTRAINT system_administrator_identity CHECK (
      NOT is_system_administrator OR (
        login_id='administrator' AND name='Administrator' AND employee_id IS NULL
        AND account_status='ACTIVE' AND credential_kind='password'
      )
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION protect_system_administrator() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='TRUNCATE' THEN
    IF EXISTS(SELECT 1 FROM user_accounts WHERE is_system_administrator) THEN
      RAISE EXCEPTION 'Administrator account is protected.' USING ERRCODE='42501';
    END IF;
    RETURN NULL;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.is_system_administrator AND NOT EXISTS(SELECT 1 FROM roles WHERE id=NEW.role_id AND role_name='OWNER') THEN
      RAISE EXCEPTION 'Administrator requires management permissions.' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.is_system_administrator THEN
    IF TG_OP='DELETE' THEN
      RAISE EXCEPTION 'Administrator account cannot be deleted.' USING ERRCODE='42501';
    END IF;
    -- Login bookkeeping remains writable; identity, credentials and access do not.
    IF (to_jsonb(NEW) - ARRAY['failed_attempts','locked_until','last_login_at','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['failed_attempts','locked_until','last_login_at','updated_at']) THEN
      RAISE EXCEPTION 'Administrator account cannot be changed.' USING ERRCODE='42501';
    END IF;
  ELSIF TG_OP='UPDATE' AND NEW.is_system_administrator THEN
    RAISE EXCEPTION 'Administrator cannot be assigned through user editing.' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER protected_administrator_row
  BEFORE INSERT OR UPDATE OR DELETE ON user_accounts
  FOR EACH ROW EXECUTE FUNCTION protect_system_administrator();
CREATE OR REPLACE TRIGGER protected_administrator_truncate
  BEFORE TRUNCATE ON user_accounts
  FOR EACH STATEMENT EXECUTE FUNCTION protect_system_administrator();
