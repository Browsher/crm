-- ver docs/db/0024.md
BEGIN;
CREATE FUNCTION empresa_consultar(p_nome text, p_cnae text, p_uf text, p_cidade text, p_bairro text, p_pagina integer)
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
     WHERE e.busca LIKE v_busca ESCAPE E'\\'
       AND (p_cnae IS NULL OR (p_cnae = 'nao_informado' AND e.cnae_principal IS NULL) OR e.cnae_principal = p_cnae)
       AND (p_uf IS NULL OR c.uf = p_uf)
       AND (p_cidade IS NULL OR c.ibge = p_cidade)
       AND (p_bairro IS NULL OR nullif(btrim(c.bairro), '') = p_bairro)
     ORDER BY e.razao_social, e.id
     LIMIT 21 OFFSET (p_pagina - 1) * 20;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_consultar(text,text,text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_consultar(text,text,text,text,text,integer) TO app_usuario;
CREATE FUNCTION empresa_filtros(p_uf text, p_cidade text)
RETURNS TABLE (tipo text, valor text, rotulo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_ler() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF (p_uf IS NOT NULL AND p_uf !~ '^[A-Z]{2}$')
     OR (p_cidade IS NOT NULL AND (p_uf IS NULL OR p_cidade !~ '^[0-9]{7}$')) THEN
    RAISE EXCEPTION 'filtro invalido' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    WITH importadas AS (
      SELECT e.cnae_principal, c.uf::text AS estado, c.ibge, c.localidade, nullif(btrim(c.bairro), '') AS bairro
        FROM public.empresa e LEFT JOIN public.cep c ON c.cep = e.cep
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
REVOKE EXECUTE ON FUNCTION empresa_filtros(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_filtros(text,text) TO app_usuario;
COMMIT;
