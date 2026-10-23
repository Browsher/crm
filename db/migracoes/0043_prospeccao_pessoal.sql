-- ver docs/db/0043.md
BEGIN;
CREATE FUNCTION prospeccao_pessoal(p jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid := public.usuario_atual(); v_resultado jsonb; v_pagina integer;
BEGIN
  IF NOT public.pode_ler() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_eu AND papel='vendedor') THEN
    RAISE EXCEPTION 'sem permissao' USING ERRCODE='42501';
  END IF;
  IF p IS NULL OR jsonb_typeof(p)<>'object' OR (p-ARRAY['origem','nicho','endereco','nome','cnpj','cnae','uf','cidade','cep','disponibilidade','porte','aberturaDe','aberturaAte','pagina'])<>'{}'::jsonb
    OR EXISTS (SELECT 1 FROM jsonb_each(p) j WHERE jsonb_typeof(j.value)<>'string' OR length(j.value#>>'{}')>200 OR j.value#>>'{}' ~ '[[:cntrl:]]' OR j.value#>>'{}' ~ U&'[\0080-\009F]')
    OR coalesce(p->>'origem','') NOT IN ('','google','banco')
    OR coalesce(p->>'disponibilidade','') NOT IN ('','disponivel','reservada_comigo','comigo','em_descanso')
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
  WITH vinculos AS MATERIALIZED (
    SELECT r.empresa_id, 'google'::text origem, coalesce(x.snapshot->>'nicho',g.nicho) nicho,
      coalesce(nullif(r.dados->>'bairro',''),x.snapshot->>'bairro',g.bairro) bairro,
      coalesce(nullif(r.dados->>'cidade',''),x.snapshot->>'cidade',g.cidade) cidade,
      coalesce(nullif(r.dados->>'uf',''),x.snapshot->>'uf',g.uf) uf, r.entregue_em entrada
    FROM public.google_resultado r JOIN public.google_planejamento g ON g.id=r.planejamento_id
    LEFT JOIN public.google_execucao x ON x.pedido_id=g.id
    WHERE g.vendedor_id=v_eu AND r.situacao='entregue' AND r.empresa_id IS NOT NULL
    UNION ALL
    SELECT ge.empresa_id,'banco',coalesce(nullif(b.filtros->>'palavra',''),nullif(b.filtros->>'cnae',''),b.nome),
      coalesce(d.bairro,b.filtros->>'bairro'),coalesce(d.cidade,b.filtros->>'cidade'),coalesce(d.uf,b.filtros->>'uf'),b.criado_em
    FROM public.busca_empresa b JOIN public.grupo_importacao_empresa ge ON ge.grupo_id=b.grupo_id
    LEFT JOIN public.empresa_dados_cadastrais d ON d.empresa_id=ge.empresa_id
    WHERE b.usuario_id=v_eu AND b.estado='concluida'
    UNION ALL
    SELECT f.empresa_id,'carteira','Cadastro existente',NULL,NULL,NULL,coalesce(f.primeira_reserva_em,now())
    FROM public.empresa_fila f WHERE (f.vendedor_id=v_eu OR (f.reservado_por=v_eu AND f.reservado_ate>now()))
      AND NOT EXISTS (SELECT 1 FROM public.google_resultado r JOIN public.google_planejamento g ON g.id=r.planejamento_id WHERE r.empresa_id=f.empresa_id AND r.situacao='entregue' AND g.vendedor_id=v_eu)
      AND NOT EXISTS (SELECT 1 FROM public.busca_empresa b JOIN public.grupo_importacao_empresa ge ON ge.grupo_id=b.grupo_id WHERE ge.empresa_id=f.empresa_id AND b.usuario_id=v_eu AND b.estado='concluida')
  ), escolhidos AS MATERIALIZED (
    SELECT v.*,concat_ws(' · ',nullif(v.bairro,''),nullif(concat_ws('/',nullif(v.cidade,''),nullif(v.uf,'')),'')) regiao
    FROM vinculos v WHERE (coalesce(p->>'origem','')='' OR v.origem=p->>'origem') AND (coalesce(p->>'nicho','')='' OR v.nicho=p->>'nicho')
  ), unicas AS MATERIALIZED (
    SELECT v.empresa_id,array_agg(DISTINCT v.origem ORDER BY v.origem) origens,array_agg(DISTINCT v.nicho ORDER BY v.nicho) nichos,
      array_agg(DISTINCT v.regiao ORDER BY v.regiao) regioes,min(v.entrada) entrada,
      max(nullif(v.bairro,'')) bairro,max(nullif(v.cidade,'')) cidade,max(nullif(v.uf,'')) uf
    FROM escolhidos v WHERE coalesce(p->>'endereco','')='' OR v.regiao=p->>'endereco' GROUP BY v.empresa_id
  ), resumo AS MATERIALIZED (
    SELECT e.id,coalesce(e.nome_fantasia,e.razao_social,'Empresa sem nome') nome,e.cnpj,e.cnae_principal cnae,e.cep,d.porte,d.data_abertura abertura,
      coalesce(c.bairro,d.bairro,u.bairro) bairro,coalesce(c.localidade,d.cidade,u.cidade) cidade,coalesce(c.uf::text,d.uf,u.uf) uf,u.origens,u.nichos,u.regioes,u.entrada,
      CASE WHEN f.vendedor_id=v_eu AND public.empresa_cliente(e.id) THEN 'cliente'
        WHEN f.vendedor_id=v_eu AND n.id IS NOT NULL THEN n.etapa WHEN f.vendedor_id=v_eu THEN 'atendimento'
        WHEN f.reservado_por=v_eu AND f.reservado_ate>now() THEN 'reservada'
        WHEN (f.vendedor_id IS NOT NULL AND f.vendedor_id<>v_eu) OR (f.reservado_ate>now() AND f.reservado_por<>v_eu) OR NOT public.empresa_origem_ativa(e.id) THEN 'indisponivel'
        WHEN f.elegivel_em>now() THEN 'em_descanso' ELSE 'a_contatar' END situacao
    FROM unicas u JOIN public.empresa e ON e.id=u.empresa_id
    LEFT JOIN public.cep c ON c.cep=e.cep LEFT JOIN public.empresa_dados_cadastrais d ON d.empresa_id=e.id
    LEFT JOIN public.empresa_fila f ON f.empresa_id=e.id LEFT JOIN public.negociacao n ON n.empresa_id=e.id AND n.vendedor_id=v_eu AND n.encerrada_em IS NULL
  ), filtradas AS MATERIALIZED (
    SELECT r.* FROM resumo r WHERE (coalesce(p->>'nome','')='' OR strpos(public.sem_acento(r.nome),public.sem_acento(p->>'nome'))>0)
      AND (coalesce(p->>'cnpj','')='' OR r.cnpj=p->>'cnpj') AND (coalesce(p->>'cnae','')='' OR r.cnae=p->>'cnae')
      AND (coalesce(p->>'uf','')='' OR r.uf=p->>'uf') AND (coalesce(p->>'cidade','')='' OR strpos(public.sem_acento(r.cidade),public.sem_acento(p->>'cidade'))>0)
      AND (coalesce(p->>'cep','')='' OR r.cep=p->>'cep') AND (coalesce(p->>'porte','')='' OR r.porte=p->>'porte' OR (p->>'porte'='sem' AND r.porte IS NULL))
      AND (coalesce(p->>'aberturaDe','')='' OR r.abertura>=(p->>'aberturaDe')::date) AND (coalesce(p->>'aberturaAte','')='' OR r.abertura<=(p->>'aberturaAte')::date)
      AND (coalesce(p->>'disponibilidade','')='' OR (p->>'disponibilidade'='disponivel' AND r.situacao='a_contatar') OR (p->>'disponibilidade'='reservada_comigo' AND r.situacao='reservada') OR (p->>'disponibilidade'='comigo' AND r.situacao IN ('cliente','atendimento','primeiro_contato','em_negociacao','proposta_enviada')) OR (p->>'disponibilidade'='em_descanso' AND r.situacao='em_descanso'))
  ) SELECT jsonb_build_object('empresas',coalesce((SELECT jsonb_agg(to_jsonb(pagina) ORDER BY pagina.entrada DESC,pagina.id) FROM (SELECT * FROM filtradas ORDER BY entrada DESC,id LIMIT 20 OFFSET (v_pagina-1)*20) pagina),'[]'::jsonb),
    'total',(SELECT count(*) FROM filtradas),'nichos',coalesce((SELECT jsonb_agg(nicho ORDER BY nicho) FROM (SELECT DISTINCT nicho FROM vinculos WHERE coalesce(p->>'origem','')='' OR origem=p->>'origem') n),'[]'::jsonb),
    'bairros',coalesce((SELECT jsonb_agg(regiao ORDER BY regiao) FROM (SELECT DISTINCT regiao FROM escolhidos WHERE regiao<>'') b),'[]'::jsonb)) INTO v_resultado;
  RETURN v_resultado;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'filtros invalidos' USING ERRCODE='22023';
END;
$$;
REVOKE EXECUTE ON FUNCTION prospeccao_pessoal(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prospeccao_pessoal(jsonb) TO app_usuario;
CREATE FUNCTION prospeccao_pessoal_reservar(p_alvo uuid,p_filtros jsonb,p_contexto uuid)
RETURNS TABLE(resultado text,empresa_id uuid,reservado_ate timestamptz,contexto uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid:=public.usuario_atual(); v_dados jsonb; v_alvo uuid; v_pagina integer:=1; v_atual uuid;
BEGIN
  IF NOT public.pode_escrever() THEN RAISE EXCEPTION 'sem permissao' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27,1);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_eu::text,25));
  IF NOT public.pode_escrever() THEN RAISE EXCEPTION 'sem permissao' USING ERRCODE='42501'; END IF;
  SELECT f.versao INTO v_atual FROM public.fila_contexto f WHERE f.usuario_id=v_eu;
  IF v_atual IS DISTINCT FROM p_contexto THEN
    resultado:='contexto_alterado'; contexto:=v_atual; RETURN NEXT; RETURN;
  END IF;
  LOOP
    v_dados:=public.prospeccao_pessoal((p_filtros-'pagina')||jsonb_build_object('pagina',v_pagina::text));
    SELECT (e->>'id')::uuid INTO v_alvo FROM jsonb_array_elements(v_dados->'empresas') e
      WHERE (p_alvo IS NULL AND e->>'situacao'='a_contatar') OR (p_alvo IS NOT NULL AND e->>'id'=p_alvo::text) LIMIT 1;
    EXIT WHEN v_alvo IS NOT NULL OR v_pagina*20 >= (v_dados->>'total')::integer;
    v_pagina:=v_pagina+1;
  END LOOP;
  IF v_alvo IS NULL THEN resultado:=CASE WHEN p_alvo IS NULL THEN 'sem_candidata' ELSE 'indisponivel' END;contexto:=v_atual;RETURN NEXT;RETURN;END IF;
  RETURN QUERY SELECT * FROM public.fila_reservar(v_alvo,'',NULL,NULL,NULL,NULL,p_contexto,NULL);
END;
$$;
REVOKE EXECUTE ON FUNCTION prospeccao_pessoal_reservar(uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prospeccao_pessoal_reservar(uuid,jsonb,uuid) TO app_usuario;
COMMIT;
