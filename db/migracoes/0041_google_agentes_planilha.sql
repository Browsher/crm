-- ver docs/db/0041.md
BEGIN;
CREATE TABLE google_agente (
  vendedor_id uuid PRIMARY KEY REFERENCES usuario(id) ON DELETE RESTRICT,
  pausado boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE google_agente ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_agente_leitura ON google_agente FOR SELECT TO app_usuario
  USING (pode_ler() AND (eh_gestor() OR vendedor_id=usuario_atual()));
GRANT SELECT ON google_agente TO app_usuario;
INSERT INTO google_agente(vendedor_id) SELECT id FROM usuario WHERE papel='vendedor';
CREATE FUNCTION google_agente_usuario() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.papel='vendedor' THEN INSERT INTO public.google_agente(vendedor_id) VALUES (NEW.id) ON CONFLICT DO NOTHING; END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_agente_usuario() FROM PUBLIC;
CREATE TRIGGER google_agente_usuario AFTER INSERT OR UPDATE OF papel ON usuario FOR EACH ROW EXECUTE FUNCTION google_agente_usuario();
CREATE FUNCTION google_agente_definir(p_vendedor uuid,p_pausado boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  PERFORM id FROM public.usuario WHERE id IN (public.usuario_atual(),p_vendedor) ORDER BY id FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF p_pausado IS NULL OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=p_vendedor AND papel='vendedor') THEN
    RAISE EXCEPTION 'vendedor invalido' USING ERRCODE='22023';
  END IF;
  UPDATE public.google_agente SET pausado=p_pausado,atualizado_em=clock_timestamp() WHERE vendedor_id=p_vendedor;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_agente_definir(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_agente_definir(uuid,boolean) TO app_usuario;
ALTER TABLE google_planejamento ADD COLUMN revisao integer NOT NULL DEFAULT 1 CHECK (revisao>0);
CREATE SEQUENCE google_planilha_linha START 2;
CREATE TABLE google_sincronizacao (
  pedido_id uuid PRIMARY KEY REFERENCES google_planejamento(id) ON DELETE RESTRICT,
  linha integer NOT NULL UNIQUE DEFAULT nextval('google_planilha_linha') CHECK (linha BETWEEN 2 AND 200000),
  versao integer NOT NULL DEFAULT 1,
  revisao integer NOT NULL,
  versao_confirmada integer NOT NULL DEFAULT 0,
  revisao_confirmada integer NOT NULL DEFAULT 0,
  destino text,
  envio_id uuid,
  envio_versao integer,
  erro text,
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  confirmada_em timestamptz
);
ALTER TABLE google_sincronizacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_sincronizacao_leitura ON google_sincronizacao FOR SELECT TO app_usuario
  USING (pode_ler() AND (eh_gestor() OR EXISTS (
    SELECT 1 FROM google_planejamento p WHERE p.id=pedido_id AND p.vendedor_id=usuario_atual())));
GRANT SELECT ON google_sincronizacao TO app_usuario;
INSERT INTO google_sincronizacao(pedido_id,revisao) SELECT id,revisao FROM google_planejamento ORDER BY criado_em,id;
CREATE TABLE google_planilha_tentativa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES google_sincronizacao(pedido_id) ON DELETE RESTRICT,
  versao integer NOT NULL,
  celulas jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pedido_id,versao)
);
ALTER TABLE google_planilha_tentativa ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_planilha_tentativa_leitura ON google_planilha_tentativa FOR SELECT TO app_usuario USING (eh_gestor());
GRANT SELECT ON google_planilha_tentativa TO app_usuario;
CREATE FUNCTION google_planejamento_revisar() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (NEW.nicho,NEW.bairro,NEW.cidade,NEW.uf) IS DISTINCT FROM (OLD.nicho,OLD.bairro,OLD.cidade,OLD.uf) THEN
    NEW.revisao := OLD.revisao+1;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_planejamento_revisar() FROM PUBLIC;
CREATE TRIGGER google_planejamento_revisar BEFORE UPDATE ON google_planejamento FOR EACH ROW EXECUTE FUNCTION google_planejamento_revisar();
CREATE FUNCTION google_planejamento_espelhar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.google_sincronizacao(pedido_id,revisao) VALUES (NEW.id,NEW.revisao)
    ON CONFLICT (pedido_id) DO UPDATE SET versao=public.google_sincronizacao.versao+1,revisao=NEW.revisao,
      atualizada_em=clock_timestamp(),erro=NULL;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_planejamento_espelhar() FROM PUBLIC;
CREATE TRIGGER google_planejamento_espelhar AFTER INSERT OR UPDATE ON google_planejamento FOR EACH ROW EXECUTE FUNCTION google_planejamento_espelhar();
ALTER FUNCTION google_planejar(date,text,text,text,text) RENAME TO google_planejar_interno;
REVOKE EXECUTE ON FUNCTION google_planejar_interno(date,text,text,text,text) FROM app_usuario;
CREATE FUNCTION google_planejar(p_dia date,p_nicho text,p_bairro text,p_cidade text,p_uf text) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  PERFORM id FROM public.usuario WHERE id=public.usuario_atual() FOR SHARE;
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=public.usuario_atual() AND papel='vendedor') THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501';
  END IF;
  RETURN public.google_planejar_interno(p_dia,p_nicho,p_bairro,p_cidade,p_uf);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_planejar(date,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_planejar(date,text,text,text,text) TO app_usuario;
CREATE FUNCTION google_planilha_preparar(p_id uuid,p_destino text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.google_sincronizacao%ROWTYPE;
  v_dados jsonb;
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF p_destino IS NULL OR p_destino !~ '^[A-Za-z0-9_-]{1,255}:[0-9]{1,10}$' THEN
    RAISE EXCEPTION 'destino invalido' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(41,2);
  PERFORM id FROM public.usuario WHERE id=public.usuario_atual() FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.google_sincronizacao WHERE pedido_id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido invalido' USING ERRCODE='22023'; END IF;
  IF v.destino IS NOT NULL AND v.destino<>p_destino THEN RAISE EXCEPTION 'destino divergente' USING ERRCODE='55000'; END IF;
  UPDATE public.google_sincronizacao SET destino=p_destino WHERE pedido_id=p_id;
  SELECT jsonb_build_object('id',p.id,'vendedor_id',p.vendedor_id,'vendedor',u.nome,'dia',p.dia,'nicho',p.nicho,
    'bairro',p.bairro,'cidade',p.cidade,'uf',p.uf,'estado',p.estado,'atualizado_em',
    to_char(v.atualizada_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) INTO v_dados
    FROM public.google_planejamento p JOIN public.usuario u ON u.id=p.vendedor_id WHERE p.id=p_id;
  RETURN jsonb_build_object('pedido',p_id,'linha',v.linha,'versao',v.versao,'revisao',v.revisao,'envio_id',v.envio_id,'dados',v_dados,
    'anteriores',coalesce((SELECT jsonb_agg(t.celulas ORDER BY t.versao) FROM public.google_planilha_tentativa t WHERE t.pedido_id=p_id),'[]'::jsonb));
END;
$$;
REVOKE EXECUTE ON FUNCTION google_planilha_preparar(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_planilha_preparar(uuid,text) TO app_usuario;
CREATE FUNCTION google_planilha_intencao(p_id uuid,p_versao integer,p_celulas jsonb,p_envio uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.google_sincronizacao%ROWTYPE;
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(41,2);
  PERFORM id FROM public.usuario WHERE id=public.usuario_atual() FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.google_sincronizacao WHERE pedido_id=p_id FOR UPDATE;
  IF NOT FOUND OR v.versao<>p_versao OR v.destino IS NULL OR v.envio_id IS NOT NULL THEN RETURN false; END IF;
  IF p_celulas IS NULL OR jsonb_typeof(p_celulas)<>'array' OR jsonb_array_length(p_celulas)<>13
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_celulas) x WHERE jsonb_typeof(x.value)<>'string')
    OR p_celulas->>0 IS DISTINCT FROM p_id::text OR p_celulas->>1 IS DISTINCT FROM v.revisao::text
    OR p_celulas->>12 IS DISTINCT FROM p_versao::text OR pg_column_size(p_celulas)>20000 THEN
    RAISE EXCEPTION 'intencao invalida' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.google_planilha_tentativa WHERE pedido_id=p_id AND versao=p_versao AND celulas IS DISTINCT FROM p_celulas) THEN
    RAISE EXCEPTION 'intencao divergente' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.google_planilha_tentativa(pedido_id,versao,celulas) VALUES (p_id,p_versao,p_celulas) ON CONFLICT DO NOTHING;
  IF p_envio IS NOT NULL THEN
    UPDATE public.google_sincronizacao SET envio_id=p_envio,envio_versao=p_versao WHERE pedido_id=p_id;
  END IF;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_planilha_intencao(uuid,integer,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_planilha_intencao(uuid,integer,jsonb,uuid) TO app_usuario;
CREATE FUNCTION google_planilha_liberar(p_id uuid,p_envio uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(41,2);
  PERFORM id FROM public.usuario WHERE id=public.usuario_atual() FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  UPDATE public.google_sincronizacao SET envio_id=NULL,envio_versao=NULL WHERE pedido_id=p_id AND envio_id=p_envio;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_planilha_liberar(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_planilha_liberar(uuid,uuid) TO app_usuario;
CREATE FUNCTION google_planilha_confirmar(p_id uuid,p_versao integer,p_erro text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(41,2);
  PERFORM id FROM public.usuario WHERE id=public.usuario_atual() FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF p_erro IS NOT NULL AND (length(p_erro)>500 OR p_erro ~ '[[:cntrl:]]') THEN
    RAISE EXCEPTION 'motivo invalido' USING ERRCODE='22023';
  END IF;
  UPDATE public.google_sincronizacao SET erro=p_erro,
    versao_confirmada=CASE WHEN p_erro IS NULL THEN versao ELSE versao_confirmada END,
    revisao_confirmada=CASE WHEN p_erro IS NULL THEN revisao ELSE revisao_confirmada END,
    confirmada_em=CASE WHEN p_erro IS NULL THEN clock_timestamp() ELSE confirmada_em END
    WHERE pedido_id=p_id AND versao=p_versao AND destino IS NOT NULL AND (p_erro IS NOT NULL OR envio_id IS NULL);
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_planilha_confirmar(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_planilha_confirmar(uuid,integer,text) TO app_usuario;
CREATE TABLE google_execucao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executor_id uuid NOT NULL,
  gestor_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  pedido_id uuid NOT NULL UNIQUE REFERENCES google_planejamento(id) ON DELETE RESTRICT,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz
);
CREATE UNIQUE INDEX google_execucao_recurso_unico ON google_execucao((true)) WHERE concluido_em IS NULL;
ALTER TABLE google_execucao ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_execucao_leitura ON google_execucao FOR SELECT TO app_usuario
  USING (pode_ler() AND (eh_gestor() OR EXISTS (
    SELECT 1 FROM google_planejamento p WHERE p.id=pedido_id AND p.vendedor_id=usuario_atual())));
GRANT SELECT ON google_execucao TO app_usuario;
ALTER FUNCTION google_agente_proximo() RENAME TO google_proximo_legado;
REVOKE EXECUTE ON FUNCTION google_proximo_legado() FROM app_usuario;
CREATE FUNCTION google_coordenar_em(p_executor uuid,p_agora timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_dia date := (p_agora AT TIME ZONE 'America/Sao_Paulo')::date;
  v_pedido public.google_planejamento%ROWTYPE;
  v_execucao public.google_execucao%ROWTYPE;
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF p_executor IS NULL THEN RAISE EXCEPTION 'executor obrigatorio' USING ERRCODE='55000'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  PERFORM u.id FROM public.usuario u WHERE u.id=public.usuario_atual() OR u.id IN (
    SELECT p.vendedor_id FROM public.google_planejamento p WHERE p.estado IN ('planejado','aguardando','coletando','validando','falhou')
  ) ORDER BY u.id FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_execucao FROM public.google_execucao WHERE concluido_em IS NULL;
  IF FOUND THEN
    IF v_execucao.executor_id<>p_executor OR v_execucao.gestor_id<>public.usuario_atual() THEN
      RETURN jsonb_build_object('pedido',NULL,'ocupado',true);
    END IF;
    SELECT * INTO v_pedido FROM public.google_planejamento WHERE id=v_execucao.pedido_id;
    RETURN jsonb_build_object('pedido',to_jsonb(v_pedido),'agente',v_pedido.vendedor_id);
  END IF;
  SELECT * INTO v_pedido FROM public.google_planejamento WHERE estado IN ('coletando','validando','falhou') ORDER BY iniciado_em,id LIMIT 1;
  IF NOT FOUND THEN
    UPDATE public.google_planejamento SET estado='cancelado',motivo='Dia planejado passou sem iniciar a busca.'
      WHERE dia<v_dia AND estado IN ('planejado','aguardando');
    IF extract(isodow FROM v_dia) NOT BETWEEN 1 AND 5 OR (p_agora AT TIME ZONE 'America/Sao_Paulo')::time<time '09:00' THEN
      RETURN jsonb_build_object('pedido',NULL);
    END IF;
    INSERT INTO public.google_rotina(dia,iniciado_em) VALUES (v_dia,p_agora) ON CONFLICT (dia) DO NOTHING;
    IF FOUND THEN
      UPDATE public.google_planejamento p SET estado='aguardando',snapshot=jsonb_build_object('nicho',p.nicho,'bairro',p.bairro,'cidade',p.cidade,'uf',p.uf)
        FROM public.usuario u WHERE p.dia=v_dia AND p.estado='planejado' AND u.id=p.vendedor_id AND u.ativo AND u.papel='vendedor' AND NOT u.senha_provisoria_pendente;
    END IF;
    UPDATE public.google_planejamento p SET estado='cancelado',motivo='Vendedor indisponível.'
      WHERE p.estado='aguardando' AND NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id=p.vendedor_id AND u.ativo AND u.papel='vendedor' AND NOT u.senha_provisoria_pendente);
    SELECT p.* INTO v_pedido FROM public.google_planejamento p JOIN public.google_agente a ON a.vendedor_id=p.vendedor_id
      WHERE p.estado='aguardando' AND p.dia=v_dia AND NOT a.pausado ORDER BY p.criado_em,p.id LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('pedido',NULL); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.google_sincronizacao s WHERE s.pedido_id=v_pedido.id AND s.revisao_confirmada=v_pedido.revisao AND s.envio_id IS NULL) THEN
      RETURN jsonb_build_object('pedido',NULL,'sincronizar',v_pedido.id);
    END IF;
    UPDATE public.google_planejamento SET estado='coletando',iniciado_em=p_agora WHERE id=v_pedido.id RETURNING * INTO v_pedido;
  END IF;
  INSERT INTO public.google_execucao(executor_id,gestor_id,pedido_id) VALUES (p_executor,public.usuario_atual(),v_pedido.id);
  RETURN jsonb_build_object('pedido',to_jsonb(v_pedido),'agente',v_pedido.vendedor_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_coordenar_em(uuid,timestamptz) FROM PUBLIC;
CREATE FUNCTION google_agente_proximo(p_executor uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.google_coordenar_em(p_executor,clock_timestamp());
$$;
REVOKE EXECUTE ON FUNCTION google_agente_proximo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_agente_proximo(uuid) TO app_usuario;
CREATE FUNCTION google_execucao_validar(p_id uuid,p_executor uuid,p_concluida boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  PERFORM id FROM public.usuario WHERE id=public.usuario_atual() FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF p_executor IS NULL OR NOT EXISTS (SELECT 1 FROM public.google_execucao WHERE pedido_id=p_id AND executor_id=p_executor
    AND gestor_id=public.usuario_atual() AND (p_concluida OR concluido_em IS NULL)) THEN
    RAISE EXCEPTION 'execucao indisponivel, reconcilie o mesmo pedido' USING ERRCODE='55000';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_execucao_validar(uuid,uuid,boolean) FROM PUBLIC;
ALTER FUNCTION google_agente_etapa(uuid,text,text) RENAME TO google_etapa_interna;
REVOKE EXECUTE ON FUNCTION google_etapa_interna(uuid,text,text) FROM app_usuario;
CREATE FUNCTION google_agente_etapa(p_id uuid,p_estado text,p_motivo text,p_executor uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.google_execucao_validar(p_id,p_executor);
  PERFORM public.google_etapa_interna(p_id,p_estado,p_motivo);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_agente_etapa(uuid,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_agente_etapa(uuid,text,text,uuid) TO app_usuario;
ALTER FUNCTION google_agente_entregar(uuid,jsonb,jsonb) RENAME TO google_publicar_interno;
REVOKE EXECUTE ON FUNCTION google_publicar_interno(uuid,jsonb,jsonb) FROM app_usuario;
CREATE FUNCTION google_agente_entregar(p_id uuid,p_empresas jsonb,p_recibo jsonb,p_executor uuid DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_resultado text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  PERFORM public.google_execucao_validar(p_id,p_executor,true);
  v_resultado := public.google_publicar_interno(p_id,p_empresas,p_recibo);
  UPDATE public.google_execucao SET concluido_em=coalesce(concluido_em,clock_timestamp()) WHERE pedido_id=p_id;
  RETURN v_resultado;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_agente_entregar(uuid,jsonb,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_agente_entregar(uuid,jsonb,jsonb,uuid) TO app_usuario;
COMMIT;
