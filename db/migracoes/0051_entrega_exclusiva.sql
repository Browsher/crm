-- ver docs/db/0051.md
BEGIN;
CREATE FUNCTION empresa_vincular_entrega(p_empresa uuid,p_vendedor uuid,p_origem text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_dono uuid;
BEGIN
  IF p_origem IS NULL OR p_origem NOT IN ('google','banco') THEN RETURN 'indisponivel'; END IF;
  PERFORM 1 FROM public.empresa WHERE id=p_empresa FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=p_vendedor AND ativo AND papel='vendedor' AND NOT senha_provisoria_pendente)
    OR EXISTS (SELECT 1 FROM public.empresa_vinculo_pendencia WHERE empresa_id=p_empresa) THEN RETURN 'indisponivel'; END IF;
  SELECT vendedor_id INTO v_dono FROM public.empresa_vinculo WHERE empresa_id=p_empresa;
  IF FOUND THEN RETURN CASE WHEN v_dono=p_vendedor THEN 'repetida' ELSE 'indisponivel' END; END IF;
  IF public.empresa_cliente(p_empresa)
    OR EXISTS (SELECT 1 FROM public.empresa_fila WHERE empresa_id=p_empresa AND
      ((vendedor_id IS NOT NULL AND vendedor_id<>p_vendedor) OR (reservado_por IS NOT NULL AND reservado_por<>p_vendedor AND reservado_ate>clock_timestamp())))
    OR EXISTS (SELECT 1 FROM public.google_exclusividade WHERE empresa_id=p_empresa) THEN RETURN 'indisponivel'; END IF;
  INSERT INTO public.empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES(p_empresa,p_vendedor,p_origem);
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_vincular_entrega(uuid,uuid,text) FROM PUBLIC;

CREATE FUNCTION empresa_entrega_contato_repetido(p jsonb,p_empresa uuid) RETURNS boolean
LANGUAGE sql VOLATILE SET search_path = '' AS $$
  WITH contatos AS (
    SELECT ARRAY(SELECT value FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'telefones')='array' THEN p->'telefones' ELSE '[]'::jsonb END)
      UNION SELECT p->>'telefone' WHERE p->>'telefone' ~ '^[0-9]{10,11}$') AS fones,
      lower(nullif(btrim(p->>'email'),'')) AS email
  ), historico AS (
    SELECT e.id AS empresa_id,e.telefone,e.email,'[]'::jsonb AS telefones FROM public.empresa e
    UNION ALL
    SELECT d.empresa_id,NULL,NULL,d.telefones FROM public.empresa_dados_cadastrais d
    UNION ALL
    SELECT r.empresa_id,r.dados->>'telefone',r.dados->>'email',CASE WHEN jsonb_typeof(r.dados->'telefones')='array' THEN r.dados->'telefones' ELSE '[]'::jsonb END
      FROM public.google_resultado r WHERE r.situacao='entregue'
    UNION ALL
    SELECT ge.empresa_id,e->>'telefone',e->>'email',coalesce(e->'telefones','[]'::jsonb)
      FROM public.busca_empresa b JOIN public.grupo_importacao_empresa ge ON ge.grupo_id=b.grupo_id
      JOIN public.empresa cadastro ON cadastro.id=ge.empresa_id
      CROSS JOIN LATERAL jsonb_array_elements(b.empresas) e WHERE e->>'cnpj'=cadastro.cnpj
  ) SELECT EXISTS (SELECT 1 FROM historico h CROSS JOIN contatos c WHERE h.empresa_id IS DISTINCT FROM p_empresa
    AND (h.telefone=ANY(c.fones) OR h.telefones ?| c.fones OR (c.email IS NOT NULL AND lower(btrim(h.email))=c.email)));
$$;
REVOKE EXECUTE ON FUNCTION empresa_entrega_contato_repetido(jsonb,uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION google_agente_entregar(p_id uuid,p_empresas jsonb,p_recibo jsonb,p_executor uuid DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
<<entrega>>
DECLARE
  p public.google_planejamento%ROWTYPE;
  e public.google_execucao%ROWTYPE;
  l public.google_lote%ROWTYPE;
  c jsonb;
  ev jsonb;
  linha jsonb;
  identidade text;
  empresa_id uuid;
  por_cnpj uuid;
  por_google uuid;
  fone text;
  mail text;
  situacao text;
  motivo text;
  decisao text;
  indice integer;
  novas integer := 0;
  novas_empresas integer := 0;
  grupo_id uuid;
  inativo boolean;
  resposta text;
  vinculo text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  PERFORM public.google_execucao_validar(p_id,p_executor,true);
  SELECT * INTO e FROM public.google_execucao WHERE pedido_id=p_id FOR UPDATE;
  IF e.contrato=1 AND p_recibo->'versao' IS DISTINCT FROM '2'::jsonb THEN RETURN public.google_entregar_legado(p_id,p_empresas,p_recibo,p_executor); END IF;
  IF e.contrato<>2 OR p_recibo->'versao' IS DISTINCT FROM '2'::jsonb OR p_recibo->>'pedido_id' IS DISTINCT FROM p_id::text
    OR p_recibo->>'execucao_id' IS DISTINCT FROM e.id::text OR p_recibo->>'revisao' IS DISTINCT FROM e.revisao::text
    OR p_recibo->>'snapshot_sha256' IS DISTINCT FROM encode(sha256(convert_to(e.snapshot::text,'UTF8')),'hex')
    OR coalesce(p_recibo->>'lote_id','') !~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
    OR coalesce(p_recibo->>'origem_sha256','') !~ '^[0-9a-f]{64}$' OR coalesce(p_recibo->>'resultado_sha256','') !~ '^[0-9a-f]{64}$'
    OR length(coalesce(p_recibo->>'arquivo_original_id','')) NOT BETWEEN 1 AND 255 OR length(coalesce(p_recibo->>'arquivo_resultado_id','')) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'recibo invalido' USING ERRCODE='22023'; END IF;
  SELECT * INTO l FROM public.google_lote WHERE id=(p_recibo->>'lote_id')::uuid AND execucao_id=e.id FOR UPDATE;
  IF NOT FOUND OR l.candidatas IS DISTINCT FROM p_empresas THEN RAISE EXCEPTION 'lote divergente' USING ERRCODE='22023'; END IF;
  IF l.recibo IS NOT NULL THEN
    IF l.recibo IS DISTINCT FROM p_recibo THEN RAISE EXCEPTION 'publicacao divergente' USING ERRCODE='22023'; END IF;
    RETURN 'repetida';
  END IF;
  IF e.concluido_em IS NOT NULL THEN RAISE EXCEPTION 'execucao concluida' USING ERRCODE='55000'; END IF;
  c := public.google_criterios_normalizar(e.snapshot->'criterios');
  IF p_recibo->'verificacoes_requeridas' IS DISTINCT FROM public.google_verificacoes_requeridas(c) OR jsonb_typeof(p_recibo->'evidencias') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'verificacoes divergentes' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(p_recibo->'evidencias')>1000 THEN RAISE EXCEPTION 'evidencias excessivas' USING ERRCODE='22023'; END IF;
  FOR ev IN SELECT value FROM jsonb_array_elements(p_recibo->'evidencias') LOOP
    IF jsonb_typeof(ev)<>'object' OR EXISTS (SELECT 1 FROM unnest(ARRAY['candidata','criterio','opcao','estado','motivo','fonte','horario']) k WHERE jsonb_typeof(ev->k) IS DISTINCT FROM 'string')
      OR ev->>'estado' NOT IN ('aprovado','reprovado','nao_confirmado') OR length(ev->>'motivo') NOT BETWEEN 1 AND 500 OR length(ev->>'fonte') NOT BETWEEN 1 AND 2048
      OR ev->>'horario' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_empresas) x WHERE public.google_candidata_identidade(x.value)=ev->>'candidata')
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.google_criterios_regras(c)) r WHERE r.value->>'criterio'=ev->>'criterio' AND r.value->'opcoes' ? (ev->>'opcao')) THEN RAISE EXCEPTION 'evidencia invalida' USING ERRCODE='22023'; END IF;
    PERFORM (ev->>'horario')::timestamptz;
    IF ev->>'criterio'='telefone' AND ev->>'estado'='aprovado' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_empresas) x WHERE public.google_candidata_identidade(x.value)=ev->>'candidata' AND x.value->>'telefone'=ev->>'contato'
      AND x.value->>'telefone' ~ '^[0-9]{10,11}$' AND (ev->>'opcao'<>'fixo' OR x.value->>'telefone' ~ '^[0-9]{2}[2-5][0-9]{7}$')) THEN RAISE EXCEPTION 'contato divergente' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_recibo->'evidencias') x GROUP BY x.value->>'candidata',x.value->>'criterio',x.value->>'opcao' HAVING count(*)>1) THEN RAISE EXCEPTION 'evidencia repetida' USING ERRCODE='22023'; END IF;
  SELECT * INTO p FROM public.google_planejamento WHERE id=p_id FOR UPDATE;
  PERFORM id FROM public.usuario WHERE id IN (public.usuario_atual(),p.vendedor_id) ORDER BY id FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'sem permissao' USING ERRCODE='42501'; END IF;
  inativo := NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=p.vendedor_id AND ativo AND papel='vendedor' AND NOT senha_provisoria_pendente);
  SELECT coalesce(max(r.indice),0) INTO indice FROM public.google_resultado r WHERE r.planejamento_id=p_id;
  FOR linha IN SELECT value FROM jsonb_array_elements(p_empresas) LOOP
    indice := indice+1; empresa_id := NULL; por_cnpj := NULL; por_google := NULL;
    identidade := public.google_candidata_identidade(linha);
    fone := CASE WHEN linha->>'telefone' ~ '^[0-9]{10,11}$' THEN linha->>'telefone' END;
    mail := CASE WHEN linha->>'email' ~ '^[^[:space:]@]+@[^[:space:]@]+$' THEN lower(btrim(linha->>'email')) END;
    decisao := public.google_evidencias_decidir(c,p_recibo->'evidencias',identidade);
    situacao := 'pendente'; motivo := CASE decisao WHEN 'reprovado' THEN 'Não atende aos critérios selecionados.' ELSE 'Critério selecionado não confirmado.' END;
    IF inativo THEN motivo := 'Vendedor indisponível. Resultados preservados para o gestor.';
    ELSIF e.entregues+novas>=50 THEN motivo := 'Meta de 50 empresas atingida.';
    ELSIF decisao='aprovado' AND coalesce(nullif(btrim(linha->>'razao_social'),''),nullif(btrim(linha->>'nome_fantasia'),'')) IS NOT NULL
      AND (nullif(linha->>'cnpj','') IS NULL OR public.empresa_cnpj_valido(linha->>'cnpj')) THEN
      SELECT id INTO por_cnpj FROM public.empresa WHERE cnpj=nullif(linha->>'cnpj','') FOR UPDATE;
      SELECT o.empresa_id INTO por_google FROM public.empresa_origem_google o WHERE google_place_id=identidade FOR UPDATE;
      IF (por_cnpj IS NOT NULL AND por_google IS NOT NULL AND por_cnpj<>por_google) OR (por_google IS NOT NULL AND nullif(linha->>'cnpj','') IS NOT NULL AND EXISTS (SELECT 1 FROM public.empresa WHERE id=por_google AND cnpj IS DISTINCT FROM linha->>'cnpj')) THEN
        situacao := 'conflito'; motivo := 'CNPJ e identificador Google precisam de conferência.';
      ELSE
        empresa_id := coalesce(por_cnpj,por_google);
        IF public.empresa_entrega_contato_repetido(linha,empresa_id) THEN
          situacao := 'repetida'; motivo := 'Telefone ou e-mail já encontrado na base da empresa.';
        ELSE
          IF empresa_id IS NULL THEN
            INSERT INTO public.empresa(cnpj,razao_social,nome_fantasia,telefone,email,cep,cnae_principal) VALUES (nullif(linha->>'cnpj',''),nullif(btrim(linha->>'razao_social'),''),nullif(btrim(linha->>'nome_fantasia'),''),fone,mail,
              CASE WHEN linha->>'cep' ~ '^[0-9]{8}$' THEN linha->>'cep' END,CASE WHEN linha->>'cnae_principal' ~ '^[0-9]{7}$' THEN linha->>'cnae_principal' END) RETURNING id INTO empresa_id;
            novas_empresas := novas_empresas+1;
          END IF;
          vinculo := public.empresa_vincular_entrega(empresa_id,p.vendedor_id,'google');
          IF vinculo='ok' THEN
            IF nullif(linha->>'google_place_id','') IS NOT NULL THEN INSERT INTO public.empresa_origem_google(google_place_id,empresa_id) VALUES (linha->>'google_place_id',empresa_id) ON CONFLICT DO NOTHING; END IF;
            INSERT INTO public.google_exclusividade(empresa_id,vendedor_id,planejamento_id) VALUES (empresa_id,p.vendedor_id,p_id);
            IF grupo_id IS NULL THEN grupo_id := public.google_grupo_destino(p.vendedor_id,e.snapshot); END IF;
            INSERT INTO public.grupo_importacao_empresa(grupo_id,empresa_id) VALUES (grupo_id,empresa_id) ON CONFLICT DO NOTHING;
            situacao := 'entregue'; motivo := NULL; novas := novas+1;
          ELSE
            situacao := vinculo; motivo := CASE WHEN vinculo='repetida' THEN 'Empresa já entregue a este vendedor.' ELSE 'Empresa já destinada ou em atendimento.' END;
          END IF;
        END IF;
      END IF;
    END IF;
    INSERT INTO public.google_resultado(planejamento_id,lote_id,indice,empresa_id,dados,situacao,motivo,entregue_em,canais_verificados) VALUES (p_id,l.id,indice,empresa_id,linha,situacao,motivo,CASE WHEN situacao='entregue' THEN clock_timestamp() END,
      ARRAY(SELECT x.value->>'opcao' FROM jsonb_array_elements(p_recibo->'evidencias') x WHERE x.value->>'candidata'=identidade AND x.value->>'criterio'='telefone' AND x.value->>'estado'='aprovado'));
  END LOOP;
  resposta := CASE WHEN inativo THEN 'vendedor_inativo' ELSE 'ok' END;
  IF grupo_id IS NOT NULL THEN
    UPDATE public.grupo_importacao g SET inseridas=g.inseridas+novas_empresas,
      vinculadas=(SELECT count(*)::integer FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id=entrega.grupo_id) WHERE g.id=entrega.grupo_id;
  END IF;
  UPDATE public.google_execucao SET entregues=entregues+novas WHERE id=e.id;
  UPDATE public.google_lote SET recibo=p_recibo,resposta=jsonb_build_object('resultado',entrega.resposta,'entregues',novas),concluido_em=clock_timestamp() WHERE id=l.id;
  IF inativo THEN
    UPDATE public.google_execucao SET concluido_em=clock_timestamp(),motivo_parada='vendedor_inativo' WHERE id=e.id;
    UPDATE public.google_planejamento SET estado='cancelado',motivo='Vendedor indisponível.',concluido_em=clock_timestamp() WHERE id=p_id;
  END IF;
  RETURN resposta;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'horario invalido' USING ERRCODE='22023';
END;
$$;
REVOKE EXECUTE ON FUNCTION google_agente_entregar(uuid,jsonb,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_agente_entregar(uuid,jsonb,jsonb,uuid) TO app_usuario;

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
  v_criada boolean;
  v_automatico boolean := p_cnpjs IS NULL;
BEGIN
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id = public.usuario_atual() AND u.papel = 'vendedor') THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  PERFORM pg_catalog.pg_advisory_xact_lock(38,1);
  PERFORM id FROM public.usuario WHERE id=public.usuario_atual() FOR SHARE;
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
  FOR v_linha IN SELECT value FROM jsonb_array_elements(v_busca.empresas) WHERE value->>'cnpj' = ANY(p_cnpjs) ORDER BY value->>'cnpj' LOOP
    SELECT e.id INTO v_empresa FROM public.empresa e WHERE e.cnpj=v_linha->>'cnpj' FOR UPDATE;
    IF public.empresa_entrega_contato_repetido(v_linha,v_empresa) THEN CONTINUE; END IF;
    INSERT INTO public.empresa(cnpj,razao_social,nome_fantasia,telefone,email,cep,cnae_principal)
      VALUES (v_linha->>'cnpj',v_linha->>'razao_social',v_linha->>'nome_fantasia',v_linha->>'telefone',
        v_linha->>'email',v_linha->>'cep',v_linha->>'cnae_principal')
      ON CONFLICT (cnpj) DO NOTHING RETURNING id INTO v_empresa;
    v_criada := FOUND;
    IF NOT v_criada THEN SELECT e.id INTO STRICT v_empresa FROM public.empresa e WHERE e.cnpj = v_linha->>'cnpj' FOR UPDATE;
    END IF;
    IF public.empresa_vincular_entrega(v_empresa,public.usuario_atual(),'banco')<>'ok' THEN CONTINUE; END IF;
    IF v_criada THEN v_novas := v_novas+1; END IF;
    IF v_grupo IS NULL THEN
      INSERT INTO public.grupo_importacao(nome,descricao,origem,criterios)
        VALUES (v_busca.nome,CASE WHEN v_automatico THEN 'Empresas incluídas automaticamente na busca de ' ELSE 'Empresas selecionadas na busca de ' END || to_char(v_busca.criado_em AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),
          v_busca.fornecedor,concat_ws('; ','UF: ' || (v_busca.filtros->>'uf'),'Cidade: ' || nullif(v_busca.filtros->>'cidade',''),
          'Bairro: ' || nullif(v_busca.filtros->>'bairro',''),'CNAE: ' || nullif(v_busca.filtros->>'cnae',''),
          'Palavra: ' || nullif(v_busca.filtros->>'palavra',''),'Porte: ' || nullif(v_busca.filtros->>'porte',''),'Situação: ativa'))
        RETURNING id INTO v_grupo;
      UPDATE public.busca_empresa b SET grupo_id = v_grupo WHERE b.id = p_id;
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

CREATE OR REPLACE FUNCTION google_publicar_interno(p_id uuid,p_empresas jsonb,p_recibo jsonb) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_pedido public.google_planejamento%ROWTYPE;
  v_publicacao public.google_publicacao%ROWTYPE;
  v_linha jsonb;
  v_i integer := 0;
  v_id uuid;
  v_cnpj_id uuid;
  v_google_id uuid;
  v_cnpj text;
  v_google text;
  v_situacao text;
  v_motivo text;
  v_inativo boolean;
  v_entregues integer := 0;
  v_vinculo text;
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL OR p_empresas IS NULL OR jsonb_typeof(p_empresas)<>'array' OR jsonb_array_length(p_empresas)>5000
    OR pg_column_size(p_empresas)>8000000 OR p_recibo IS NULL OR jsonb_typeof(p_recibo)<>'object'
    OR p_recibo->>'pedido_id' IS DISTINCT FROM p_id::text OR p_recibo->'validacao_conferida' IS DISTINCT FROM 'true'::jsonb
    OR coalesce(p_recibo->>'origem_sha256','') !~ '^[0-9a-f]{64}$' OR coalesce(p_recibo->>'final_sha256','') !~ '^[0-9a-f]{64}$'
    OR length(coalesce(p_recibo->>'arquivo_original_id','')) NOT BETWEEN 1 AND 255 OR length(coalesce(p_recibo->>'arquivo_final_id','')) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'publicacao invalida' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_empresas) x WHERE jsonb_typeof(x.value)<>'object') THEN
    RAISE EXCEPTION 'empresa invalida' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_pedido FROM public.google_planejamento WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido invalido' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_publicacao FROM public.google_publicacao WHERE planejamento_id=p_id;
  IF FOUND THEN
    IF v_publicacao.empresas IS DISTINCT FROM p_empresas OR v_publicacao.recibo IS DISTINCT FROM p_recibo THEN
      RAISE EXCEPTION 'publicacao divergente' USING ERRCODE='22023';
    END IF;
    RETURN 'repetida';
  END IF;
  IF v_pedido.estado NOT IN ('coletando','validando','falhou') THEN RAISE EXCEPTION 'pedido nao iniciado' USING ERRCODE='22023'; END IF;
  PERFORM id FROM public.usuario WHERE id IN (public.usuario_atual(),v_pedido.vendedor_id) ORDER BY id FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  SELECT NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_pedido.vendedor_id AND ativo AND papel='vendedor' AND NOT senha_provisoria_pendente) INTO v_inativo;
  INSERT INTO public.google_publicacao(planejamento_id,empresas,recibo) VALUES (p_id,p_empresas,p_recibo);
  FOR v_linha IN SELECT value FROM jsonb_array_elements(p_empresas) LOOP
    v_i := v_i+1;
    v_id := NULL;
    v_cnpj_id := NULL;
    v_google_id := NULL;
    v_situacao := 'pendente';
    v_motivo := 'Confira identidade, funcionamento e telefone validado.';
    v_cnpj := nullif(v_linha->>'cnpj','');
    v_google := nullif(v_linha->>'google_place_id','');
    IF v_entregues>=50 THEN v_motivo := 'Limite de 50 leads atingido. Ocorrência preservada para conferência.'; END IF;
    IF NOT v_inativo AND v_entregues<50 AND v_linha->'validado'='true'::jsonb AND coalesce(v_linha->'fechada','false'::jsonb)='false'::jsonb
      AND coalesce(v_linha->>'telefone','') ~ '^[0-9]{10,11}$'
      AND (public.empresa_cnpj_valido(v_cnpj) OR (length(v_google) BETWEEN 1 AND 255 AND v_google !~ '[[:cntrl:]]' AND v_google !~ U&'[\0080-\009F]'))
      AND (v_cnpj IS NULL OR public.empresa_cnpj_valido(v_cnpj))
      AND (v_google IS NULL OR (length(v_google) BETWEEN 1 AND 255 AND v_google !~ '[[:cntrl:]]' AND v_google !~ U&'[\0080-\009F]'))
      AND coalesce(nullif(btrim(v_linha->>'razao_social'),''),nullif(btrim(v_linha->>'nome_fantasia'),'')) IS NOT NULL THEN
      SELECT id INTO v_cnpj_id FROM public.empresa WHERE cnpj=v_cnpj FOR UPDATE;
      SELECT e.id INTO v_google_id FROM public.empresa_origem_google o JOIN public.empresa e ON e.id=o.empresa_id WHERE o.google_place_id=v_google FOR UPDATE OF e;
      IF (v_cnpj_id IS NOT NULL AND v_google_id IS NOT NULL AND v_cnpj_id<>v_google_id)
        OR (v_google_id IS NOT NULL AND v_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM public.empresa WHERE id=v_google_id AND cnpj IS DISTINCT FROM v_cnpj)) THEN
        v_situacao := 'conflito'; v_motivo := 'CNPJ e identificador Google precisam de conferência.';
      ELSE
        v_id := coalesce(v_cnpj_id,v_google_id);
        IF public.empresa_entrega_contato_repetido(v_linha,v_id) THEN
          v_situacao := 'repetida'; v_motivo := 'Telefone ou e-mail já encontrado na base da empresa.';
        ELSE
          IF v_id IS NULL THEN
            INSERT INTO public.empresa(cnpj,razao_social,nome_fantasia,telefone,email,cep,cnae_principal)
              VALUES (v_cnpj,nullif(btrim(v_linha->>'razao_social'),''),nullif(btrim(v_linha->>'nome_fantasia'),''),v_linha->>'telefone',
                CASE WHEN v_linha->>'email' ~ '^[^[:space:]@]+@[^[:space:]@]+$' THEN lower(btrim(v_linha->>'email')) END,
                CASE WHEN v_linha->>'cep' ~ '^[0-9]{8}$' THEN v_linha->>'cep' END,
                CASE WHEN v_linha->>'cnae_principal' ~ '^[0-9]{7}$' THEN v_linha->>'cnae_principal' END)
              ON CONFLICT (cnpj) DO NOTHING RETURNING id INTO v_id;
            IF v_id IS NULL THEN SELECT id INTO v_id FROM public.empresa WHERE cnpj=v_cnpj FOR UPDATE; END IF;
          END IF;
          IF v_google IS NOT NULL THEN
            INSERT INTO public.empresa_origem_google(google_place_id,empresa_id) VALUES (v_google,v_id) ON CONFLICT DO NOTHING;
          END IF;
          v_vinculo := public.empresa_vincular_entrega(v_id,v_pedido.vendedor_id,'google');
          IF v_vinculo<>'ok' THEN
            v_situacao := v_vinculo; v_motivo := CASE WHEN v_vinculo='repetida' THEN 'Empresa já entregue a este vendedor.' ELSE 'Empresa já destinada ou em atendimento.' END;
          ELSE
            INSERT INTO public.google_exclusividade(empresa_id,vendedor_id,planejamento_id) VALUES (v_id,v_pedido.vendedor_id,p_id);
            v_entregues := v_entregues+1;
            v_situacao := 'entregue'; v_motivo := NULL;
          END IF;
        END IF;
      END IF;
    END IF;
    IF v_inativo THEN v_motivo := 'Vendedor indisponível. Entrega não liberada.'; END IF;
    INSERT INTO public.google_resultado(planejamento_id,indice,empresa_id,dados,situacao,motivo,entregue_em)
      VALUES (p_id,v_i,v_id,v_linha,v_situacao,v_motivo,CASE WHEN v_situacao='entregue' THEN clock_timestamp() END);
  END LOOP;
  UPDATE public.google_planejamento SET estado=CASE WHEN v_inativo THEN 'cancelado' ELSE 'concluido' END,concluido_em=clock_timestamp(),
    motivo=CASE WHEN v_inativo THEN 'Vendedor indisponível. Resultados preservados para o gestor.' END WHERE id=p_id;
  RETURN CASE WHEN v_inativo THEN 'vendedor_inativo' ELSE 'ok' END;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_publicar_interno(uuid,jsonb,jsonb) FROM PUBLIC;
COMMIT;
