-- ver docs/db/0015.md
BEGIN;
CREATE SCHEMA extensoes;
CREATE EXTENSION unaccent WITH SCHEMA extensoes;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA extensoes FROM PUBLIC;
GRANT USAGE ON SCHEMA extensoes TO app_usuario;
GRANT EXECUTE ON FUNCTION extensoes.unaccent(regdictionary, text) TO app_usuario;
CREATE FUNCTION sem_acento(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT SET search_path = ''
AS $$ SELECT lower(extensoes.unaccent('extensoes.unaccent'::regdictionary, p)) $$;
REVOKE EXECUTE ON FUNCTION sem_acento(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sem_acento(text) TO app_usuario;
ALTER TABLE empresa ADD COLUMN busca text GENERATED ALWAYS AS (sem_acento(razao_social || ' ' || coalesce(nome_fantasia, ''))) STORED;
COMMIT;
