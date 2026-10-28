-- ver docs/db/0046.md
BEGIN;
ALTER TABLE busca_empresa ADD COLUMN fornecedor text NOT NULL DEFAULT 'CNPJ.biz' CHECK (fornecedor IN ('CNPJ.biz','Casa dos Dados'));
ALTER TABLE empresa_dados_cadastrais DROP CONSTRAINT empresa_dados_cadastrais_fonte_check;
ALTER TABLE empresa_dados_cadastrais ADD CONSTRAINT empresa_dados_cadastrais_fonte_check CHECK (fonte IN ('CNPJ.biz','Casa dos Dados'));
CREATE FUNCTION busca_empresa_reservar_casa(p_chave uuid,p_nome text,p_filtros jsonb) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r text;
BEGIN
  r := public.busca_empresa_reservar(p_chave,p_nome,p_filtros);
  IF r = 'ok' THEN
    UPDATE public.busca_empresa SET fornecedor = 'Casa dos Dados' WHERE id = p_chave;
  ELSIF r = 'repetida' AND NOT EXISTS (SELECT 1 FROM public.busca_empresa WHERE id = p_chave AND fornecedor = 'Casa dos Dados') THEN
    RAISE EXCEPTION 'fornecedor divergente' USING ERRCODE = '22023';
  END IF;
  RETURN r;
END;
$$;
REVOKE EXECUTE ON FUNCTION busca_empresa_reservar_casa(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION busca_empresa_reservar_casa(uuid,text,jsonb) TO app_usuario;
CREATE FUNCTION busca_casa_repetida(p jsonb,p_grupo uuid) RETURNS boolean
LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresa e WHERE (
      e.cnpj = p->>'cnpj' OR e.telefone = p->>'telefone'
      OR e.telefone = ANY(ARRAY(SELECT value FROM jsonb_array_elements_text(p->'telefones')))
      OR (nullif(p->>'email','') IS NOT NULL AND e.email = lower(btrim(p->>'email')))
      OR EXISTS (SELECT 1 FROM public.empresa_dados_cadastrais d WHERE d.empresa_id = e.id
        AND d.telefones ?| ARRAY(SELECT value FROM jsonb_array_elements_text(p->'telefones') UNION SELECT p->>'telefone' WHERE p->>'telefone' IS NOT NULL))
    ) AND NOT (e.cnpj = p->>'cnpj' AND p_grupo IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id = p_grupo AND ge.empresa_id = e.id))
  );
$$;
REVOKE EXECUTE ON FUNCTION busca_casa_repetida(jsonb,uuid) FROM PUBLIC;
CREATE FUNCTION busca_casa_resultados(p jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE e jsonb; r jsonb := '[]'::jsonb; telefones text[] := ARRAY[]::text[]; emails text[] := ARRAY[]::text[];
  cnpjs text[] := ARRAY[]::text[]; fones text[]; repetida boolean;
BEGIN
  FOR e IN SELECT value FROM jsonb_array_elements(p) LOOP
    fones := ARRAY(SELECT value FROM jsonb_array_elements_text(e->'telefones') UNION SELECT e->>'telefone' WHERE e->>'telefone' IS NOT NULL);
    repetida := public.busca_casa_repetida(e,NULL) OR e->>'cnpj' = ANY(cnpjs)
      OR (e->>'email' IS NOT NULL AND e->>'email' = ANY(emails)) OR fones && telefones;
    r := r || jsonb_build_array(e || jsonb_build_object('bloqueada_por_repeticao',coalesce(repetida,false)));
    IF NOT coalesce(repetida,false) THEN
      cnpjs := array_append(cnpjs,e->>'cnpj');
      telefones := telefones || fones;
      IF e->>'email' IS NOT NULL THEN emails := array_append(emails,e->>'email'); END IF;
    END IF;
  END LOOP;
  RETURN r;
END;
$$;
REVOKE EXECUTE ON FUNCTION busca_casa_resultados(jsonb) FROM PUBLIC;
CREATE OR REPLACE FUNCTION busca_empresa_concluir(p_id uuid,p_empresas jsonb,p_motivo text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_busca public.busca_empresa%ROWTYPE;
  v_linha jsonb;
BEGIN
  IF NOT public.pode_escrever() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_busca FROM public.busca_empresa b WHERE b.id = p_id FOR UPDATE;
  IF NOT FOUND OR v_busca.usuario_id <> public.usuario_atual() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF v_busca.estado <> 'reservada' OR p_empresas IS NULL OR jsonb_typeof(p_empresas) <> 'array'
    OR jsonb_array_length(p_empresas) > v_busca.quantidade OR pg_column_size(p_empresas) > 2000000
    OR (p_motivo IS NOT NULL AND (p_motivo NOT IN ('nao_configurado','credencial_invalida','sem_creditos','fornecedor_ocupado','fornecedor_indisponivel','tempo_esgotado','resposta_invalida','cnae_nao_encontrado') OR p_empresas <> '[]'::jsonb)) THEN
    RAISE EXCEPTION 'resultado invalido' USING ERRCODE = '22023';
  END IF;
  FOR v_linha IN SELECT value FROM jsonb_array_elements(p_empresas) LOOP
    IF jsonb_typeof(v_linha) <> 'object' OR NOT v_linha ?& ARRAY['cnpj','razao_social','telefone','telefones']
      OR EXISTS (SELECT 1 FROM jsonb_each(v_linha) j WHERE j.key NOT IN
        ('detalhes','cnpj','razao_social','nome_fantasia','email','telefone','cep','cnae_principal','situacao','porte','data_abertura','logradouro','numero','complemento','bairro','cidade','uf','telefones')
        OR (j.key NOT IN ('telefones','detalhes') AND (jsonb_typeof(j.value) NOT IN ('string','null')
          OR length(j.value #>> '{}') > 1000 OR j.value #>> '{}' ~ '[[:cntrl:]]' OR j.value #>> '{}' ~ U&'[\0080-\009F]'))
      )
      OR (v_linha ? 'detalhes' AND NOT public.busca_detalhes_empresariais_validos(v_linha->'detalhes'))
      OR NOT public.empresa_cnpj_valido(v_linha->>'cnpj') OR coalesce(btrim(v_linha->>'razao_social'),'') = ''
      OR (v_linha->>'telefone' IS NOT NULL AND v_linha->>'telefone' !~ '^[0-9]{10,11}$')
      OR (v_linha->>'email' IS NOT NULL AND (v_linha->>'email' <> lower(btrim(v_linha->>'email')) OR v_linha->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+$'))
      OR (v_linha->>'cep' IS NOT NULL AND v_linha->>'cep' !~ '^[0-9]{8}$')
      OR (v_linha->>'cnae_principal' IS NOT NULL AND v_linha->>'cnae_principal' !~ '^[0-9]{7}$')
      OR (v_linha->>'data_abertura' IS NOT NULL AND v_linha->>'data_abertura' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
      OR jsonb_typeof(v_linha->'telefones') <> 'array' OR jsonb_array_length(v_linha->'telefones') > 30 THEN
      RAISE EXCEPTION 'empresa invalida' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_linha->'telefones') t WHERE jsonb_typeof(t.value) <> 'string' OR t.value #>> '{}' !~ '^[0-9]{10,11}$') THEN
      RAISE EXCEPTION 'telefone invalido' USING ERRCODE = '22023';
    END IF;
    IF v_linha->>'data_abertura' IS NOT NULL THEN PERFORM (v_linha->>'data_abertura')::date; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_empresas) GROUP BY value->>'cnpj' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'empresa repetida' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.busca_empresa_socios(busca_id,cnpj,dados) SELECT p_id,e->>'cnpj',e->'detalhes'->'socios' FROM jsonb_array_elements(p_empresas) e WHERE e->'detalhes' ? 'socios';
  UPDATE public.busca_empresa SET empresas = public.busca_empresas_resumir(CASE WHEN v_busca.fornecedor = 'Casa dos Dados' THEN public.busca_casa_resultados(p_empresas) ELSE p_empresas END), motivo = p_motivo,
    estado = CASE WHEN p_motivo IS NULL THEN 'concluida' ELSE 'falhou' END, concluido_em = clock_timestamp() WHERE id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION busca_empresa_concluir(uuid,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION busca_empresa_concluir(uuid,jsonb,text) TO app_usuario;
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
      VALUES (v_busca.nome,'Empresas selecionadas na busca de ' || to_char(v_busca.criado_em AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),
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
  RETURN QUERY SELECT v_grupo,v_novas,v_total;
END;
$$;
REVOKE EXECUTE ON FUNCTION busca_empresa_importar(uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION busca_empresa_importar(uuid,text[]) TO app_usuario;
COMMIT;
