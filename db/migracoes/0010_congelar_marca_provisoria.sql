-- ver docs/db/0010.md
BEGIN;
CREATE FUNCTION senha_provisoria_de(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT u.senha_provisoria_pendente FROM public.usuario u WHERE u.id = p_id $$;
REVOKE EXECUTE ON FUNCTION senha_provisoria_de(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION senha_provisoria_de(uuid) TO app_usuario;
ALTER POLICY usuario_alterar ON usuario
  WITH CHECK (pode_escrever() AND eh_gestor() AND id <> usuario_atual()
              AND senha_provisoria_pendente = senha_provisoria_de(id));
COMMIT;
