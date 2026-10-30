-- docs/db/0055.md
BEGIN;
CREATE FUNCTION empresa_origem_ativa_para(p_empresa uuid,p_vendedor uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT NOT EXISTS(SELECT 1 FROM public.google_exclusividade g WHERE g.empresa_id=p_empresa AND g.vendedor_id<>p_vendedor)
    AND (EXISTS(SELECT 1 FROM public.grupo_importacao_empresa ge JOIN public.grupo_importacao g ON g.id=ge.grupo_id WHERE ge.empresa_id=p_empresa AND g.ativo)
      OR EXISTS(SELECT 1 FROM public.google_exclusividade g WHERE g.empresa_id=p_empresa));
$$;
REVOKE EXECUTE ON FUNCTION empresa_origem_ativa_para(uuid,uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION empresa_origem_ativa(p_empresa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.empresa_origem_ativa_para(p_empresa,CASE WHEN public.eh_gestor()
    THEN (SELECT vendedor_id FROM public.google_exclusividade WHERE empresa_id=p_empresa) ELSE public.usuario_atual() END);
$$;
REVOKE EXECUTE ON FUNCTION empresa_origem_ativa(uuid) FROM PUBLIC;
CREATE FUNCTION empresa_atendimento_motivo(p_empresa uuid) RETURNS text
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN e.id IS NULL OR p.empresa_id IS NOT NULL OR v.empresa_id IS NULL THEN 'pendente'
    WHEN NOT coalesce(u.ativo AND u.papel='vendedor',false) THEN 'responsavel_inativo'
    WHEN NOT public.empresa_origem_ativa_para(e.id,v.vendedor_id) THEN 'origem_inativa' END
  FROM (SELECT p_empresa AS id) alvo LEFT JOIN public.empresa e ON e.id=alvo.id
  LEFT JOIN public.empresa_vinculo v ON v.empresa_id=e.id LEFT JOIN public.usuario u ON u.id=v.vendedor_id
  LEFT JOIN public.empresa_vinculo_pendencia p ON p.empresa_id=e.id;
$$;
REVOKE EXECUTE ON FUNCTION empresa_atendimento_motivo(uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION empresa_atendimento_resumos(p_vendedor uuid,p_empresa uuid DEFAULT NULL) RETURNS TABLE(empresa_id uuid,dados jsonb)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH alvos AS MATERIALIZED (
    SELECT v.empresa_id FROM public.empresa_vinculo v WHERE p_empresa IS NULL AND v.vendedor_id=p_vendedor
    UNION ALL SELECT p_empresa WHERE p_empresa IS NOT NULL
  ), estados AS MATERIALIZED (
    SELECT empresa_id,public.empresa_atendimento_motivo(empresa_id) AS motivo FROM alvos
  ), banco AS MATERIALIZED (
    SELECT DISTINCT ON (item->>'cnpj') item->>'cnpj' cnpj,
      nullif(item->>'bairro','') bairro,nullif(item->>'cidade','') cidade,nullif(item->>'uf','') uf
    FROM public.busca_empresa b CROSS JOIN LATERAL jsonb_array_elements(b.empresas) item
    WHERE b.usuario_id=p_vendedor AND b.estado='concluida' AND nullif(item->>'cnpj','') IS NOT NULL
      AND coalesce(nullif(item->>'bairro',''),nullif(item->>'cidade',''),nullif(item->>'uf','')) IS NOT NULL
    ORDER BY item->>'cnpj',b.criado_em DESC,b.id DESC
  )
  SELECT e.id,jsonb_build_object(
    'referencia',jsonb_build_object('tipo','cadastro','empresaId',e.id),'id',e.id,
    'nome',coalesce(e.nome_fantasia,e.razao_social,'Não informado'),'cnpj',e.cnpj,'cnae',e.cnae_principal,'atividade',NULL,
    'bairro',coalesce(c.bairro,d.bairro,g.bairro,banco.bairro),'cidade',coalesce(c.localidade,d.cidade,g.cidade,banco.cidade),
    'uf',coalesce(c.uf::text,d.uf,g.uf,banco.uf),
    'origens',coalesce((SELECT jsonb_agg(origem ORDER BY origem) FROM (
      SELECT v.origem_inicial origem WHERE v.origem_inicial IS NOT NULL
      UNION SELECT 'google' WHERE EXISTS (SELECT 1 FROM public.google_resultado r JOIN public.google_planejamento p ON p.id=r.planejamento_id WHERE r.empresa_id=e.id AND r.situacao='entregue' AND p.vendedor_id=v.vendedor_id)
      UNION SELECT 'banco' WHERE EXISTS (SELECT 1 FROM public.busca_empresa b JOIN public.grupo_importacao_empresa ge ON ge.grupo_id=b.grupo_id WHERE ge.empresa_id=e.id AND b.usuario_id=v.vendedor_id AND b.estado='concluida')
    ) o),'[]'::jsonb),
    'recebidaEm',v.recebida_em,'versao',CASE WHEN v.vendedor_id=public.usuario_atual() AND NOT public.eh_gestor() THEN v.versao END,
    'negociacaoId',CASE WHEN v.vendedor_id=public.usuario_atual() THEN n.id END,
    'situacao',CASE WHEN estado.motivo IS NOT NULL OR v.vendedor_id<>public.usuario_atual() THEN 'indisponivel'
      WHEN v.arquivada_em IS NOT NULL THEN 'sem_interesse'
      WHEN f.vendedor_id=v.vendedor_id AND public.empresa_cliente(e.id) THEN 'cliente'
      WHEN n.id IS NOT NULL THEN n.etapa
      WHEN v.iniciada_em IS NOT NULL OR f.vendedor_id=v.vendedor_id THEN 'atendimento' ELSE 'a_contatar' END,
    'motivoIndisponibilidade',CASE WHEN estado.motivo IS NOT NULL THEN estado.motivo
      WHEN v.vendedor_id<>public.usuario_atual() THEN 'outro_responsavel' END)
  FROM alvos a JOIN estados estado ON estado.empresa_id=a.empresa_id JOIN public.empresa e ON e.id=a.empresa_id LEFT JOIN public.empresa_vinculo v ON v.empresa_id=e.id
  LEFT JOIN public.empresa_fila f ON f.empresa_id=e.id LEFT JOIN public.empresa_dados_cadastrais d ON d.empresa_id=e.id
  LEFT JOIN public.cep c ON c.cep=e.cep
  LEFT JOIN public.negociacao n ON n.empresa_id=e.id AND n.vendedor_id=v.vendedor_id AND n.encerrada_em IS NULL
  LEFT JOIN LATERAL (SELECT nullif(r.dados->>'bairro','') bairro,nullif(r.dados->>'cidade','') cidade,nullif(r.dados->>'uf','') uf
    FROM public.google_resultado r JOIN public.google_planejamento p ON p.id=r.planejamento_id
    WHERE r.empresa_id=e.id AND r.situacao='entregue' AND p.vendedor_id=v.vendedor_id
      AND coalesce(nullif(r.dados->>'bairro',''),nullif(r.dados->>'cidade',''),nullif(r.dados->>'uf','')) IS NOT NULL
    ORDER BY r.entregue_em DESC,r.id LIMIT 1) g ON true
  LEFT JOIN banco ON banco.cnpj=e.cnpj;
$$;
REVOKE EXECUTE ON FUNCTION empresa_atendimento_resumos(uuid,uuid) FROM PUBLIC;
CREATE FUNCTION empresas_disponibilidade_ler(p_empresas uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid:=public.usuario_atual(); v_ids uuid[]; v_empresas jsonb;
BEGIN
  IF NOT public.pode_ler() OR NOT EXISTS(SELECT 1 FROM public.usuario WHERE id=v_eu AND ativo AND papel IN ('vendedor','gestor')) THEN
    RETURN jsonb_build_object('ok',false,'motivo','sem_permissao');
  END IF;
  IF p_empresas IS NULL OR array_position(p_empresas,NULL) IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'motivo','dados_invalidos');
  END IF;
  SELECT coalesce(array_agg(DISTINCT id ORDER BY id),'{}'::uuid[]) INTO v_ids FROM unnest(p_empresas) id;
  IF cardinality(v_ids)>100 THEN RETURN jsonb_build_object('ok',false,'motivo','dados_invalidos'); END IF;
  WITH autorizadas AS MATERIALIZED (
    SELECT e.id,public.empresa_atendimento_motivo(e.id) AS motivo FROM public.empresa e
    LEFT JOIN public.empresa_vinculo v ON v.empresa_id=e.id
    WHERE e.id=ANY(v_ids) AND (public.eh_gestor() OR v.vendedor_id=v_eu)
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('empresaId',id,'disponivel',motivo IS NULL,'motivo',motivo) ORDER BY id),'[]'::jsonb)
    INTO v_empresas FROM autorizadas;
  RETURN jsonb_build_object('ok',true,'empresas',v_empresas);
END;
$$;
REVOKE EXECUTE ON FUNCTION empresas_disponibilidade_ler(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresas_disponibilidade_ler(uuid[]) TO app_usuario;
COMMIT;
