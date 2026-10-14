-- ver docs/db/0033.md
BEGIN;
ALTER TABLE public.empresa ALTER COLUMN cnpj DROP NOT NULL;
ALTER TABLE public.empresa ALTER COLUMN razao_social DROP NOT NULL;
ALTER TABLE public.empresa ADD CONSTRAINT empresa_nome_conhecido
  CHECK (coalesce(razao_social,nome_fantasia) IS NOT NULL);
ALTER TABLE public.empresa ALTER COLUMN busca SET EXPRESSION AS (
  public.sem_acento(coalesce(razao_social,'') || ' ' || coalesce(nome_fantasia,''))
);
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
     WHERE public.empresa_visivel_prospeccao(e.id) AND e.busca LIKE v_busca ESCAPE E'\\'
       AND (p_cnae IS NULL OR (p_cnae = 'nao_informado' AND e.cnae_principal IS NULL) OR e.cnae_principal = p_cnae)
       AND (p_uf IS NULL OR c.uf = p_uf)
       AND (p_cidade IS NULL OR c.ibge = p_cidade)
       AND (p_bairro IS NULL OR nullif(btrim(c.bairro), '') = p_bairro)
     ORDER BY coalesce(e.razao_social,e.nome_fantasia), e.id
     LIMIT 21 OFFSET (p_pagina - 1) * 20;
END;
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
    WHERE NOT public.empresa_cliente(x.id) AND public.empresa_origem_ativa(x.id) AND f.vendedor_id IS DISTINCT FROM public.usuario_atual()
      AND NOT coalesce(dono.ativo, false)
      AND (f.reservado_ate IS NULL OR f.reservado_ate <= now())
      AND (f.elegivel_em IS NULL OR f.elegivel_em <= now())
    ORDER BY coalesce(x.razao_social,x.nome_fantasia), x.id LIMIT 10
  )) e
    ORDER BY coalesce(e.razao_social,e.nome_fantasia), e.id LIMIT 10;
END;
$$;
COMMIT;
