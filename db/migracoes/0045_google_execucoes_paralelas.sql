-- ver docs/db/0045.md
BEGIN;
ALTER TABLE google_execucao ADD COLUMN vendedor_id uuid;
UPDATE google_execucao e SET vendedor_id=p.vendedor_id FROM google_planejamento p WHERE p.id=e.pedido_id;
ALTER TABLE google_execucao ALTER COLUMN vendedor_id SET NOT NULL;
ALTER TABLE google_planejamento ADD CONSTRAINT google_planejamento_id_vendedor_unico UNIQUE(id,vendedor_id);
ALTER TABLE google_execucao ADD CONSTRAINT google_execucao_pedido_vendedor_fk FOREIGN KEY(pedido_id,vendedor_id) REFERENCES google_planejamento(id,vendedor_id) ON DELETE RESTRICT;
DROP INDEX google_execucao_recurso_unico;
CREATE UNIQUE INDEX google_execucao_executor_aberto_unico ON google_execucao(executor_id) WHERE concluido_em IS NULL;
CREATE UNIQUE INDEX google_execucao_vendedor_aberto_unico ON google_execucao(vendedor_id) WHERE concluido_em IS NULL;
CREATE OR REPLACE FUNCTION google_coordenar_legado_em(p_executor uuid,p_agora timestamptz) RETURNS jsonb
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
    IF v_execucao.contrato<>1 OR v_execucao.executor_id<>p_executor OR v_execucao.gestor_id<>public.usuario_atual() THEN
      RETURN jsonb_build_object('pedido',NULL,'ocupado',true);
    END IF;
    SELECT * INTO v_pedido FROM public.google_planejamento WHERE id=v_execucao.pedido_id;
    RETURN jsonb_build_object('pedido',to_jsonb(v_pedido),'agente',v_pedido.vendedor_id);
  END IF;
  SELECT * INTO v_pedido FROM public.google_planejamento p WHERE estado IN ('coletando','validando','falhou') AND NOT EXISTS (SELECT 1 FROM public.google_execucao e WHERE e.pedido_id=p.id) ORDER BY iniciado_em,id LIMIT 1;
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
  INSERT INTO public.google_execucao(executor_id,gestor_id,pedido_id,vendedor_id,contrato) VALUES (p_executor,public.usuario_atual(),v_pedido.id,v_pedido.vendedor_id,1);
  RETURN jsonb_build_object('pedido',to_jsonb(v_pedido),'agente',v_pedido.vendedor_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_coordenar_legado_em(uuid,timestamptz) FROM PUBLIC;
CREATE OR REPLACE FUNCTION google_coordenar_em(p_executor uuid,p_agora timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  local_agora timestamp := p_agora AT TIME ZONE 'America/Sao_Paulo';
  d date;
  p public.google_planejamento%ROWTYPE;
  e public.google_execucao%ROWTYPE;
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'sem permissao' USING ERRCODE='42501'; END IF;
  IF p_executor IS NULL THEN RAISE EXCEPTION 'executor obrigatorio' USING ERRCODE='55000'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  PERFORM u.id FROM public.usuario u WHERE u.id=public.usuario_atual() OR u.id IN (SELECT vendedor_id FROM public.google_planejamento WHERE estado IN ('planejado','aguardando','coletando','validando','falhou')) ORDER BY u.id FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'sem permissao' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM public.google_execucao WHERE executor_id=p_executor AND concluido_em IS NULL FOR UPDATE;
  IF FOUND THEN
    IF e.gestor_id<>public.usuario_atual() THEN RETURN jsonb_build_object('pedido',NULL,'ocupado',true); END IF;
    IF e.contrato=1 THEN RETURN public.google_coordenar_legado_em(p_executor,p_agora); END IF;
    SELECT * INTO p FROM public.google_planejamento WHERE id=e.pedido_id;
  ELSE
    IF EXISTS (SELECT 1 FROM public.google_execucao WHERE concluido_em IS NULL AND contrato=1) THEN RETURN jsonb_build_object('pedido',NULL,'ocupado',true); END IF;
    IF EXISTS (SELECT 1 FROM public.google_planejamento p0 WHERE p0.estado IN ('coletando','validando','falhou') AND NOT EXISTS (SELECT 1 FROM public.google_execucao x WHERE x.pedido_id=p0.id)) THEN
      IF EXISTS (SELECT 1 FROM public.google_execucao WHERE concluido_em IS NULL) THEN RETURN jsonb_build_object('pedido',NULL,'ocupado',true); END IF;
      RETURN public.google_coordenar_legado_em(p_executor,p_agora);
    END IF;
    IF (SELECT count(*) FROM public.google_execucao WHERE concluido_em IS NULL)>=3 THEN RETURN jsonb_build_object('pedido',NULL,'ocupado',true); END IF;
    IF extract(isodow FROM local_agora)<=5 AND local_agora::time>=time '17:00' THEN
      d := local_agora::date+CASE WHEN extract(isodow FROM local_agora)=5 THEN 3 ELSE 1 END;
      UPDATE public.google_planejamento SET estado='cancelado',motivo='Dia planejado passou sem iniciar a busca.' WHERE dia<=local_agora::date AND estado IN ('planejado','aguardando');
      INSERT INTO public.google_rotina(dia,iniciado_em) VALUES (d,p_agora) ON CONFLICT (dia) DO NOTHING;
    END IF;
    SELECT p0.* INTO p FROM public.google_planejamento p0 JOIN public.google_agente a ON a.vendedor_id=p0.vendedor_id JOIN public.usuario u ON u.id=p0.vendedor_id
      JOIN public.google_rotina fila ON fila.dia=p0.dia
      WHERE p0.dia>=local_agora::date AND p0.criado_em<=fila.iniciado_em AND fila.iniciado_em<=p_agora AND p0.nicho<>'' AND p0.estado IN ('planejado','aguardando') AND NOT a.pausado AND u.ativo AND u.papel='vendedor' AND NOT u.senha_provisoria_pendente
      AND NOT EXISTS (SELECT 1 FROM public.google_execucao x WHERE x.pedido_id=p0.id OR (x.vendedor_id=p0.vendedor_id AND x.concluido_em IS NULL))
      AND EXISTS (SELECT 1 FROM public.google_sincronizacao s WHERE s.pedido_id=p0.id AND s.revisao_confirmada=p0.revisao AND s.envio_id IS NULL)
      ORDER BY p0.dia,p0.criado_em,p0.id LIMIT 1;
    IF NOT FOUND THEN
      SELECT p0.* INTO p FROM public.google_planejamento p0 JOIN public.google_agente a ON a.vendedor_id=p0.vendedor_id JOIN public.usuario u ON u.id=p0.vendedor_id
        JOIN public.google_rotina fila ON fila.dia=p0.dia
        WHERE p0.dia>=local_agora::date AND p0.criado_em<=fila.iniciado_em AND fila.iniciado_em<=p_agora AND p0.nicho<>'' AND p0.estado IN ('planejado','aguardando') AND NOT a.pausado AND u.ativo AND u.papel='vendedor' AND NOT u.senha_provisoria_pendente
        AND NOT EXISTS (SELECT 1 FROM public.google_execucao x WHERE x.pedido_id=p0.id OR (x.vendedor_id=p0.vendedor_id AND x.concluido_em IS NULL))
        ORDER BY p0.dia,p0.criado_em,p0.id LIMIT 1;
      IF FOUND THEN RETURN jsonb_build_object('pedido',NULL,'sincronizar',p.id); END IF;
      RETURN jsonb_build_object('pedido',NULL);
    END IF;
    UPDATE public.google_planejamento SET estado='coletando',iniciado_em=p_agora,snapshot=jsonb_build_object('nicho',p.nicho,'bairro',p.bairro,'cidade',p.cidade,'uf',p.uf,'criterios',public.google_criterios_normalizar(p.criterios),'revisao',p.revisao) WHERE id=p.id RETURNING * INTO p;
    INSERT INTO public.google_execucao(executor_id,gestor_id,pedido_id,vendedor_id,revisao,snapshot) VALUES (p_executor,public.usuario_atual(),p.id,p.vendedor_id,p.revisao,p.snapshot) RETURNING * INTO e;
  END IF;
  RETURN jsonb_build_object('pedido',to_jsonb(p)||e.snapshot||jsonb_build_object('snapshot',e.snapshot,'execucao_id',e.id,'contrato',2,'snapshot_sha256',encode(sha256(convert_to(e.snapshot::text,'UTF8')),'hex'),'analisadas',e.analisadas,'entregues',e.entregues,
    'lotes',(SELECT count(*) FROM public.google_lote l WHERE l.execucao_id=e.id),'lote_pendente',(SELECT to_jsonb(l) FROM public.google_lote l WHERE l.execucao_id=e.id AND l.concluido_em IS NULL)),'agente',p.vendedor_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_coordenar_em(uuid,timestamptz) FROM PUBLIC;
COMMIT;
