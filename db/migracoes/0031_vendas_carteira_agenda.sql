-- ver docs/db/0031.md
BEGIN;
CREATE FUNCTION carteira_venda_registrar(p_empresa uuid,p_chave uuid,p_data date,p_valor bigint,p_observacao text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_eu uuid := public.usuario_atual(); v_v public.venda; v_nota text := nullif(btrim(p_observacao),'');
BEGIN
  IF NOT public.pode_escrever() OR NOT EXISTS(SELECT 1 FROM public.usuario WHERE id=v_eu AND ativo AND papel='vendedor') THEN RETURN 'sem_permissao'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_eu::text,25));
  PERFORM 1 FROM public.empresa WHERE id=p_empresa FOR UPDATE;
  IF NOT public.pode_escrever() OR NOT EXISTS(SELECT 1 FROM public.usuario WHERE id=v_eu AND ativo AND papel='vendedor')
    OR NOT EXISTS(SELECT 1 FROM public.empresa_fila WHERE empresa_id=p_empresa AND vendedor_id=v_eu) THEN RETURN 'sem_permissao'; END IF;
  IF NOT public.empresa_cliente(p_empresa) THEN RETURN 'nao_cliente'; END IF;
  IF p_chave IS NULL OR p_data IS NULL OR NOT isfinite(p_data) OR p_data<'0001-01-01'::date
    OR p_data>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR p_valor IS NULL OR p_valor<1 OR p_valor>99999999999
    OR length(p_observacao)>2000 THEN RETURN 'dados_invalidos'; END IF;
  SELECT * INTO v_v FROM public.venda WHERE chave=p_chave;
  IF FOUND THEN
    IF v_v.empresa_id=p_empresa AND v_v.negociacao_id IS NULL AND v_v.autor_id=v_eu AND v_v.data=p_data
      AND v_v.valor_centavos=p_valor AND v_v.observacao IS NOT DISTINCT FROM v_nota THEN RETURN 'ok'; END IF;
    RETURN 'chave_reutilizada';
  END IF;
  BEGIN
    INSERT INTO public.venda(empresa_id,autor_id,data,valor_centavos,observacao,chave)
      VALUES(p_empresa,v_eu,p_data,p_valor,v_nota,p_chave);
  EXCEPTION WHEN unique_violation THEN RETURN 'chave_reutilizada';
  END;
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION carteira_venda_registrar(uuid,uuid,date,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION carteira_venda_registrar(uuid,uuid,date,bigint,text) TO app_usuario;
CREATE OR REPLACE FUNCTION contato_registrar(p_empresa_id uuid, p_tipo text, p_nota text, p_proximo_passo text, p_proximo_passo_data date, p_desfecho text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_fila public.empresa_fila%ROWTYPE;
  v_resultado text;
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_eu::text, 25));
  PERFORM 1 FROM public.empresa e WHERE e.id = p_empresa_id FOR UPDATE;
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF p_tipo='retornar_depois' AND (p_desfecho IS DISTINCT FROM 'assumir'
    OR nullif(btrim(p_proximo_passo),'') IS NULL OR p_proximo_passo_data IS NULL OR NOT isfinite(p_proximo_passo_data)) THEN
    RAISE EXCEPTION 'retorno exige assumir e combinado com data' USING ERRCODE = '23514';
  END IF;
  SELECT f.* INTO v_fila FROM public.empresa_fila f WHERE f.empresa_id = p_empresa_id;
  IF v_fila.reservado_por = v_eu AND v_fila.reservado_ate <= clock_timestamp() THEN
    RETURN 'reserva_expirada';
  END IF;
  v_resultado := public.contato_registrar_interno(p_empresa_id,p_tipo,p_nota,p_proximo_passo,p_proximo_passo_data,p_desfecho);
  IF v_resultado = 'ok' AND v_fila.reservado_por = v_eu AND p_desfecho IN ('assumir','devolver') THEN
    INSERT INTO public.fila_contexto AS fc (usuario_id) VALUES (v_eu)
    ON CONFLICT (usuario_id) DO UPDATE SET versao = gen_random_uuid();
  END IF;
  RETURN v_resultado;
END;
$$;
COMMIT;
