-- ver docs/db/0021.md
BEGIN;
DO $$ BEGIN
  CREATE ROLE app_teste NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT app_conexao TO app_teste WITH INHERIT TRUE;
ALTER ROLE app_teste CONNECTION LIMIT 20;
ALTER ROLE app_teste SET idle_in_transaction_session_timeout = '30s';
COMMIT;
