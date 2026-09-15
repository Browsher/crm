-- ver docs/db/0029.md
BEGIN;
ALTER TABLE venda ADD COLUMN negociacao_id uuid REFERENCES negociacao(id) ON DELETE RESTRICT UNIQUE;
CREATE FUNCTION funil_bloquear(p_id uuid) RETURNS negociacao
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_eu uuid := public.usuario_atual(); v_empresa uuid; v_n public.negociacao;
BEGIN
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_eu AND ativo AND papel='vendedor') THEN RETURN NULL; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_eu::text,25));
  SELECT empresa_id INTO v_empresa FROM public.negociacao WHERE id=p_id AND vendedor_id=v_eu;
  IF v_empresa IS NULL THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.empresa WHERE id=v_empresa FOR UPDATE;
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_eu AND ativo AND papel='vendedor') THEN RETURN NULL; END IF;
  SELECT n.* INTO v_n FROM public.negociacao n JOIN public.empresa_fila f ON f.empresa_id=n.empresa_id
    WHERE n.id=p_id AND n.vendedor_id=v_eu AND f.vendedor_id=v_eu;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION funil_bloquear(uuid) FROM PUBLIC;
CREATE FUNCTION funil_etapa_definir(p_id uuid,p_etapa text,p_anterior text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_n public.negociacao;
BEGIN
  v_n := public.funil_bloquear(p_id);
  IF v_n.id IS NULL THEN RETURN 'sem_permissao'; END IF;
  IF v_n.encerrada_em IS NOT NULL THEN RETURN 'encerrada'; END IF;
  IF p_etapa IS NULL OR p_etapa NOT IN ('primeiro_contato','em_negociacao','proposta_enviada') THEN RETURN 'dados_invalidos'; END IF;
  IF v_n.etapa IS DISTINCT FROM p_anterior THEN RETURN 'desatualizada'; END IF;
  UPDATE public.negociacao SET etapa=p_etapa WHERE id=p_id;
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION funil_etapa_definir(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION funil_etapa_definir(uuid,text,text) TO app_usuario;
CREATE FUNCTION funil_venda_registrar(p_id uuid,p_chave uuid,p_data date,p_valor bigint,p_observacao text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_n public.negociacao; v_v public.venda; v_id uuid; v_nota text := nullif(btrim(p_observacao),'');
BEGIN
  v_n := public.funil_bloquear(p_id);
  IF v_n.id IS NULL THEN RETURN 'sem_permissao'; END IF;
  IF p_chave IS NULL OR p_data IS NULL OR NOT isfinite(p_data) OR p_data<'0001-01-01'::date
    OR p_data>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR p_valor IS NULL OR p_valor<1 OR p_valor>99999999999
    OR length(p_observacao)>2000 THEN RETURN 'dados_invalidos'; END IF;
  SELECT * INTO v_v FROM public.venda WHERE chave=p_chave;
  IF FOUND THEN
    IF v_v.negociacao_id=p_id AND v_v.autor_id=public.usuario_atual() AND v_v.data=p_data
      AND v_v.valor_centavos=p_valor AND v_v.observacao IS NOT DISTINCT FROM v_nota THEN RETURN 'ok'; END IF;
    RETURN 'chave_reutilizada';
  END IF;
  IF v_n.encerrada_em IS NOT NULL OR public.empresa_cliente(v_n.empresa_id) THEN RETURN 'encerrada'; END IF;
  BEGIN
    INSERT INTO public.venda(empresa_id,autor_id,data,valor_centavos,observacao,chave,negociacao_id)
      VALUES(v_n.empresa_id,public.usuario_atual(),p_data,p_valor,v_nota,p_chave,p_id)
      RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN RETURN 'chave_reutilizada';
  END;
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION funil_venda_registrar(uuid,uuid,date,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION funil_venda_registrar(uuid,uuid,date,bigint,text) TO app_usuario;
CREATE FUNCTION funil_devolver(p_id uuid,p_motivo text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_n public.negociacao;
BEGIN
  v_n := public.funil_bloquear(p_id);
  IF v_n.id IS NULL THEN RETURN 'sem_permissao'; END IF;
  IF v_n.encerrada_em IS NOT NULL THEN RETURN 'encerrada'; END IF;
  IF nullif(btrim(p_motivo),'') IS NULL OR length(p_motivo)>2000 THEN RETURN 'dados_invalidos'; END IF;
  RETURN public.contato_registrar(v_n.empresa_id,'sem_interesse',btrim(p_motivo),NULL,NULL,'devolver');
END;
$$;
REVOKE EXECUTE ON FUNCTION funil_devolver(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION funil_devolver(uuid,text) TO app_usuario;
CREATE FUNCTION minhas_empresas_clientes() RETURNS TABLE(empresa_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT f.empresa_id FROM public.empresa_fila f WHERE public.pode_ler()
  AND f.vendedor_id=public.usuario_atual() AND EXISTS(SELECT 1 FROM public.venda v WHERE v.empresa_id=f.empresa_id); $$;
REVOKE EXECUTE ON FUNCTION minhas_empresas_clientes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION minhas_empresas_clientes() TO app_usuario;
COMMIT;
