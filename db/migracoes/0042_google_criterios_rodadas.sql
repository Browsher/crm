-- ver docs/db/0042.md
BEGIN;
CREATE FUNCTION google_criterios_normalizar(p jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v jsonb := '{"termos":"","produtos":"","tipos":[],"atendimento":"","excluir":"","situacao":"","site":[],"email":[],"telefone":[],"nota":null,"avaliacoes":null,"prioridades":"","observacoes":""}';
  k text;
  opcoes jsonb;
  x jsonb;
BEGIN
  IF p IS NULL OR p='null'::jsonb THEN RETURN v; END IF;
  IF jsonb_typeof(p)<>'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(p) t WHERE NOT v ? t) THEN
    RAISE EXCEPTION 'criterios invalidos' USING ERRCODE='22023';
  END IF;
  v := v || p;
  FOREACH k IN ARRAY ARRAY['termos','produtos','excluir','prioridades','observacoes'] LOOP
    IF jsonb_typeof(v->k)<>'string' OR length(v->>k)>2000 OR (v->>k) ~ U&'[\0001-\0008\000B\000C\000E-\001F\007F-\009F]' THEN
      RAISE EXCEPTION 'texto invalido' USING ERRCODE='22023';
    END IF;
    v := jsonb_set(v,ARRAY[k],to_jsonb(btrim(replace(replace(v->>k,E'\r\n',E'\n'),E'\r',E'\n'))));
  END LOOP;
  FOREACH k IN ARRAY ARRAY['tipos','site','email','telefone'] LOOP
    opcoes := CASE k WHEN 'tipos' THEN '["varejista","atacadista","distribuidor","fabricante"]'::jsonb
      WHEN 'telefone' THEN '["whatsapp","fixo"]'::jsonb ELSE '["com","sem"]'::jsonb END;
    IF jsonb_typeof(v->k)<>'array' OR jsonb_array_length(v->k)>100 THEN RAISE EXCEPTION 'opcoes invalidas' USING ERRCODE='22023'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v->k) a WHERE NOT opcoes @> jsonb_build_array(a.value)) THEN
      RAISE EXCEPTION 'opcao invalida' USING ERRCODE='22023';
    END IF;
    SELECT coalesce(jsonb_agg(a.value ORDER BY a.ord),'[]') INTO x FROM jsonb_array_elements(opcoes) WITH ORDINALITY a(value,ord) WHERE v->k @> jsonb_build_array(a.value);
    IF k IN ('site','email') AND jsonb_array_length(x)=2 THEN x := '[]'; END IF;
    v := jsonb_set(v,ARRAY[k],x);
  END LOOP;
  IF v->>'atendimento' NOT IN ('','priorizar_fisica','fisica','online','ambos') OR jsonb_typeof(v->'atendimento')<>'string'
    OR v->>'situacao' NOT IN ('','priorizar_funcionamento','funcionamento','excluir_encerradas','excluir_fechadas') OR jsonb_typeof(v->'situacao')<>'string' THEN
    RAISE EXCEPTION 'escolha invalida' USING ERRCODE='22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['nota','avaliacoes'] LOOP
    IF v->k<>'null'::jsonb THEN
      IF jsonb_typeof(v->k)<>'number' THEN RAISE EXCEPTION 'numero invalido' USING ERRCODE='22023'; END IF;
      IF (v->>k)::numeric<0 OR (k='nota' AND (v->>k)::numeric>5)
        OR (k='avaliacoes' AND ((v->>k)::numeric>9007199254740991 OR trunc((v->>k)::numeric)<>(v->>k)::numeric)) THEN
        RAISE EXCEPTION 'numero fora do intervalo' USING ERRCODE='22023';
      END IF;
    END IF;
  END LOOP;
  RETURN v;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_criterios_normalizar(jsonb) FROM PUBLIC;
ALTER TABLE google_planejamento ADD COLUMN criterios jsonb NOT NULL DEFAULT '{}';
ALTER TABLE google_planejamento DROP CONSTRAINT google_planejamento_nicho_check;
ALTER TABLE google_planejamento DROP CONSTRAINT google_planejamento_cidade_check;
ALTER TABLE google_planejamento DROP CONSTRAINT google_planejamento_uf_check;
ALTER TABLE google_planejamento ADD CONSTRAINT google_planejamento_campos_check CHECK (
  (nicho='' AND bairro='' AND cidade='' AND uf='') OR
  (length(btrim(nicho)) BETWEEN 1 AND 100 AND nicho !~ '[[:cntrl:]]' AND length(btrim(cidade)) BETWEEN 1 AND 100 AND cidade !~ '[[:cntrl:]]'
    AND uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')));
CREATE OR REPLACE FUNCTION google_planejamento_revisar() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.criterios := public.google_criterios_normalizar(NEW.criterios);
  IF (NEW.nicho,NEW.bairro,NEW.cidade,NEW.uf,NEW.criterios) IS DISTINCT FROM (OLD.nicho,OLD.bairro,OLD.cidade,OLD.uf,public.google_criterios_normalizar(OLD.criterios)) THEN NEW.revisao := OLD.revisao+1; END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION google_planejamento_salvar_semana(p_dias jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  x jsonb;
  d date;
  n text;
  b text;
  c text;
  u text;
  v_id uuid;
  ids jsonb := '[]';
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  PERFORM id FROM public.usuario WHERE id=public.usuario_atual() FOR SHARE;
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=public.usuario_atual() AND papel='vendedor') THEN RAISE EXCEPTION 'sem permissao' USING ERRCODE='42501'; END IF;
  IF p_dias IS NULL OR jsonb_typeof(p_dias)<>'array' OR jsonb_array_length(p_dias) NOT BETWEEN 1 AND 10 OR pg_column_size(p_dias)>160000 THEN RAISE EXCEPTION 'semana invalida' USING ERRCODE='22023'; END IF;
  IF (SELECT count(DISTINCT value->>'dia') FROM jsonb_array_elements(p_dias))<>jsonb_array_length(p_dias) THEN RAISE EXCEPTION 'dias repetidos' USING ERRCODE='22023'; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(p_dias) LOOP
    IF jsonb_typeof(x)<>'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(x) k WHERE k NOT IN ('dia','nicho','bairro','cidade','uf','criterios'))
      OR EXISTS (SELECT 1 FROM unnest(ARRAY['dia','nicho','bairro','cidade','uf']) k WHERE jsonb_typeof(x->k) IS DISTINCT FROM 'string')
      OR x->>'dia' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'dia invalido' USING ERRCODE='22023'; END IF;
    d := (x->>'dia')::date;
    IF d<=(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date OR extract(isodow FROM d)>5 THEN RAISE EXCEPTION 'data bloqueada' USING ERRCODE='22023'; END IF;
    n := btrim(x->>'nicho'); b := btrim(x->>'bairro'); c := btrim(x->>'cidade'); u := upper(btrim(x->>'uf'));
    IF length(b)>100 OR (n||b||c||u) ~ '[[:cntrl:]]' OR (n||b||c||u) ~ U&'[\0080-\009F]'
      OR NOT ((n='' AND b='' AND c='' AND u='') OR (length(n) BETWEEN 1 AND 100 AND length(c) BETWEEN 1 AND 100 AND u IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'))) THEN RAISE EXCEPTION 'plano parcial' USING ERRCODE='22023'; END IF;
    INSERT INTO public.google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,criterios)
      VALUES (public.usuario_atual(),d,n,b,c,u,public.google_criterios_normalizar(x->'criterios'))
      ON CONFLICT (vendedor_id,dia) DO UPDATE SET nicho=excluded.nicho,bairro=excluded.bairro,cidade=excluded.cidade,uf=excluded.uf,criterios=excluded.criterios
      RETURNING id INTO v_id;
    ids := ids || to_jsonb(v_id);
  END LOOP;
  RETURN jsonb_build_object('ids',ids);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'data invalida' USING ERRCODE='22023';
END;
$$;
REVOKE EXECUTE ON FUNCTION google_planejamento_salvar_semana(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_planejamento_salvar_semana(jsonb) TO app_usuario;
CREATE OR REPLACE FUNCTION google_planejar(p_dia date,p_nicho text,p_bairro text,p_cidade text,p_uf text) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb;
BEGIN
  r := public.google_planejamento_salvar_semana(jsonb_build_array(jsonb_build_object('dia',p_dia,'nicho',p_nicho,'bairro',p_bairro,'cidade',p_cidade,'uf',p_uf)));
  RETURN (r->'ids'->>0)::uuid;
END;
$$;
CREATE FUNCTION google_planejamento_copiar(p_origem uuid,p_revisao integer,p_destinos date[],p_campos text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE origem public.google_planejamento%ROWTYPE; d date; destino public.google_planejamento%ROWTYPE; dias jsonb := '[]';
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  PERFORM id FROM public.usuario WHERE id=public.usuario_atual() FOR SHARE;
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=public.usuario_atual() AND papel='vendedor') THEN RAISE EXCEPTION 'sem permissao' USING ERRCODE='42501'; END IF;
  SELECT * INTO origem FROM public.google_planejamento WHERE id=p_origem AND vendedor_id=public.usuario_atual() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'origem indisponivel' USING ERRCODE='42501'; END IF;
  IF p_revisao IS DISTINCT FROM origem.revisao THEN RAISE EXCEPTION 'revisao alterada' USING ERRCODE='55000'; END IF;
  IF p_destinos IS NULL OR cardinality(p_destinos) NOT BETWEEN 1 AND 10 OR p_campos IS NULL OR cardinality(p_campos) NOT BETWEEN 1 AND 3
    OR EXISTS (SELECT 1 FROM unnest(p_campos) k WHERE k IS NULL OR k NOT IN ('nicho','criterios','regiao')) THEN RAISE EXCEPTION 'copia invalida' USING ERRCODE='22023'; END IF;
  FOREACH d IN ARRAY p_destinos LOOP
    IF d IS NULL OR d=origem.dia THEN RAISE EXCEPTION 'destino invalido' USING ERRCODE='22023'; END IF;
    SELECT * INTO destino FROM public.google_planejamento WHERE vendedor_id=public.usuario_atual() AND dia=d;
    dias := dias || jsonb_build_array(jsonb_build_object('dia',d,'nicho',CASE WHEN 'nicho'=ANY(p_campos) THEN origem.nicho ELSE coalesce(destino.nicho,'') END,
      'bairro',CASE WHEN 'regiao'=ANY(p_campos) THEN origem.bairro ELSE coalesce(destino.bairro,'') END,
      'cidade',CASE WHEN 'regiao'=ANY(p_campos) THEN origem.cidade ELSE coalesce(destino.cidade,'') END,
      'uf',CASE WHEN 'regiao'=ANY(p_campos) THEN origem.uf ELSE coalesce(destino.uf,'') END,
      'criterios',CASE WHEN 'criterios'=ANY(p_campos) THEN origem.criterios ELSE coalesce(destino.criterios,'{}') END));
  END LOOP;
  RETURN public.google_planejamento_salvar_semana(dias);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_planejamento_copiar(uuid,integer,date[],text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_planejamento_copiar(uuid,integer,date[],text[]) TO app_usuario;
ALTER TABLE google_execucao ADD COLUMN contrato integer NOT NULL DEFAULT 1 CHECK (contrato IN (1,2));
ALTER TABLE google_execucao ALTER COLUMN contrato SET DEFAULT 2;
ALTER TABLE google_execucao ADD COLUMN revisao integer;
ALTER TABLE google_execucao ADD COLUMN snapshot jsonb;
ALTER TABLE google_execucao ADD COLUMN analisadas integer NOT NULL DEFAULT 0 CHECK (analisadas BETWEEN 0 AND 150);
ALTER TABLE google_execucao ADD COLUMN entregues integer NOT NULL DEFAULT 0 CHECK (entregues BETWEEN 0 AND 50);
ALTER TABLE google_execucao ADD COLUMN motivo_parada text;
CREATE TABLE google_lote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES google_execucao(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES google_planejamento(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 1 AND 3),
  candidatas jsonb NOT NULL CHECK (jsonb_typeof(candidatas)='array' AND jsonb_array_length(candidatas) BETWEEN 1 AND 50),
  recibo jsonb,
  resposta jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  UNIQUE(execucao_id,ordinal)
);
ALTER TABLE google_lote ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_lote_leitura ON google_lote FOR SELECT TO app_usuario USING (pode_ler() AND (eh_gestor() OR EXISTS (SELECT 1 FROM google_planejamento p WHERE p.id=pedido_id AND p.vendedor_id=usuario_atual())));
GRANT SELECT ON google_lote TO app_usuario;
ALTER FUNCTION google_coordenar_em(uuid,timestamptz) RENAME TO google_coordenar_legado_em;
CREATE FUNCTION google_coordenar_em(p_executor uuid,p_agora timestamptz) RETURNS jsonb
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
  SELECT * INTO e FROM public.google_execucao WHERE concluido_em IS NULL FOR UPDATE;
  IF FOUND THEN
    IF e.executor_id<>p_executor OR e.gestor_id<>public.usuario_atual() THEN RETURN jsonb_build_object('pedido',NULL,'ocupado',true); END IF;
    IF e.contrato=1 THEN RETURN public.google_coordenar_legado_em(p_executor,p_agora); END IF;
    SELECT * INTO p FROM public.google_planejamento WHERE id=e.pedido_id;
  ELSE
    IF extract(isodow FROM local_agora)>5 OR local_agora::time<time '17:00' THEN RETURN jsonb_build_object('pedido',NULL); END IF;
    d := local_agora::date+CASE WHEN extract(isodow FROM local_agora)=5 THEN 3 ELSE 1 END;
    UPDATE public.google_planejamento SET estado='cancelado',motivo='Dia planejado passou sem iniciar a busca.' WHERE dia<=local_agora::date AND estado IN ('planejado','aguardando');
    INSERT INTO public.google_rotina(dia,iniciado_em) VALUES (d,p_agora) ON CONFLICT (dia) DO NOTHING;
    SELECT p0.* INTO p FROM public.google_planejamento p0 JOIN public.google_agente a ON a.vendedor_id=p0.vendedor_id JOIN public.usuario u ON u.id=p0.vendedor_id
      WHERE p0.dia=d AND p0.nicho<>'' AND p0.estado IN ('planejado','aguardando') AND NOT a.pausado AND u.ativo AND u.papel='vendedor' AND NOT u.senha_provisoria_pendente
      AND NOT EXISTS (SELECT 1 FROM public.google_execucao x WHERE x.pedido_id=p0.id) ORDER BY p0.criado_em,p0.id LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('pedido',NULL); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.google_sincronizacao s WHERE s.pedido_id=p.id AND s.revisao_confirmada=p.revisao AND s.envio_id IS NULL) THEN RETURN jsonb_build_object('pedido',NULL,'sincronizar',p.id); END IF;
    UPDATE public.google_planejamento SET estado='coletando',iniciado_em=p_agora,snapshot=jsonb_build_object('nicho',p.nicho,'bairro',p.bairro,'cidade',p.cidade,'uf',p.uf,'criterios',public.google_criterios_normalizar(p.criterios),'revisao',p.revisao) WHERE id=p.id RETURNING * INTO p;
    INSERT INTO public.google_execucao(executor_id,gestor_id,pedido_id,revisao,snapshot) VALUES (p_executor,public.usuario_atual(),p.id,p.revisao,p.snapshot) RETURNING * INTO e;
  END IF;
  RETURN jsonb_build_object('pedido',to_jsonb(p)||e.snapshot||jsonb_build_object('snapshot',e.snapshot,'execucao_id',e.id,'contrato',2,'snapshot_sha256',encode(sha256(convert_to(e.snapshot::text,'UTF8')),'hex'),'analisadas',e.analisadas,'entregues',e.entregues),'agente',p.vendedor_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_coordenar_em(uuid,timestamptz) FROM PUBLIC;
CREATE FUNCTION google_agente_reservar_lote(p_id uuid,p_executor uuid,p_lote jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.google_execucao%ROWTYPE; l public.google_lote%ROWTYPE; lote_id uuid; candidatas jsonb; n integer;
BEGIN
  PERFORM public.google_execucao_validar(p_id,p_executor,true);
  SELECT * INTO e FROM public.google_execucao WHERE pedido_id=p_id FOR UPDATE;
  IF e.contrato<>2 OR jsonb_typeof(p_lote) IS DISTINCT FROM 'object' OR coalesce(p_lote->>'lote_id','') !~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$' THEN RAISE EXCEPTION 'lote invalido' USING ERRCODE='22023'; END IF;
  lote_id := (p_lote->>'lote_id')::uuid; candidatas := p_lote->'candidatas';
  SELECT * INTO l FROM public.google_lote WHERE id=lote_id;
  IF FOUND THEN
    IF l.execucao_id<>e.id OR l.candidatas IS DISTINCT FROM candidatas THEN RAISE EXCEPTION 'lote divergente' USING ERRCODE='22023'; END IF;
    RETURN to_jsonb(l);
  END IF;
  IF e.concluido_em IS NOT NULL OR e.entregues>=50 OR e.analisadas>=150 OR EXISTS (SELECT 1 FROM public.google_lote WHERE execucao_id=e.id AND concluido_em IS NULL) THEN RAISE EXCEPTION 'execucao pendente ou esgotada' USING ERRCODE='55000'; END IF;
  IF jsonb_typeof(candidatas) IS DISTINCT FROM 'array' OR jsonb_array_length(candidatas) NOT BETWEEN 1 AND 50 OR pg_column_size(candidatas)>4000000 THEN RAISE EXCEPTION 'candidatas invalidas' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(candidatas) c WHERE jsonb_typeof(c.value)<>'object' OR coalesce(c.value->>'google_place_id','') !~ '^[^[:cntrl:]]{1,255}$')
    OR (SELECT count(DISTINCT c.value->>'google_place_id') FROM jsonb_array_elements(candidatas) c)<>jsonb_array_length(candidatas)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(candidatas) c JOIN public.google_lote a ON a.execucao_id=e.id CROSS JOIN LATERAL jsonb_array_elements(a.candidatas) b WHERE b.value->>'google_place_id'=c.value->>'google_place_id') THEN RAISE EXCEPTION 'identidade repetida ou invalida' USING ERRCODE='22023'; END IF;
  SELECT count(*)+1 INTO n FROM public.google_lote WHERE execucao_id=e.id;
  IF n>3 OR e.analisadas+jsonb_array_length(candidatas)>150 THEN RAISE EXCEPTION 'orcamento esgotado' USING ERRCODE='55000'; END IF;
  INSERT INTO public.google_lote(id,execucao_id,pedido_id,ordinal,candidatas) VALUES (lote_id,e.id,p_id,n,candidatas) RETURNING * INTO l;
  UPDATE public.google_execucao SET analisadas=analisadas+jsonb_array_length(candidatas) WHERE id=e.id;
  RETURN to_jsonb(l);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_agente_reservar_lote(uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_agente_reservar_lote(uuid,uuid,jsonb) TO app_usuario;
CREATE FUNCTION google_agente_concluir(p_id uuid,p_executor uuid,p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.google_execucao%ROWTYPE;
BEGIN
  PERFORM public.google_execucao_validar(p_id,p_executor,true);
  SELECT * INTO e FROM public.google_execucao WHERE pedido_id=p_id FOR UPDATE;
  IF p_motivo IS NULL OR p_motivo NOT IN ('meta_atingida','limite_lotes','sem_novidades','sem_resultados') THEN RAISE EXCEPTION 'motivo invalido' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.google_lote WHERE execucao_id=e.id AND concluido_em IS NULL) THEN RAISE EXCEPTION 'lote pendente' USING ERRCODE='55000'; END IF;
  IF e.concluido_em IS NOT NULL THEN
    IF e.motivo_parada IS DISTINCT FROM p_motivo THEN RAISE EXCEPTION 'conclusao divergente' USING ERRCODE='22023'; END IF;
    RETURN to_jsonb(e);
  END IF;
  IF (p_motivo='meta_atingida' AND e.entregues<50) OR (p_motivo='limite_lotes' AND (SELECT count(*) FROM public.google_lote WHERE execucao_id=e.id)<3) THEN RAISE EXCEPTION 'limite nao atingido' USING ERRCODE='22023'; END IF;
  UPDATE public.google_execucao SET concluido_em=clock_timestamp(),motivo_parada=p_motivo WHERE id=e.id RETURNING * INTO e;
  UPDATE public.google_planejamento SET estado='concluido',concluido_em=e.concluido_em,motivo=p_motivo WHERE id=p_id;
  RETURN to_jsonb(e);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_agente_concluir(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_agente_concluir(uuid,uuid,text) TO app_usuario;
COMMIT;
