-- ver docs/db/0062.md
BEGIN;
CREATE FUNCTION busca_empresa_reservar_casa_com_exclusoes(p_chave uuid,p_nome text,p_filtros jsonb)
RETURNS TABLE(resultado text,cnpjs_excluidos text[])
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  resultado := public.busca_empresa_reservar_casa(p_chave,p_nome,p_filtros);
  cnpjs_excluidos := ARRAY[]::text[];
  IF resultado = 'ok' THEN
    cnpjs_excluidos := ARRAY(
      SELECT e.cnpj
      FROM public.empresa_vinculo v
      JOIN public.empresa e ON e.id = v.empresa_id
      WHERE v.origem_inicial = 'banco' AND e.cnpj IS NOT NULL
      ORDER BY e.cnpj
    );
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION busca_empresa_reservar_casa_com_exclusoes(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION busca_empresa_reservar_casa_com_exclusoes(uuid,text,jsonb) TO app_usuario;
COMMIT;
