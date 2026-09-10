-- ver docs/db/0016.md
BEGIN;
CREATE TABLE empresa_fila (
  empresa_id          uuid PRIMARY KEY REFERENCES empresa (id) ON DELETE RESTRICT,
  vendedor_id         uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  reservado_por       uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  reservado_ate       timestamptz,
  elegivel_em         timestamptz,
  primeira_reserva_em timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  atualizado_em  timestamptz,
  atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT empresa_fila_reserva_coerente CHECK ((reservado_por IS NULL) = (reservado_ate IS NULL)),
  CONSTRAINT empresa_fila_posse_ou_reserva CHECK (vendedor_id IS NULL OR reservado_por IS NULL)
);
CREATE TRIGGER empresa_fila_auditoria BEFORE INSERT OR UPDATE ON empresa_fila
FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
ALTER TABLE empresa_fila ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_fila_leitura ON empresa_fila FOR SELECT
  USING (eh_gestor() OR vendedor_id = usuario_atual() OR reservado_por = usuario_atual());
GRANT SELECT ON empresa_fila TO app_usuario;
DROP POLICY empresa_leitura ON empresa;
CREATE POLICY empresa_leitura ON empresa FOR SELECT USING (
  eh_gestor() OR EXISTS (
    SELECT 1 FROM empresa_fila f
     WHERE f.empresa_id = empresa.id
       AND (f.vendedor_id = usuario_atual()
            OR (f.reservado_por = usuario_atual() AND f.reservado_ate > now()))
  )
);
CREATE FUNCTION fila_puxar() RETURNS TABLE (empresa_id uuid, reservado_ate timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_eu       uuid := public.usuario_atual();
  v_anterior uuid;
  v_empresa  uuid;
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'troque a senha provisoria antes de prospectar' USING ERRCODE = '42501';
  END IF;
  UPDATE public.empresa_fila ef
     SET reservado_por = NULL, reservado_ate = NULL
   WHERE ef.reservado_por = v_eu
   RETURNING ef.empresa_id INTO v_anterior;
  SELECT e.id INTO v_empresa
    FROM public.empresa e
    LEFT JOIN public.empresa_fila f ON f.empresa_id = e.id
    LEFT JOIN public.usuario dono ON dono.id = f.vendedor_id
   WHERE (f.vendedor_id IS NULL OR dono.ativo = false)
     AND (f.reservado_ate IS NULL OR f.reservado_ate < now())
     AND (f.elegivel_em IS NULL OR f.elegivel_em <= now())
     AND e.id IS DISTINCT FROM v_anterior
   ORDER BY f.elegivel_em ASC NULLS FIRST, e.criado_em ASC, e.id ASC
   LIMIT 1
   FOR UPDATE OF e SKIP LOCKED;
  IF v_empresa IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.empresa_fila AS ef (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
  VALUES (v_empresa, v_eu, now() + interval '30 minutes', now())
  ON CONFLICT (empresa_id) DO UPDATE
     SET reservado_por = excluded.reservado_por,
         reservado_ate = excluded.reservado_ate,
         vendedor_id = NULL,
         primeira_reserva_em = coalesce(ef.primeira_reserva_em, excluded.primeira_reserva_em)
  RETURNING ef.empresa_id, ef.reservado_ate INTO empresa_id, reservado_ate;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION fila_puxar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fila_puxar() TO app_usuario;
CREATE FUNCTION empresa_assumir(p_empresa_id uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu   uuid := public.usuario_atual();
  v_dono uuid;
  v_resv uuid;
  v_ate  timestamptz;
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'troque a senha provisoria antes de assumir empresa' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.empresa e WHERE e.id = p_empresa_id FOR UPDATE;
  SELECT f.vendedor_id, f.reservado_por, f.reservado_ate
    INTO v_dono, v_resv, v_ate
    FROM public.empresa_fila f
   WHERE f.empresa_id = p_empresa_id;
  IF NOT FOUND THEN
    RETURN 'nao_encontrada';
  END IF;
  IF v_dono = v_eu THEN
    RETURN 'ja_e_sua';
  END IF;
  IF v_resv = v_eu AND v_ate <= now() THEN
    RETURN 'reserva_expirada';
  END IF;
  IF v_resv IS DISTINCT FROM v_eu THEN
    RAISE EXCEPTION 'esta empresa nao esta com voce' USING ERRCODE = '42501';
  END IF;
  UPDATE public.empresa_fila ef
     SET vendedor_id = v_eu, reservado_por = NULL, reservado_ate = NULL
   WHERE ef.empresa_id = p_empresa_id;
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_assumir(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_assumir(uuid) TO app_usuario;
CREATE FUNCTION empresa_devolver(p_empresa_id uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu   uuid := public.usuario_atual();
  v_dono uuid;
  v_resv uuid;
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'troque a senha provisoria antes de devolver empresa' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.empresa e WHERE e.id = p_empresa_id FOR UPDATE;
  SELECT f.vendedor_id, f.reservado_por
    INTO v_dono, v_resv
    FROM public.empresa_fila f
   WHERE f.empresa_id = p_empresa_id;
  IF NOT FOUND THEN
    RETURN 'nao_encontrada';
  END IF;
  IF NOT COALESCE(v_dono = v_eu OR v_resv = v_eu, false) THEN
    RAISE EXCEPTION 'esta empresa nao esta com voce' USING ERRCODE = '42501';
  END IF;
  UPDATE public.empresa_fila ef
     SET vendedor_id = NULL,
         reservado_por = NULL,
         reservado_ate = NULL,
         elegivel_em = now() + interval '30 days'
   WHERE ef.empresa_id = p_empresa_id;
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_devolver(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_devolver(uuid) TO app_usuario;
COMMIT;
