-- ver docs/db/0009.md
BEGIN;
CREATE FUNCTION autenticacao.credencial_por_email(p_email text)
RETURNS TABLE (usuario_id uuid, senha_hash text, ativo boolean, senha_provisoria_pendente boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT c.usuario_id, c.senha_hash, u.ativo, u.senha_provisoria_pendente
  FROM autenticacao.credencial c JOIN public.usuario u ON u.id = c.usuario_id
  WHERE u.email = lower(btrim(p_email))
$$;
CREATE FUNCTION autenticacao.bloqueio_login(p_email text, p_origem text)
RETURNS TABLE (bloqueado boolean, segundos_restantes integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  c_limite_email constant integer := 10;
  c_limite_origem constant integer := 30;
  c_janela constant interval := interval '15 minutes';
  v_email text := lower(btrim(p_email));
  v_falhas_email integer;
  v_falhas_origem integer := 0;
  v_ultima timestamptz;
  v_ultima_origem timestamptz;
BEGIN
  SELECT count(*), max(t.ocorreu_em) INTO v_falhas_email, v_ultima
  FROM autenticacao.tentativa_login t
  WHERE t.email = v_email AND NOT t.sucesso AND t.ocorreu_em > now() - c_janela;
  IF p_origem IS NOT NULL THEN
    SELECT count(*), max(t.ocorreu_em) INTO v_falhas_origem, v_ultima_origem
    FROM autenticacao.tentativa_login t
    WHERE t.origem = p_origem AND NOT t.sucesso AND t.ocorreu_em > now() - c_janela;
    v_ultima := GREATEST(v_ultima, v_ultima_origem);
  END IF;
  IF v_falhas_email >= c_limite_email OR v_falhas_origem >= c_limite_origem THEN
    RETURN QUERY SELECT true, GREATEST(0, EXTRACT(EPOCH FROM (v_ultima + c_janela - now()))::integer);
  ELSE
    RETURN QUERY SELECT false, 0;
  END IF;
END
$$;
CREATE FUNCTION autenticacao.registrar_tentativa_login(p_email text, p_origem text, p_sucesso boolean)
RETURNS TABLE (bloqueado boolean, segundos_restantes integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
BEGIN
  INSERT INTO autenticacao.tentativa_login (email, origem, sucesso) VALUES (v_email, p_origem, p_sucesso);
  IF p_sucesso THEN
    DELETE FROM autenticacao.tentativa_login t WHERE t.email = v_email AND NOT t.sucesso;
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  RETURN QUERY SELECT b.bloqueado, b.segundos_restantes FROM autenticacao.bloqueio_login(v_email, p_origem) b;
END
$$;
CREATE FUNCTION autenticacao.sessao_criar(p_usuario_id uuid, p_token_hash text, p_expira_em timestamptz)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  INSERT INTO autenticacao.sessao (usuario_id, token_hash, expira_em) VALUES (p_usuario_id, p_token_hash, p_expira_em)
$$;
CREATE FUNCTION autenticacao.sessao_atual(p_token_hash text)
RETURNS TABLE (usuario_id uuid, nome text, email text, papel text, senha_provisoria_pendente boolean, expira_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.id, u.nome, u.email, u.papel, u.senha_provisoria_pendente, s.expira_em
  FROM autenticacao.sessao s JOIN public.usuario u ON u.id = s.usuario_id
  WHERE s.token_hash = p_token_hash AND s.expira_em > now() AND u.ativo
$$;
CREATE FUNCTION autenticacao.sessao_encerrar(p_token_hash text)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  DELETE FROM autenticacao.sessao WHERE token_hash = p_token_hash
$$;
CREATE FUNCTION autenticacao.senha_trocar(p_token_hash text, p_hash_novo text)
RETURNS uuid
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
  UPDATE autenticacao.credencial SET senha_hash = p_hash_novo, atualizado_em = now() WHERE usuario_id = v_usuario;
  UPDATE public.usuario SET senha_provisoria_pendente = false WHERE id = v_usuario AND senha_provisoria_pendente;
  DELETE FROM autenticacao.sessao WHERE usuario_id = v_usuario AND token_hash <> p_token_hash;
  RETURN v_usuario;
END
$$;
REVOKE EXECUTE ON FUNCTION
  autenticacao.credencial_por_email(text),
  autenticacao.bloqueio_login(text, text),
  autenticacao.registrar_tentativa_login(text, text, boolean),
  autenticacao.sessao_criar(uuid, text, timestamptz),
  autenticacao.sessao_atual(text),
  autenticacao.sessao_encerrar(text),
  autenticacao.senha_trocar(text, text)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  autenticacao.credencial_por_email(text),
  autenticacao.bloqueio_login(text, text),
  autenticacao.registrar_tentativa_login(text, text, boolean),
  autenticacao.sessao_criar(uuid, text, timestamptz),
  autenticacao.sessao_atual(text),
  autenticacao.sessao_encerrar(text),
  autenticacao.senha_trocar(text, text)
TO app_conexao;
COMMIT;
