-- ver docs/db/0057.md
BEGIN;
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
    IF p_operacao<>'retomar' AND v_v.arquivada_em IS NOT NULL THEN v_resultado:=jsonb_build_object('ok',false,'motivo','arquivada'); EXIT aplicar; END IF;
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

CREATE OR REPLACE FUNCTION funil_bloquear(p_id uuid) RETURNS negociacao
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_eu uuid := public.usuario_atual(); v_empresa uuid; v_n public.negociacao;
BEGIN
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_eu AND ativo AND papel='vendedor') THEN RETURN NULL; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27,1);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_eu::text,25));
  SELECT empresa_id INTO v_empresa FROM public.negociacao WHERE id=p_id AND vendedor_id=v_eu;
  IF v_empresa IS NULL THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.empresa WHERE id=v_empresa FOR UPDATE;
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=v_eu AND ativo AND papel='vendedor') THEN RETURN NULL; END IF;
  SELECT n.* INTO v_n FROM public.negociacao n JOIN public.empresa_fila f ON f.empresa_id=n.empresa_id
    WHERE n.id=p_id AND n.vendedor_id=v_eu AND f.vendedor_id=v_eu;
  IF NOT EXISTS(SELECT 1 FROM public.empresa_vinculo WHERE empresa_id=v_empresa AND vendedor_id=v_eu) THEN RETURN NULL; END IF;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION funil_etapa_definir(p_id uuid,p_etapa text,p_anterior text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_n public.negociacao;
BEGIN
  v_n := public.funil_bloquear(p_id);
  IF v_n.id IS NULL THEN RETURN 'sem_permissao'; END IF;
  IF public.empresa_atendimento_motivo(v_n.empresa_id) IS NOT NULL THEN RETURN 'desatualizada'; END IF;
  IF EXISTS(SELECT 1 FROM public.empresa_vinculo WHERE empresa_id=v_n.empresa_id AND arquivada_em IS NOT NULL) THEN RETURN 'encerrada'; END IF;
  IF v_n.encerrada_em IS NOT NULL THEN RETURN 'encerrada'; END IF;
  IF v_n.etapa IS DISTINCT FROM p_anterior THEN RETURN 'desatualizada'; END IF;
  IF p_etapa IS NULL OR NOT (
    (v_n.etapa='primeiro_contato' AND p_etapa='em_negociacao') OR
    (v_n.etapa='em_negociacao' AND p_etapa='proposta_enviada')
  ) THEN RETURN 'dados_invalidos'; END IF;
  UPDATE public.negociacao SET etapa=p_etapa WHERE id=p_id;
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION funil_venda_registrar(p_id uuid,p_chave uuid,p_data date,p_valor bigint,p_observacao text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_n public.negociacao; v_v public.venda; v_id uuid; v_nota text := nullif(btrim(p_observacao),'');
BEGIN
  v_n := public.funil_bloquear(p_id);
  IF v_n.id IS NULL THEN RETURN 'sem_permissao'; END IF;
  IF p_chave IS NULL OR p_data IS NULL OR NOT isfinite(p_data) OR p_data<'0001-01-01'::date
    OR p_data>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR p_valor IS NULL OR p_valor<1 OR p_valor>99999999999
    OR length(p_observacao)>2000 THEN RETURN 'dados_invalidos'; END IF;
  SELECT * INTO v_v FROM public.venda WHERE chave=p_chave;
  IF FOUND THEN
    IF v_v.negociacao_id=p_id AND v_v.autor_id=public.usuario_atual() AND v_v.data=p_data
      AND v_v.valor_centavos=p_valor AND v_v.observacao IS NOT DISTINCT FROM v_nota THEN RETURN 'ok'; END IF;
    RETURN 'chave_reutilizada';
  END IF;
  IF public.empresa_atendimento_motivo(v_n.empresa_id) IS NOT NULL THEN RETURN 'desatualizada'; END IF;
  IF EXISTS(SELECT 1 FROM public.empresa_vinculo WHERE empresa_id=v_n.empresa_id AND arquivada_em IS NOT NULL) THEN RETURN 'encerrada'; END IF;
  IF v_n.encerrada_em IS NOT NULL OR public.empresa_cliente(v_n.empresa_id) THEN RETURN 'encerrada'; END IF;
  BEGIN
    INSERT INTO public.venda(empresa_id,autor_id,data,valor_centavos,observacao,chave,negociacao_id)
      VALUES(v_n.empresa_id,public.usuario_atual(),p_data,p_valor,v_nota,p_chave,p_id)
      RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN RETURN 'chave_reutilizada';
  END;
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION carteira_venda_registrar(p_empresa uuid,p_chave uuid,p_data date,p_valor bigint,p_observacao text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_eu uuid := public.usuario_atual(); v_v public.venda; v_nota text := nullif(btrim(p_observacao),'');
BEGIN
  IF NOT public.pode_escrever() OR NOT EXISTS(SELECT 1 FROM public.usuario WHERE id=v_eu AND ativo AND papel='vendedor') THEN RETURN 'sem_permissao'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27,1);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_eu::text,25));
  PERFORM 1 FROM public.empresa WHERE id=p_empresa FOR UPDATE;
  IF NOT public.pode_escrever() OR NOT EXISTS(SELECT 1 FROM public.usuario WHERE id=v_eu AND ativo AND papel='vendedor')
    OR NOT EXISTS(SELECT 1 FROM public.empresa_fila WHERE empresa_id=p_empresa AND vendedor_id=v_eu) THEN RETURN 'sem_permissao'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.empresa_vinculo WHERE empresa_id=p_empresa AND vendedor_id=v_eu) THEN RETURN 'sem_permissao'; END IF;
  IF NOT public.empresa_cliente(p_empresa) THEN RETURN 'nao_cliente'; END IF;
  IF p_chave IS NULL OR p_data IS NULL OR NOT isfinite(p_data) OR p_data<'0001-01-01'::date
    OR p_data>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR p_valor IS NULL OR p_valor<1 OR p_valor>99999999999
    OR length(p_observacao)>2000 THEN RETURN 'dados_invalidos'; END IF;
  SELECT * INTO v_v FROM public.venda WHERE chave=p_chave;
  IF FOUND THEN
    IF v_v.empresa_id=p_empresa AND v_v.negociacao_id IS NULL AND v_v.autor_id=v_eu AND v_v.data=p_data
      AND v_v.valor_centavos=p_valor AND v_v.observacao IS NOT DISTINCT FROM v_nota THEN RETURN 'ok'; END IF;
    RETURN 'chave_reutilizada';
  END IF;
  IF public.empresa_atendimento_motivo(p_empresa) IS NOT NULL THEN RETURN 'desatualizada'; END IF;
  IF EXISTS(SELECT 1 FROM public.empresa_vinculo WHERE empresa_id=p_empresa AND arquivada_em IS NOT NULL) THEN RETURN 'arquivada'; END IF;
  BEGIN
    INSERT INTO public.venda(empresa_id,autor_id,data,valor_centavos,observacao,chave)
      VALUES(p_empresa,v_eu,p_data,p_valor,v_nota,p_chave);
  EXCEPTION WHEN unique_violation THEN RETURN 'chave_reutilizada';
  END;
  RETURN 'ok';
END;
$$;

REVOKE EXECUTE ON FUNCTION fila_reservar(uuid,text,text,text,text,text,uuid,uuid) FROM app_usuario, PUBLIC;
REVOKE EXECUTE ON FUNCTION contato_registrar(uuid,text,text,text,date,text) FROM app_usuario, PUBLIC;
REVOKE EXECUTE ON FUNCTION funil_devolver(uuid,text) FROM app_usuario, PUBLIC;
REVOKE EXECUTE ON FUNCTION prospeccao_pessoal_reservar(uuid,jsonb,uuid) FROM app_usuario, PUBLIC;
REVOKE EXECUTE ON FUNCTION empresa_consultar(text,text,text,text,text,integer,uuid) FROM app_usuario, PUBLIC;
REVOKE EXECUTE ON FUNCTION empresa_filtros(text,text,uuid) FROM app_usuario, PUBLIC;
REVOKE EXECUTE ON FUNCTION empresa_perfil(uuid) FROM app_usuario, PUBLIC;
REVOKE EXECUTE ON FUNCTION empresa_recentes() FROM app_usuario, PUBLIC;
REVOKE EXECUTE ON FUNCTION empresa_sugestoes() FROM app_usuario, PUBLIC;
REVOKE EXECUTE ON FUNCTION grupo_prospeccao_ler(uuid) FROM app_usuario, PUBLIC;
REVOKE EXECUTE ON FUNCTION grupos_prospeccao_listar(integer) FROM app_usuario, PUBLIC;
ALTER POLICY empresa_fila_leitura ON empresa_fila USING (pode_ler() AND (eh_gestor() OR vendedor_id=usuario_atual()));
ALTER POLICY empresa_leitura ON empresa USING (pode_ler() AND (eh_gestor() OR EXISTS(SELECT 1 FROM empresa_fila f WHERE f.empresa_id=empresa.id AND f.vendedor_id=usuario_atual())));
CREATE OR REPLACE FUNCTION empresa_recente_registrar(p_empresa uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(public.usuario_atual()::text, 25));
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.empresa WHERE id=p_empresa FOR UPDATE;
  IF NOT public.pode_escrever() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.empresa_vinculo WHERE empresa_id=p_empresa AND vendedor_id=public.usuario_atual()) THEN RETURN false; END IF;
  RETURN public.empresa_recente_gravar(public.usuario_atual(), p_empresa);
END;
$$;
CREATE OR REPLACE FUNCTION empresa_dados_cadastrais_ler(p_empresa uuid) RETURNS SETOF empresa_dados_cadastrais
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.pode_ler() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF NOT public.eh_gestor() AND NOT EXISTS(SELECT 1 FROM public.empresa_vinculo WHERE empresa_id=p_empresa AND vendedor_id=public.usuario_atual())
    AND NOT EXISTS(SELECT 1 FROM public.empresa_fila WHERE empresa_id=p_empresa AND vendedor_id=public.usuario_atual()) THEN RETURN; END IF;
  RETURN QUERY SELECT d.* FROM public.empresa_dados_cadastrais d WHERE d.empresa_id=p_empresa;
END;
$$;
REVOKE EXECUTE ON FUNCTION busca_empresa_grupos_google() FROM app_usuario, PUBLIC;
COMMIT;
