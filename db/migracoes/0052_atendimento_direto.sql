-- ver docs/db/0052.md
BEGIN;
ALTER TABLE negociacao DROP CONSTRAINT negociacao_encerramento_check;
ALTER TABLE negociacao ADD CONSTRAINT negociacao_encerramento_check CHECK (encerramento IN ('venda','devolucao','inatividade','sem_interesse'));

ALTER POLICY empresa_leitura ON empresa USING (
  pode_ler() AND (eh_gestor() OR EXISTS (SELECT 1 FROM empresa_fila f WHERE f.empresa_id=empresa.id
    AND (f.vendedor_id=usuario_atual() OR (f.reservado_por=usuario_atual() AND f.reservado_ate>now()))))
);
ALTER POLICY contato_leitura ON contato USING (pode_ler() AND EXISTS (SELECT 1 FROM empresa e WHERE e.id=contato.empresa_id));

CREATE POLICY empresa_dados_cadastrais_vinculo ON empresa_dados_cadastrais FOR SELECT TO app_usuario USING (
  pode_ler() AND EXISTS (SELECT 1 FROM empresa_vinculo v WHERE v.empresa_id=empresa_dados_cadastrais.empresa_id AND v.vendedor_id=usuario_atual())
);
CREATE OR REPLACE FUNCTION empresa_dados_cadastrais_ler(p_empresa uuid) RETURNS SETOF empresa_dados_cadastrais
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_pessoal boolean;
BEGIN
  IF NOT public.pode_ler() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  v_pessoal := EXISTS (SELECT 1 FROM public.empresa_vinculo WHERE empresa_id=p_empresa AND vendedor_id=public.usuario_atual());
  IF NOT public.eh_gestor() AND NOT v_pessoal AND NOT public.empresa_visivel_prospeccao(p_empresa) THEN RETURN; END IF;
  RETURN QUERY SELECT d.empresa_id,d.fonte,d.coletado_em,d.situacao,d.porte,d.data_abertura,
    d.logradouro,d.numero,d.complemento,d.bairro,d.cidade,d.uf,
    CASE WHEN public.eh_gestor() OR v_pessoal OR EXISTS (SELECT 1 FROM public.empresa_fila f WHERE f.empresa_id=p_empresa
      AND (f.vendedor_id=public.usuario_atual() OR (f.reservado_por=public.usuario_atual() AND f.reservado_ate>now())))
      THEN d.telefones ELSE '[]'::jsonb END,d.detalhes FROM public.empresa_dados_cadastrais d WHERE d.empresa_id=p_empresa;
END;
$$;

CREATE FUNCTION atendimento_estado_alterado() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.empresa WHERE id=NEW.empresa_id FOR UPDATE;
  UPDATE public.empresa_vinculo SET versao=versao+1 WHERE empresa_id=NEW.empresa_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION atendimento_estado_alterado() FROM PUBLIC;
CREATE TRIGGER atendimento_contato_estado AFTER INSERT ON contato FOR EACH ROW EXECUTE FUNCTION atendimento_estado_alterado();
CREATE TRIGGER atendimento_negociacao_estado AFTER INSERT OR UPDATE ON negociacao FOR EACH ROW EXECUTE FUNCTION atendimento_estado_alterado();
CREATE TRIGGER atendimento_venda_estado AFTER INSERT ON venda FOR EACH ROW EXECUTE FUNCTION atendimento_estado_alterado();

CREATE FUNCTION atendimento_arquivar_interno(p_empresa uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.negociacao SET encerrada_em=clock_timestamp(),encerramento='sem_interesse' WHERE empresa_id=p_empresa AND encerrada_em IS NULL;
  UPDATE public.empresa_vinculo SET arquivada_em=clock_timestamp(),agenda_contato_id=NULL WHERE empresa_id=p_empresa;
END;
$$;
REVOKE EXECUTE ON FUNCTION atendimento_arquivar_interno(uuid) FROM PUBLIC;

CREATE FUNCTION atendimento_executar(p_empresa uuid,p_chave uuid,p_versao integer,p_operacao text,p_entrada jsonb) RETURNS jsonb
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
REVOKE EXECUTE ON FUNCTION atendimento_executar(uuid,uuid,integer,text,jsonb) FROM PUBLIC;

CREATE FUNCTION atendimento_iniciar(p_empresa uuid,p_chave uuid,p_versao integer) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$ SELECT public.atendimento_executar(p_empresa,p_chave,p_versao,'iniciar','{}'); $$;
CREATE FUNCTION contato_registrar_direto(p_empresa uuid,p_chave uuid,p_versao integer,p_tipo text,p_nota text,p_passo text,p_data text) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$ SELECT public.atendimento_executar(p_empresa,p_chave,p_versao,'contato',jsonb_build_object('tipo',p_tipo,'nota',nullif(btrim(p_nota),''),'proximoPasso',nullif(btrim(p_passo),''),'proximoPassoData',nullif(btrim(p_data),''))); $$;
CREATE FUNCTION empresa_sem_interesse_definir(p_empresa uuid,p_chave uuid,p_versao integer,p_negociacao uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$ SELECT public.atendimento_executar(p_empresa,p_chave,p_versao,'arquivar',jsonb_build_object('negociacaoId',p_negociacao)); $$;
CREATE FUNCTION empresa_atendimento_retomar(p_empresa uuid,p_chave uuid,p_versao integer) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$ SELECT public.atendimento_executar(p_empresa,p_chave,p_versao,'retomar','{}'); $$;
REVOKE EXECUTE ON FUNCTION atendimento_iniciar(uuid,uuid,integer),contato_registrar_direto(uuid,uuid,integer,text,text,text,text),empresa_sem_interesse_definir(uuid,uuid,integer,uuid),empresa_atendimento_retomar(uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION atendimento_iniciar(uuid,uuid,integer),contato_registrar_direto(uuid,uuid,integer,text,text,text,text),empresa_sem_interesse_definir(uuid,uuid,integer,uuid),empresa_atendimento_retomar(uuid,uuid,integer) TO app_usuario;
COMMIT;
