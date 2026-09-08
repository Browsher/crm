-- ver docs/db/0008.md
BEGIN;
ALTER TABLE usuario ADD COLUMN senha_provisoria_pendente boolean NOT NULL DEFAULT false;
CREATE FUNCTION pode_escrever() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE((SELECT u.ativo AND NOT u.senha_provisoria_pendente FROM public.usuario u WHERE u.id = public.usuario_atual()), false) $$;
REVOKE EXECUTE ON FUNCTION pode_escrever() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pode_escrever() TO app_usuario;
ALTER POLICY usuario_criar ON usuario WITH CHECK (pode_escrever() AND eh_gestor());
ALTER POLICY usuario_alterar ON usuario
  USING (pode_escrever() AND eh_gestor() AND id <> usuario_atual())
  WITH CHECK (pode_escrever() AND eh_gestor() AND id <> usuario_atual());
COMMIT;
