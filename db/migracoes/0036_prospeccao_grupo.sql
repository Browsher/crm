-- ver docs/db/0036.md
BEGIN;
DROP FUNCTION fila_reservar(uuid,text,text,text,text,text,uuid);
DROP FUNCTION empresa_consultar(text,text,text,text,text,integer);
DROP FUNCTION empresa_filtros(text,text);
CREATE FUNCTION fila_reservar(p_alvo uuid, p_nome text, p_cnae text, p_uf text, p_cidade text, p_bairro text, p_contexto_esperado uuid, p_grupo uuid DEFAULT NULL)
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
  IF (p_alvo IS NULL OR p_alvo IS DISTINCT FROM v_anterior) AND p_grupo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.grupo_importacao g WHERE g.id = p_grupo AND g.ativo) THEN
    SELECT f.empresa_id, f.reservado_ate INTO empresa_id, reservado_ate FROM public.empresa_fila f WHERE f.empresa_id = v_anterior;
    resultado := 'grupo_indisponivel'; RETURN NEXT; RETURN;
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
       WHERE NOT public.empresa_cliente(e.id) AND public.empresa_origem_ativa(e.id) AND e.id IS DISTINCT FROM v_anterior AND NOT (e.id = ANY(v_excluidas))
         AND (f.vendedor_id IS NULL OR dono.ativo = false)
         AND (f.reservado_ate IS NULL OR f.reservado_ate <= v_agora)
         AND (f.elegivel_em IS NULL OR f.elegivel_em <= v_agora)
         AND (p_grupo IS NULL OR EXISTS (SELECT 1 FROM public.grupo_importacao_empresa ge WHERE ge.empresa_id = e.id AND ge.grupo_id = p_grupo))
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
    IF NOT public.pode_escrever() THEN
      RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
    END IF;
    v_agora := clock_timestamp();
    SELECT f.* INTO v_fila FROM public.empresa_fila f WHERE f.empresa_id = v_candidata;
    SELECT u.ativo INTO v_dono_ativo FROM public.usuario u WHERE u.id = v_fila.vendedor_id;
    IF v_fila.reservado_por = v_eu AND v_fila.reservado_ate > v_agora THEN
      resultado := 'ok'; empresa_id := v_candidata; reservado_ate := v_fila.reservado_ate;
      RETURN NEXT; RETURN;
    END IF;
    IF v_candidata IS DISTINCT FROM v_anterior AND p_grupo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.grupo_importacao_empresa ge WHERE ge.empresa_id = v_candidata AND ge.grupo_id = p_grupo) THEN
      resultado := 'indisponivel'; RETURN NEXT; RETURN;
    END IF;
    IF NOT public.empresa_cliente(v_candidata) AND public.empresa_origem_ativa(v_candidata) AND (v_fila.vendedor_id IS NULL OR v_dono_ativo = false)
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
  UPDATE public.negociacao n SET encerrada_em = clock_timestamp(), encerramento = 'devolucao'
    WHERE n.empresa_id = v_candidata AND n.encerrada_em IS NULL;
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
CREATE FUNCTION empresa_consultar(p_nome text, p_cnae text, p_uf text, p_cidade text, p_bairro text, p_pagina integer, p_grupo uuid DEFAULT NULL)
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
  IF p_grupo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.grupo_importacao g WHERE g.id = p_grupo AND g.ativo) THEN
    RAISE EXCEPTION 'grupo indisponivel' USING ERRCODE = 'P0002';
  END IF;
  v_busca := '%' || replace(replace(replace(public.sem_acento(p_nome), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  RETURN QUERY
    SELECT e.id, e.razao_social, e.nome_fantasia, e.cnae_principal,
           c.localidade, c.uf::text, nullif(btrim(c.bairro), ''),
           CASE
             WHEN f.vendedor_id = v_eu THEN 'comigo'
             WHEN public.empresa_cliente(e.id) OR dono.ativo THEN 'outro_vendedor'
             WHEN f.reservado_ate > now() THEN
               CASE WHEN f.reservado_por = v_eu THEN 'reservada_comigo' ELSE 'outro_vendedor' END
             WHEN f.elegivel_em > now() THEN 'em_descanso'
             ELSE 'disponivel'
           END
      FROM public.empresa e
      LEFT JOIN public.cep c ON c.cep = e.cep
      LEFT JOIN public.empresa_fila f ON f.empresa_id = e.id
      LEFT JOIN public.usuario dono ON dono.id = f.vendedor_id
     WHERE public.empresa_visivel_prospeccao(e.id) AND (p_grupo IS NULL OR EXISTS (SELECT 1 FROM public.grupo_importacao_empresa ge WHERE ge.empresa_id = e.id AND ge.grupo_id = p_grupo)) AND e.busca LIKE v_busca ESCAPE E'\\'
       AND (p_cnae IS NULL OR (p_cnae = 'nao_informado' AND e.cnae_principal IS NULL) OR e.cnae_principal = p_cnae)
       AND (p_uf IS NULL OR c.uf = p_uf)
       AND (p_cidade IS NULL OR c.ibge = p_cidade)
       AND (p_bairro IS NULL OR nullif(btrim(c.bairro), '') = p_bairro)
     ORDER BY coalesce(e.razao_social,e.nome_fantasia), e.id
     LIMIT 21 OFFSET (p_pagina - 1) * 20;
END;
$$;
CREATE FUNCTION empresa_filtros(p_uf text, p_cidade text, p_grupo uuid DEFAULT NULL)
RETURNS TABLE (tipo text, valor text, rotulo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_ler() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
  IF p_grupo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.grupo_importacao g WHERE g.id = p_grupo AND g.ativo) THEN
    RAISE EXCEPTION 'grupo indisponivel' USING ERRCODE = 'P0002';
  END IF;
  IF (p_uf IS NOT NULL AND p_uf !~ '^[A-Z]{2}$')
     OR (p_cidade IS NOT NULL AND (p_uf IS NULL OR p_cidade !~ '^[0-9]{7}$')) THEN
    RAISE EXCEPTION 'filtro invalido' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    WITH importadas AS (
      SELECT e.cnae_principal, c.uf::text AS estado, c.ibge, c.localidade, nullif(btrim(c.bairro), '') AS bairro
        FROM public.empresa e LEFT JOIN public.cep c ON c.cep = e.cep
       WHERE public.empresa_visivel_prospeccao(e.id) AND (p_grupo IS NULL OR EXISTS (SELECT 1 FROM public.grupo_importacao_empresa ge WHERE ge.empresa_id = e.id AND ge.grupo_id = p_grupo))
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
CREATE FUNCTION grupo_prospeccao_ler(p_grupo uuid)
RETURNS TABLE(id uuid,nome text,descricao text,origem text,criterios text,criado_em timestamptz,total bigint,disponiveis bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_ler() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT g.id,g.nome,g.descricao,g.origem,g.criterios,g.criado_em,
    (SELECT count(DISTINCT ge.empresa_id) FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id=g.id),
    (SELECT count(DISTINCT e.id) FROM public.grupo_importacao_empresa ge
      JOIN public.empresa e ON e.id=ge.empresa_id
      LEFT JOIN public.empresa_fila f ON f.empresa_id=e.id
      LEFT JOIN public.usuario dono ON dono.id=f.vendedor_id
      WHERE ge.grupo_id=g.id AND public.empresa_origem_ativa(e.id) AND NOT public.empresa_cliente(e.id)
        AND (f.vendedor_id IS NULL OR dono.ativo=false)
        AND (f.reservado_ate IS NULL OR f.reservado_ate<=now())
        AND (f.elegivel_em IS NULL OR f.elegivel_em<=now()))
    FROM public.grupo_importacao g WHERE g.id=p_grupo AND g.ativo;
END;
$$;
REVOKE EXECUTE ON FUNCTION fila_reservar(uuid,text,text,text,text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fila_reservar(uuid,text,text,text,text,text,uuid,uuid) TO app_usuario;
REVOKE EXECUTE ON FUNCTION empresa_consultar(text,text,text,text,text,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_consultar(text,text,text,text,text,integer,uuid) TO app_usuario;
REVOKE EXECUTE ON FUNCTION empresa_filtros(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_filtros(text,text,uuid) TO app_usuario;
REVOKE EXECUTE ON FUNCTION grupo_prospeccao_ler(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grupo_prospeccao_ler(uuid) TO app_usuario;
COMMIT;
