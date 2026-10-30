-- docs/db/0059.md
BEGIN;

REVOKE EXECUTE ON FUNCTION public.grupo_importacao_confirmar(uuid,text,text,text,jsonb,jsonb,jsonb) FROM app_usuario, PUBLIC;

COMMIT;
