-- Ensaio em clone descartável; o cliente deve validar a URL local antes da conexão.
DO $$
DECLARE v jsonb; v_texto text;
BEGIN
  IF current_database() !~ '^teste_[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'recuperacao de ensaio exige banco descartavel do harness';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend') THEN
    RAISE EXCEPTION 'clone precisa estar sem outras conexoes';
  END IF;
  SELECT backup,conteudo INTO STRICT v,v_texto FROM recuperacao_arquivo;
  IF v->>'formato' IS DISTINCT FROM 'crm-arquivo-legado-v1' OR v->'manifesto'->>'banco'=current_database()
    OR NOT EXISTS(SELECT 1 FROM public.arquivo_legado_operacao o WHERE o.manifesto=v->'manifesto'
      AND o.backup_sha256=encode(sha256(convert_to(v_texto,'UTF8')),'hex')) THEN
    RAISE EXCEPTION 'backup nao corresponde a operacao clonada ou clone nao foi separado';
  END IF;
END;
$$;
SELECT pg_advisory_xact_lock(27,1);
LOCK TABLE public.grupo_importacao,public.empresa_vinculo,public.empresa_vinculo_pendencia,public.negociacao IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.grupo_importacao DISABLE TRIGGER grupo_arquivo_guardar;
ALTER TABLE public.grupo_importacao DISABLE TRIGGER grupo_importacao_auditoria;
ALTER TABLE public.empresa_vinculo DISABLE TRIGGER arquivo_guardar;
ALTER TABLE public.empresa_vinculo DISABLE TRIGGER empresa_vinculo_auditoria;
ALTER TABLE public.empresa_vinculo_pendencia DISABLE TRIGGER arquivo_guardar;
ALTER TABLE public.empresa_vinculo_pendencia DISABLE TRIGGER empresa_vinculo_pendencia_auditoria;
ALTER TABLE public.negociacao DISABLE TRIGGER arquivo_guardar;
ALTER TABLE public.negociacao DISABLE TRIGGER atendimento_negociacao_estado;
UPDATE public.grupo_importacao g SET ativo=b.ativo,atualizado_em=b.atualizado_em,atualizado_por=b.atualizado_por
FROM recuperacao_arquivo r CROSS JOIN LATERAL jsonb_populate_recordset(NULL::public.grupo_importacao,r.backup->'manifesto'->'grupos') b
WHERE g.id=b.id;
UPDATE public.negociacao n SET encerrada_em=b.encerrada_em,encerramento=b.encerramento
FROM recuperacao_arquivo r CROSS JOIN LATERAL jsonb_populate_recordset(NULL::public.negociacao,r.backup->'manifesto'->'negociacao') b
WHERE n.id=b.id;
UPDATE public.empresa_vinculo_pendencia p SET resolvida_por_arquivo_em=b.resolvida_por_arquivo_em,atualizado_em=b.atualizado_em,atualizado_por=b.atualizado_por
FROM recuperacao_arquivo r CROSS JOIN LATERAL jsonb_populate_recordset(NULL::public.empresa_vinculo_pendencia,r.backup->'manifesto'->'empresa_vinculo_pendencia') b
WHERE p.empresa_id=b.empresa_id;
UPDATE public.empresa_vinculo v SET agenda_contato_id=b.agenda_contato_id,versao=b.versao,atualizado_em=b.atualizado_em,atualizado_por=b.atualizado_por
FROM recuperacao_arquivo r CROSS JOIN LATERAL jsonb_populate_recordset(NULL::public.empresa_vinculo,r.backup->'manifesto'->'empresa_vinculo') b
WHERE v.empresa_id=b.empresa_id;
ALTER TABLE public.grupo_importacao ENABLE TRIGGER grupo_arquivo_guardar;
ALTER TABLE public.grupo_importacao ENABLE TRIGGER grupo_importacao_auditoria;
ALTER TABLE public.empresa_vinculo ENABLE TRIGGER arquivo_guardar;
ALTER TABLE public.empresa_vinculo ENABLE TRIGGER empresa_vinculo_auditoria;
ALTER TABLE public.empresa_vinculo_pendencia ENABLE TRIGGER arquivo_guardar;
ALTER TABLE public.empresa_vinculo_pendencia ENABLE TRIGGER empresa_vinculo_pendencia_auditoria;
ALTER TABLE public.negociacao ENABLE TRIGGER arquivo_guardar;
ALTER TABLE public.negociacao ENABLE TRIGGER atendimento_negociacao_estado;
