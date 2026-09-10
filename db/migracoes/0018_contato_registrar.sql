-- ver docs/db/0018.md
BEGIN;
CREATE FUNCTION contato_registrar(
  p_empresa_id         uuid,
  p_tipo               text,
  p_nota               text,
  p_proximo_passo      text,
  p_proximo_passo_data date,
  p_desfecho           text
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu       uuid := public.usuario_atual();
  v_dono     uuid;
  v_resv     uuid;
  v_ate      timestamptz;
  v_desfecho text;
BEGIN
  IF p_desfecho IS NULL OR p_desfecho NOT IN ('nenhum', 'assumir', 'devolver') THEN
    RAISE EXCEPTION 'desfecho invalido: %', p_desfecho;
  END IF;

  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'troque a senha provisoria antes de registrar contato' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.empresa e WHERE e.id = p_empresa_id FOR UPDATE;

  SELECT f.vendedor_id, f.reservado_por, f.reservado_ate
    INTO v_dono, v_resv, v_ate
    FROM public.empresa_fila f
   WHERE f.empresa_id = p_empresa_id;
  IF NOT FOUND THEN
    RETURN 'nao_encontrada';
  END IF;

  IF v_dono IS DISTINCT FROM v_eu AND v_resv IS DISTINCT FROM v_eu THEN
    RAISE EXCEPTION 'esta empresa nao esta com voce' USING ERRCODE = '42501';
  END IF;

  IF v_dono IS DISTINCT FROM v_eu AND v_ate <= now() THEN
    RETURN 'reserva_expirada';
  END IF;

  IF p_desfecho = 'assumir' THEN
    v_desfecho := public.empresa_assumir(p_empresa_id);
  ELSIF p_desfecho = 'devolver' THEN
    v_desfecho := public.empresa_devolver(p_empresa_id);
  END IF;
  IF v_desfecho IS NOT NULL AND v_desfecho <> 'ok' THEN
    RETURN v_desfecho;
  END IF;

  INSERT INTO public.contato (empresa_id, tipo, nota, proximo_passo, proximo_passo_data)
  VALUES (p_empresa_id, p_tipo, p_nota, p_proximo_passo, p_proximo_passo_data);
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION contato_registrar(uuid, text, text, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION contato_registrar(uuid, text, text, text, date, text) TO app_usuario;
COMMIT;
