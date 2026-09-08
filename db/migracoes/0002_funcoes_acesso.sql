-- ver docs/db/0002.md
BEGIN;
CREATE FUNCTION usuario_atual() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT NULLIF(current_setting('app.usuario_id', true), '')::uuid $$;

CREATE FUNCTION pode_ler() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE((SELECT u.ativo FROM public.usuario u WHERE u.id = public.usuario_atual()), false) $$;

CREATE FUNCTION eh_gestor() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE((SELECT u.papel = 'gestor' AND u.ativo FROM public.usuario u WHERE u.id = public.usuario_atual()), false) $$;

REVOKE EXECUTE ON FUNCTION usuario_atual(), pode_ler(), eh_gestor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION usuario_atual(), pode_ler(), eh_gestor() TO app_usuario;
COMMIT;
