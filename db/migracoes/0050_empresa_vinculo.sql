-- ver docs/db/0050.md
BEGIN;
CREATE TABLE empresa_vinculo (
  empresa_id uuid PRIMARY KEY REFERENCES empresa(id) ON DELETE RESTRICT,
  vendedor_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  origem_inicial text NOT NULL CHECK (origem_inicial IN ('google','banco','legado')),
  recebida_em timestamptz NOT NULL DEFAULT now(),
  iniciada_em timestamptz,
  arquivada_em timestamptz,
  agenda_contato_id uuid REFERENCES contato(id) ON DELETE RESTRICT,
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES usuario(id) ON DELETE RESTRICT,
  atualizado_em timestamptz,
  atualizado_por uuid REFERENCES usuario(id) ON DELETE RESTRICT,
  CHECK (arquivada_em IS NULL OR agenda_contato_id IS NULL)
);
CREATE INDEX empresa_vinculo_vendedor_idx ON empresa_vinculo(vendedor_id,recebida_em,empresa_id);
CREATE TRIGGER empresa_vinculo_auditoria BEFORE INSERT OR UPDATE ON empresa_vinculo
FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
ALTER TABLE empresa_vinculo ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_vinculo_leitura ON empresa_vinculo FOR SELECT TO app_usuario
USING (pode_ler() AND (eh_gestor() OR vendedor_id=usuario_atual()));
GRANT SELECT ON empresa_vinculo TO app_usuario;
CREATE TABLE empresa_vinculo_pendencia (
  empresa_id uuid PRIMARY KEY REFERENCES empresa(id) ON DELETE RESTRICT,
  motivo text NOT NULL CHECK (btrim(motivo) <> ''),
  candidatos uuid[] NOT NULL DEFAULT '{}',
  evidencias jsonb NOT NULL CHECK (jsonb_typeof(evidencias)='object'),
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES usuario(id) ON DELETE RESTRICT,
  atualizado_em timestamptz,
  atualizado_por uuid REFERENCES usuario(id) ON DELETE RESTRICT
);
CREATE TRIGGER empresa_vinculo_pendencia_auditoria BEFORE INSERT OR UPDATE ON empresa_vinculo_pendencia
FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
ALTER TABLE empresa_vinculo_pendencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_vinculo_pendencia_leitura ON empresa_vinculo_pendencia FOR SELECT TO app_usuario USING (eh_gestor());
GRANT SELECT ON empresa_vinculo_pendencia TO app_usuario;
CREATE TABLE empresa_atendimento_operacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave uuid NOT NULL UNIQUE,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES empresa(id) ON DELETE RESTRICT,
  operacao text NOT NULL CHECK (btrim(operacao) <> ''),
  entrada jsonb NOT NULL CHECK (jsonb_typeof(entrada)='object'),
  resultado jsonb NOT NULL CHECK (jsonb_typeof(resultado)='object'),
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES usuario(id) ON DELETE RESTRICT,
  atualizado_em timestamptz,
  atualizado_por uuid REFERENCES usuario(id) ON DELETE RESTRICT
);
CREATE TRIGGER empresa_atendimento_operacao_auditoria BEFORE INSERT OR UPDATE ON empresa_atendimento_operacao
FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
ALTER TABLE empresa_atendimento_operacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_atendimento_operacao_leitura ON empresa_atendimento_operacao FOR SELECT TO app_usuario
USING (pode_ler() AND (eh_gestor() OR (usuario_id=usuario_atual() AND EXISTS (
  SELECT 1 FROM empresa_vinculo v WHERE v.empresa_id=empresa_atendimento_operacao.empresa_id AND v.vendedor_id=usuario_atual()
))));
GRANT SELECT ON empresa_atendimento_operacao TO app_usuario;
CREATE FUNCTION empresa_vinculo_agenda_validar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.agenda_contato_id IS NOT NULL THEN
    PERFORM c.id FROM public.contato c WHERE c.id=NEW.agenda_contato_id AND c.empresa_id=NEW.empresa_id
      AND c.proximo_passo IS NOT NULL AND c.proximo_passo_data IS NOT NULL FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'agenda exige contato da mesma empresa com tarefa' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_vinculo_agenda_validar() FROM PUBLIC;
CREATE TRIGGER empresa_vinculo_agenda BEFORE INSERT OR UPDATE ON empresa_vinculo
FOR EACH ROW EXECUTE FUNCTION empresa_vinculo_agenda_validar();
CREATE FUNCTION contato_agenda_vinculo_validar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.empresa_vinculo v WHERE v.agenda_contato_id=NEW.id
    AND (v.empresa_id<>NEW.empresa_id OR NEW.proximo_passo IS NULL OR NEW.proximo_passo_data IS NULL)) THEN
    RAISE EXCEPTION 'contato referenciado na agenda exige mesma empresa e tarefa' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION contato_agenda_vinculo_validar() FROM PUBLIC;
CREATE TRIGGER contato_agenda_vinculo BEFORE UPDATE OF empresa_id,proximo_passo,proximo_passo_data ON contato
FOR EACH ROW EXECUTE FUNCTION contato_agenda_vinculo_validar();
CREATE VIEW empresa_transicao_evidencias AS
WITH entregas AS (
  SELECT r.empresa_id,p.vendedor_id,r.entregue_em AS recebida_em,'google'::text AS origem
    FROM google_resultado r JOIN google_planejamento p ON p.id=r.planejamento_id
    WHERE r.situacao='entregue' AND r.empresa_id IS NOT NULL
  UNION ALL
  SELECT ge.empresa_id,b.usuario_id,b.concluido_em,'banco'::text
    FROM busca_empresa b JOIN grupo_importacao_empresa ge ON ge.grupo_id=b.grupo_id WHERE b.estado='concluida'
  UNION ALL
  SELECT f.empresa_id,f.reservado_por,f.primeira_reserva_em,'legado'::text FROM empresa_fila f WHERE f.reservado_por IS NOT NULL
), base AS (
  SELECT e.id AS empresa_id,e.criado_em AS empresa_criada_em,f.vendedor_id AS responsavel,g.vendedor_id AS google,
    g.criado_em AS google_recebida_em,
    coalesce((SELECT array_agg(DISTINCT t.vendedor_id ORDER BY t.vendedor_id) FROM entregas t WHERE t.empresa_id=e.id),'{}'::uuid[]) AS candidatos,
    c.id AS contato_id,c.tipo,c.criado_em AS contato_em,c.criado_por AS contato_autor,c.proximo_passo,c.proximo_passo_data,
    coalesce((SELECT array_agg(DISTINCT n.vendedor_id ORDER BY n.vendedor_id) FROM negociacao n WHERE n.empresa_id=e.id),'{}'::uuid[]) AS negociacao_autores,
    (SELECT min(t.recebida_em) FROM entregas t WHERE t.empresa_id=e.id) AS entrega_em,
    (SELECT t.origem FROM entregas t WHERE t.empresa_id=e.id ORDER BY t.recebida_em NULLS LAST,t.vendedor_id,t.origem LIMIT 1) AS entrega_origem,
    (SELECT min(h.criado_em) FROM contato h WHERE h.empresa_id=e.id) AS primeiro_contato_em,
    EXISTS (SELECT 1 FROM venda v WHERE v.empresa_id=e.id AND v.criada_em>=c.criado_em) OR
      EXISTS (SELECT 1 FROM negociacao n WHERE n.empresa_id=e.id AND (n.encerrada_em IS NULL OR n.iniciada_em>=c.criado_em OR n.encerrada_em>c.criado_em)) AS negativo_contradito
  FROM empresa e LEFT JOIN empresa_fila f ON f.empresa_id=e.id LEFT JOIN google_exclusividade g ON g.empresa_id=e.id
  LEFT JOIN LATERAL (SELECT h.* FROM contato h WHERE h.empresa_id=e.id ORDER BY h.criado_em DESC,h.id DESC LIMIT 1) c ON true
), classificadas AS (
  SELECT b.*,
    CASE
      WHEN responsavel IS NOT NULL AND google IS NOT NULL AND responsavel<>google THEN 'conflito_google'
      WHEN responsavel IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id=responsavel AND u.ativo AND u.papel='vendedor') THEN 'responsavel_inativo'
      WHEN responsavel IS NOT NULL THEN NULL
      WHEN google IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id=google AND u.ativo AND u.papel='vendedor') THEN 'google_inativo'
      WHEN google IS NOT NULL THEN NULL
      WHEN cardinality(candidatos)=0 THEN 'sem_evidencia'
      WHEN EXISTS (SELECT 1 FROM unnest(candidatos) c(id) WHERE NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id=c.id AND u.ativo AND u.papel='vendedor')) THEN 'candidato_inativo'
      WHEN cardinality(candidatos)>1 THEN 'multiplos_candidatos'
      ELSE NULL
    END AS motivo_vinculo,
    coalesce(responsavel,google,candidatos[1]) AS vendedor_id
  FROM base b
)
SELECT c.*,
  coalesce(motivo_vinculo,CASE WHEN tipo='sem_interesse' AND negativo_contradito THEN 'sem_interesse_contraditorio' END) AS motivo,
  CASE WHEN tipo='sem_interesse' AND NOT negativo_contradito THEN contato_em END AS arquivada_em,
  CASE WHEN tipo<>'sem_interesse' AND proximo_passo IS NOT NULL AND proximo_passo_data IS NOT NULL THEN contato_id END AS agenda_contato_id,
  coalesce(google_recebida_em,entrega_em,empresa_criada_em) AS recebida_em,
  CASE WHEN google IS NOT NULL THEN 'google' ELSE coalesce(entrega_origem,'legado') END AS origem_inicial
FROM classificadas c;
REVOKE ALL ON empresa_transicao_evidencias FROM PUBLIC,app_usuario;
INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial,recebida_em,iniciada_em,arquivada_em,agenda_contato_id)
  SELECT empresa_id,vendedor_id,origem_inicial,recebida_em,primeiro_contato_em,arquivada_em,agenda_contato_id
  FROM empresa_transicao_evidencias WHERE motivo IS NULL;
INSERT INTO empresa_vinculo_pendencia(empresa_id,motivo,candidatos,evidencias)
  SELECT empresa_id,motivo,candidatos,jsonb_build_object('responsavel',responsavel,'google',google,
    'ultimoContatoId',contato_id,'ultimoContatoAutor',contato_autor,'negociacaoAutores',negociacao_autores)
  FROM empresa_transicao_evidencias WHERE motivo IS NOT NULL;
CREATE POLICY empresa_vinculo_pessoal ON empresa FOR SELECT TO app_usuario USING (
  pode_ler() AND EXISTS (SELECT 1 FROM empresa_vinculo v WHERE v.empresa_id=empresa.id AND v.vendedor_id=usuario_atual())
);
CREATE FUNCTION atendimento_transicao_inventariar(p_depois uuid,p_limite integer) RETURNS jsonb
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
  ) SELECT jsonb_build_object('empresas',count(*),'vinculosInequivocos',count(*) FILTER(WHERE motivo IS NULL),'pendencias',count(*) FILTER(WHERE motivo IS NOT NULL))
    INTO v_totais FROM estado;
  WITH pendentes AS (
    SELECT t.empresa_id,coalesce(p.motivo,t.motivo) AS motivo,coalesce(p.candidatos,t.candidatos) AS candidatos
    FROM public.empresa_transicao_evidencias t LEFT JOIN public.empresa_vinculo v USING(empresa_id)
    LEFT JOIN public.empresa_vinculo_pendencia p USING(empresa_id)
    WHERE v.empresa_id IS NULL AND coalesce(p.motivo,t.motivo) IS NOT NULL AND (p_depois IS NULL OR t.empresa_id>p_depois)
    ORDER BY t.empresa_id LIMIT p_limite+1
  ), pagina AS (SELECT * FROM pendentes ORDER BY empresa_id LIMIT p_limite)
  SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('empresaId',empresa_id,'motivo',motivo,'candidatos',candidatos) ORDER BY empresa_id) FROM pagina),'[]'::jsonb),
    CASE WHEN (SELECT count(*) FROM pendentes)>p_limite THEN (SELECT empresa_id FROM pagina ORDER BY empresa_id DESC LIMIT 1) END
    INTO v_pendencias,v_proximo;
  RETURN jsonb_build_object('ok',true,'dados',jsonb_build_object('totais',v_totais,'pendencias',v_pendencias,'proximo',v_proximo));
END;
$$;
REVOKE EXECUTE ON FUNCTION atendimento_transicao_inventariar(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION atendimento_transicao_inventariar(uuid,integer) TO app_usuario;
COMMIT;
