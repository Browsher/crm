-- ver docs/db/0061.md
BEGIN;
CREATE INDEX empresa_vinculo_arquivo_funil_idx
  ON empresa_vinculo(vendedor_id,arquivada_em DESC,empresa_id DESC) WHERE arquivada_em IS NOT NULL;
CREATE INDEX empresa_atendimento_operacao_arquivo_funil_idx
  ON empresa_atendimento_operacao(empresa_id,usuario_id,(resultado->'versao'))
  WHERE operacao='arquivar' AND resultado @> '{"ok":true}'::jsonb;

CREATE FUNCTION funil_arquivo_negociacao(p_v public.empresa_vinculo) RETURNS uuid
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT n.id
  FROM public.empresa_atendimento_operacao op
  JOIN public.negociacao n ON n.id=CASE WHEN pg_input_is_valid(op.entrada->>'negociacaoId','uuid')
    THEN (op.entrada->>'negociacaoId')::uuid END
    AND n.empresa_id=(p_v).empresa_id AND n.vendedor_id=(p_v).vendedor_id AND n.encerramento='sem_interesse'
  WHERE (p_v).arquivada_em IS NOT NULL AND op.empresa_id=(p_v).empresa_id AND op.usuario_id=(p_v).vendedor_id
    AND op.operacao='arquivar' AND op.resultado @> '{"ok":true}'::jsonb AND op.resultado->'versao'=to_jsonb((p_v).versao)
    AND public.empresa_atendimento_motivo((p_v).empresa_id) IS NULL
    AND NOT public.empresa_cliente((p_v).empresa_id)
    AND NOT EXISTS(SELECT 1 FROM public.negociacao WHERE empresa_id=(p_v).empresa_id AND encerrada_em IS NULL)
    AND NOT EXISTS(SELECT 1 FROM public.empresa_fila WHERE empresa_id=(p_v).empresa_id AND vendedor_id<>(p_v).vendedor_id)
  ORDER BY n.id DESC LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION funil_arquivo_negociacao(public.empresa_vinculo) FROM PUBLIC;

CREATE FUNCTION funil_sem_interesse_recentes()
RETURNS TABLE(empresa_id uuid,negociacao_id uuid,nome text,arquivada_em timestamptz,versao integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.empresa_id,a.negociacao_id,coalesce(e.razao_social,e.nome_fantasia),v.arquivada_em,v.versao
  FROM public.empresa_vinculo v
  JOIN public.empresa e ON e.id=v.empresa_id
  CROSS JOIN LATERAL public.funil_arquivo_negociacao(v) a(negociacao_id)
  WHERE public.pode_ler() AND v.vendedor_id=public.usuario_atual() AND v.arquivada_em IS NOT NULL
    AND EXISTS(SELECT 1 FROM public.usuario WHERE id=public.usuario_atual() AND papel='vendedor' AND ativo)
    AND a.negociacao_id IS NOT NULL
  ORDER BY v.arquivada_em DESC,v.empresa_id DESC LIMIT 3;
$$;

CREATE OR REPLACE FUNCTION atendimento_executar(p_empresa uuid,p_chave uuid,p_versao integer,p_operacao text,p_entrada jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_v public.empresa_vinculo;
  v_op public.empresa_atendimento_operacao;
  v_entrada jsonb := p_entrada || jsonb_build_object('versao',p_versao);
  v_resultado jsonb;
  v_tipo text := p_entrada->>'tipo';
  v_nota text := p_entrada->>'nota';
  v_passo text := p_entrada->>'proximoPasso';
  v_data_texto text := p_entrada->>'proximoPassoData';
  v_data date;
  v_contato uuid;
  v_negociacao uuid;
BEGIN
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_eu AND ativo AND papel='vendedor') THEN
    RETURN jsonb_build_object('ok',false,'motivo','sem_permissao'); END IF;
  IF p_empresa IS NULL OR p_chave IS NULL OR p_versao IS NULL OR p_versao<1 THEN RETURN jsonb_build_object('ok',false,'motivo','dados_invalidos'); END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27,1);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_eu::text,25));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_chave::text,52));
  PERFORM 1 FROM public.usuario WHERE id=v_eu FOR SHARE;
  PERFORM 1 FROM public.empresa WHERE id=p_empresa FOR UPDATE;
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_eu AND ativo AND papel='vendedor') THEN
    RETURN jsonb_build_object('ok',false,'motivo','sem_permissao'); END IF;
  SELECT * INTO v_v FROM public.empresa_vinculo WHERE empresa_id=p_empresa FOR UPDATE;
  IF v_v.vendedor_id IS DISTINCT FROM v_eu THEN RETURN jsonb_build_object('ok',false,'motivo','sem_permissao'); END IF;
  SELECT * INTO v_op FROM public.empresa_atendimento_operacao WHERE chave=p_chave;
  IF FOUND THEN
    IF v_op.usuario_id=v_eu AND v_op.empresa_id=p_empresa AND v_op.operacao=p_operacao AND v_op.entrada=v_entrada THEN
      RETURN CASE WHEN v_op.resultado->>'ok'='true' THEN v_op.resultado || jsonb_build_object('repetida',true) ELSE v_op.resultado END;
    END IF;
    RETURN jsonb_build_object('ok',false,'motivo','chave_reutilizada');
  END IF;
  <<aplicar>>
  BEGIN
    IF public.empresa_atendimento_motivo(p_empresa) IS NOT NULL THEN v_resultado:=jsonb_build_object('ok',false,'motivo','desatualizada'); EXIT aplicar; END IF;
    IF v_v.versao<>p_versao THEN v_resultado:=jsonb_build_object('ok',false,'motivo','desatualizada'); EXIT aplicar; END IF;
    IF p_operacao NOT IN ('retomar','devolver_funil') AND v_v.arquivada_em IS NOT NULL THEN v_resultado:=jsonb_build_object('ok',false,'motivo','arquivada'); EXIT aplicar; END IF;
    IF p_operacao='contato' THEN
      IF v_tipo IS NULL OR v_tipo NOT IN ('nao_liguei','nao_atendeu','retornar_depois','sem_interesse','interessado','acompanhamento')
        OR (v_passo IS NULL)<>(v_data_texto IS NULL) OR length(v_nota)>2000 OR length(v_passo)>2000
        OR (v_tipo='sem_interesse' AND v_passo IS NOT NULL)
        OR (v_tipo IN ('retornar_depois','acompanhamento') AND v_passo IS NULL)
        OR (v_tipo='acompanhamento' AND NOT public.empresa_cliente(p_empresa) AND NOT EXISTS (SELECT 1 FROM public.negociacao WHERE empresa_id=p_empresa AND encerrada_em IS NULL)) THEN
        v_resultado:=jsonb_build_object('ok',false,'motivo','dados_invalidos'); EXIT aplicar; END IF;
      IF v_data_texto IS NOT NULL THEN
        IF v_data_texto !~ '^\d{4}-\d{2}-\d{2}$' THEN v_resultado:=jsonb_build_object('ok',false,'motivo','dados_invalidos'); EXIT aplicar; END IF;
        BEGIN v_data:=v_data_texto::date;
        EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
          v_resultado:=jsonb_build_object('ok',false,'motivo','dados_invalidos'); EXIT aplicar;
        END;
        IF NOT isfinite(v_data) OR v_data<'0001-01-01'::date THEN v_resultado:=jsonb_build_object('ok',false,'motivo','dados_invalidos'); EXIT aplicar; END IF;
      END IF;
      IF EXISTS (SELECT 1 FROM public.empresa_fila WHERE empresa_id=p_empresa AND vendedor_id IS NOT NULL AND vendedor_id<>v_eu)
        OR EXISTS (SELECT 1 FROM public.negociacao WHERE empresa_id=p_empresa AND encerrada_em IS NULL AND vendedor_id<>v_eu) THEN
        v_resultado:=jsonb_build_object('ok',false,'motivo','sem_permissao'); EXIT aplicar; END IF;
      INSERT INTO public.contato(empresa_id,tipo,nota,proximo_passo,proximo_passo_data) VALUES(p_empresa,v_tipo,v_nota,v_passo,v_data) RETURNING id INTO v_contato;
      UPDATE public.empresa_vinculo SET iniciada_em=coalesce(iniciada_em,clock_timestamp()),agenda_contato_id=CASE WHEN v_data IS NOT NULL THEN v_contato END WHERE empresa_id=p_empresa;
      IF v_tipo='sem_interesse' THEN PERFORM public.atendimento_arquivar_interno(p_empresa);
      ELSIF v_tipo IN ('interessado','retornar_depois') AND NOT public.empresa_cliente(p_empresa) THEN
        INSERT INTO public.empresa_fila(empresa_id,vendedor_id) VALUES(p_empresa,v_eu) ON CONFLICT(empresa_id) DO UPDATE SET vendedor_id=v_eu,reservado_por=NULL,reservado_ate=NULL;
        IF NOT EXISTS (SELECT 1 FROM public.negociacao WHERE empresa_id=p_empresa AND encerrada_em IS NULL) THEN
          INSERT INTO public.negociacao(empresa_id,vendedor_id) VALUES(p_empresa,v_eu);
        END IF;
      END IF;
    ELSIF p_operacao='arquivar' THEN
      v_negociacao:=(p_entrada->>'negociacaoId')::uuid;
      IF v_negociacao IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.negociacao WHERE id=v_negociacao AND empresa_id=p_empresa AND vendedor_id=v_eu AND encerrada_em IS NULL) THEN
        v_resultado:=jsonb_build_object('ok',false,'motivo','desatualizada'); EXIT aplicar; END IF;
      IF EXISTS (SELECT 1 FROM public.empresa_fila WHERE empresa_id=p_empresa AND vendedor_id IS NOT NULL AND vendedor_id<>v_eu)
        OR EXISTS (SELECT 1 FROM public.negociacao WHERE empresa_id=p_empresa AND encerrada_em IS NULL AND vendedor_id<>v_eu) THEN
        v_resultado:=jsonb_build_object('ok',false,'motivo','sem_permissao'); EXIT aplicar; END IF;
      PERFORM public.atendimento_arquivar_interno(p_empresa);
    ELSIF p_operacao='devolver_funil' THEN
      v_negociacao:=(p_entrada->>'negociacaoId')::uuid;
      IF v_negociacao IS NULL THEN
        v_resultado:=jsonb_build_object('ok',false,'motivo','dados_invalidos'); EXIT aplicar; END IF;
      IF public.funil_arquivo_negociacao(v_v) IS DISTINCT FROM v_negociacao THEN
        v_resultado:=jsonb_build_object('ok',false,'motivo','desatualizada'); EXIT aplicar; END IF;
      INSERT INTO public.empresa_fila AS f(empresa_id,vendedor_id) VALUES(p_empresa,v_eu)
        ON CONFLICT(empresa_id) DO UPDATE SET vendedor_id=v_eu,reservado_por=NULL,reservado_ate=NULL WHERE f.vendedor_id IS NULL;
      IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM public.empresa_fila WHERE empresa_id=p_empresa AND vendedor_id=v_eu) THEN
        v_resultado:=jsonb_build_object('ok',false,'motivo','desatualizada'); EXIT aplicar; END IF;
      UPDATE public.empresa_vinculo SET arquivada_em=NULL WHERE empresa_id=p_empresa;
      INSERT INTO public.negociacao(empresa_id,vendedor_id) VALUES(p_empresa,v_eu);
    ELSIF p_operacao='retomar' THEN
      UPDATE public.empresa_vinculo SET arquivada_em=NULL WHERE empresa_id=p_empresa;
    ELSIF p_operacao='iniciar' THEN
      UPDATE public.empresa_vinculo SET iniciada_em=coalesce(iniciada_em,clock_timestamp()) WHERE empresa_id=p_empresa;
    ELSE v_resultado:=jsonb_build_object('ok',false,'motivo','dados_invalidos'); EXIT aplicar;
    END IF;
    UPDATE public.empresa_vinculo SET versao=versao+1 WHERE empresa_id=p_empresa RETURNING versao INTO v_v.versao;
    v_resultado:=jsonb_build_object('ok',true,'versao',v_v.versao,'repetida',false);
  END;
  INSERT INTO public.empresa_atendimento_operacao(chave,usuario_id,empresa_id,operacao,entrada,resultado) VALUES(p_chave,v_eu,p_empresa,p_operacao,v_entrada,v_resultado);
  RETURN v_resultado;
END;
$$;

CREATE FUNCTION funil_empresa_devolver(p_empresa uuid,p_chave uuid,p_versao integer,p_negociacao uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.atendimento_executar(p_empresa,p_chave,p_versao,'devolver_funil',jsonb_build_object('negociacaoId',p_negociacao));
$$;
REVOKE EXECUTE ON FUNCTION funil_sem_interesse_recentes(),funil_empresa_devolver(uuid,uuid,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION funil_sem_interesse_recentes(),funil_empresa_devolver(uuid,uuid,integer,uuid) TO app_usuario;
COMMIT;
