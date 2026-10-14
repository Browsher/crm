-- ver docs/db/0034.md
BEGIN;
CREATE TABLE empresa_origem_google (
  google_place_id text PRIMARY KEY CHECK (google_place_id = btrim(google_place_id)
    AND length(google_place_id) BETWEEN 1 AND 255 AND google_place_id !~ '[[:cntrl:]]'
    AND google_place_id !~ U&'[\0080-\009F]'),
  empresa_id uuid NOT NULL REFERENCES empresa(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES usuario(id) ON DELETE RESTRICT,
  atualizado_em timestamptz,
  atualizado_por uuid REFERENCES usuario(id) ON DELETE RESTRICT
);
CREATE INDEX empresa_origem_google_empresa_idx ON empresa_origem_google(empresa_id);
CREATE TRIGGER empresa_origem_google_auditoria BEFORE INSERT OR UPDATE ON empresa_origem_google
  FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
ALTER TABLE empresa_origem_google ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_origem_google_leitura ON empresa_origem_google FOR SELECT TO app_usuario USING (eh_gestor());
GRANT SELECT ON empresa_origem_google TO app_usuario;

CREATE FUNCTION empresa_cnpj_valido(p_cnpj text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
  v_base text;
  v_soma integer;
  v_peso integer;
  v_resto integer;
  v_digito integer;
  v_i integer;
  v_rodada integer;
BEGIN
  IF p_cnpj IS NULL OR p_cnpj !~ '^[0-9A-Z]{12}[0-9]{2}$' OR p_cnpj ~ '^(.)\1{13}$' THEN RETURN false; END IF;
  v_base := left(p_cnpj,12);
  FOR v_rodada IN 1..2 LOOP
    v_soma := 0;
    v_peso := 2;
    FOR v_i IN REVERSE length(v_base)..1 LOOP
      v_soma := v_soma + (ascii(substr(v_base,v_i,1)) - 48) * v_peso;
      v_peso := CASE WHEN v_peso = 9 THEN 2 ELSE v_peso + 1 END;
    END LOOP;
    v_resto := v_soma % 11;
    v_digito := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;
    v_base := v_base || v_digito::text;
  END LOOP;
  RETURN v_base = p_cnpj;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_cnpj_valido(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION grupo_importacao_confirmar(p_chave uuid,p_nome text,p_arquivo text,
  p_assinatura text,p_linhas jsonb,p_relatorio jsonb)
RETURNS TABLE(grupo_id uuid,inseridas integer,vinculadas integer,relatorio jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_grupo public.grupo_importacao%ROWTYPE;
  v_pedido jsonb;
  v_linha jsonb;
  v_id uuid;
  v_por_cnpj uuid;
  v_por_google uuid;
  v_empresa public.empresa%ROWTYPE;
  v_resolvidas uuid[] := '{}';
  v_novas integer := 0;
  v_total integer;
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF p_chave IS NULL OR p_nome IS NULL OR btrim(p_nome) = '' OR length(p_nome) NOT BETWEEN 1 AND 100 OR p_nome ~ '[[:cntrl:]]'
     OR p_arquivo IS NULL OR btrim(p_arquivo) = '' OR length(p_arquivo) NOT BETWEEN 1 AND 255 OR p_arquivo ~ '[[:cntrl:]]'
     OR p_assinatura IS NULL OR p_assinatura !~ '^[0-9a-f]{64}$'
     OR p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array'
     OR p_relatorio IS NULL OR jsonb_typeof(p_relatorio) <> 'object' THEN
    RAISE EXCEPTION 'confirmacao invalida' USING ERRCODE = '22023';
  END IF;
  v_total := jsonb_array_length(p_linhas);
  IF v_total NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'quantidade invalida' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(27, 1);
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  FOR v_linha IN SELECT value FROM jsonb_array_elements(p_linhas) LOOP
    IF jsonb_typeof(v_linha) <> 'object' OR EXISTS (
      SELECT 1 FROM jsonb_each(v_linha) j WHERE j.key NOT IN ('cnpj','razao_social','nome_fantasia','contato_nome','telefone','email','cep','cnae_principal','google_place_id')
        OR jsonb_typeof(j.value) NOT IN ('string','null') OR j.value #>> '{}' ~ '[[:cntrl:]]'
    ) THEN
      RAISE EXCEPTION 'linha invalida' USING ERRCODE = '22023';
    END IF;
    IF (v_linha->>'cnpj' IS NOT NULL AND NOT public.empresa_cnpj_valido(v_linha->>'cnpj'))
       OR (v_linha->>'cnpj' IS NULL AND v_linha->>'google_place_id' IS NULL)
       OR (coalesce(btrim(v_linha->>'razao_social'),'') = '' AND coalesce(btrim(v_linha->>'nome_fantasia'),'') = '')
       OR btrim(v_linha->>'razao_social') = ''
       OR (v_linha->>'google_place_id' IS NOT NULL AND (
          v_linha->>'google_place_id' <> btrim(v_linha->>'google_place_id')
          OR length(v_linha->>'google_place_id') NOT BETWEEN 1 AND 255
          OR v_linha->>'google_place_id' ~ U&'[\0080-\009F]'))
       OR btrim(v_linha->>'nome_fantasia') = '' OR btrim(v_linha->>'contato_nome') = ''
       OR coalesce(v_linha->>'telefone','') !~ '^[0-9]{10,11}$'
       OR (v_linha->>'email' IS NOT NULL AND ((v_linha->>'email') <> lower(btrim(v_linha->>'email')) OR (v_linha->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+$'))
       OR (v_linha->>'cep' IS NOT NULL AND (v_linha->>'cep') !~ '^[0-9]{8}$')
       OR (v_linha->>'cnae_principal' IS NOT NULL AND (v_linha->>'cnae_principal') !~ '^[0-9]{7}$') THEN
      RAISE EXCEPTION 'linha invalida' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_linhas)
      WHERE value->>'cnpj' IS NOT NULL GROUP BY value->>'cnpj' HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_linhas)
      WHERE value->>'google_place_id' IS NOT NULL GROUP BY value->>'google_place_id' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'identificador repetido' USING ERRCODE = '22023';
  END IF;
  v_pedido := jsonb_build_object('nome',p_nome,'arquivo',p_arquivo,'linhas',p_linhas);
  SELECT g.* INTO v_grupo FROM public.grupo_importacao g WHERE g.chave = p_chave;
  IF FOUND THEN
    IF v_grupo.criado_por IS DISTINCT FROM public.usuario_atual()
       OR v_grupo.assinatura IS DISTINCT FROM p_assinatura OR v_grupo.pedido IS DISTINCT FROM v_pedido THEN
      RAISE EXCEPTION 'chave de confirmacao divergente' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v_grupo.id, v_grupo.inseridas, v_grupo.vinculadas, v_grupo.relatorio;
    RETURN;
  END IF;
  INSERT INTO public.grupo_importacao(nome,arquivo_nome,chave,assinatura,relatorio,pedido)
    VALUES (p_nome,p_arquivo,p_chave,p_assinatura,p_relatorio,v_pedido) RETURNING * INTO v_grupo;
  FOR v_linha IN SELECT value FROM jsonb_array_elements(p_linhas) ORDER BY value->>'cnpj', value->>'google_place_id' LOOP
    SELECT e.id INTO v_por_cnpj FROM public.empresa e WHERE e.cnpj = v_linha->>'cnpj' FOR UPDATE;
    SELECT e.id INTO v_por_google FROM public.empresa_origem_google o JOIN public.empresa e ON e.id = o.empresa_id
      WHERE o.google_place_id = v_linha->>'google_place_id' FOR UPDATE OF e;
    IF v_por_cnpj IS NOT NULL AND v_por_google IS NOT NULL AND v_por_cnpj <> v_por_google THEN
      RAISE EXCEPTION 'identificadores divergentes' USING ERRCODE = '22023';
    END IF;
    v_id := coalesce(v_por_google, v_por_cnpj);
    IF v_id IS NULL THEN
      INSERT INTO public.empresa(cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal)
        VALUES (v_linha->>'cnpj',v_linha->>'razao_social',v_linha->>'nome_fantasia',v_linha->>'contato_nome',v_linha->>'telefone',v_linha->>'email',v_linha->>'cep',v_linha->>'cnae_principal')
        RETURNING id INTO v_id;
      v_novas := v_novas + 1;
    ELSE
      SELECT e.* INTO STRICT v_empresa FROM public.empresa e WHERE e.id = v_id;
      IF (v_empresa.cnpj IS NOT NULL AND v_linha->>'cnpj' IS NOT NULL AND v_empresa.cnpj <> v_linha->>'cnpj')
         OR (v_empresa.razao_social IS NOT NULL AND v_linha->>'razao_social' IS NOT NULL AND v_empresa.razao_social <> v_linha->>'razao_social') THEN
        RAISE EXCEPTION 'cadastro divergente' USING ERRCODE = '22023';
      END IF;
      UPDATE public.empresa e
        SET cnpj = coalesce(e.cnpj,v_linha->>'cnpj'), razao_social = coalesce(e.razao_social,v_linha->>'razao_social')
        WHERE e.id = v_id AND ((e.cnpj IS NULL AND v_linha->>'cnpj' IS NOT NULL)
          OR (e.razao_social IS NULL AND v_linha->>'razao_social' IS NOT NULL));
    END IF;
    IF v_id = ANY(v_resolvidas) THEN
      RAISE EXCEPTION 'empresa repetida' USING ERRCODE = '22023';
    END IF;
    v_resolvidas := array_append(v_resolvidas, v_id);
    IF v_linha->>'google_place_id' IS NOT NULL THEN
      INSERT INTO public.empresa_origem_google(google_place_id,empresa_id) VALUES (v_linha->>'google_place_id',v_id)
        ON CONFLICT (google_place_id) DO NOTHING;
      IF NOT EXISTS (SELECT 1 FROM public.empresa_origem_google o WHERE o.google_place_id = v_linha->>'google_place_id' AND o.empresa_id = v_id) THEN
        RAISE EXCEPTION 'origem divergente' USING ERRCODE = '22023';
      END IF;
    END IF;
    INSERT INTO public.grupo_importacao_empresa(grupo_id,empresa_id) VALUES (v_grupo.id,v_id);
  END LOOP;
  UPDATE public.grupo_importacao g SET inseridas = v_novas, vinculadas = v_total WHERE g.id = v_grupo.id;
  RETURN QUERY SELECT v_grupo.id, v_novas, v_total, p_relatorio;
END;
$$;
REVOKE EXECUTE ON FUNCTION grupo_importacao_confirmar(uuid,text,text,text,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grupo_importacao_confirmar(uuid,text,text,text,jsonb,jsonb) TO app_usuario;
COMMIT;
