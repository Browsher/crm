-- ver docs/db/0011.md
BEGIN;
CREATE FUNCTION credencial_definir(p_usuario_id uuid, p_hash text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT (public.pode_escrever() AND public.eh_gestor()) OR p_usuario_id = public.usuario_atual() THEN
    RAISE EXCEPTION 'credencial_definir: so gestor ativo define senha de outro usuario' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id = p_usuario_id) THEN
    RETURN false;
  END IF;
  INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES (p_usuario_id, p_hash)
  ON CONFLICT (usuario_id) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, atualizado_em = now();
  UPDATE public.usuario SET senha_provisoria_pendente = true WHERE id = p_usuario_id AND NOT senha_provisoria_pendente;
  DELETE FROM autenticacao.sessao WHERE usuario_id = p_usuario_id;
  RETURN true;
END
$$;
CREATE FUNCTION sessoes_encerrar_de(p_usuario_id uuid) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_apagadas integer;
BEGIN
  IF NOT (public.pode_escrever() AND public.eh_gestor()) OR p_usuario_id = public.usuario_atual() THEN
    RAISE EXCEPTION 'sessoes_encerrar_de: so gestor ativo encerra sessoes de outro usuario' USING ERRCODE = '42501';
  END IF;
  DELETE FROM autenticacao.sessao WHERE usuario_id = p_usuario_id;
  GET DIAGNOSTICS v_apagadas = ROW_COUNT;
  RETURN v_apagadas;
END
$$;
REVOKE EXECUTE ON FUNCTION credencial_definir(uuid, text), sessoes_encerrar_de(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION credencial_definir(uuid, text), sessoes_encerrar_de(uuid) TO app_usuario;
COMMIT;
