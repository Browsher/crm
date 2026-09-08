-- ver docs/db/0006.md
BEGIN;
REVOKE INHERIT OPTION FOR app_usuario FROM app_conexao;
ALTER ROLE app_conexao NOINHERIT CONNECTION LIMIT 20;
ALTER ROLE app_conexao SET idle_in_transaction_session_timeout = '30s';
COMMIT;
