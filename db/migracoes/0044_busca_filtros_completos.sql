-- ver docs/db/0044.md
BEGIN;
CREATE FUNCTION busca_filtros_completos_validos(a jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE j record; r jsonb; elemento jsonb; k text;
BEGIN
  IF a IS NULL OR jsonb_typeof(a)<>'object' OR pg_column_size(a)>64000
    OR a->'versao'<>'1'::jsonb OR NOT a ?& ARRAY['versao','palavras','cnaes','naturezas','atividadeTipo','regioes','portes','tipos','situacoes','regimes','capitalMinimo','capitalMaximo','aberturaDe','aberturaAte','contato','ddds','semEmailContabil','socios']
    OR (a-ARRAY['versao','palavras','cnaes','naturezas','atividadeTipo','regioes','portes','tipos','situacoes','regimes','capitalMinimo','capitalMaximo','aberturaDe','aberturaAte','contato','ddds','semEmailContabil','socios'])<>'{}'::jsonb THEN RETURN false; END IF;
  FOR j IN SELECT * FROM jsonb_each(a) LOOP
    IF j.key IN ('palavras','cnaes','naturezas','atividadeTipo','regioes','portes','tipos','situacoes','regimes','ddds') THEN
      IF jsonb_typeof(j.value)<>'array' OR jsonb_array_length(j.value)>20 THEN RETURN false; END IF;
      IF j.key<>'regioes' THEN
        FOR elemento IN SELECT * FROM jsonb_array_elements(j.value) LOOP
          IF jsonb_typeof(elemento)<>'string' OR length(btrim(elemento#>>'{}')) NOT BETWEEN 1 AND 100 OR elemento#>>'{}' ~ '[[:cntrl:]]' OR elemento#>>'{}' ~ U&'[\0080-\009F]' THEN RETURN false; END IF;
        END LOOP;
      END IF;
    ELSIF j.key IN ('socios','semEmailContabil') THEN
      IF jsonb_typeof(j.value)<>'boolean' THEN RETURN false; END IF;
    ELSIF j.key<>'versao' AND jsonb_typeof(j.value)<>'string' THEN RETURN false;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(a->'cnaes') t WHERE t !~ '^[0-9]{7}$') OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(a->'naturezas') t WHERE t !~ '^[0-9]{4}$')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(a->'atividadeTipo') t WHERE t NOT IN ('principal','secundaria')) OR jsonb_array_length(a->'atividadeTipo') NOT BETWEEN 1 AND 2
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(a->'portes') t WHERE t NOT IN ('MEI','ME','EPP','DEMAIS'))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(a->'tipos') t WHERE t NOT IN ('1','2'))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(a->'situacoes') t WHERE t NOT IN ('ativa','baixada','suspensa','inapta','nula'))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(a->'regimes') t WHERE t NOT IN ('Simples Nacional','Lucro Real','Lucro Presumido','Lucro Arbitrado','Isenta','Imune','Indefinido'))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(a->'ddds') t WHERE t !~ '^[1-9][0-9]$')
    OR a->>'contato' NOT IN ('','email','celular','celulareemail','telefone','telefoneoucelular','telefoneoucelulareemail','telefoneoucelularouemail') THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['capitalMinimo','capitalMaximo'] LOOP
    IF a->>k !~ '^(|([0-9]{1,13})(\.[0-9]{1,2})?)$' THEN RETURN false; END IF;
  END LOOP;
  IF nullif(a->>'capitalMinimo','')::numeric > nullif(a->>'capitalMaximo','')::numeric THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['aberturaDe','aberturaAte'] LOOP
    IF a->>k<>'' THEN
      IF a->>k !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN false; END IF;
      PERFORM (a->>k)::date;
    END IF;
  END LOOP;
  IF nullif(a->>'aberturaDe','')::date > nullif(a->>'aberturaAte','')::date THEN RETURN false; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(a->'regioes') LOOP
    IF jsonb_typeof(r)<>'object' OR NOT r ?& ARRAY['estado','cidade','bairros'] OR (r-ARRAY['estado','cidade','bairros'])<>'{}'::jsonb
      OR jsonb_typeof(r->'estado')<>'string' OR r->>'estado' NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
      OR jsonb_typeof(r->'cidade')<>'string' OR length(r->>'cidade')>100 OR r->>'cidade' ~ '[[:cntrl:]]' OR r->>'cidade' ~ U&'[\0080-\009F]'
      OR jsonb_typeof(r->'bairros')<>'array' OR jsonb_array_length(r->'bairros')>20 OR (jsonb_array_length(r->'bairros')>0 AND btrim(r->>'cidade')='') THEN RETURN false; END IF;
    FOR elemento IN SELECT * FROM jsonb_array_elements(r->'bairros') LOOP
      IF jsonb_typeof(elemento)<>'string' OR length(btrim(elemento#>>'{}')) NOT BETWEEN 1 AND 100 OR elemento#>>'{}' ~ '[[:cntrl:]]' OR elemento#>>'{}' ~ U&'[\0080-\009F]' THEN RETURN false; END IF;
    END LOOP;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_parameter_value OR invalid_text_representation THEN RETURN false;
END;
$$;
REVOKE EXECUTE ON FUNCTION busca_filtros_completos_validos(jsonb) FROM PUBLIC;
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
    OR (p_filtros - ARRAY['palavra','cnae','uf','cidade','bairro','porte','tipo','contato','quantidade','offset','avancados']) <> '{}'::jsonb
    OR NOT p_filtros ?& ARRAY['palavra','cnae','uf','cidade','bairro','porte','tipo','contato','quantidade','offset']
    OR (p_filtros ? 'avancados' AND NOT public.busca_filtros_completos_validos(p_filtros->'avancados'))
    OR EXISTS (SELECT 1 FROM jsonb_each(p_filtros-'avancados') j WHERE
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
    OR (NOT p_filtros ? 'avancados' AND btrim(p_filtros->>'palavra') = '' AND p_filtros->>'cnae' = '')
    OR (NOT (p_filtros ? 'avancados' AND p_filtros->>'uf'='') AND p_filtros->>'uf' NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'))
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
CREATE FUNCTION busca_socios_resumir(p jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(CASE WHEN jsonb_typeof(e)='string' THEN e ELSE jsonb_strip_nulls(jsonb_build_object('nome',e->'nome','funcao',CASE WHEN jsonb_typeof(e->'funcao')='object' THEN jsonb_build_object('codigo',e->'funcao'->'codigo','descricao',e->'funcao'->'descricao') ELSE NULL END)) END),'[]'::jsonb) FROM jsonb_array_elements(p) e;
$$;
REVOKE EXECUTE ON FUNCTION busca_socios_resumir(jsonb) FROM PUBLIC;
CREATE FUNCTION busca_empresas_resumir(p jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(CASE WHEN e->'detalhes' ? 'socios' THEN jsonb_set(e,'{detalhes,socios}',public.busca_socios_resumir(e->'detalhes'->'socios')) ELSE e END),'[]'::jsonb) FROM jsonb_array_elements(p) e;
$$;
REVOKE EXECUTE ON FUNCTION busca_empresas_resumir(jsonb) FROM PUBLIC;
CREATE TABLE busca_empresa_socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  busca_id uuid NOT NULL REFERENCES busca_empresa(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  dados jsonb NOT NULL CHECK(jsonb_typeof(dados)='array' AND jsonb_array_length(dados)<=100 AND pg_column_size(dados)<=64000),
  UNIQUE(busca_id,cnpj)
);
ALTER TABLE busca_empresa_socios ENABLE ROW LEVEL SECURITY;
CREATE POLICY busca_empresa_socios_gestor ON busca_empresa_socios FOR SELECT TO app_usuario USING(pode_ler() AND eh_gestor());
GRANT SELECT ON busca_empresa_socios TO app_usuario;

CREATE FUNCTION busca_detalhes_empresariais_validos(d jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE j record; e jsonb;
BEGIN
  IF d IS NULL OR jsonb_typeof(d)<>'object' OR pg_column_size(d)>64000 OR (d-ARRAY['capital_social','natureza_juridica','regime_tributario','atividades_secundarias','socios'])<>'{}'::jsonb THEN RETURN false; END IF;
  FOR j IN SELECT * FROM jsonb_each(d) LOOP
    IF j.key='socios' THEN
      IF jsonb_typeof(j.value)<>'array' OR jsonb_array_length(j.value)>100 THEN RETURN false; END IF;
      FOR e IN SELECT * FROM jsonb_array_elements(j.value) LOOP
        IF jsonb_typeof(e) NOT IN ('object','string') OR (jsonb_typeof(e)='object' AND (e-ARRAY['nome','cnpj_cpf_socio','funcao','data_entrada_sociedade','pais','representante_legal','faixa_etariia'])<>'{}'::jsonb) THEN RETURN false; END IF;
        IF jsonb_typeof(e)='object' THEN
          IF EXISTS (SELECT 1 FROM jsonb_each(e) x WHERE x.key IN ('nome','cnpj_cpf_socio','data_entrada_sociedade','faixa_etariia') AND (jsonb_typeof(x.value) NOT IN ('string','null') OR length(x.value#>>'{}')>1000 OR x.value#>>'{}' ~ '[[:cntrl:]]')) THEN RETURN false; END IF;
          IF e ? 'funcao' AND e->'funcao'<>'null'::jsonb THEN
            IF jsonb_typeof(e->'funcao')<>'object' OR ((e->'funcao')-ARRAY['codigo','descricao'])<>'{}'::jsonb THEN RETURN false; END IF;
            IF EXISTS (SELECT 1 FROM jsonb_each(e->'funcao') x WHERE jsonb_typeof(x.value) NOT IN ('string','null') OR length(x.value#>>'{}')>1000 OR x.value#>>'{}' ~ '[[:cntrl:]]') THEN RETURN false; END IF;
          END IF;
        END IF;
      END LOOP;
    ELSIF j.key IN ('regime_tributario','atividades_secundarias') THEN
      IF jsonb_typeof(j.value)<>'array' OR jsonb_array_length(j.value)>100 THEN RETURN false; END IF;
      FOR e IN SELECT * FROM jsonb_array_elements(j.value) LOOP
        IF jsonb_typeof(e)<>'string' OR length(e#>>'{}')>1000 OR e#>>'{}' ~ '[[:cntrl:]]' OR e#>>'{}' ~ U&'[\0080-\009F]' THEN RETURN false; END IF;
      END LOOP;
    ELSIF jsonb_typeof(j.value) NOT IN ('string','null') OR length(j.value#>>'{}')>1000 OR j.value#>>'{}' ~ '[[:cntrl:]]' OR j.value#>>'{}' ~ U&'[\0080-\009F]' THEN RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION busca_detalhes_empresariais_validos(jsonb) FROM PUBLIC;
ALTER TABLE empresa_dados_cadastrais ADD COLUMN detalhes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (busca_detalhes_empresariais_validos(detalhes) AND (NOT detalhes ? 'socios' OR detalhes->'socios'=busca_socios_resumir(detalhes->'socios')));
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
  UPDATE public.busca_empresa SET empresas = public.busca_empresas_resumir(p_empresas), motivo = p_motivo,
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
    INSERT INTO public.empresa_dados_cadastrais(empresa_id,fonte,coletado_em,situacao,porte,data_abertura,logradouro,numero,complemento,bairro,cidade,uf,telefones,detalhes)
      VALUES (v_empresa,'CNPJ.biz',v_busca.criado_em,v_linha->>'situacao',v_linha->>'porte',(v_linha->>'data_abertura')::date,
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
    ) THEN d.telefones ELSE '[]'::jsonb END,d.detalhes
    FROM public.empresa_dados_cadastrais d WHERE d.empresa_id = p_empresa;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_dados_cadastrais_ler(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_dados_cadastrais_ler(uuid) TO app_usuario;

COMMIT;
