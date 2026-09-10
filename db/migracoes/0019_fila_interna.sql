-- ver docs/db/0019.md
BEGIN;
REVOKE EXECUTE ON FUNCTION empresa_assumir(uuid) FROM app_usuario;
REVOKE EXECUTE ON FUNCTION empresa_devolver(uuid) FROM app_usuario;
COMMIT;
