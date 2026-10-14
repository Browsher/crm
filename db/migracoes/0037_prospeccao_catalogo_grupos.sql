-- ver docs/db/0037.md
BEGIN;
CREATE FUNCTION grupo_prospeccao_contagens(p_grupo uuid)
RETURNS TABLE(total integer,disponiveis integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    (SELECT count(DISTINCT ge.empresa_id)::integer FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id=p_grupo),
    (SELECT count(DISTINCT e.id)::integer FROM public.grupo_importacao_empresa ge
      JOIN public.empresa e ON e.id=ge.empresa_id
      LEFT JOIN public.empresa_fila f ON f.empresa_id=e.id
      LEFT JOIN public.usuario dono ON dono.id=f.vendedor_id
      WHERE ge.grupo_id=p_grupo AND public.empresa_origem_ativa(e.id) AND NOT public.empresa_cliente(e.id)
        AND (f.vendedor_id IS NULL OR dono.ativo=false)
        AND (f.reservado_ate IS NULL OR f.reservado_ate<=now())
        AND (f.elegivel_em IS NULL OR f.elegivel_em<=now()));
$$;
REVOKE EXECUTE ON FUNCTION grupo_prospeccao_contagens(uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION grupo_prospeccao_ler(p_grupo uuid)
RETURNS TABLE(id uuid,nome text,descricao text,origem text,criterios text,criado_em timestamptz,total bigint,disponiveis bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_ler() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT g.id,g.nome,g.descricao,g.origem,g.criterios,g.criado_em,c.total::bigint,c.disponiveis::bigint
    FROM public.grupo_importacao g CROSS JOIN LATERAL public.grupo_prospeccao_contagens(g.id) c
    WHERE g.id=p_grupo AND g.ativo;
END;
$$;
CREATE FUNCTION grupos_prospeccao_listar(p_pagina integer DEFAULT 1)
RETURNS TABLE(id uuid,nome text,descricao text,origem text,criterios text,criado_em timestamptz,total bigint,disponiveis bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_ler() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
  IF p_pagina IS NULL OR p_pagina < 1 OR p_pagina > 10000 THEN
    RAISE EXCEPTION 'pagina invalida' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT g.id,g.nome,g.descricao,g.origem,g.criterios,g.criado_em,c.total::bigint,c.disponiveis::bigint
    FROM (SELECT x.id,x.nome,x.descricao,x.origem,x.criterios,x.criado_em FROM public.grupo_importacao x
      WHERE x.ativo ORDER BY x.criado_em DESC,x.id DESC LIMIT 21 OFFSET (p_pagina-1)*20) g
    CROSS JOIN LATERAL public.grupo_prospeccao_contagens(g.id) c
    ORDER BY g.criado_em DESC,g.id DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION grupos_prospeccao_listar(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grupos_prospeccao_listar(integer) TO app_usuario;
COMMIT;
