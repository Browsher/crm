-- ver docs/db/0022.md
BEGIN;
ALTER TABLE autenticacao.credencial ADD COLUMN versao bigint NOT NULL DEFAULT 1;

DROP FUNCTION autenticacao.credencial_por_email(text);
CREATE FUNCTION autenticacao.credencial_por_email(p_email text)
RETURNS TABLE (usuario_id uuid, senha_hash text, versao bigint, ativo boolean, senha_provisoria_pendente boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT c.usuario_id, c.senha_hash, c.versao, u.ativo, u.senha_provisoria_pendente
  FROM autenticacao.credencial c JOIN public.usuario u ON u.id = c.usuario_id
  WHERE u.email = lower(btrim(p_email))
$$;

DROP FUNCTION autenticacao.sessao_criar(uuid, text, timestamptz);
CREATE FUNCTION autenticacao.sessao_criar(p_usuario_id uuid, p_token_hash text, p_expira_em timestamptz, p_versao bigint)
RETURNS TABLE (senha_provisoria_pendente boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_versao bigint;
  v_ativo boolean;
  v_pendente boolean;
BEGIN
  SELECT c.versao INTO v_versao FROM autenticacao.credencial c
  WHERE c.usuario_id = p_usuario_id FOR UPDATE;
  IF NOT FOUND OR p_versao IS NULL OR v_versao IS DISTINCT FROM p_versao THEN
    RETURN;
  END IF;
  SELECT u.ativo, u.senha_provisoria_pendente INTO v_ativo, v_pendente
  FROM public.usuario u WHERE u.id = p_usuario_id FOR SHARE;
  IF NOT FOUND OR NOT v_ativo THEN
    RETURN;
  END IF;
  INSERT INTO autenticacao.sessao (usuario_id, token_hash, expira_em)
  VALUES (p_usuario_id, p_token_hash, p_expira_em);
  RETURN QUERY SELECT v_pendente;
END
$$;

REVOKE EXECUTE ON FUNCTION autenticacao.credencial_por_email(text),
  autenticacao.sessao_criar(uuid, text, timestamptz, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION autenticacao.credencial_por_email(text),
  autenticacao.sessao_criar(uuid, text, timestamptz, bigint) TO app_conexao;

CREATE OR REPLACE FUNCTION credencial_definir(p_usuario_id uuid, p_hash text) RETURNS text
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
  SET senha_hash = EXCLUDED.senha_hash, atualizado_em = now(), atualizado_por = EXCLUDED.atualizado_por,
      versao = autenticacao.credencial.versao + 1;
  UPDATE public.usuario SET senha_provisoria_pendente = true WHERE id = p_usuario_id AND NOT senha_provisoria_pendente;
  PERFORM public.sessoes_encerrar_de(p_usuario_id);
  RETURN 'ok';
END
$$;

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
  UPDATE autenticacao.credencial SET senha_hash = p_hash_novo, versao = versao + 1,
    atualizado_em = now(), atualizado_por = v_usuario WHERE usuario_id = v_usuario;
  UPDATE public.usuario SET senha_provisoria_pendente = false WHERE id = v_usuario AND senha_provisoria_pendente;
  DELETE FROM autenticacao.sessao WHERE usuario_id = v_usuario AND token_hash <> p_token_hash;
  RETURN v_usuario;
END
$$;
COMMIT;
