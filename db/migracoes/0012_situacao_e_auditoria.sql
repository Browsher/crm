-- ver docs/db/0012.md
BEGIN;
ALTER TABLE autenticacao.credencial ADD COLUMN atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT;
CREATE FUNCTION exigir_gestor(p_alvo uuid) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
BEGIN
  IF NOT (public.pode_escrever() AND public.eh_gestor()) OR p_alvo = public.usuario_atual() THEN
    RAISE EXCEPTION 'so gestor ativo e sem senha provisoria age sobre outro usuario' USING ERRCODE = '42501';
  END IF;
END
$$;
REVOKE EXECUTE ON FUNCTION exigir_gestor(uuid) FROM PUBLIC;
DROP FUNCTION credencial_definir(uuid, text);
CREATE FUNCTION credencial_definir(p_usuario_id uuid, p_hash text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_ativo boolean;
BEGIN
  PERFORM public.exigir_gestor(p_usuario_id);
  SELECT u.ativo INTO v_ativo FROM public.usuario u WHERE u.id = p_usuario_id;
  IF v_ativo IS NULL THEN
    RETURN 'nao_encontrado';
  END IF;
  IF NOT v_ativo THEN
    RETURN 'alvo_inativo';
  END IF;
  INSERT INTO autenticacao.credencial (usuario_id, senha_hash, atualizado_por)
  VALUES (p_usuario_id, p_hash, public.usuario_atual())
  ON CONFLICT (usuario_id) DO UPDATE
  SET senha_hash = EXCLUDED.senha_hash, atualizado_em = now(), atualizado_por = EXCLUDED.atualizado_por;
  UPDATE public.usuario SET senha_provisoria_pendente = true WHERE id = p_usuario_id AND NOT senha_provisoria_pendente;
  PERFORM public.sessoes_encerrar_de(p_usuario_id);
  RETURN 'ok';
END
$$;
REVOKE EXECUTE ON FUNCTION credencial_definir(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION credencial_definir(uuid, text) TO app_usuario;
CREATE FUNCTION usuario_situacao_definir(p_usuario_id uuid, p_ativo boolean) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_ativo boolean;
BEGIN
  PERFORM public.exigir_gestor(p_usuario_id);
  SELECT u.ativo INTO v_ativo FROM public.usuario u WHERE u.id = p_usuario_id;
  IF v_ativo IS NULL THEN
    RETURN 'nao_encontrado';
  END IF;
  IF v_ativo = p_ativo THEN
    RETURN 'ja_nesse_estado';
  END IF;
  UPDATE public.usuario SET ativo = p_ativo WHERE id = p_usuario_id;
  IF NOT p_ativo THEN
    PERFORM public.sessoes_encerrar_de(p_usuario_id);
  END IF;
  RETURN 'ok';
END
$$;
REVOKE EXECUTE ON FUNCTION usuario_situacao_definir(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION usuario_situacao_definir(uuid, boolean) TO app_usuario;
CREATE OR REPLACE FUNCTION sessoes_encerrar_de(p_usuario_id uuid) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_apagadas integer;
BEGIN
  PERFORM public.exigir_gestor(p_usuario_id);
  DELETE FROM autenticacao.sessao WHERE usuario_id = p_usuario_id;
  GET DIAGNOSTICS v_apagadas = ROW_COUNT;
  RETURN v_apagadas;
END
$$;
REVOKE EXECUTE ON FUNCTION sessoes_encerrar_de(uuid) FROM app_usuario;
CREATE OR REPLACE FUNCTION autenticacao.senha_trocar(p_token_hash text, p_hash_novo text) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_usuario uuid;
BEGIN
  SELECT s.usuario_id INTO v_usuario
  FROM autenticacao.sessao s JOIN public.usuario u ON u.id = s.usuario_id
  WHERE s.token_hash = p_token_hash AND s.expira_em > now() AND u.ativo;
  IF v_usuario IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE autenticacao.credencial SET senha_hash = p_hash_novo, atualizado_em = now(), atualizado_por = v_usuario WHERE usuario_id = v_usuario;
  UPDATE public.usuario SET senha_provisoria_pendente = false WHERE id = v_usuario AND senha_provisoria_pendente;
  DELETE FROM autenticacao.sessao WHERE usuario_id = v_usuario AND token_hash <> p_token_hash;
  RETURN v_usuario;
END
$$;
REVOKE EXECUTE ON FUNCTION definir_auditoria() FROM PUBLIC;
COMMIT;
