-- ver docs/db/0039.md
BEGIN;
CREATE OR REPLACE FUNCTION busca_empresa_reservar(p_chave uuid,p_nome text,p_filtros jsonb) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_anterior public.busca_empresa%ROWTYPE;
  v_limite public.busca_empresa_limite%ROWTYPE;
  v_usado integer;
  v_quantidade integer;
BEGIN
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id = v_eu AND u.papel = 'vendedor') THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF p_chave IS NULL OR p_nome IS NULL OR length(btrim(p_nome)) NOT BETWEEN 1 AND 100 OR p_nome ~ '[[:cntrl:]]'
    OR p_nome ~ U&'[\0080-\009F]' OR p_filtros IS NULL OR jsonb_typeof(p_filtros) <> 'object'
    OR (p_filtros - ARRAY['palavra','cnae','uf','cidade','bairro','porte','tipo','contato','quantidade','offset']) <> '{}'::jsonb
    OR NOT p_filtros ?& ARRAY['palavra','cnae','uf','cidade','bairro','porte','tipo','contato','quantidade','offset']
    OR EXISTS (SELECT 1 FROM jsonb_each(p_filtros) j WHERE
      (j.key IN ('quantidade','offset') AND jsonb_typeof(j.value) <> 'number')
      OR (j.key NOT IN ('quantidade','offset') AND jsonb_typeof(j.value) <> 'string')
      OR length(j.value #>> '{}') > 100 OR j.value #>> '{}' ~ '[[:cntrl:]]'
      OR j.value #>> '{}' ~ U&'[\0080-\009F]')
    OR coalesce(p_filtros->>'quantidade','') !~ '^[0-9]{1,3}$'
    OR coalesce(p_filtros->>'offset','') !~ '^[0-9]{1,7}$' THEN
    RAISE EXCEPTION 'filtros invalidos' USING ERRCODE = '22023';
  END IF;
  v_quantidade := (p_filtros->>'quantidade')::integer;
  IF v_quantidade NOT BETWEEN 1 AND 100 OR (p_filtros->>'offset')::integer > 1000000
    OR (p_filtros->>'cnae' <> '' AND p_filtros->>'cnae' !~ '^[0-9]{7}$')
    OR (btrim(p_filtros->>'palavra') = '' AND p_filtros->>'cnae' = '')
    OR p_filtros->>'uf' NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
    OR (p_filtros->>'bairro' <> '' AND btrim(p_filtros->>'cidade') = '')
    OR p_filtros->>'porte' NOT IN ('','MEI','ME','EPP','DEMAIS') OR p_filtros->>'tipo' NOT IN ('','1','2')
    OR p_filtros->>'contato' NOT IN ('telefoneoucelular','telefoneoucelulareemail','email','telefoneoucelularouemail') THEN
    RAISE EXCEPTION 'filtros invalidos' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(38,1);
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id = public.usuario_atual() AND u.papel = 'vendedor') THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_anterior FROM public.busca_empresa b WHERE b.id = p_chave;
  IF FOUND THEN
    IF v_anterior.usuario_id <> v_eu THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
    IF v_anterior.nome <> btrim(p_nome) OR v_anterior.filtros <> p_filtros THEN
      RAISE EXCEPTION 'operacao divergente' USING ERRCODE = '22023';
    END IF;
    RETURN 'repetida';
  END IF;
  SELECT * INTO v_limite FROM public.busca_empresa_limite l WHERE l.usuario_id = v_eu;
  IF v_limite.pausado THEN RETURN 'pausada'; END IF;
  SELECT coalesce(sum(b.quantidade),0)::integer INTO v_usado FROM public.busca_empresa b
    WHERE b.usuario_id = v_eu AND (b.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  IF coalesce(v_limite.limite_diario,0) < v_usado + v_quantidade THEN RETURN 'limite'; END IF;
  INSERT INTO public.busca_empresa(id,usuario_id,nome,filtros,quantidade) VALUES (p_chave,v_eu,btrim(p_nome),p_filtros,v_quantidade);
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION busca_empresa_reservar(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION busca_empresa_reservar(uuid,text,jsonb) TO app_usuario;
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
BEGIN
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id = public.usuario_atual() AND u.papel = 'vendedor') THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  PERFORM pg_catalog.pg_advisory_xact_lock(38,1);
  SELECT * INTO v_busca FROM public.busca_empresa b WHERE b.id = p_id FOR UPDATE;
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id = public.usuario_atual() AND u.papel = 'vendedor') OR v_busca.usuario_id IS DISTINCT FROM public.usuario_atual()
    OR EXISTS (SELECT 1 FROM public.busca_empresa_limite l WHERE l.usuario_id = public.usuario_atual() AND l.pausado) THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF v_busca.estado <> 'concluida' OR p_cnpjs IS NULL OR coalesce(array_length(p_cnpjs,1),0) NOT BETWEEN 1 AND 100
    OR (SELECT count(DISTINCT c) FROM unnest(p_cnpjs) c) <> array_length(p_cnpjs,1)
    OR EXISTS (SELECT 1 FROM unnest(p_cnpjs) c WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_busca.empresas) e WHERE e.value->>'cnpj' = c AND e.value->>'telefone' IS NOT NULL)) THEN
    RAISE EXCEPTION 'selecao invalida' USING ERRCODE = '22023';
  END IF;
  v_grupo := v_busca.grupo_id;
  IF v_grupo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.grupo_importacao g WHERE g.id = v_grupo AND g.ativo) THEN
    RAISE EXCEPTION 'grupo inativo' USING ERRCODE = '42501';
  END IF;
  IF v_grupo IS NULL THEN
    INSERT INTO public.grupo_importacao(nome,descricao,origem,criterios)
      VALUES (v_busca.nome,'Empresas selecionadas na busca de ' || to_char(v_busca.criado_em AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),
        'CNPJ.biz',concat_ws('; ','UF: ' || (v_busca.filtros->>'uf'),'Cidade: ' || nullif(v_busca.filtros->>'cidade',''),
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
    INSERT INTO public.empresa_dados_cadastrais(empresa_id,fonte,coletado_em,situacao,porte,data_abertura,logradouro,numero,complemento,bairro,cidade,uf,telefones)
      VALUES (v_empresa,'CNPJ.biz',v_busca.criado_em,v_linha->>'situacao',v_linha->>'porte',(v_linha->>'data_abertura')::date,
        v_linha->>'logradouro',v_linha->>'numero',v_linha->>'complemento',v_linha->>'bairro',v_linha->>'cidade',v_linha->>'uf',v_linha->'telefones')
      ON CONFLICT (empresa_id) DO NOTHING;
    INSERT INTO public.grupo_importacao_empresa(grupo_id,empresa_id) VALUES (v_grupo,v_empresa) ON CONFLICT DO NOTHING;
  END LOOP;
  SELECT count(*)::integer INTO v_total FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id = v_grupo;
  UPDATE public.grupo_importacao g SET inseridas = g.inseridas + v_novas, vinculadas = v_total WHERE g.id = v_grupo;
  RETURN QUERY SELECT v_grupo,v_novas,v_total;
END;
$$;
REVOKE EXECUTE ON FUNCTION busca_empresa_importar(uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION busca_empresa_importar(uuid,text[]) TO app_usuario;
CREATE OR REPLACE FUNCTION empresa_dados_cadastrais_ler(p_empresa uuid) RETURNS SETOF empresa_dados_cadastrais
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_ler() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
  IF NOT public.eh_gestor() AND NOT public.empresa_visivel_prospeccao(p_empresa) THEN RETURN; END IF;
  RETURN QUERY SELECT d.empresa_id,d.fonte,d.coletado_em,d.situacao,d.porte,d.data_abertura,
    d.logradouro,d.numero,d.complemento,d.bairro,d.cidade,d.uf,
    CASE WHEN public.eh_gestor() OR EXISTS (
      SELECT 1 FROM public.empresa_fila f WHERE f.empresa_id = p_empresa AND (
        f.vendedor_id = public.usuario_atual() OR (f.reservado_por = public.usuario_atual() AND f.reservado_ate > now()))
    ) THEN d.telefones ELSE '[]'::jsonb END
    FROM public.empresa_dados_cadastrais d WHERE d.empresa_id = p_empresa;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_dados_cadastrais_ler(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_dados_cadastrais_ler(uuid) TO app_usuario;

COMMIT;
