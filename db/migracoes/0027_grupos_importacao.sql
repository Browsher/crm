-- ver docs/db/0027.md
BEGIN;
CREATE TABLE grupo_importacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (btrim(nome) <> '' AND length(nome) BETWEEN 1 AND 100 AND nome !~ '[[:cntrl:]]'),
  arquivo_nome text CHECK (btrim(arquivo_nome) <> '' AND length(arquivo_nome) BETWEEN 1 AND 255 AND arquivo_nome !~ '[[:cntrl:]]'),
  ativo boolean NOT NULL DEFAULT true,
  chave uuid UNIQUE,
  assinatura text CHECK (assinatura ~ '^[0-9a-f]{64}$'),
  relatorio jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(relatorio) = 'object'),
  pedido jsonb,
  inseridas integer NOT NULL DEFAULT 0 CHECK (inseridas >= 0),
  vinculadas integer NOT NULL DEFAULT 0 CHECK (vinculadas >= inseridas),
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES usuario(id) ON DELETE RESTRICT,
  atualizado_em timestamptz,
  atualizado_por uuid REFERENCES usuario(id) ON DELETE RESTRICT
);
CREATE TRIGGER grupo_importacao_auditoria BEFORE INSERT OR UPDATE ON grupo_importacao
  FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
ALTER TABLE grupo_importacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY grupo_importacao_leitura ON grupo_importacao FOR SELECT TO app_usuario USING (eh_gestor());
GRANT SELECT ON grupo_importacao TO app_usuario;
CREATE TABLE grupo_importacao_empresa (
  grupo_id uuid NOT NULL REFERENCES grupo_importacao(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES empresa(id) ON DELETE RESTRICT,
  PRIMARY KEY (grupo_id, empresa_id)
);
CREATE INDEX grupo_importacao_empresa_empresa_idx ON grupo_importacao_empresa(empresa_id, grupo_id);
ALTER TABLE grupo_importacao_empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY grupo_importacao_empresa_leitura ON grupo_importacao_empresa FOR SELECT TO app_usuario USING (eh_gestor());
GRANT SELECT ON grupo_importacao_empresa TO app_usuario;
WITH base AS (
  INSERT INTO grupo_importacao(nome, vinculadas)
    SELECT 'Base de testes', count(*)::integer FROM empresa HAVING count(*) > 0 RETURNING id
)
INSERT INTO grupo_importacao_empresa(grupo_id, empresa_id) SELECT b.id, e.id FROM base b CROSS JOIN empresa e;
CREATE FUNCTION empresa_origem_ativa(p_empresa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.grupo_importacao_empresa ge
    JOIN public.grupo_importacao g ON g.id = ge.grupo_id
    WHERE ge.empresa_id = p_empresa AND g.ativo);
$$;
REVOKE EXECUTE ON FUNCTION empresa_origem_ativa(uuid) FROM PUBLIC;
CREATE FUNCTION empresa_visivel_prospeccao(p_empresa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.empresa_origem_ativa(p_empresa) OR EXISTS (
    SELECT 1 FROM public.empresa_fila f WHERE f.empresa_id = p_empresa
      AND (f.vendedor_id = public.usuario_atual()
        OR (f.reservado_por = public.usuario_atual() AND f.reservado_ate > now()))
  );
$$;
REVOKE EXECUTE ON FUNCTION empresa_visivel_prospeccao(uuid) FROM PUBLIC;
CREATE FUNCTION grupo_importacao_confirmar(p_chave uuid,p_nome text,p_arquivo text,
  p_assinatura text,p_linhas jsonb,p_relatorio jsonb)
RETURNS TABLE(grupo_id uuid,inseridas integer,vinculadas integer,relatorio jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_grupo public.grupo_importacao%ROWTYPE;
  v_pedido jsonb;
  v_linha jsonb;
  v_id uuid;
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
  FOR v_linha IN SELECT value FROM jsonb_array_elements(p_linhas) LOOP
    IF jsonb_typeof(v_linha) <> 'object' OR EXISTS (
      SELECT 1 FROM jsonb_each(v_linha) j WHERE j.key NOT IN ('cnpj','razao_social','nome_fantasia','contato_nome','telefone','email','cep','cnae_principal')
        OR jsonb_typeof(j.value) NOT IN ('string','null') OR j.value #>> '{}' ~ '[[:cntrl:]]'
    ) THEN
      RAISE EXCEPTION 'linha invalida' USING ERRCODE = '22023';
    END IF;
    IF coalesce(v_linha->>'cnpj','') !~ '^[0-9A-Z]{12}[0-9]{2}$'
       OR coalesce(btrim(v_linha->>'razao_social'),'') = ''
       OR btrim(v_linha->>'nome_fantasia') = '' OR btrim(v_linha->>'contato_nome') = ''
       OR coalesce(v_linha->>'telefone','') !~ '^[0-9]{10,11}$'
       OR (v_linha->>'email' IS NOT NULL AND ((v_linha->>'email') <> lower(btrim(v_linha->>'email')) OR (v_linha->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+$'))
       OR (v_linha->>'cep' IS NOT NULL AND (v_linha->>'cep') !~ '^[0-9]{8}$')
       OR (v_linha->>'cnae_principal' IS NOT NULL AND (v_linha->>'cnae_principal') !~ '^[0-9]{7}$') THEN
      RAISE EXCEPTION 'linha invalida' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'cnpj') FROM jsonb_array_elements(p_linhas)) <> v_total THEN
    RAISE EXCEPTION 'cnpj repetido' USING ERRCODE = '22023';
  END IF;
  v_pedido := jsonb_build_object('nome',p_nome,'arquivo',p_arquivo,'linhas',p_linhas);
  PERFORM pg_catalog.pg_advisory_xact_lock(27, 1);
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
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
  FOR v_linha IN SELECT value FROM jsonb_array_elements(p_linhas) ORDER BY value->>'cnpj' LOOP
    INSERT INTO public.empresa(cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal)
      VALUES (v_linha->>'cnpj',v_linha->>'razao_social',v_linha->>'nome_fantasia',v_linha->>'contato_nome',v_linha->>'telefone',v_linha->>'email',v_linha->>'cep',v_linha->>'cnae_principal')
      ON CONFLICT (cnpj) DO NOTHING RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      SELECT e.id INTO STRICT v_id FROM public.empresa e WHERE e.cnpj = v_linha->>'cnpj';
    ELSE
      v_novas := v_novas + 1;
    END IF;
    INSERT INTO public.grupo_importacao_empresa(grupo_id,empresa_id) VALUES (v_grupo.id,v_id);
  END LOOP;
  UPDATE public.grupo_importacao g SET inseridas = v_novas, vinculadas = v_total WHERE g.id = v_grupo.id;
  RETURN QUERY SELECT v_grupo.id, v_novas, v_total, p_relatorio;
END;
$$;
REVOKE EXECUTE ON FUNCTION grupo_importacao_confirmar(uuid,text,text,text,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grupo_importacao_confirmar(uuid,text,text,text,jsonb,jsonb) TO app_usuario;
CREATE FUNCTION grupo_importacao_situacao_definir(p_grupo uuid,p_ativo boolean) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF p_grupo IS NULL OR p_ativo IS NULL THEN RAISE EXCEPTION 'situacao invalida' USING ERRCODE = '22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(27, 1);
  PERFORM 1 FROM public.grupo_importacao WHERE id = p_grupo FOR UPDATE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.grupo_importacao WHERE id = p_grupo) THEN RETURN 'nao_encontrado'; END IF;
  UPDATE public.grupo_importacao SET ativo = p_ativo WHERE id = p_grupo AND ativo IS DISTINCT FROM p_ativo;
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION grupo_importacao_situacao_definir(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grupo_importacao_situacao_definir(uuid,boolean) TO app_usuario;
CREATE FUNCTION grupo_importacao_renomear(p_grupo uuid,p_nome text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF p_grupo IS NULL OR p_nome IS NULL OR btrim(p_nome) = '' OR length(p_nome) NOT BETWEEN 1 AND 100 OR p_nome ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'nome invalido' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.grupo_importacao WHERE id = p_grupo FOR UPDATE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.grupo_importacao WHERE id = p_grupo) THEN RETURN 'nao_encontrado'; END IF;
  UPDATE public.grupo_importacao SET nome = p_nome WHERE id = p_grupo AND nome IS DISTINCT FROM p_nome;
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION grupo_importacao_renomear(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grupo_importacao_renomear(uuid,text) TO app_usuario;
CREATE OR REPLACE FUNCTION fila_reservar(p_alvo uuid, p_nome text, p_cnae text, p_uf text, p_cidade text, p_bairro text, p_contexto_esperado uuid)
RETURNS TABLE (resultado text, empresa_id uuid, reservado_ate timestamptz, contexto uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_anterior uuid;
  v_candidata uuid;
  v_bloqueada uuid;
  v_contexto uuid;
  v_agora timestamptz;
  v_fila public.empresa_fila%ROWTYPE;
  v_dono_ativo boolean;
  v_busca text;
  v_excluidas uuid[] := '{}';
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF p_nome IS NULL OR length(p_nome) > 100
     OR (p_cnae IS NOT NULL AND p_cnae <> 'nao_informado' AND p_cnae !~ '^[0-9]{7}$')
     OR (p_uf IS NOT NULL AND p_uf !~ '^[A-Z]{2}$')
     OR (p_cidade IS NOT NULL AND (p_uf IS NULL OR p_cidade !~ '^[0-9]{7}$'))
     OR (p_bairro IS NOT NULL AND (p_cidade IS NULL OR btrim(p_bairro) = '' OR length(p_bairro) > 200)) THEN
    RAISE EXCEPTION 'filtro invalido' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27, 1);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_eu::text, 25));
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  SELECT fc.versao INTO v_contexto FROM public.fila_contexto fc WHERE fc.usuario_id = v_eu;
  contexto := v_contexto;
  IF v_contexto IS DISTINCT FROM p_contexto_esperado THEN
    resultado := 'contexto_alterado'; RETURN NEXT; RETURN;
  END IF;
  SELECT f.empresa_id INTO v_anterior FROM public.empresa_fila f WHERE f.reservado_por = v_eu;
  IF v_anterior IS NOT NULL THEN
    SELECT e.id INTO v_bloqueada FROM public.empresa e WHERE e.id = v_anterior FOR UPDATE SKIP LOCKED;
    IF v_bloqueada IS NULL THEN
      resultado := 'indisponivel'; RETURN NEXT; RETURN;
    END IF;
  END IF;
  v_busca := '%' || replace(replace(replace(public.sem_acento(p_nome), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  LOOP
    v_agora := clock_timestamp();
    IF p_alvo IS NOT NULL THEN
      SELECT e.id INTO v_candidata FROM public.empresa e WHERE e.id = p_alvo FOR UPDATE SKIP LOCKED;
    ELSE
      SELECT e.id INTO v_candidata
        FROM public.empresa e
        LEFT JOIN public.empresa_fila f ON f.empresa_id = e.id
        LEFT JOIN public.usuario dono ON dono.id = f.vendedor_id
        LEFT JOIN public.cep c ON c.cep = e.cep
       WHERE public.empresa_origem_ativa(e.id) AND e.id IS DISTINCT FROM v_anterior AND NOT (e.id = ANY(v_excluidas))
         AND (f.vendedor_id IS NULL OR dono.ativo = false)
         AND (f.reservado_ate IS NULL OR f.reservado_ate <= v_agora)
         AND (f.elegivel_em IS NULL OR f.elegivel_em <= v_agora)
         AND e.busca LIKE v_busca ESCAPE E'\\'
         AND (p_cnae IS NULL OR (p_cnae = 'nao_informado' AND e.cnae_principal IS NULL) OR e.cnae_principal = p_cnae)
         AND (p_uf IS NULL OR c.uf = p_uf)
         AND (p_cidade IS NULL OR c.ibge = p_cidade)
         AND (p_bairro IS NULL OR nullif(btrim(c.bairro), '') = p_bairro)
       ORDER BY f.elegivel_em ASC NULLS FIRST, e.criado_em, e.id
       LIMIT 1 FOR UPDATE OF e SKIP LOCKED;
    END IF;
    IF v_candidata IS NULL THEN
      resultado := CASE WHEN p_alvo IS NULL THEN 'sem_candidata' ELSE 'indisponivel' END;
      RETURN NEXT; RETURN;
    END IF;
    v_agora := clock_timestamp();
    SELECT f.* INTO v_fila FROM public.empresa_fila f WHERE f.empresa_id = v_candidata;
    SELECT u.ativo INTO v_dono_ativo FROM public.usuario u WHERE u.id = v_fila.vendedor_id;
    IF v_fila.reservado_por = v_eu AND v_fila.reservado_ate > v_agora THEN
      resultado := 'ok'; empresa_id := v_candidata; reservado_ate := v_fila.reservado_ate;
      RETURN NEXT; RETURN;
    END IF;
    IF public.empresa_origem_ativa(v_candidata) AND (v_fila.vendedor_id IS NULL OR v_dono_ativo = false)
       AND (v_fila.reservado_ate IS NULL OR v_fila.reservado_ate <= v_agora)
       AND (v_fila.elegivel_em IS NULL OR v_fila.elegivel_em <= v_agora) THEN
      EXIT;
    END IF;
    IF p_alvo IS NOT NULL THEN
      resultado := 'indisponivel'; RETURN NEXT; RETURN;
    END IF;
    v_excluidas := array_append(v_excluidas, v_candidata);
  END LOOP;
  UPDATE public.empresa_fila f SET reservado_por = NULL, reservado_ate = NULL
   WHERE f.empresa_id = v_anterior AND f.reservado_por = v_eu;
  INSERT INTO public.empresa_fila AS f (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
  VALUES (v_candidata, v_eu, v_agora + interval '30 minutes', v_agora)
  ON CONFLICT ON CONSTRAINT empresa_fila_pkey DO UPDATE
    SET vendedor_id = NULL, reservado_por = excluded.reservado_por, reservado_ate = excluded.reservado_ate,
        primeira_reserva_em = coalesce(f.primeira_reserva_em, excluded.primeira_reserva_em);
  INSERT INTO public.fila_contexto AS fc (usuario_id) VALUES (v_eu)
  ON CONFLICT (usuario_id) DO UPDATE SET versao = gen_random_uuid()
  RETURNING fc.versao INTO contexto;
  resultado := 'ok'; empresa_id := v_candidata; reservado_ate := v_agora + interval '30 minutes';
  RETURN NEXT;
END;
$$;
CREATE OR REPLACE FUNCTION empresa_consultar(p_nome text, p_cnae text, p_uf text, p_cidade text, p_bairro text, p_pagina integer)
RETURNS TABLE (id uuid, razao_social text, nome_fantasia text, cnae_principal text, cidade text, uf text, bairro text, disponibilidade text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_busca text;
BEGIN
  IF NOT public.pode_ler() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF p_nome IS NULL OR length(p_nome) > 100
     OR p_pagina IS NULL OR p_pagina < 1 OR p_pagina > 10000
     OR (p_cnae IS NOT NULL AND p_cnae <> 'nao_informado' AND p_cnae !~ '^[0-9]{7}$')
     OR (p_uf IS NOT NULL AND p_uf !~ '^[A-Z]{2}$')
     OR (p_cidade IS NOT NULL AND (p_uf IS NULL OR p_cidade !~ '^[0-9]{7}$'))
     OR (p_bairro IS NOT NULL AND (p_cidade IS NULL OR btrim(p_bairro) = '' OR length(p_bairro) > 200)) THEN
    RAISE EXCEPTION 'filtro invalido' USING ERRCODE = '22023';
  END IF;
  v_busca := '%' || replace(replace(replace(public.sem_acento(p_nome), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  RETURN QUERY
    SELECT e.id, e.razao_social, e.nome_fantasia, e.cnae_principal,
           c.localidade, c.uf::text, nullif(btrim(c.bairro), ''),
           CASE
             WHEN f.vendedor_id = v_eu THEN 'comigo'
             WHEN dono.ativo THEN 'outro_vendedor'
             WHEN f.reservado_ate > now() THEN
               CASE WHEN f.reservado_por = v_eu THEN 'reservada_comigo' ELSE 'outro_vendedor' END
             WHEN f.elegivel_em > now() THEN 'em_descanso'
             ELSE 'disponivel'
           END
      FROM public.empresa e
      LEFT JOIN public.cep c ON c.cep = e.cep
      LEFT JOIN public.empresa_fila f ON f.empresa_id = e.id
      LEFT JOIN public.usuario dono ON dono.id = f.vendedor_id
     WHERE public.empresa_visivel_prospeccao(e.id) AND e.busca LIKE v_busca ESCAPE E'\\'
       AND (p_cnae IS NULL OR (p_cnae = 'nao_informado' AND e.cnae_principal IS NULL) OR e.cnae_principal = p_cnae)
       AND (p_uf IS NULL OR c.uf = p_uf)
       AND (p_cidade IS NULL OR c.ibge = p_cidade)
       AND (p_bairro IS NULL OR nullif(btrim(c.bairro), '') = p_bairro)
     ORDER BY e.razao_social, e.id
     LIMIT 21 OFFSET (p_pagina - 1) * 20;
END;
$$;
CREATE OR REPLACE FUNCTION empresa_resumos(p_ids uuid[]) RETURNS TABLE (
  id uuid, razao_social text, nome_fantasia text, cnae_principal text,
  cidade text, uf text, bairro text, disponibilidade text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT e.id, e.razao_social, e.nome_fantasia, e.cnae_principal,
    c.localidade, c.uf::text, nullif(btrim(c.bairro), ''),
    CASE
      WHEN f.vendedor_id = public.usuario_atual() THEN 'comigo'
      WHEN dono.ativo THEN 'outro_vendedor'
      WHEN f.reservado_ate > now() THEN
        CASE WHEN f.reservado_por = public.usuario_atual() THEN 'reservada_comigo' ELSE 'outro_vendedor' END
      WHEN f.elegivel_em > now() THEN 'em_descanso'
      ELSE 'disponivel'
    END
  FROM public.empresa e
  LEFT JOIN public.cep c ON c.cep = e.cep
  LEFT JOIN public.empresa_fila f ON f.empresa_id = e.id
  LEFT JOIN public.usuario dono ON dono.id = f.vendedor_id
  WHERE public.empresa_visivel_prospeccao(e.id) AND e.id = ANY(p_ids);
$$;
CREATE OR REPLACE FUNCTION empresa_sugestoes() RETURNS TABLE (
  id uuid, razao_social text, nome_fantasia text, cnae_principal text,
  cidade text, uf text, bairro text, disponibilidade text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_ler() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT e.* FROM public.empresa_resumos(ARRAY(
    SELECT x.id FROM public.empresa x
    LEFT JOIN public.empresa_fila f ON f.empresa_id = x.id
    LEFT JOIN public.usuario dono ON dono.id = f.vendedor_id
    WHERE public.empresa_origem_ativa(x.id) AND f.vendedor_id IS DISTINCT FROM public.usuario_atual()
      AND NOT coalesce(dono.ativo, false)
      AND (f.reservado_ate IS NULL OR f.reservado_ate <= now())
      AND (f.elegivel_em IS NULL OR f.elegivel_em <= now())
    ORDER BY x.razao_social, x.id LIMIT 10
  )) e
    ORDER BY e.razao_social, e.id LIMIT 10;
END;
$$;
CREATE FUNCTION empresa_filtros_interno(p_uf text, p_cidade text, p_administracao boolean)
RETURNS TABLE (tipo text, valor text, rotulo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF (p_uf IS NOT NULL AND p_uf !~ '^[A-Z]{2}$')
     OR (p_cidade IS NOT NULL AND (p_uf IS NULL OR p_cidade !~ '^[0-9]{7}$')) THEN
    RAISE EXCEPTION 'filtro invalido' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    WITH importadas AS (
      SELECT e.cnae_principal, c.uf::text AS estado, c.ibge, c.localidade, nullif(btrim(c.bairro), '') AS bairro
        FROM public.empresa e LEFT JOIN public.cep c ON c.cep = e.cep
       WHERE p_administracao OR public.empresa_visivel_prospeccao(e.id)
    ), opcoes AS (
      SELECT 'cnae'::text AS tipo, coalesce(i.cnae_principal, 'nao_informado') AS valor,
             coalesce(i.cnae_principal, 'Não informado') AS rotulo FROM importadas i
      UNION
      SELECT 'uf', i.estado, i.estado FROM importadas i WHERE i.estado IS NOT NULL
      UNION
      SELECT 'cidade', i.ibge, i.localidade FROM importadas i WHERE i.estado = p_uf
      UNION
      SELECT 'bairro', i.bairro, i.bairro FROM importadas i
       WHERE i.estado = p_uf AND i.ibge = p_cidade AND i.bairro IS NOT NULL
    )
    SELECT o.tipo, o.valor, o.rotulo FROM opcoes o ORDER BY o.rotulo, o.valor, o.tipo;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_filtros_interno(text,text,boolean) FROM PUBLIC;
CREATE OR REPLACE FUNCTION empresa_filtros(p_uf text, p_cidade text)
RETURNS TABLE (tipo text, valor text, rotulo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_ler() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT f.tipo, f.valor, f.rotulo
    FROM public.empresa_filtros_interno(p_uf, p_cidade, false) f;
END;
$$;
CREATE FUNCTION empresa_filtros_administracao(p_uf text, p_cidade text)
RETURNS TABLE (tipo text, valor text, rotulo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT f.tipo, f.valor, f.rotulo
    FROM public.empresa_filtros_interno(p_uf, p_cidade, true) f;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_filtros_administracao(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_filtros_administracao(text,text) TO app_usuario;
COMMIT;
