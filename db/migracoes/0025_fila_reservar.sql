-- ver docs/db/0025.md
BEGIN;
CREATE TABLE fila_contexto (
  usuario_id uuid PRIMARY KEY REFERENCES usuario(id) ON DELETE RESTRICT,
  versao uuid NOT NULL DEFAULT gen_random_uuid()
);
ALTER TABLE fila_contexto ENABLE ROW LEVEL SECURITY;
CREATE POLICY fila_contexto_leitura ON fila_contexto FOR SELECT
  USING (pode_ler() AND usuario_id = usuario_atual());
GRANT SELECT ON fila_contexto TO app_usuario;
CREATE FUNCTION fila_reservar(p_alvo uuid, p_nome text, p_cnae text, p_uf text, p_cidade text, p_bairro text, p_contexto_esperado uuid)
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
       WHERE e.id IS DISTINCT FROM v_anterior AND NOT (e.id = ANY(v_excluidas))
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
    IF (v_fila.vendedor_id IS NULL OR v_dono_ativo = false)
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
REVOKE EXECUTE ON FUNCTION fila_reservar(uuid,text,text,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fila_reservar(uuid,text,text,text,text,text,uuid) TO app_usuario;
REVOKE EXECUTE ON FUNCTION fila_puxar() FROM app_usuario;
ALTER FUNCTION contato_registrar(uuid,text,text,text,date,text) RENAME TO contato_registrar_interno;
REVOKE EXECUTE ON FUNCTION contato_registrar_interno(uuid,text,text,text,date,text) FROM app_usuario;
CREATE FUNCTION contato_registrar(p_empresa_id uuid, p_tipo text, p_nota text, p_proximo_passo text, p_proximo_passo_data date, p_desfecho text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_fila public.empresa_fila%ROWTYPE;
  v_resultado text;
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_eu::text, 25));
  PERFORM 1 FROM public.empresa e WHERE e.id = p_empresa_id FOR UPDATE;
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  SELECT f.* INTO v_fila FROM public.empresa_fila f WHERE f.empresa_id = p_empresa_id;
  IF v_fila.reservado_por = v_eu AND v_fila.reservado_ate <= clock_timestamp() THEN
    RETURN 'reserva_expirada';
  END IF;
  v_resultado := public.contato_registrar_interno(p_empresa_id,p_tipo,p_nota,p_proximo_passo,p_proximo_passo_data,p_desfecho);
  IF v_resultado = 'ok' AND v_fila.reservado_por = v_eu AND p_desfecho IN ('assumir','devolver') THEN
    INSERT INTO public.fila_contexto AS fc (usuario_id) VALUES (v_eu)
    ON CONFLICT (usuario_id) DO UPDATE SET versao = gen_random_uuid();
  END IF;
  RETURN v_resultado;
END;
$$;
REVOKE EXECUTE ON FUNCTION contato_registrar(uuid,text,text,text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION contato_registrar(uuid,text,text,text,date,text) TO app_usuario;
COMMIT;
