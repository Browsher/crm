-- docs/db/0058.md
BEGIN;

CREATE OR REPLACE FUNCTION prospeccao_pessoal(p jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid := public.usuario_atual(); v_resultado jsonb; v_pagina integer;
BEGIN
  IF NOT public.pode_ler() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_eu AND papel='vendedor') THEN
    RAISE EXCEPTION 'sem permissao' USING ERRCODE='42501';
  END IF;
  IF p IS NULL OR jsonb_typeof(p)<>'object' OR (p-ARRAY['origem','nicho','endereco','nome','cnpj','cnae','uf','cidade','cep','disponibilidade','porte','aberturaDe','aberturaAte','pagina'])<>'{}'::jsonb
    OR EXISTS (SELECT 1 FROM jsonb_each(p) j WHERE jsonb_typeof(j.value)<>'string' OR length(j.value#>>'{}')>200 OR j.value#>>'{}' ~ '[[:cntrl:]]' OR j.value#>>'{}' ~ U&'[\0080-\009F]')
    OR coalesce(p->>'origem','') NOT IN ('','google','banco')
    OR coalesce(p->>'disponibilidade','') NOT IN ('','disponivel','comigo','sem_interesse')
    OR coalesce(p->>'porte','') NOT IN ('','MEI','ME','EPP','DEMAIS','sem')
    OR coalesce(nullif(p->>'pagina',''),'1') !~ '^[0-9]{1,5}$'
    OR (coalesce(p->>'cnpj','')<>'' AND p->>'cnpj' !~ '^[0-9]{14}$')
    OR (coalesce(p->>'cnae','')<>'' AND p->>'cnae' !~ '^[0-9]{7}$')
    OR (coalesce(p->>'cep','')<>'' AND p->>'cep' !~ '^[0-9]{8}$')
    OR (coalesce(p->>'uf','')<>'' AND p->>'uf' !~ '^[A-Z]{2}$')
    OR EXISTS (SELECT 1 FROM jsonb_each_text(p) j WHERE j.key IN ('aberturaDe','aberturaAte') AND j.value<>'' AND j.value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN
    RAISE EXCEPTION 'filtros invalidos' USING ERRCODE='22023';
  END IF;
  v_pagina := coalesce(nullif(p->>'pagina',''),'1')::integer;
  IF v_pagina NOT BETWEEN 1 AND 10000 OR (nullif(p->>'aberturaDe','') IS NOT NULL AND nullif(p->>'aberturaAte','') IS NOT NULL AND (p->>'aberturaDe')::date>(p->>'aberturaAte')::date) THEN
    RAISE EXCEPTION 'filtros invalidos' USING ERRCODE='22023';
  END IF;
  WITH projecoes AS MATERIALIZED (
    SELECT r.empresa_id,r.dados FROM public.empresa_atendimento_resumos(v_eu) r
    JOIN public.empresa_vinculo v ON v.empresa_id=r.empresa_id
    WHERE v.vendedor_id=v_eu AND (CASE WHEN p->>'disponibilidade'='sem_interesse' THEN v.arquivada_em IS NOT NULL ELSE v.arquivada_em IS NULL END)
  ), fontes AS MATERIALIZED (
    SELECT r.empresa_id, 'google'::text origem, coalesce(x.snapshot->>'nicho',g.snapshot->>'nicho',g.nicho) nicho,
      r.entregue_em entrada, NULL::text grupo_origem
    FROM public.google_resultado r JOIN public.google_planejamento g ON g.id=r.planejamento_id
    LEFT JOIN public.google_execucao x ON x.pedido_id=g.id
    WHERE g.vendedor_id=v_eu AND r.situacao='entregue' AND r.empresa_id IS NOT NULL
    UNION ALL
    SELECT ge.empresa_id,'banco',coalesce(nullif(b.filtros->>'palavra',''),nullif(b.filtros->>'cnae',''),b.nome),
      b.criado_em,g.nome
    FROM public.busca_empresa b JOIN public.grupo_importacao g ON g.id=b.grupo_id
    JOIN public.grupo_importacao_empresa ge ON ge.grupo_id=b.grupo_id
    WHERE b.usuario_id=v_eu AND b.estado='concluida'
    UNION ALL
    SELECT v.empresa_id,v.origem_inicial,'Cadastro existente',v.recebida_em,NULL::text
    FROM public.empresa_vinculo v WHERE v.vendedor_id=v_eu
      AND NOT EXISTS (SELECT 1 FROM public.google_resultado r JOIN public.google_planejamento g ON g.id=r.planejamento_id WHERE r.empresa_id=v.empresa_id AND r.situacao='entregue' AND g.vendedor_id=v_eu)
      AND NOT EXISTS (SELECT 1 FROM public.busca_empresa b JOIN public.grupo_importacao_empresa ge ON ge.grupo_id=b.grupo_id WHERE ge.empresa_id=v.empresa_id AND b.usuario_id=v_eu AND b.estado='concluida')
  ), vinculos AS MATERIALIZED (
    SELECT s.*,r.dados FROM fontes s JOIN projecoes r ON r.empresa_id=s.empresa_id
  ), vinculadas AS MATERIALIZED (
    SELECT v.*,concat_ws(' · ',nullif(v.dados->>'bairro',''),nullif(concat_ws('/',nullif(v.dados->>'cidade',''),nullif(v.dados->>'uf','')),'')) regiao
    FROM vinculos v
  ), escolhidos AS MATERIALIZED (
    SELECT v.* FROM vinculadas v WHERE (coalesce(p->>'origem','')='' OR v.origem=p->>'origem') AND (coalesce(p->>'nicho','')='' OR v.nicho=p->>'nicho')
  ), elegiveis AS MATERIALIZED (
    SELECT DISTINCT empresa_id FROM escolhidos v WHERE coalesce(p->>'endereco','')='' OR v.regiao=p->>'endereco'
  ), unicas AS MATERIALIZED (
    SELECT v.empresa_id,array_agg(DISTINCT v.origem ORDER BY v.origem) origens,array_agg(DISTINCT v.nicho ORDER BY v.nicho) nichos,
      coalesce(array_agg(DISTINCT v.regiao ORDER BY v.regiao) FILTER (WHERE v.regiao<>''),'{}'::text[]) regioes,min(v.entrada) entrada,
      (array_agg(v.grupo_origem ORDER BY v.entrada,v.grupo_origem) FILTER (WHERE v.grupo_origem IS NOT NULL))[1] grupo_origem
    FROM vinculadas v JOIN elegiveis el ON el.empresa_id=v.empresa_id GROUP BY v.empresa_id
  ), resumo AS MATERIALIZED (
    SELECT e.id,coalesce(e.nome_fantasia,e.razao_social,'Empresa sem nome') nome,e.cnpj,e.cnae_principal cnae,e.cep,d.porte,d.data_abertura abertura,
      s.dados->>'bairro' bairro,s.dados->>'cidade' cidade,s.dados->>'uf' uf,s.dados->'origens' origens,u.nichos,u.regioes,u.entrada,u.grupo_origem AS "grupoOrigem",
      s.dados->>'situacao' situacao,s.dados->'referencia' referencia,s.dados->>'atividade' atividade,
      (s.dados->>'versao')::integer versao,(s.dados->>'negociacaoId')::uuid AS "negociacaoId",
      s.dados->>'recebidaEm' AS "recebidaEm",s.dados->>'motivoIndisponibilidade' AS "motivoIndisponibilidade"
    FROM unicas u JOIN public.empresa e ON e.id=u.empresa_id
    LEFT JOIN public.empresa_dados_cadastrais d ON d.empresa_id=e.id
    JOIN projecoes s ON s.empresa_id=e.id
  ), filtradas AS MATERIALIZED (
    SELECT r.* FROM resumo r WHERE (coalesce(p->>'nome','')='' OR strpos(public.sem_acento(r.nome),public.sem_acento(p->>'nome'))>0)
      AND (coalesce(p->>'cnpj','')='' OR r.cnpj=p->>'cnpj') AND (coalesce(p->>'cnae','')='' OR r.cnae=p->>'cnae')
      AND (coalesce(p->>'uf','')='' OR r.uf=p->>'uf') AND (coalesce(p->>'cidade','')='' OR strpos(public.sem_acento(r.cidade),public.sem_acento(p->>'cidade'))>0)
      AND (coalesce(p->>'cep','')='' OR r.cep=p->>'cep') AND (coalesce(p->>'porte','')='' OR r.porte=p->>'porte' OR (p->>'porte'='sem' AND r.porte IS NULL))
      AND (coalesce(p->>'aberturaDe','')='' OR r.abertura>=(p->>'aberturaDe')::date) AND (coalesce(p->>'aberturaAte','')='' OR r.abertura<=(p->>'aberturaAte')::date)
      AND (coalesce(p->>'disponibilidade','')='' OR (p->>'disponibilidade'='disponivel' AND r.situacao='a_contatar') OR (p->>'disponibilidade'='comigo' AND r.situacao IN ('cliente','atendimento','primeiro_contato','em_negociacao','proposta_enviada')) OR p->>'disponibilidade'='sem_interesse')
  ) SELECT jsonb_build_object('empresas',coalesce((SELECT jsonb_agg(to_jsonb(pagina) ORDER BY pagina.entrada DESC,pagina.id) FROM (SELECT * FROM filtradas ORDER BY entrada DESC,id LIMIT 20 OFFSET (v_pagina-1)*20) pagina),'[]'::jsonb),
    'total',(SELECT count(*) FROM filtradas),'nichos',coalesce((SELECT jsonb_agg(nicho ORDER BY nicho) FROM (SELECT DISTINCT nicho FROM vinculos WHERE coalesce(p->>'origem','')='' OR origem=p->>'origem') n),'[]'::jsonb),
    'bairros',coalesce((SELECT jsonb_agg(regiao ORDER BY regiao) FROM (SELECT DISTINCT regiao FROM escolhidos WHERE regiao<>'') b),'[]'::jsonb)) INTO v_resultado;
  RETURN v_resultado;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'filtros invalidos' USING ERRCODE='22023';
END;
$$;

CREATE OR REPLACE FUNCTION empresas_resumos_ler(p_empresas uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid := public.usuario_atual(); v_ids uuid[]; v_empresas jsonb;
BEGIN
  IF NOT public.pode_ler() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_eu AND papel='vendedor' AND ativo) THEN
    RETURN jsonb_build_object('ok',false,'motivo','sem_permissao');
  END IF;
  IF p_empresas IS NULL OR array_position(p_empresas,NULL) IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'motivo','dados_invalidos');
  END IF;
  SELECT coalesce(array_agg(DISTINCT id),'{}'::uuid[]) INTO v_ids FROM unnest(p_empresas) id;
  IF cardinality(v_ids)>100 THEN RETURN jsonb_build_object('ok',false,'motivo','dados_invalidos'); END IF;
  IF cardinality(v_ids)=0 THEN RETURN jsonb_build_object('ok',true,'empresas','[]'::jsonb); END IF;
  SELECT coalesce(array_agg(v.empresa_id ORDER BY v.empresa_id),'{}'::uuid[]) INTO v_ids
  FROM public.empresa_vinculo v WHERE v.vendedor_id=v_eu AND v.empresa_id=ANY(v_ids);
  SELECT coalesce(jsonb_agg(r.dados ORDER BY r.empresa_id),'[]'::jsonb) INTO v_empresas
  FROM public.empresa_resumos_base(v_ids) r;
  RETURN jsonb_build_object('ok',true,'empresas',v_empresas);
END $$;
COMMIT;
