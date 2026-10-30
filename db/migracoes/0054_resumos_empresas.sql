-- docs/db/0054.md
BEGIN;

CREATE FUNCTION empresas_resumos_ler(p_empresas uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid := public.usuario_atual(); v_ids uuid[]; v_empresas jsonb;
BEGIN
  IF NOT public.pode_ler() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_eu AND papel='vendedor' AND ativo) THEN
    RETURN jsonb_build_object('ok',false,'motivo','sem_permissao');
  END IF;
  IF p_empresas IS NULL OR array_position(p_empresas,NULL) IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'motivo','dados_invalidos');
  END IF;
  SELECT coalesce(array_agg(DISTINCT id),'{}'::uuid[]) INTO v_ids FROM unnest(p_empresas) id;
  IF cardinality(v_ids)>100 THEN RETURN jsonb_build_object('ok',false,'motivo','dados_invalidos'); END IF;
  IF cardinality(v_ids)=0 THEN RETURN jsonb_build_object('ok',true,'empresas','[]'::jsonb); END IF;
  SELECT coalesce(jsonb_agg(r.dados ORDER BY r.empresa_id),'[]'::jsonb) INTO v_empresas
  FROM public.empresa_atendimento_resumos(v_eu) r
  JOIN public.empresa_vinculo v ON v.empresa_id=r.empresa_id AND v.vendedor_id=v_eu
  WHERE r.empresa_id=ANY(v_ids);
  RETURN jsonb_build_object('ok',true,'empresas',v_empresas);
END $$;
REVOKE EXECUTE ON FUNCTION empresas_resumos_ler(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresas_resumos_ler(uuid[]) TO app_usuario;
COMMIT;
