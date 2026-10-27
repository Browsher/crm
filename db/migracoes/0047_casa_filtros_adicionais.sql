-- ver docs/db/0047.md
BEGIN;
CREATE OR REPLACE FUNCTION busca_filtros_completos_validos(a jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE j record; r jsonb; elemento jsonb; k text;
BEGIN
  IF a IS NULL OR jsonb_typeof(a)<>'object' OR pg_column_size(a)>64000
    OR a->'versao'<>'1'::jsonb OR NOT a ?& ARRAY['versao','palavras','cnaes','naturezas','atividadeTipo','regioes','portes','tipos','situacoes','regimes','capitalMinimo','capitalMaximo','aberturaDe','aberturaAte','contato','ddds','semEmailContabil','socios']
    OR (a-ARRAY['versao','palavras','cnaes','naturezas','atividadeTipo','regioes','portes','tipos','situacoes','regimes','capitalMinimo','capitalMaximo','aberturaDe','aberturaAte','contato','ddds','semEmailContabil','socios','cnaesSecundarios','aberturaUltimosDias','excluirMei','excluirSimples','meiExclusaoDe','meiExclusaoAte','simplesExclusaoDe','simplesExclusaoAte'])<>'{}'::jsonb THEN RETURN false; END IF;
  FOR j IN SELECT * FROM jsonb_each(a) LOOP
    IF j.key IN ('palavras','cnaes','cnaesSecundarios','naturezas','atividadeTipo','regioes','portes','tipos','situacoes','regimes','ddds') THEN
      IF jsonb_typeof(j.value)<>'array' OR jsonb_array_length(j.value)>20 THEN RETURN false; END IF;
      IF j.key<>'regioes' THEN
        FOR elemento IN SELECT * FROM jsonb_array_elements(j.value) LOOP
          IF jsonb_typeof(elemento)<>'string' OR length(btrim(elemento#>>'{}')) NOT BETWEEN 1 AND 100 OR elemento#>>'{}' ~ '[[:cntrl:]]' OR elemento#>>'{}' ~ U&'[\0080-\009F]' THEN RETURN false; END IF;
        END LOOP;
      END IF;
    ELSIF j.key IN ('socios','semEmailContabil','excluirMei','excluirSimples') THEN
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
  FOREACH k IN ARRAY ARRAY['aberturaDe','aberturaAte','meiExclusaoDe','meiExclusaoAte','simplesExclusaoDe','simplesExclusaoAte'] LOOP
    IF a->>k<>'' THEN
      IF a->>k !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN false; END IF;
      PERFORM (a->>k)::date;
    END IF;
  END LOOP;
  IF nullif(a->>'aberturaDe','')::date > nullif(a->>'aberturaAte','')::date THEN RETURN false; END IF;
  IF a ? 'cnaesSecundarios' THEN
    IF a->'atividadeTipo' <> '["principal"]'::jsonb
      OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(a->'cnaesSecundarios') t WHERE t !~ '^[0-9]{7}$')
      OR jsonb_array_length(a->'cnaesSecundarios') <> (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(a->'cnaesSecundarios')) THEN RETURN false; END IF;
  END IF;
  IF coalesce(a->>'aberturaUltimosDias','') <> '' THEN
    IF a->>'aberturaUltimosDias' !~ '^[1-9][0-9]{0,9}$' THEN RETURN false; END IF;
    IF (a->>'aberturaUltimosDias')::numeric > 2147483647 OR a->>'aberturaDe' <> '' OR a->>'aberturaAte' <> '' THEN RETURN false; END IF;
  END IF;
  IF (a->'excluirMei' = 'true'::jsonb AND a->'portes' ? 'MEI')
    OR (a->'excluirSimples' = 'true'::jsonb AND a->'regimes' ? 'Simples Nacional') THEN RETURN false; END IF;
  IF ((coalesce(a->>'meiExclusaoDe','') <> '' OR coalesce(a->>'meiExclusaoAte','') <> '') AND a->'excluirMei' IS DISTINCT FROM 'true'::jsonb)
    OR ((coalesce(a->>'simplesExclusaoDe','') <> '' OR coalesce(a->>'simplesExclusaoAte','') <> '') AND a->'excluirSimples' IS DISTINCT FROM 'true'::jsonb) THEN RETURN false; END IF;
  IF nullif(a->>'meiExclusaoDe','')::date > nullif(a->>'meiExclusaoAte','')::date
    OR nullif(a->>'simplesExclusaoDe','')::date > nullif(a->>'simplesExclusaoAte','')::date THEN RETURN false; END IF;
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
COMMIT;
