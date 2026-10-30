-- docs/db/0060.md
BEGIN;
CREATE TABLE arquivo_legado_operacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manifesto jsonb NOT NULL CHECK (jsonb_typeof(manifesto)='object'),
  assinatura text NOT NULL UNIQUE CHECK (assinatura ~ '^[0-9a-f]{64}$'),
  backup_sha256 text NOT NULL CHECK (backup_sha256 ~ '^[0-9a-f]{64}$'),
  aplicado_em timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE arquivo_legado_operacao ENABLE ROW LEVEL SECURITY;
CREATE TABLE empresa_arquivo (
  empresa_id uuid PRIMARY KEY REFERENCES empresa(id) ON DELETE RESTRICT,
  operacao_id uuid NOT NULL REFERENCES arquivo_legado_operacao(id) ON DELETE RESTRICT,
  arquivada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  motivo text NOT NULL DEFAULT 'arquivamento_legado' CHECK (motivo='arquivamento_legado'),
  agenda_cancelada jsonb
);
ALTER TABLE empresa_arquivo ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_arquivo_leitura ON empresa_arquivo FOR SELECT TO app_usuario
USING (pode_ler() AND (eh_gestor() OR EXISTS(SELECT 1 FROM empresa_vinculo v WHERE v.empresa_id=empresa_arquivo.empresa_id AND v.vendedor_id=usuario_atual())));
GRANT SELECT ON empresa_arquivo TO app_usuario;
CREATE TABLE grupo_importacao_arquivo (
  grupo_id uuid PRIMARY KEY REFERENCES grupo_importacao(id) ON DELETE RESTRICT,
  operacao_id uuid NOT NULL REFERENCES arquivo_legado_operacao(id) ON DELETE RESTRICT,
  arquivada_em timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE grupo_importacao_arquivo ENABLE ROW LEVEL SECURITY;
CREATE POLICY grupo_arquivo_leitura ON grupo_importacao_arquivo FOR SELECT TO app_usuario USING (eh_gestor());
GRANT SELECT ON grupo_importacao_arquivo TO app_usuario;
ALTER TABLE empresa_vinculo_pendencia ADD COLUMN resolvida_por_arquivo_em timestamptz;
ALTER TABLE negociacao DROP CONSTRAINT negociacao_encerramento_check;
ALTER TABLE negociacao ADD CONSTRAINT negociacao_encerramento_check CHECK (encerramento IN ('venda','devolucao','inatividade','sem_interesse','arquivamento_legado'));

CREATE FUNCTION arquivo_escrita_serializar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27,1);
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION arquivo_escrita_serializar() FROM PUBLIC;
CREATE FUNCTION empresa_arquivo_bloquear_escrita() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_anterior uuid;
BEGIN
  v_id:=CASE WHEN TG_TABLE_NAME='empresa' THEN (to_jsonb(NEW)->>'id')::uuid ELSE (to_jsonb(NEW)->>'empresa_id')::uuid END;
  IF TG_OP<>'INSERT' THEN v_anterior:=CASE WHEN TG_TABLE_NAME='empresa' THEN (to_jsonb(OLD)->>'id')::uuid ELSE (to_jsonb(OLD)->>'empresa_id')::uuid END; END IF;
  IF EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id IN (v_id,v_anterior)) THEN
    RAISE EXCEPTION 'empresa arquivada: somente consulta' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='grupo_importacao_empresa' AND EXISTS(SELECT 1 FROM public.grupo_importacao_arquivo WHERE grupo_id IN ((to_jsonb(NEW)->>'grupo_id')::uuid,(to_jsonb(OLD)->>'grupo_id')::uuid)) THEN
    RAISE EXCEPTION 'lista arquivada: somente consulta' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_arquivo_bloquear_escrita() FROM PUBLIC;
CREATE FUNCTION grupo_arquivo_bloquear_escrita() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.grupo_importacao_arquivo WHERE grupo_id=OLD.id) THEN
    RAISE EXCEPTION 'lista arquivada: somente consulta' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION grupo_arquivo_bloquear_escrita() FROM PUBLIC;
CREATE TRIGGER grupo_arquivo_guardar BEFORE UPDATE ON grupo_importacao FOR EACH ROW EXECUTE FUNCTION grupo_arquivo_bloquear_escrita();
DO $$
DECLARE v_tabela text;
BEGIN
  FOREACH v_tabela IN ARRAY ARRAY['empresa','empresa_vinculo','empresa_vinculo_pendencia','empresa_fila','contato','negociacao','venda','empresa_dados_cadastrais','empresa_origem_google','google_exclusividade','grupo_importacao_empresa','empresa_recente'] LOOP
    EXECUTE format('CREATE TRIGGER arquivo_serializar BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.arquivo_escrita_serializar()',v_tabela);
    EXECUTE format('CREATE TRIGGER arquivo_guardar BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.empresa_arquivo_bloquear_escrita()',v_tabela);
  END LOOP;
END;
$$;
CREATE TRIGGER arquivo_serializar BEFORE INSERT OR UPDATE OR DELETE ON grupo_importacao FOR EACH STATEMENT EXECUTE FUNCTION arquivo_escrita_serializar();

CREATE FUNCTION arquivo_legado_manifesto(p_grupos uuid[]) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_grupos uuid[]; v_empresas uuid[]; v_resultado jsonb; v_tabela text; v_linhas jsonb;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  SELECT array_agg(DISTINCT id ORDER BY id) INTO v_grupos FROM unnest(p_grupos) id;
  IF p_grupos IS NULL OR array_position(p_grupos,NULL) IS NOT NULL OR coalesce(cardinality(v_grupos),0)=0
    OR (SELECT count(*) FROM public.grupo_importacao WHERE id=ANY(v_grupos))<>cardinality(v_grupos) THEN
    RAISE EXCEPTION 'conjunto de listas invalido' USING ERRCODE='22023'; END IF;
  PERFORM id FROM public.grupo_importacao WHERE id=ANY(v_grupos) ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM unnest(v_grupos) g(id) WHERE NOT EXISTS(SELECT 1 FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id=g.id)) THEN
    RAISE EXCEPTION 'lista vazia' USING ERRCODE='22023'; END IF;
  SELECT array_agg(DISTINCT empresa_id ORDER BY empresa_id) INTO v_empresas FROM public.grupo_importacao_empresa WHERE grupo_id=ANY(v_grupos);
  PERFORM id FROM public.empresa WHERE id=ANY(v_empresas) ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.grupo_importacao_empresa WHERE empresa_id=ANY(v_empresas) AND NOT grupo_id=ANY(v_grupos)) THEN
    RAISE EXCEPTION 'empresa compartilhada com outra lista' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=ANY(v_empresas)) OR EXISTS(SELECT 1 FROM public.grupo_importacao_arquivo WHERE grupo_id=ANY(v_grupos)) THEN
    RAISE EXCEPTION 'conjunto ja arquivado' USING ERRCODE='22023'; END IF;
  SELECT jsonb_build_object('versao',1,'banco',current_database(),'gruposIds',to_jsonb(v_grupos),'empresasIds',to_jsonb(v_empresas),
    'grupos',(SELECT jsonb_agg(to_jsonb(g) ORDER BY id) FROM public.grupo_importacao g WHERE id=ANY(v_grupos)),
    'membros',(SELECT jsonb_agg(to_jsonb(ge) ORDER BY grupo_id,empresa_id) FROM public.grupo_importacao_empresa ge WHERE empresa_id=ANY(v_empresas)),
    'empresas',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.empresa e WHERE id=ANY(v_empresas))) INTO v_resultado;
  FOREACH v_tabela IN ARRAY ARRAY['empresa_vinculo','empresa_vinculo_pendencia','empresa_fila','contato','negociacao','venda','empresa_dados_cadastrais','empresa_origem_google','google_exclusividade','empresa_recente','empresa_atendimento_operacao'] LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(linha ORDER BY linha::text),''[]''::jsonb) FROM (SELECT to_jsonb(t) linha FROM public.%I t WHERE empresa_id=ANY($1)) s',v_tabela) INTO v_linhas USING v_empresas;
    v_resultado:=v_resultado||jsonb_build_object(v_tabela,v_linhas);
  END LOOP;
  SELECT v_resultado||jsonb_build_object('google_resultado',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.google_resultado r WHERE r.empresa_id=ANY(v_empresas)),'[]'::jsonb),
    'busca_empresa',coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM public.busca_empresa b WHERE b.grupo_id=ANY(v_grupos)),'[]'::jsonb),
    'google_grupo',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY grupo_id) FROM public.google_grupo g WHERE grupo_id=ANY(v_grupos)),'[]'::jsonb)) INTO v_resultado;
  RETURN v_resultado;
END;
$$;
REVOKE EXECUTE ON FUNCTION arquivo_legado_manifesto(uuid[]) FROM PUBLIC,app_usuario;
CREATE FUNCTION arquivo_legado_aplicar(p_manifesto jsonb,p_backup_sha256 text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_grupos uuid[]; v_empresas uuid[]; v_atual jsonb; v_id uuid;
BEGIN
  IF p_backup_sha256 IS NULL OR p_backup_sha256 !~ '^[0-9a-f]{64}$' OR p_manifesto IS NULL OR p_manifesto->>'versao'<>'1' THEN
    RAISE EXCEPTION 'manifesto e copia recuperavel obrigatorios' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  SELECT id INTO v_id FROM public.arquivo_legado_operacao WHERE manifesto=p_manifesto AND backup_sha256=p_backup_sha256;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'repetida',true,'operacaoId',v_id); END IF;
  SELECT array_agg(value::uuid ORDER BY value) INTO v_grupos FROM jsonb_array_elements_text(p_manifesto->'gruposIds');
  v_atual:=public.arquivo_legado_manifesto(v_grupos);
  IF v_atual IS DISTINCT FROM p_manifesto THEN RAISE EXCEPTION 'manifesto divergente: refaca simulacao e copia' USING ERRCODE='22023'; END IF;
  SELECT array_agg(value::uuid ORDER BY value) INTO v_empresas FROM jsonb_array_elements_text(p_manifesto->'empresasIds');
  INSERT INTO public.arquivo_legado_operacao(manifesto,assinatura,backup_sha256) VALUES(p_manifesto,encode(sha256(convert_to(p_manifesto::text,'UTF8')),'hex'),p_backup_sha256) RETURNING id INTO v_id;
  UPDATE public.empresa_vinculo SET agenda_contato_id=NULL,versao=versao+1 WHERE empresa_id=ANY(v_empresas);
  UPDATE public.empresa_vinculo_pendencia SET resolvida_por_arquivo_em=clock_timestamp() WHERE empresa_id=ANY(v_empresas);
  UPDATE public.negociacao SET encerrada_em=clock_timestamp(),encerramento='arquivamento_legado' WHERE empresa_id=ANY(v_empresas) AND encerrada_em IS NULL;
  UPDATE public.grupo_importacao SET ativo=false WHERE id=ANY(v_grupos);
  INSERT INTO public.empresa_arquivo(empresa_id,operacao_id,agenda_cancelada)
    SELECT e,v_id,(SELECT to_jsonb(c) FROM public.contato c WHERE c.id=(SELECT (x->>'agenda_contato_id')::uuid FROM jsonb_array_elements(p_manifesto->'empresa_vinculo') x WHERE x->>'empresa_id'=e::text))
    FROM unnest(v_empresas) e;
  INSERT INTO public.grupo_importacao_arquivo(grupo_id,operacao_id) SELECT g,v_id FROM unnest(v_grupos) g;
  RETURN jsonb_build_object('ok',true,'repetida',false,'operacaoId',v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION arquivo_legado_aplicar(jsonb,text) FROM PUBLIC,app_usuario;
CREATE FUNCTION busca_empresa_snapshot_ativo(p_busca uuid,p_cnpj text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.pode_ler() AND EXISTS(SELECT 1 FROM public.busca_empresa b WHERE b.id=p_busca AND b.usuario_id=public.usuario_atual()
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(b.empresas) item WHERE item->>'cnpj'=p_cnpj))
    AND NOT EXISTS(SELECT 1 FROM public.empresa e JOIN public.empresa_arquivo a ON a.empresa_id=e.id WHERE e.cnpj=p_cnpj);
$$;
REVOKE EXECUTE ON FUNCTION busca_empresa_snapshot_ativo(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION busca_empresa_snapshot_ativo(uuid,text) TO app_usuario;
CREATE OR REPLACE FUNCTION empresa_origem_ativa_para(p_empresa uuid,p_vendedor uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT NOT EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=p_empresa) AND NOT EXISTS(SELECT 1 FROM public.google_exclusividade g WHERE g.empresa_id=p_empresa AND g.vendedor_id<>p_vendedor)
    AND (EXISTS(SELECT 1 FROM public.grupo_importacao_empresa ge JOIN public.grupo_importacao g ON g.id=ge.grupo_id WHERE ge.empresa_id=p_empresa AND g.ativo)
      OR EXISTS(SELECT 1 FROM public.google_exclusividade g WHERE g.empresa_id=p_empresa));
$$;

CREATE OR REPLACE FUNCTION empresa_atendimento_motivo(p_empresa uuid) RETURNS text
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=p_empresa) THEN 'arquivada' WHEN e.id IS NULL OR p.empresa_id IS NOT NULL OR v.empresa_id IS NULL THEN 'pendente'
    WHEN NOT coalesce(u.ativo AND u.papel='vendedor',false) THEN 'responsavel_inativo'
    WHEN NOT public.empresa_origem_ativa_para(e.id,v.vendedor_id) THEN 'origem_inativa' END
  FROM (SELECT p_empresa AS id) alvo LEFT JOIN public.empresa e ON e.id=alvo.id
  LEFT JOIN public.empresa_vinculo v ON v.empresa_id=e.id LEFT JOIN public.usuario u ON u.id=v.vendedor_id
  LEFT JOIN public.empresa_vinculo_pendencia p ON p.empresa_id=e.id;
$$;

CREATE OR REPLACE FUNCTION empresa_resumos_base(p_empresas uuid[]) RETURNS TABLE(empresa_id uuid,dados jsonb)
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
    'situacao',CASE WHEN EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=e.id) THEN 'arquivada' WHEN estado.motivo IS NOT NULL THEN 'indisponivel'
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

CREATE OR REPLACE FUNCTION empresa_atendimento_resumos(p_vendedor uuid,p_empresa uuid DEFAULT NULL) RETURNS TABLE(empresa_id uuid,dados jsonb)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH ids AS (SELECT coalesce(array_agg(e.id),'{}'::uuid[]) AS empresas FROM public.empresa e
    LEFT JOIN public.empresa_vinculo v ON v.empresa_id=e.id
    WHERE (p_empresa IS NULL AND v.vendedor_id=p_vendedor) OR e.id=p_empresa)
  SELECT r.empresa_id,r.dados || jsonb_build_object(
    'versao',CASE WHEN v.vendedor_id=public.usuario_atual() AND NOT public.eh_gestor() THEN r.dados->'versao' END,
    'negociacaoId',CASE WHEN v.vendedor_id=public.usuario_atual() THEN r.dados->'negociacaoId' END,
    'situacao',CASE WHEN r.dados->>'situacao'='arquivada' THEN 'arquivada' WHEN v.vendedor_id<>public.usuario_atual() THEN 'indisponivel' ELSE r.dados->>'situacao' END,
    'motivoIndisponibilidade',coalesce(r.dados->>'motivoIndisponibilidade',CASE WHEN v.vendedor_id<>public.usuario_atual() THEN 'outro_responsavel' END))
  FROM ids CROSS JOIN LATERAL public.empresa_resumos_base(ids.empresas) r LEFT JOIN public.empresa_vinculo v ON v.empresa_id=r.empresa_id;
$$;

CREATE OR REPLACE FUNCTION prospeccao_pessoal(p jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid := public.usuario_atual(); v_resultado jsonb; v_pagina integer;
BEGIN
  IF NOT public.pode_ler() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_eu AND papel='vendedor') THEN
    RAISE EXCEPTION 'sem permissao' USING ERRCODE='42501';
  END IF;
  IF p IS NULL OR jsonb_typeof(p)<>'object' OR (p-ARRAY['origem','nicho','endereco','nome','cnpj','cnae','uf','cidade','cep','disponibilidade','porte','aberturaDe','aberturaAte','pagina'])<>'{}'::jsonb
    OR EXISTS (SELECT 1 FROM jsonb_each(p) j WHERE jsonb_typeof(j.value)<>'string' OR length(j.value#>>'{}')>200 OR j.value#>>'{}' ~ '[[:cntrl:]]' OR j.value#>>'{}' ~ U&'[\0080-\009F]')
    OR coalesce(p->>'origem','') NOT IN ('','google','banco')
    OR coalesce(p->>'disponibilidade','') NOT IN ('','disponivel','comigo','sem_interesse')
    OR coalesce(p->>'porte','') NOT IN ('','MEI','ME','EPP','DEMAIS','sem')
    OR coalesce(nullif(p->>'pagina',''),'1') !~ '^[0-9]{1,5}$'
    OR (coalesce(p->>'cnpj','')<>'' AND p->>'cnpj' !~ '^[0-9]{14}$')
    OR (coalesce(p->>'cnae','')<>'' AND p->>'cnae' !~ '^[0-9]{7}$')
    OR (coalesce(p->>'cep','')<>'' AND p->>'cep' !~ '^[0-9]{8}$')
    OR (coalesce(p->>'uf','')<>'' AND p->>'uf' !~ '^[A-Z]{2}$')
    OR EXISTS (SELECT 1 FROM jsonb_each_text(p) j WHERE j.key IN ('aberturaDe','aberturaAte') AND j.value<>'' AND j.value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN
    RAISE EXCEPTION 'filtros invalidos' USING ERRCODE='22023';
  END IF;
  v_pagina := coalesce(nullif(p->>'pagina',''),'1')::integer;
  IF v_pagina NOT BETWEEN 1 AND 10000 OR (nullif(p->>'aberturaDe','') IS NOT NULL AND nullif(p->>'aberturaAte','') IS NOT NULL AND (p->>'aberturaDe')::date>(p->>'aberturaAte')::date) THEN
    RAISE EXCEPTION 'filtros invalidos' USING ERRCODE='22023';
  END IF;
  WITH projecoes AS MATERIALIZED (
    SELECT r.empresa_id,r.dados FROM public.empresa_atendimento_resumos(v_eu) r
    JOIN public.empresa_vinculo v ON v.empresa_id=r.empresa_id
    WHERE NOT EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=v.empresa_id) AND v.vendedor_id=v_eu AND (CASE WHEN p->>'disponibilidade'='sem_interesse' THEN v.arquivada_em IS NOT NULL ELSE v.arquivada_em IS NULL END)
  ), fontes AS MATERIALIZED (
    SELECT r.empresa_id, 'google'::text origem, coalesce(x.snapshot->>'nicho',g.snapshot->>'nicho',g.nicho) nicho,
      r.entregue_em entrada, NULL::text grupo_origem
    FROM public.google_resultado r JOIN public.google_planejamento g ON g.id=r.planejamento_id
    LEFT JOIN public.google_execucao x ON x.pedido_id=g.id
    WHERE g.vendedor_id=v_eu AND r.situacao='entregue' AND r.empresa_id IS NOT NULL
    UNION ALL
    SELECT ge.empresa_id,'banco',coalesce(nullif(b.filtros->>'palavra',''),nullif(b.filtros->>'cnae',''),b.nome),
      b.criado_em,g.nome
    FROM public.busca_empresa b JOIN public.grupo_importacao g ON g.id=b.grupo_id
    JOIN public.grupo_importacao_empresa ge ON ge.grupo_id=b.grupo_id
    WHERE b.usuario_id=v_eu AND b.estado='concluida'
    UNION ALL
    SELECT v.empresa_id,v.origem_inicial,'Cadastro existente',v.recebida_em,NULL::text
    FROM public.empresa_vinculo v WHERE v.vendedor_id=v_eu
      AND NOT EXISTS (SELECT 1 FROM public.google_resultado r JOIN public.google_planejamento g ON g.id=r.planejamento_id WHERE r.empresa_id=v.empresa_id AND r.situacao='entregue' AND g.vendedor_id=v_eu)
      AND NOT EXISTS (SELECT 1 FROM public.busca_empresa b JOIN public.grupo_importacao_empresa ge ON ge.grupo_id=b.grupo_id WHERE ge.empresa_id=v.empresa_id AND b.usuario_id=v_eu AND b.estado='concluida')
  ), vinculos AS MATERIALIZED (
    SELECT s.*,r.dados FROM fontes s JOIN projecoes r ON r.empresa_id=s.empresa_id
  ), vinculadas AS MATERIALIZED (
    SELECT v.*,concat_ws(' · ',nullif(v.dados->>'bairro',''),nullif(concat_ws('/',nullif(v.dados->>'cidade',''),nullif(v.dados->>'uf','')),'')) regiao
    FROM vinculos v
  ), escolhidos AS MATERIALIZED (
    SELECT v.* FROM vinculadas v WHERE (coalesce(p->>'origem','')='' OR v.origem=p->>'origem') AND (coalesce(p->>'nicho','')='' OR v.nicho=p->>'nicho')
  ), elegiveis AS MATERIALIZED (
    SELECT DISTINCT empresa_id FROM escolhidos v WHERE coalesce(p->>'endereco','')='' OR v.regiao=p->>'endereco'
  ), unicas AS MATERIALIZED (
    SELECT v.empresa_id,array_agg(DISTINCT v.origem ORDER BY v.origem) origens,array_agg(DISTINCT v.nicho ORDER BY v.nicho) nichos,
      coalesce(array_agg(DISTINCT v.regiao ORDER BY v.regiao) FILTER (WHERE v.regiao<>''),'{}'::text[]) regioes,min(v.entrada) entrada,
      (array_agg(v.grupo_origem ORDER BY v.entrada,v.grupo_origem) FILTER (WHERE v.grupo_origem IS NOT NULL))[1] grupo_origem
    FROM vinculadas v JOIN elegiveis el ON el.empresa_id=v.empresa_id GROUP BY v.empresa_id
  ), resumo AS MATERIALIZED (
    SELECT e.id,coalesce(e.nome_fantasia,e.razao_social,'Empresa sem nome') nome,e.cnpj,e.cnae_principal cnae,e.cep,d.porte,d.data_abertura abertura,
      s.dados->>'bairro' bairro,s.dados->>'cidade' cidade,s.dados->>'uf' uf,s.dados->'origens' origens,u.nichos,u.regioes,u.entrada,u.grupo_origem AS "grupoOrigem",
      s.dados->>'situacao' situacao,s.dados->'referencia' referencia,s.dados->>'atividade' atividade,
      (s.dados->>'versao')::integer versao,(s.dados->>'negociacaoId')::uuid AS "negociacaoId",
      s.dados->>'recebidaEm' AS "recebidaEm",s.dados->>'motivoIndisponibilidade' AS "motivoIndisponibilidade"
    FROM unicas u JOIN public.empresa e ON e.id=u.empresa_id
    LEFT JOIN public.empresa_dados_cadastrais d ON d.empresa_id=e.id
    JOIN projecoes s ON s.empresa_id=e.id
  ), filtradas AS MATERIALIZED (
    SELECT r.* FROM resumo r WHERE (coalesce(p->>'nome','')='' OR strpos(public.sem_acento(r.nome),public.sem_acento(p->>'nome'))>0)
      AND (coalesce(p->>'cnpj','')='' OR r.cnpj=p->>'cnpj') AND (coalesce(p->>'cnae','')='' OR r.cnae=p->>'cnae')
      AND (coalesce(p->>'uf','')='' OR r.uf=p->>'uf') AND (coalesce(p->>'cidade','')='' OR strpos(public.sem_acento(r.cidade),public.sem_acento(p->>'cidade'))>0)
      AND (coalesce(p->>'cep','')='' OR r.cep=p->>'cep') AND (coalesce(p->>'porte','')='' OR r.porte=p->>'porte' OR (p->>'porte'='sem' AND r.porte IS NULL))
      AND (coalesce(p->>'aberturaDe','')='' OR r.abertura>=(p->>'aberturaDe')::date) AND (coalesce(p->>'aberturaAte','')='' OR r.abertura<=(p->>'aberturaAte')::date)
      AND (coalesce(p->>'disponibilidade','')='' OR (p->>'disponibilidade'='disponivel' AND r.situacao='a_contatar') OR (p->>'disponibilidade'='comigo' AND r.situacao IN ('cliente','atendimento','primeiro_contato','em_negociacao','proposta_enviada')) OR p->>'disponibilidade'='sem_interesse')
  ) SELECT jsonb_build_object('empresas',coalesce((SELECT jsonb_agg(to_jsonb(pagina) ORDER BY pagina.entrada DESC,pagina.id) FROM (SELECT * FROM filtradas ORDER BY entrada DESC,id LIMIT 20 OFFSET (v_pagina-1)*20) pagina),'[]'::jsonb),
    'total',(SELECT count(*) FROM filtradas),'nichos',coalesce((SELECT jsonb_agg(nicho ORDER BY nicho) FROM (SELECT DISTINCT nicho FROM vinculos WHERE coalesce(p->>'origem','')='' OR origem=p->>'origem') n),'[]'::jsonb),
    'bairros',coalesce((SELECT jsonb_agg(regiao ORDER BY regiao) FROM (SELECT DISTINCT regiao FROM escolhidos WHERE regiao<>'') b),'[]'::jsonb)) INTO v_resultado;
  RETURN v_resultado;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'filtros invalidos' USING ERRCODE='22023';
END;
$$;

CREATE OR REPLACE FUNCTION empresa_vincular_entrega(p_empresa uuid,p_vendedor uuid,p_origem text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_dono uuid;
BEGIN
  IF p_origem IS NULL OR p_origem NOT IN ('google','banco') THEN RETURN 'indisponivel'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27,1);
  PERFORM 1 FROM public.empresa WHERE id=p_empresa FOR UPDATE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=p_empresa) OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=p_vendedor AND ativo AND papel='vendedor' AND NOT senha_provisoria_pendente)
    OR EXISTS (SELECT 1 FROM public.empresa_vinculo_pendencia WHERE empresa_id=p_empresa) THEN RETURN 'indisponivel'; END IF;
  SELECT vendedor_id INTO v_dono FROM public.empresa_vinculo WHERE empresa_id=p_empresa;
  IF FOUND THEN RETURN CASE WHEN v_dono=p_vendedor THEN 'repetida' ELSE 'indisponivel' END; END IF;
  IF public.empresa_cliente(p_empresa)
    OR EXISTS (SELECT 1 FROM public.empresa_fila WHERE empresa_id=p_empresa AND
      ((vendedor_id IS NOT NULL AND vendedor_id<>p_vendedor) OR (reservado_por IS NOT NULL AND reservado_por<>p_vendedor AND reservado_ate>clock_timestamp())))
    OR EXISTS (SELECT 1 FROM public.google_exclusividade WHERE empresa_id=p_empresa) THEN RETURN 'indisponivel'; END IF;
  INSERT INTO public.empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES(p_empresa,p_vendedor,p_origem);
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION empresa_recente_registrar(p_empresa uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27,1);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(public.usuario_atual()::text, 25));
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.empresa WHERE id=p_empresa FOR UPDATE;
  IF NOT public.pode_escrever() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.empresa_vinculo WHERE empresa_id=p_empresa AND vendedor_id=public.usuario_atual()) THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=p_empresa) THEN RETURN false; END IF;
  RETURN public.empresa_recente_gravar(public.usuario_atual(), p_empresa);
END;
$$;

CREATE OR REPLACE FUNCTION empresa_filtros_interno(p_uf text, p_cidade text, p_administracao boolean)
RETURNS TABLE (tipo text, valor text, rotulo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF (p_uf IS NOT NULL AND p_uf !~ '^[A-Z]{2}$')
     OR (p_cidade IS NOT NULL AND (p_uf IS NULL OR p_cidade !~ '^[0-9]{7}$')) THEN
    RAISE EXCEPTION 'filtro invalido' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    WITH importadas AS (
      SELECT e.cnae_principal, c.uf::text AS estado, c.ibge, c.localidade, nullif(btrim(c.bairro), '') AS bairro
        FROM public.empresa e LEFT JOIN public.cep c ON c.cep = e.cep
       WHERE NOT EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=e.id) AND (p_administracao OR public.empresa_visivel_prospeccao(e.id))
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

CREATE OR REPLACE FUNCTION minhas_empresas_clientes() RETURNS TABLE(empresa_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT f.empresa_id FROM public.empresa_fila f WHERE public.pode_ler()
  AND NOT EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=f.empresa_id) AND f.vendedor_id=public.usuario_atual() AND EXISTS(SELECT 1 FROM public.venda v WHERE v.empresa_id=f.empresa_id); $$;

CREATE OR REPLACE FUNCTION grupo_importacao_renomear(p_grupo uuid,p_nome text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF p_grupo IS NULL OR p_nome IS NULL OR btrim(p_nome) = '' OR length(p_nome) NOT BETWEEN 1 AND 100 OR p_nome ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'nome invalido' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27,1);
  PERFORM 1 FROM public.grupo_importacao WHERE id = p_grupo FOR UPDATE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.grupo_importacao WHERE id = p_grupo) THEN RETURN 'nao_encontrado'; END IF;
  UPDATE public.grupo_importacao SET nome = p_nome WHERE id = p_grupo AND nome IS DISTINCT FROM p_nome;
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION grupo_importacao_metadados_definir(p_grupo uuid,p_descricao text,p_origem text,p_criterios text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_descricao text;
  v_origem text;
  v_criterios text;
  v_encontrado boolean;
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  v_descricao := public.grupo_importacao_texto_normalizar(p_descricao);
  v_origem := public.grupo_importacao_texto_normalizar(p_origem);
  v_criterios := nullif(public.grupo_importacao_texto_normalizar(p_criterios),'');
  IF p_grupo IS NULL OR v_descricao IS NULL OR v_origem IS NULL
     OR NOT public.grupo_importacao_texto_valido(v_descricao,500)
     OR NOT public.grupo_importacao_texto_valido(v_origem,500)
     OR (v_criterios IS NOT NULL AND NOT public.grupo_importacao_texto_valido(v_criterios,2000)) THEN
    RAISE EXCEPTION 'metadados invalidos' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27,1);
  PERFORM 1 FROM public.grupo_importacao WHERE id = p_grupo FOR UPDATE;
  v_encontrado := FOUND;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF NOT v_encontrado THEN RETURN 'nao_encontrado'; END IF;
  UPDATE public.grupo_importacao SET descricao = v_descricao, origem = v_origem, criterios = v_criterios
    WHERE id = p_grupo AND (descricao,origem,criterios) IS DISTINCT FROM (v_descricao,v_origem,v_criterios);
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION atendimento_transicao_inventariar(p_depois uuid,p_limite integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_totais jsonb;
  v_pendencias jsonb;
  v_proximo uuid;
BEGIN
  IF NOT public.pode_ler() OR NOT public.eh_gestor() THEN RETURN jsonb_build_object('ok',false,'motivo','sem_permissao'); END IF;
  IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 100 THEN RETURN jsonb_build_object('ok',false,'motivo','filtros_invalidos'); END IF;
  WITH estado AS (
    SELECT t.empresa_id,CASE WHEN v.empresa_id IS NULL THEN coalesce(p.motivo,t.motivo) END AS motivo
    FROM public.empresa_transicao_evidencias t LEFT JOIN public.empresa_vinculo v USING(empresa_id)
    LEFT JOIN public.empresa_vinculo_pendencia p USING(empresa_id)
    WHERE NOT EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=t.empresa_id)
  ) SELECT jsonb_build_object('empresas',count(*),'vinculosInequivocos',count(*) FILTER(WHERE motivo IS NULL),'pendencias',count(*) FILTER(WHERE motivo IS NOT NULL))
    INTO v_totais FROM estado;
  WITH pendentes AS (
    SELECT t.empresa_id,coalesce(p.motivo,t.motivo) AS motivo,coalesce(p.candidatos,t.candidatos) AS candidatos
    FROM public.empresa_transicao_evidencias t LEFT JOIN public.empresa_vinculo v USING(empresa_id)
    LEFT JOIN public.empresa_vinculo_pendencia p USING(empresa_id)
    WHERE NOT EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=t.empresa_id) AND v.empresa_id IS NULL AND coalesce(p.motivo,t.motivo) IS NOT NULL AND (p_depois IS NULL OR t.empresa_id>p_depois)
    ORDER BY t.empresa_id LIMIT p_limite+1
  ), pagina AS (SELECT * FROM pendentes ORDER BY empresa_id LIMIT p_limite)
  SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('empresaId',empresa_id,'motivo',motivo,'candidatos',candidatos) ORDER BY empresa_id) FROM pagina),'[]'::jsonb),
    CASE WHEN (SELECT count(*) FROM pendentes)>p_limite THEN (SELECT empresa_id FROM pagina ORDER BY empresa_id DESC LIMIT 1) END
    INTO v_pendencias,v_proximo;
  RETURN jsonb_build_object('ok',true,'dados',jsonb_build_object('totais',v_totais,'pendencias',v_pendencias,'proximo',v_proximo));
END;
$$;

CREATE OR REPLACE FUNCTION google_publicar_interno(p_id uuid,p_empresas jsonb,p_recibo jsonb) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_pedido public.google_planejamento%ROWTYPE;
  v_publicacao public.google_publicacao%ROWTYPE;
  v_linha jsonb;
  v_i integer := 0;
  v_id uuid;
  v_cnpj_id uuid;
  v_google_id uuid;
  v_cnpj text;
  v_google text;
  v_situacao text;
  v_motivo text;
  v_inativo boolean;
  v_entregues integer := 0;
  v_vinculo text;
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL OR p_empresas IS NULL OR jsonb_typeof(p_empresas)<>'array' OR jsonb_array_length(p_empresas)>5000
    OR pg_column_size(p_empresas)>8000000 OR p_recibo IS NULL OR jsonb_typeof(p_recibo)<>'object'
    OR p_recibo->>'pedido_id' IS DISTINCT FROM p_id::text OR p_recibo->'validacao_conferida' IS DISTINCT FROM 'true'::jsonb
    OR coalesce(p_recibo->>'origem_sha256','') !~ '^[0-9a-f]{64}$' OR coalesce(p_recibo->>'final_sha256','') !~ '^[0-9a-f]{64}$'
    OR length(coalesce(p_recibo->>'arquivo_original_id','')) NOT BETWEEN 1 AND 255 OR length(coalesce(p_recibo->>'arquivo_final_id','')) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'publicacao invalida' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_empresas) x WHERE jsonb_typeof(x.value)<>'object') THEN
    RAISE EXCEPTION 'empresa invalida' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_pedido FROM public.google_planejamento WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido invalido' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_publicacao FROM public.google_publicacao WHERE planejamento_id=p_id;
  IF FOUND THEN
    IF v_publicacao.empresas IS DISTINCT FROM p_empresas OR v_publicacao.recibo IS DISTINCT FROM p_recibo THEN
      RAISE EXCEPTION 'publicacao divergente' USING ERRCODE='22023';
    END IF;
    RETURN 'repetida';
  END IF;
  IF v_pedido.estado NOT IN ('coletando','validando','falhou') THEN RAISE EXCEPTION 'pedido nao iniciado' USING ERRCODE='22023'; END IF;
  PERFORM id FROM public.usuario WHERE id IN (public.usuario_atual(),v_pedido.vendedor_id) ORDER BY id FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  SELECT NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_pedido.vendedor_id AND ativo AND papel='vendedor' AND NOT senha_provisoria_pendente) INTO v_inativo;
  INSERT INTO public.google_publicacao(planejamento_id,empresas,recibo) VALUES (p_id,p_empresas,p_recibo);
  FOR v_linha IN SELECT value FROM jsonb_array_elements(p_empresas) LOOP
    v_i := v_i+1;
    v_id := NULL;
    v_cnpj_id := NULL;
    v_google_id := NULL;
    v_situacao := 'pendente';
    v_motivo := 'Confira identidade, funcionamento e telefone validado.';
    v_cnpj := nullif(v_linha->>'cnpj','');
    v_google := nullif(v_linha->>'google_place_id','');
    IF v_entregues>=50 THEN v_motivo := 'Limite de 50 leads atingido. Ocorrência preservada para conferência.'; END IF;
    IF NOT v_inativo AND v_entregues<50 AND v_linha->'validado'='true'::jsonb AND coalesce(v_linha->'fechada','false'::jsonb)='false'::jsonb
      AND coalesce(v_linha->>'telefone','') ~ '^[0-9]{10,11}$'
      AND (public.empresa_cnpj_valido(v_cnpj) OR (length(v_google) BETWEEN 1 AND 255 AND v_google !~ '[[:cntrl:]]' AND v_google !~ U&'[\0080-\009F]'))
      AND (v_cnpj IS NULL OR public.empresa_cnpj_valido(v_cnpj))
      AND (v_google IS NULL OR (length(v_google) BETWEEN 1 AND 255 AND v_google !~ '[[:cntrl:]]' AND v_google !~ U&'[\0080-\009F]'))
      AND coalesce(nullif(btrim(v_linha->>'razao_social'),''),nullif(btrim(v_linha->>'nome_fantasia'),'')) IS NOT NULL THEN
      SELECT id INTO v_cnpj_id FROM public.empresa WHERE cnpj=v_cnpj FOR UPDATE;
      SELECT e.id INTO v_google_id FROM public.empresa_origem_google o JOIN public.empresa e ON e.id=o.empresa_id WHERE o.google_place_id=v_google FOR UPDATE OF e;
      IF (v_cnpj_id IS NOT NULL AND v_google_id IS NOT NULL AND v_cnpj_id<>v_google_id)
        OR (v_google_id IS NOT NULL AND v_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM public.empresa WHERE id=v_google_id AND cnpj IS DISTINCT FROM v_cnpj)) THEN
        v_situacao := 'conflito'; v_motivo := 'CNPJ e identificador Google precisam de conferência.';
      ELSE
        v_id := coalesce(v_cnpj_id,v_google_id);
        IF public.empresa_entrega_contato_repetido(v_linha,v_id) THEN
          v_situacao := 'repetida'; v_motivo := 'Telefone ou e-mail já encontrado na base da empresa.';
        ELSE
          IF v_id IS NULL THEN
            INSERT INTO public.empresa(cnpj,razao_social,nome_fantasia,telefone,email,cep,cnae_principal)
              VALUES (v_cnpj,nullif(btrim(v_linha->>'razao_social'),''),nullif(btrim(v_linha->>'nome_fantasia'),''),v_linha->>'telefone',
                CASE WHEN v_linha->>'email' ~ '^[^[:space:]@]+@[^[:space:]@]+$' THEN lower(btrim(v_linha->>'email')) END,
                CASE WHEN v_linha->>'cep' ~ '^[0-9]{8}$' THEN v_linha->>'cep' END,
                CASE WHEN v_linha->>'cnae_principal' ~ '^[0-9]{7}$' THEN v_linha->>'cnae_principal' END)
              ON CONFLICT (cnpj) DO NOTHING RETURNING id INTO v_id;
            IF v_id IS NULL THEN SELECT id INTO v_id FROM public.empresa WHERE cnpj=v_cnpj FOR UPDATE; END IF;
          END IF;
          IF v_google IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=v_id) THEN
            INSERT INTO public.empresa_origem_google(google_place_id,empresa_id) VALUES (v_google,v_id) ON CONFLICT DO NOTHING;
          END IF;
          v_vinculo := public.empresa_vincular_entrega(v_id,v_pedido.vendedor_id,'google');
          IF v_vinculo<>'ok' THEN
            v_situacao := v_vinculo; v_motivo := CASE WHEN v_vinculo='repetida' THEN 'Empresa já entregue a este vendedor.' ELSE 'Empresa já destinada ou em atendimento.' END;
          ELSE
            INSERT INTO public.google_exclusividade(empresa_id,vendedor_id,planejamento_id) VALUES (v_id,v_pedido.vendedor_id,p_id);
            v_entregues := v_entregues+1;
            v_situacao := 'entregue'; v_motivo := NULL;
          END IF;
        END IF;
      END IF;
    END IF;
    IF v_inativo THEN v_motivo := 'Vendedor indisponível. Entrega não liberada.'; END IF;
    INSERT INTO public.google_resultado(planejamento_id,indice,empresa_id,dados,situacao,motivo,entregue_em)
      VALUES (p_id,v_i,v_id,v_linha,v_situacao,v_motivo,CASE WHEN v_situacao='entregue' THEN clock_timestamp() END);
  END LOOP;
  UPDATE public.google_planejamento SET estado=CASE WHEN v_inativo THEN 'cancelado' ELSE 'concluido' END,concluido_em=clock_timestamp(),
    motivo=CASE WHEN v_inativo THEN 'Vendedor indisponível. Resultados preservados para o gestor.' END WHERE id=p_id;
  RETURN CASE WHEN v_inativo THEN 'vendedor_inativo' ELSE 'ok' END;
END;
$$;

CREATE OR REPLACE FUNCTION google_grupo_destino(p_vendedor uuid,p_snapshot jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  chave text;
  destino uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  SELECT jsonb_agg(public.sem_acento(regexp_replace(btrim(coalesce(p_snapshot->>k,'')),'\s+',' ','g')) ORDER BY n)::text INTO chave
    FROM unnest(ARRAY['nicho','bairro','cidade','uf']) WITH ORDINALITY t(k,n);
  LOOP
    SELECT grupo_id INTO destino FROM public.google_grupo WHERE vendedor_id=p_vendedor AND identidade=chave;
    EXIT WHEN destino IS NULL;
    IF NOT EXISTS(SELECT 1 FROM public.grupo_importacao_arquivo WHERE grupo_id=destino) THEN RETURN destino; END IF;
    chave:=chave||':'||destino::text;
  END LOOP;
  INSERT INTO public.grupo_importacao(nome,descricao,origem)
    VALUES (left((p_snapshot->>'nicho')||' · '||coalesce(nullif(p_snapshot->>'bairro',''),p_snapshot->>'cidade')||' / '||(p_snapshot->>'uf'),100),
      'Empresas do Google para '||(p_snapshot->>'nicho')||' em '||coalesce(nullif(p_snapshot->>'bairro','')||', ','')||(p_snapshot->>'cidade')||' / '||(p_snapshot->>'uf'),'Google') RETURNING id INTO destino;
  INSERT INTO public.google_grupo(grupo_id,vendedor_id,identidade) VALUES (destino,p_vendedor,chave);
  RETURN destino;
END;
$$;

CREATE OR REPLACE FUNCTION busca_empresa_importar(p_id uuid,p_cnpjs text[])
RETURNS TABLE(grupo_id uuid,inseridas integer,vinculadas integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_busca public.busca_empresa%ROWTYPE;
  v_grupo uuid;
  v_empresa uuid;
  v_novas integer := 0;
  v_total integer;
  v_linha jsonb;
  v_criada boolean;
  v_automatico boolean := p_cnpjs IS NULL;
BEGIN
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id = public.usuario_atual() AND u.papel = 'vendedor') THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  PERFORM pg_catalog.pg_advisory_xact_lock(38,1);
  PERFORM id FROM public.usuario WHERE id=public.usuario_atual() FOR SHARE;
  SELECT * INTO v_busca FROM public.busca_empresa b WHERE b.id = p_id FOR UPDATE;
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id = public.usuario_atual() AND u.papel = 'vendedor') OR v_busca.usuario_id IS DISTINCT FROM public.usuario_atual()
    OR EXISTS (SELECT 1 FROM public.busca_empresa_limite l WHERE l.usuario_id = public.usuario_atual() AND l.pausado) THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF v_automatico AND v_busca.estado='concluida' AND v_busca.inclusao_automatica_concluida
    AND EXISTS(SELECT 1 FROM public.grupo_importacao_arquivo a WHERE a.grupo_id=v_busca.grupo_id) THEN
    RETURN QUERY SELECT g.id,g.inseridas,g.vinculadas FROM public.grupo_importacao g WHERE g.id=v_busca.grupo_id;
    RETURN;
  END IF;
  IF v_automatico THEN
    IF v_busca.estado <> 'concluida' THEN RAISE EXCEPTION 'consulta nao concluida' USING ERRCODE = '22023'; END IF;
    IF v_busca.grupo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.grupo_importacao g WHERE g.id=v_busca.grupo_id AND g.ativo) THEN
      RAISE EXCEPTION 'grupo inativo' USING ERRCODE = '42501';
    END IF;
    IF v_busca.fornecedor = 'Casa dos Dados' THEN
      SELECT coalesce(jsonb_agg(CASE WHEN coalesce((e.dados->>'bloqueada_por_repeticao')::boolean,false)
          OR public.busca_casa_repetida(e.dados,v_busca.grupo_id)
        THEN jsonb_set(e.dados,'{bloqueada_por_repeticao}','true'::jsonb) ELSE e.dados END ORDER BY e.indice),'[]'::jsonb)
        INTO v_busca.empresas FROM jsonb_array_elements(v_busca.empresas) WITH ORDINALITY e(dados,indice);
      UPDATE public.busca_empresa b SET empresas=v_busca.empresas WHERE b.id=p_id AND b.empresas IS DISTINCT FROM v_busca.empresas;
    END IF;
    SELECT coalesce(array_agg(DISTINCT e->>'cnpj'),ARRAY[]::text[]) INTO p_cnpjs FROM jsonb_array_elements(v_busca.empresas) e
      WHERE e->>'telefone' ~ '^[0-9]{10,11}$' AND NOT coalesce((e->>'bloqueada_por_repeticao')::boolean,false);
    IF cardinality(p_cnpjs)=0 THEN
      UPDATE public.busca_empresa b SET inclusao_automatica_concluida=true WHERE b.id=p_id AND NOT b.inclusao_automatica_concluida;
      RETURN QUERY SELECT v_busca.grupo_id,0,(SELECT count(*)::integer FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id=v_busca.grupo_id);
      RETURN;
    END IF;
  END IF;
  IF v_busca.estado <> 'concluida' OR p_cnpjs IS NULL OR coalesce(array_length(p_cnpjs,1),0) NOT BETWEEN 1 AND 100
    OR (SELECT count(DISTINCT c) FROM unnest(p_cnpjs) c) <> array_length(p_cnpjs,1)
    OR EXISTS (SELECT 1 FROM unnest(p_cnpjs) c WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_busca.empresas) e WHERE e.value->>'cnpj' = c AND e.value->>'telefone' IS NOT NULL)) THEN
    RAISE EXCEPTION 'selecao invalida' USING ERRCODE = '22023';
  END IF;
  IF v_busca.fornecedor = 'Casa dos Dados' THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_busca.empresas) e WHERE e->>'cnpj' = ANY(p_cnpjs)
      AND (coalesce((e->>'bloqueada_por_repeticao')::boolean,false) OR public.busca_casa_repetida(e,v_busca.grupo_id))) THEN
      RAISE EXCEPTION 'empresa ou contato repetido na base' USING ERRCODE = '23505';
    END IF;
  END IF;
  v_grupo := v_busca.grupo_id;
  IF v_grupo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.grupo_importacao g WHERE g.id = v_grupo AND g.ativo) THEN
    RAISE EXCEPTION 'grupo inativo' USING ERRCODE = '42501';
  END IF;
  FOR v_linha IN SELECT value FROM jsonb_array_elements(v_busca.empresas) WHERE value->>'cnpj' = ANY(p_cnpjs) ORDER BY value->>'cnpj' LOOP
    SELECT e.id INTO v_empresa FROM public.empresa e WHERE e.cnpj=v_linha->>'cnpj' FOR UPDATE;
    IF public.empresa_entrega_contato_repetido(v_linha,v_empresa) THEN CONTINUE; END IF;
    INSERT INTO public.empresa(cnpj,razao_social,nome_fantasia,telefone,email,cep,cnae_principal)
      VALUES (v_linha->>'cnpj',v_linha->>'razao_social',v_linha->>'nome_fantasia',v_linha->>'telefone',
        v_linha->>'email',v_linha->>'cep',v_linha->>'cnae_principal')
      ON CONFLICT (cnpj) DO NOTHING RETURNING id INTO v_empresa;
    v_criada := FOUND;
    IF NOT v_criada THEN SELECT e.id INTO STRICT v_empresa FROM public.empresa e WHERE e.cnpj = v_linha->>'cnpj' FOR UPDATE;
    END IF;
    IF public.empresa_vincular_entrega(v_empresa,public.usuario_atual(),'banco')<>'ok' THEN CONTINUE; END IF;
    IF v_criada THEN v_novas := v_novas+1; END IF;
    IF v_grupo IS NULL THEN
      INSERT INTO public.grupo_importacao(nome,descricao,origem,criterios)
        VALUES (v_busca.nome,CASE WHEN v_automatico THEN 'Empresas incluídas automaticamente na busca de ' ELSE 'Empresas selecionadas na busca de ' END || to_char(v_busca.criado_em AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),
          v_busca.fornecedor,concat_ws('; ','UF: ' || (v_busca.filtros->>'uf'),'Cidade: ' || nullif(v_busca.filtros->>'cidade',''),
          'Bairro: ' || nullif(v_busca.filtros->>'bairro',''),'CNAE: ' || nullif(v_busca.filtros->>'cnae',''),
          'Palavra: ' || nullif(v_busca.filtros->>'palavra',''),'Porte: ' || nullif(v_busca.filtros->>'porte',''),'Situação: ativa'))
        RETURNING id INTO v_grupo;
      UPDATE public.busca_empresa b SET grupo_id = v_grupo WHERE b.id = p_id;
    END IF;
    INSERT INTO public.empresa_dados_cadastrais(empresa_id,fonte,coletado_em,situacao,porte,data_abertura,logradouro,numero,complemento,bairro,cidade,uf,telefones,detalhes)
      VALUES (v_empresa,v_busca.fornecedor,v_busca.criado_em,v_linha->>'situacao',v_linha->>'porte',(v_linha->>'data_abertura')::date,
        v_linha->>'logradouro',v_linha->>'numero',v_linha->>'complemento',v_linha->>'bairro',v_linha->>'cidade',v_linha->>'uf',v_linha->'telefones',coalesce(v_linha->'detalhes','{}'::jsonb))
      ON CONFLICT (empresa_id) DO NOTHING;
    INSERT INTO public.grupo_importacao_empresa(grupo_id,empresa_id) VALUES (v_grupo,v_empresa) ON CONFLICT DO NOTHING;
  END LOOP;
  SELECT count(*)::integer INTO v_total FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id = v_grupo;
  UPDATE public.grupo_importacao g SET inseridas = g.inseridas + v_novas, vinculadas = v_total WHERE g.id = v_grupo;
  IF v_automatico THEN
    UPDATE public.busca_empresa b SET inclusao_automatica_concluida=true WHERE b.id=p_id AND NOT b.inclusao_automatica_concluida;
  END IF;
  RETURN QUERY SELECT v_grupo,v_novas,v_total;
END;
$$;

CREATE OR REPLACE FUNCTION empresa_recente_gravar(p_usuario uuid, p_empresa uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_usuario IS NULL THEN RETURN false; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27,1);
  IF EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=p_empresa) THEN RETURN false; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_usuario::text, 25));
  IF NOT EXISTS (SELECT 1 FROM public.empresa WHERE id = p_empresa) THEN RETURN false; END IF;
  INSERT INTO public.empresa_recente(usuario_id, empresa_id, acessada_em)
    VALUES (p_usuario, p_empresa, clock_timestamp())
    ON CONFLICT (usuario_id, empresa_id) DO UPDATE SET acessada_em = EXCLUDED.acessada_em;
  DELETE FROM public.empresa_recente r WHERE r.usuario_id = p_usuario AND NOT EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=r.empresa_id) AND r.empresa_id IN (
    SELECT x.empresa_id FROM public.empresa_recente x WHERE x.usuario_id = p_usuario AND NOT EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=x.empresa_id)
    ORDER BY x.acessada_em DESC, x.empresa_id OFFSET 10
  );
  RETURN true;
END;
$$;
COMMIT;
