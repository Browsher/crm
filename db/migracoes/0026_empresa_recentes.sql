-- ver docs/db/0026.md
BEGIN;
CREATE TABLE empresa_recente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  acessada_em timestamptz NOT NULL,
  UNIQUE (usuario_id, empresa_id)
);
ALTER TABLE empresa_recente ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_recente_leitura ON empresa_recente FOR SELECT TO app_usuario
  USING (public.pode_ler() AND usuario_id = public.usuario_atual());
GRANT SELECT ON empresa_recente TO app_usuario;
CREATE FUNCTION empresa_recente_gravar(p_usuario uuid, p_empresa uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_usuario IS NULL THEN RETURN false; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_usuario::text, 25));
  IF NOT EXISTS (SELECT 1 FROM public.empresa WHERE id = p_empresa) THEN RETURN false; END IF;
  INSERT INTO public.empresa_recente(usuario_id, empresa_id, acessada_em)
    VALUES (p_usuario, p_empresa, clock_timestamp())
    ON CONFLICT (usuario_id, empresa_id) DO UPDATE SET acessada_em = EXCLUDED.acessada_em;
  DELETE FROM public.empresa_recente r WHERE r.usuario_id = p_usuario AND r.empresa_id IN (
    SELECT x.empresa_id FROM public.empresa_recente x WHERE x.usuario_id = p_usuario
    ORDER BY x.acessada_em DESC, x.empresa_id OFFSET 10
  );
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_recente_gravar(uuid,uuid) FROM PUBLIC;
CREATE FUNCTION empresa_recente_registrar(p_empresa uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(public.usuario_atual()::text, 25));
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  RETURN public.empresa_recente_gravar(public.usuario_atual(), p_empresa);
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_recente_registrar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_recente_registrar(uuid) TO app_usuario;
CREATE FUNCTION contato_atualizar_recente() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public.empresa_recente_gravar(NEW.criado_por, NEW.empresa_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION contato_atualizar_recente() FROM PUBLIC;
CREATE TRIGGER contato_recente AFTER INSERT ON contato
  FOR EACH ROW EXECUTE FUNCTION contato_atualizar_recente();
INSERT INTO empresa_recente(usuario_id, empresa_id, acessada_em)
SELECT usuario_id, empresa_id, acessada_em FROM (
  SELECT criado_por AS usuario_id, empresa_id, max(criado_em) AS acessada_em,
    row_number() OVER (PARTITION BY criado_por ORDER BY max(criado_em) DESC, empresa_id) AS posicao
  FROM contato WHERE criado_por IS NOT NULL GROUP BY criado_por, empresa_id
) historico WHERE posicao <= 10;
CREATE FUNCTION empresa_resumos(p_ids uuid[]) RETURNS TABLE (
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
  WHERE e.id = ANY(p_ids);
$$;
REVOKE EXECUTE ON FUNCTION empresa_resumos(uuid[]) FROM PUBLIC;
CREATE FUNCTION empresa_perfil(p_empresa uuid) RETURNS TABLE (
  id uuid, razao_social text, nome_fantasia text, cnae_principal text,
  cidade text, uf text, bairro text, disponibilidade text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_ler() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT r.* FROM public.empresa_resumos(ARRAY[p_empresa]) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_perfil(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_perfil(uuid) TO app_usuario;
CREATE FUNCTION empresa_recentes() RETURNS TABLE (
  id uuid, razao_social text, nome_fantasia text, cnae_principal text,
  cidade text, uf text, bairro text, disponibilidade text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_ler() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT e.* FROM public.empresa_recente r JOIN public.empresa_resumos(ARRAY(
    SELECT x.empresa_id FROM public.empresa_recente x WHERE x.usuario_id = public.usuario_atual()
    ORDER BY x.acessada_em DESC, x.empresa_id LIMIT 10
  )) e ON e.id = r.empresa_id
    WHERE r.usuario_id = public.usuario_atual() ORDER BY r.acessada_em DESC, r.empresa_id LIMIT 10;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_recentes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_recentes() TO app_usuario;
CREATE FUNCTION empresa_sugestoes() RETURNS TABLE (
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
    WHERE f.vendedor_id IS DISTINCT FROM public.usuario_atual()
      AND NOT coalesce(dono.ativo, false)
      AND (f.reservado_ate IS NULL OR f.reservado_ate <= now())
      AND (f.elegivel_em IS NULL OR f.elegivel_em <= now())
    ORDER BY x.razao_social, x.id LIMIT 10
  )) e
    ORDER BY e.razao_social, e.id LIMIT 10;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_sugestoes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_sugestoes() TO app_usuario;
COMMIT;
