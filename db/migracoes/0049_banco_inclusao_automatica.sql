-- ver docs/db/0049.md
BEGIN;
ALTER TABLE busca_empresa ADD COLUMN inclusao_automatica_concluida boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION busca_empresa_importar(p_id uuid,p_cnpjs text[])
RETURNS TABLE(grupo_id uuid,inseridas integer,vinculadas integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_busca public.busca_empresa%ROWTYPE;
  v_grupo uuid;
  v_empresa uuid;
  v_novas integer := 0;
  v_total integer;
  v_linha jsonb;
  v_automatico boolean := p_cnpjs IS NULL;
BEGIN
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id = public.usuario_atual() AND u.papel = 'vendedor') THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  PERFORM pg_catalog.pg_advisory_xact_lock(38,1);
  SELECT * INTO v_busca FROM public.busca_empresa b WHERE b.id = p_id FOR UPDATE;
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id = public.usuario_atual() AND u.papel = 'vendedor') OR v_busca.usuario_id IS DISTINCT FROM public.usuario_atual()
    OR EXISTS (SELECT 1 FROM public.busca_empresa_limite l WHERE l.usuario_id = public.usuario_atual() AND l.pausado) THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF v_automatico THEN
    IF v_busca.estado <> 'concluida' THEN RAISE EXCEPTION 'consulta nao concluida' USING ERRCODE = '22023'; END IF;
    IF v_busca.grupo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.grupo_importacao g WHERE g.id=v_busca.grupo_id AND g.ativo) THEN
      RAISE EXCEPTION 'grupo inativo' USING ERRCODE = '42501';
    END IF;
    IF v_busca.fornecedor = 'Casa dos Dados' THEN
      LOCK TABLE public.empresa IN SHARE ROW EXCLUSIVE MODE;
      SELECT coalesce(jsonb_agg(CASE WHEN coalesce((e.dados->>'bloqueada_por_repeticao')::boolean,false)
          OR public.busca_casa_repetida(e.dados,v_busca.grupo_id)
        THEN jsonb_set(e.dados,'{bloqueada_por_repeticao}','true'::jsonb) ELSE e.dados END ORDER BY e.indice),'[]'::jsonb)
        INTO v_busca.empresas FROM jsonb_array_elements(v_busca.empresas) WITH ORDINALITY e(dados,indice);
      UPDATE public.busca_empresa b SET empresas=v_busca.empresas WHERE b.id=p_id AND b.empresas IS DISTINCT FROM v_busca.empresas;
    END IF;
    SELECT coalesce(array_agg(DISTINCT e->>'cnpj'),ARRAY[]::text[]) INTO p_cnpjs FROM jsonb_array_elements(v_busca.empresas) e
      WHERE e->>'telefone' ~ '^[0-9]{10,11}$' AND NOT coalesce((e->>'bloqueada_por_repeticao')::boolean,false);
    IF cardinality(p_cnpjs)=0 THEN
      UPDATE public.busca_empresa b SET inclusao_automatica_concluida=true WHERE b.id=p_id AND NOT b.inclusao_automatica_concluida;
      RETURN QUERY SELECT v_busca.grupo_id,0,(SELECT count(*)::integer FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id=v_busca.grupo_id);
      RETURN;
    END IF;
  END IF;
  IF v_busca.estado <> 'concluida' OR p_cnpjs IS NULL OR coalesce(array_length(p_cnpjs,1),0) NOT BETWEEN 1 AND 100
    OR (SELECT count(DISTINCT c) FROM unnest(p_cnpjs) c) <> array_length(p_cnpjs,1)
    OR EXISTS (SELECT 1 FROM unnest(p_cnpjs) c WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_busca.empresas) e WHERE e.value->>'cnpj' = c AND e.value->>'telefone' IS NOT NULL)) THEN
    RAISE EXCEPTION 'selecao invalida' USING ERRCODE = '22023';
  END IF;
  IF v_busca.fornecedor = 'Casa dos Dados' THEN
    LOCK TABLE public.empresa IN SHARE ROW EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_busca.empresas) e WHERE e->>'cnpj' = ANY(p_cnpjs)
      AND (coalesce((e->>'bloqueada_por_repeticao')::boolean,false) OR public.busca_casa_repetida(e,v_busca.grupo_id))) THEN
      RAISE EXCEPTION 'empresa ou contato repetido na base' USING ERRCODE = '23505';
    END IF;
  END IF;
  v_grupo := v_busca.grupo_id;
  IF v_grupo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.grupo_importacao g WHERE g.id = v_grupo AND g.ativo) THEN
    RAISE EXCEPTION 'grupo inativo' USING ERRCODE = '42501';
  END IF;
  IF v_grupo IS NULL THEN
    INSERT INTO public.grupo_importacao(nome,descricao,origem,criterios)
      VALUES (v_busca.nome,CASE WHEN v_automatico THEN 'Empresas incluídas automaticamente na busca de ' ELSE 'Empresas selecionadas na busca de ' END || to_char(v_busca.criado_em AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),
        v_busca.fornecedor,concat_ws('; ','UF: ' || (v_busca.filtros->>'uf'),'Cidade: ' || nullif(v_busca.filtros->>'cidade',''),
        'Bairro: ' || nullif(v_busca.filtros->>'bairro',''),'CNAE: ' || nullif(v_busca.filtros->>'cnae',''),
        'Palavra: ' || nullif(v_busca.filtros->>'palavra',''),'Porte: ' || nullif(v_busca.filtros->>'porte',''),'Situação: ativa'))
      RETURNING id INTO v_grupo;
    UPDATE public.busca_empresa b SET grupo_id = v_grupo WHERE b.id = p_id;
  END IF;
  FOR v_linha IN SELECT value FROM jsonb_array_elements(v_busca.empresas) WHERE value->>'cnpj' = ANY(p_cnpjs) ORDER BY value->>'cnpj' LOOP
    INSERT INTO public.empresa(cnpj,razao_social,nome_fantasia,telefone,email,cep,cnae_principal)
      VALUES (v_linha->>'cnpj',v_linha->>'razao_social',v_linha->>'nome_fantasia',v_linha->>'telefone',
        v_linha->>'email',v_linha->>'cep',v_linha->>'cnae_principal')
      ON CONFLICT (cnpj) DO NOTHING RETURNING id INTO v_empresa;
    IF FOUND THEN v_novas := v_novas + 1;
    ELSE SELECT e.id INTO STRICT v_empresa FROM public.empresa e WHERE e.cnpj = v_linha->>'cnpj' FOR UPDATE;
    END IF;
    INSERT INTO public.empresa_dados_cadastrais(empresa_id,fonte,coletado_em,situacao,porte,data_abertura,logradouro,numero,complemento,bairro,cidade,uf,telefones,detalhes)
      VALUES (v_empresa,v_busca.fornecedor,v_busca.criado_em,v_linha->>'situacao',v_linha->>'porte',(v_linha->>'data_abertura')::date,
        v_linha->>'logradouro',v_linha->>'numero',v_linha->>'complemento',v_linha->>'bairro',v_linha->>'cidade',v_linha->>'uf',v_linha->'telefones',coalesce(v_linha->'detalhes','{}'::jsonb))
      ON CONFLICT (empresa_id) DO NOTHING;
    INSERT INTO public.grupo_importacao_empresa(grupo_id,empresa_id) VALUES (v_grupo,v_empresa) ON CONFLICT DO NOTHING;
  END LOOP;
  SELECT count(*)::integer INTO v_total FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id = v_grupo;
  UPDATE public.grupo_importacao g SET inseridas = g.inseridas + v_novas, vinculadas = v_total WHERE g.id = v_grupo;
  IF v_automatico THEN
    UPDATE public.busca_empresa b SET inclusao_automatica_concluida=true WHERE b.id=p_id AND NOT b.inclusao_automatica_concluida;
  END IF;
  RETURN QUERY SELECT v_grupo,v_novas,v_total;
END;
$$;
REVOKE EXECUTE ON FUNCTION busca_empresa_importar(uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION busca_empresa_importar(uuid,text[]) TO app_usuario;
COMMIT;
