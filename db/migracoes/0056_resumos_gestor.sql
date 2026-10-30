-- docs/db/0056.md
BEGIN;
CREATE FUNCTION empresa_resumos_base(p_empresas uuid[]) RETURNS TABLE(empresa_id uuid,dados jsonb)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH alvos AS MATERIALIZED (
    SELECT e.id AS empresa_id,v.vendedor_id,e.cnpj FROM public.empresa e LEFT JOIN public.empresa_vinculo v ON v.empresa_id=e.id WHERE e.id=ANY(p_empresas)
  ), estados AS MATERIALIZED (
    SELECT empresa_id,public.empresa_atendimento_motivo(empresa_id) AS motivo FROM alvos
  ), banco AS MATERIALIZED (
    SELECT DISTINCT ON (b.usuario_id,item->>'cnpj') b.usuario_id,item->>'cnpj' cnpj,
      nullif(item->>'bairro','') bairro,nullif(item->>'cidade','') cidade,nullif(item->>'uf','') uf
    FROM public.busca_empresa b JOIN (SELECT DISTINCT vendedor_id FROM alvos WHERE vendedor_id IS NOT NULL) donos ON donos.vendedor_id=b.usuario_id
    CROSS JOIN LATERAL jsonb_array_elements(b.empresas) item
    WHERE EXISTS(SELECT 1 FROM alvos a WHERE a.vendedor_id=b.usuario_id AND a.cnpj=item->>'cnpj') AND b.estado='concluida' AND nullif(item->>'cnpj','') IS NOT NULL
      AND coalesce(nullif(item->>'bairro',''),nullif(item->>'cidade',''),nullif(item->>'uf','')) IS NOT NULL
    ORDER BY b.usuario_id,item->>'cnpj',b.criado_em DESC,b.id DESC
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
    'recebidaEm',v.recebida_em,'versao',v.versao,
    'negociacaoId',n.id,
    'situacao',CASE WHEN estado.motivo IS NOT NULL THEN 'indisponivel'
      WHEN v.arquivada_em IS NOT NULL THEN 'sem_interesse'
      WHEN f.vendedor_id=v.vendedor_id AND public.empresa_cliente(e.id) THEN 'cliente'
      WHEN n.id IS NOT NULL THEN n.etapa
      WHEN v.iniciada_em IS NOT NULL OR f.vendedor_id=v.vendedor_id THEN 'atendimento' ELSE 'a_contatar' END,
    'motivoIndisponibilidade',estado.motivo)
  FROM alvos a JOIN estados estado ON estado.empresa_id=a.empresa_id JOIN public.empresa e ON e.id=a.empresa_id LEFT JOIN public.empresa_vinculo v ON v.empresa_id=e.id
  LEFT JOIN public.empresa_fila f ON f.empresa_id=e.id LEFT JOIN public.empresa_dados_cadastrais d ON d.empresa_id=e.id
  LEFT JOIN public.cep c ON c.cep=e.cep
  LEFT JOIN public.negociacao n ON n.empresa_id=e.id AND n.vendedor_id=v.vendedor_id AND n.encerrada_em IS NULL
  LEFT JOIN LATERAL (SELECT nullif(r.dados->>'bairro','') bairro,nullif(r.dados->>'cidade','') cidade,nullif(r.dados->>'uf','') uf
    FROM public.google_resultado r JOIN public.google_planejamento p ON p.id=r.planejamento_id
    WHERE r.empresa_id=e.id AND r.situacao='entregue' AND p.vendedor_id=v.vendedor_id
      AND coalesce(nullif(r.dados->>'bairro',''),nullif(r.dados->>'cidade',''),nullif(r.dados->>'uf','')) IS NOT NULL
    ORDER BY r.entregue_em DESC,r.id LIMIT 1) g ON true
  LEFT JOIN banco ON banco.cnpj=e.cnpj AND banco.usuario_id=v.vendedor_id;
$$;
REVOKE EXECUTE ON FUNCTION empresa_resumos_base(uuid[]) FROM PUBLIC;
CREATE OR REPLACE FUNCTION empresa_atendimento_resumos(p_vendedor uuid,p_empresa uuid DEFAULT NULL) RETURNS TABLE(empresa_id uuid,dados jsonb)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH ids AS (SELECT coalesce(array_agg(e.id),'{}'::uuid[]) AS empresas FROM public.empresa e
    LEFT JOIN public.empresa_vinculo v ON v.empresa_id=e.id
    WHERE (p_empresa IS NULL AND v.vendedor_id=p_vendedor) OR e.id=p_empresa)
  SELECT r.empresa_id,r.dados || jsonb_build_object(
    'versao',CASE WHEN v.vendedor_id=public.usuario_atual() AND NOT public.eh_gestor() THEN r.dados->'versao' END,
    'negociacaoId',CASE WHEN v.vendedor_id=public.usuario_atual() THEN r.dados->'negociacaoId' END,
    'situacao',CASE WHEN v.vendedor_id<>public.usuario_atual() THEN 'indisponivel' ELSE r.dados->>'situacao' END,
    'motivoIndisponibilidade',coalesce(r.dados->>'motivoIndisponibilidade',CASE WHEN v.vendedor_id<>public.usuario_atual() THEN 'outro_responsavel' END))
  FROM ids CROSS JOIN LATERAL public.empresa_resumos_base(ids.empresas) r LEFT JOIN public.empresa_vinculo v ON v.empresa_id=r.empresa_id;
$$;
REVOKE EXECUTE ON FUNCTION empresa_atendimento_resumos(uuid,uuid) FROM PUBLIC;
CREATE FUNCTION gestor_empresas_resumos_ler(p_empresas uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ids uuid[]; v_empresas jsonb;
BEGIN
  IF NOT public.pode_ler() OR NOT public.eh_gestor() THEN RETURN jsonb_build_object('ok',false,'motivo','sem_permissao'); END IF;
  IF p_empresas IS NULL OR array_position(p_empresas,NULL) IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'motivo','dados_invalidos'); END IF;
  SELECT coalesce(array_agg(DISTINCT id ORDER BY id),'{}'::uuid[]) INTO v_ids FROM unnest(p_empresas) id;
  IF cardinality(v_ids)>100 THEN RETURN jsonb_build_object('ok',false,'motivo','dados_invalidos'); END IF;
  SELECT coalesce(jsonb_agg(r.dados || jsonb_build_object('versao',NULL,'responsavel',
    CASE WHEN u.id IS NOT NULL THEN jsonb_build_object('id',u.id,'nome',u.nome,'ativo',u.ativo) END) ORDER BY r.empresa_id),'[]'::jsonb) INTO v_empresas
  FROM public.empresa_resumos_base(v_ids) r LEFT JOIN public.empresa_vinculo v ON v.empresa_id=r.empresa_id LEFT JOIN public.usuario u ON u.id=v.vendedor_id;
  RETURN jsonb_build_object('ok',true,'empresas',v_empresas);
END;
$$;
REVOKE EXECUTE ON FUNCTION gestor_empresas_resumos_ler(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gestor_empresas_resumos_ler(uuid[]) TO app_usuario;
CREATE OR REPLACE FUNCTION empresa_detalhes_ler(p_empresa uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_dados jsonb;
BEGIN
  IF NOT public.pode_ler() OR NOT (public.eh_gestor() OR EXISTS (SELECT 1 FROM public.empresa_vinculo v WHERE v.empresa_id=p_empresa AND v.vendedor_id=public.usuario_atual())) THEN
    RETURN jsonb_build_object('ok',false,'motivo','sem_permissao');
  END IF;
  SELECT CASE WHEN public.eh_gestor() THEN (public.gestor_empresas_resumos_ler(ARRAY[e.id])->'empresas')->0 ELSE public.empresa_atendimento_resumo(e.id) END || jsonb_build_object(
    'razaoSocial',e.razao_social,'nomeFantasia',e.nome_fantasia,'telefone',e.telefone,'email',e.email,
    'telefones',coalesce(d.telefones,'[]'::jsonb),'logradouro',coalesce(d.logradouro,c.logradouro),'numero',d.numero,
    'complemento',d.complemento,'cep',e.cep,'porte',d.porte,'situacaoCadastral',d.situacao,
    'dataAbertura',d.data_abertura,'dadosCadastrais',d.detalhes) INTO v_dados
  FROM public.empresa e LEFT JOIN public.empresa_dados_cadastrais d ON d.empresa_id=e.id LEFT JOIN public.cep c ON c.cep=e.cep WHERE e.id=p_empresa;
  IF v_dados IS NULL THEN RETURN jsonb_build_object('ok',false,'motivo','nao_encontrada'); END IF;
  RETURN jsonb_build_object('ok',true,'dados',v_dados);
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_detalhes_ler(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION empresa_detalhes_ler(uuid) TO app_usuario;
COMMIT;
