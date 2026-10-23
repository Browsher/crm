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
  IF p_dias IS NULL OR jsonb_typeof(p_dias)<>'array' OR jsonb_array_length(p_dias) NOT BETWEEN 1 AND 10 OR pg_column_size(p_dias)>512000 THEN RAISE EXCEPTION 'semana invalida' USING ERRCODE='22023'; END IF;
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
ALTER TABLE google_execucao ADD COLUMN lotes_reservados integer NOT NULL DEFAULT 0 CHECK (lotes_reservados BETWEEN 0 AND 3);
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
CREATE POLICY google_lote_leitura ON google_lote FOR SELECT TO app_usuario USING (pode_ler() AND eh_gestor());
GRANT SELECT ON google_lote TO app_usuario;
ALTER FUNCTION google_coordenar_em(uuid,timestamptz) RENAME TO google_coordenar_legado_em;
CREATE FUNCTION google_coordenar_em(p_executor uuid,p_agora timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  local_agora timestamp := p_agora AT TIME ZONE 'America/Sao_Paulo';
  d date;
  p public.google_planejamento%ROWTYPE;
  e public.google_execucao%ROWTYPE;
  legado jsonb;
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
    IF EXISTS (SELECT 1 FROM public.google_planejamento p0 WHERE p0.estado IN ('coletando','validando','falhou') AND NOT EXISTS (SELECT 1 FROM public.google_execucao x WHERE x.pedido_id=p0.id)) THEN
      legado := public.google_coordenar_legado_em(p_executor,p_agora);
      UPDATE public.google_execucao SET contrato=1 WHERE pedido_id=(legado->'pedido'->>'id')::uuid AND executor_id=p_executor AND gestor_id=public.usuario_atual();
      RETURN legado;
    END IF;
    IF extract(isodow FROM local_agora)<=5 AND local_agora::time>=time '17:00' THEN
      d := local_agora::date+CASE WHEN extract(isodow FROM local_agora)=5 THEN 3 ELSE 1 END;
      UPDATE public.google_planejamento SET estado='cancelado',motivo='Dia planejado passou sem iniciar a busca.' WHERE dia<=local_agora::date AND estado IN ('planejado','aguardando');
      INSERT INTO public.google_rotina(dia,iniciado_em) VALUES (d,p_agora) ON CONFLICT (dia) DO NOTHING;
    END IF;
    SELECT p0.* INTO p FROM public.google_planejamento p0 JOIN public.google_agente a ON a.vendedor_id=p0.vendedor_id JOIN public.usuario u ON u.id=p0.vendedor_id
      JOIN public.google_rotina fila ON fila.dia=p0.dia
      WHERE p0.dia>=local_agora::date AND p0.criado_em<=fila.iniciado_em AND fila.iniciado_em<=p_agora AND p0.nicho<>'' AND p0.estado IN ('planejado','aguardando') AND NOT a.pausado AND u.ativo AND u.papel='vendedor' AND NOT u.senha_provisoria_pendente
      AND NOT EXISTS (SELECT 1 FROM public.google_execucao x WHERE x.pedido_id=p0.id) ORDER BY p0.dia,p0.criado_em,p0.id LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('pedido',NULL); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.google_sincronizacao s WHERE s.pedido_id=p.id AND s.revisao_confirmada=p.revisao AND s.envio_id IS NULL) THEN RETURN jsonb_build_object('pedido',NULL,'sincronizar',p.id); END IF;
    UPDATE public.google_planejamento SET estado='coletando',iniciado_em=p_agora,snapshot=jsonb_build_object('nicho',p.nicho,'bairro',p.bairro,'cidade',p.cidade,'uf',p.uf,'criterios',public.google_criterios_normalizar(p.criterios),'revisao',p.revisao) WHERE id=p.id RETURNING * INTO p;
    INSERT INTO public.google_execucao(executor_id,gestor_id,pedido_id,revisao,snapshot) VALUES (p_executor,public.usuario_atual(),p.id,p.revisao,p.snapshot) RETURNING * INTO e;
  END IF;
  RETURN jsonb_build_object('pedido',to_jsonb(p)||e.snapshot||jsonb_build_object('snapshot',e.snapshot,'execucao_id',e.id,'contrato',2,'snapshot_sha256',encode(sha256(convert_to(e.snapshot::text,'UTF8')),'hex'),'analisadas',e.analisadas,'entregues',e.entregues,
    'lotes',(SELECT count(*) FROM public.google_lote l WHERE l.execucao_id=e.id),'lote_pendente',(SELECT to_jsonb(l) FROM public.google_lote l WHERE l.execucao_id=e.id AND l.concluido_em IS NULL)),'agente',p.vendedor_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_coordenar_em(uuid,timestamptz) FROM PUBLIC;
CREATE FUNCTION google_candidata_identidade(p jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE g text := nullif(p->>'google_place_id',''); c text := nullif(p->>'cnpj','');
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'candidata invalida' USING ERRCODE='22023'; END IF;
  IF g IS NOT NULL AND (jsonb_typeof(p->'google_place_id')<>'string' OR g<>btrim(g) OR length(g)>255 OR g ~ '[[:cntrl:]]' OR g ~ U&'[\0080-\009F]') THEN RAISE EXCEPTION 'place invalido' USING ERRCODE='22023'; END IF;
  IF c IS NOT NULL AND (jsonb_typeof(p->'cnpj')<>'string' OR NOT public.empresa_cnpj_valido(c)) THEN RAISE EXCEPTION 'cnpj invalido' USING ERRCODE='22023'; END IF;
  RETURN coalesce(g,'cnpj:'||c);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_candidata_identidade(jsonb) FROM PUBLIC;
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
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(candidatas) c WHERE public.google_candidata_identidade(c.value) IS NULL)
    OR (SELECT count(DISTINCT public.google_candidata_identidade(c.value)) FROM jsonb_array_elements(candidatas) c)<>jsonb_array_length(candidatas)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(candidatas) c WHERE nullif(c.value->>'cnpj','') IS NOT NULL GROUP BY c.value->>'cnpj' HAVING count(*)>1)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(candidatas) c JOIN public.google_lote a ON a.execucao_id=e.id CROSS JOIN LATERAL jsonb_array_elements(a.candidatas) b
      WHERE public.google_candidata_identidade(b.value)=public.google_candidata_identidade(c.value) OR (nullif(c.value->>'cnpj','') IS NOT NULL AND b.value->>'cnpj'=c.value->>'cnpj')) THEN RAISE EXCEPTION 'identidade repetida ou invalida' USING ERRCODE='22023'; END IF;
  SELECT count(*)+1 INTO n FROM public.google_lote WHERE execucao_id=e.id;
  IF n>3 OR e.analisadas+jsonb_array_length(candidatas)>150 THEN RAISE EXCEPTION 'orcamento esgotado' USING ERRCODE='55000'; END IF;
  INSERT INTO public.google_lote(id,execucao_id,pedido_id,ordinal,candidatas) VALUES (lote_id,e.id,p_id,n,candidatas) RETURNING * INTO l;
  UPDATE public.google_execucao SET analisadas=analisadas+jsonb_array_length(candidatas),lotes_reservados=lotes_reservados+1 WHERE id=e.id;
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
ALTER TABLE empresa ALTER COLUMN telefone DROP NOT NULL;
CREATE FUNCTION empresa_telefone_origem_conferir() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.empresa e WHERE e.id=NEW.id AND e.telefone IS NULL)
    AND NOT EXISTS (SELECT 1 FROM public.empresa_origem_google o WHERE o.empresa_id=NEW.id)
    AND NOT EXISTS (SELECT 1 FROM public.google_exclusividade x WHERE x.empresa_id=NEW.id) THEN RAISE EXCEPTION 'telefone obrigatorio fora da origem Google' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION empresa_telefone_origem_conferir() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER empresa_telefone_origem AFTER INSERT OR UPDATE ON empresa DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION empresa_telefone_origem_conferir();
ALTER TABLE google_resultado ADD COLUMN lote_id uuid REFERENCES google_lote(id) ON DELETE SET NULL;
ALTER TABLE google_resultado ADD COLUMN canais_verificados text[] NOT NULL DEFAULT '{}';
CREATE FUNCTION google_criterios_regras(c jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE r jsonb := '[]'; k text;
BEGIN
  FOREACH k IN ARRAY ARRAY['produtos','excluir','observacoes'] LOOP
    IF c->>k<>'' THEN r := r||jsonb_build_array(jsonb_build_object('criterio',k,'opcoes',jsonb_build_array(c->k))); END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['tipos','site','email','telefone'] LOOP
    IF jsonb_array_length(c->k)>0 THEN r := r||jsonb_build_array(jsonb_build_object('criterio',k,'opcoes',c->k)); END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['atendimento','situacao'] LOOP
    IF c->>k<>'' AND c->>k NOT IN ('priorizar_fisica','priorizar_funcionamento') THEN r := r||jsonb_build_array(jsonb_build_object('criterio',k,'opcoes',jsonb_build_array(c->k))); END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['nota','avaliacoes'] LOOP
    IF c->k<>'null'::jsonb THEN r := r||jsonb_build_array(jsonb_build_object('criterio',k,'opcoes',jsonb_build_array(trim_scale((c->>k)::numeric)::text))); END IF;
  END LOOP;
  RETURN r;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_criterios_regras(jsonb) FROM PUBLIC;
CREATE FUNCTION google_verificacoes_requeridas(c jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE r jsonb := '[]';
BEGIN
  IF c->'nota'<>'null'::jsonb OR c->'avaliacoes'<>'null'::jsonb OR (c->>'situacao'<>'' AND c->>'situacao'<>'priorizar_funcionamento') THEN r := r||'"dados_google"'::jsonb; END IF;
  IF jsonb_array_length(c->'site')=1 OR jsonb_array_length(c->'email')=1 THEN r := r||'"presenca_digital"'::jsonb; END IF;
  IF c->>'produtos'<>'' OR c->>'excluir'<>'' OR c->>'observacoes'<>'' OR jsonb_array_length(c->'tipos')>0 OR (c->>'atendimento'<>'' AND c->>'atendimento'<>'priorizar_fisica') THEN r := r||'"perfil_comercial"'::jsonb; END IF;
  IF c->'telefone' ? 'whatsapp' THEN r := r||'"whatsapp"'::jsonb; END IF;
  IF c->'telefone' ? 'fixo' THEN r := r||'"fixo"'::jsonb; END IF;
  RETURN r;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_verificacoes_requeridas(jsonb) FROM PUBLIC;
CREATE FUNCTION google_evidencias_decidir(c jsonb,p_evidencias jsonb,p_candidata text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE regra jsonb; pendente boolean := false;
BEGIN
  FOR regra IN SELECT value FROM jsonb_array_elements(public.google_criterios_regras(c)) LOOP
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_evidencias) e WHERE e.value->>'candidata'=p_candidata AND e.value->>'criterio'=regra->>'criterio' AND regra->'opcoes' ? (e.value->>'opcao') AND e.value->>'estado'='aprovado') THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(regra->'opcoes') o WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_evidencias) e WHERE e.value->>'candidata'=p_candidata AND e.value->>'criterio'=regra->>'criterio' AND e.value->>'opcao'=o.value AND e.value->>'estado'='reprovado')) THEN RETURN 'reprovado'; END IF;
    pendente := true;
  END LOOP;
  RETURN CASE WHEN pendente THEN 'nao_confirmado' ELSE 'aprovado' END;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_evidencias_decidir(jsonb,jsonb,text) FROM PUBLIC;
CREATE TABLE google_grupo (
  grupo_id uuid PRIMARY KEY REFERENCES grupo_importacao(id) ON DELETE RESTRICT,
  vendedor_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  identidade text NOT NULL,
  UNIQUE(vendedor_id,identidade)
);
ALTER TABLE google_grupo ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_grupo_leitura ON google_grupo FOR SELECT TO app_usuario USING (pode_ler() AND (eh_gestor() OR vendedor_id=usuario_atual()));
GRANT SELECT ON google_grupo TO app_usuario;
CREATE FUNCTION google_grupo_destino(p_vendedor uuid,p_snapshot jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  chave text;
  destino uuid;
BEGIN
  SELECT jsonb_agg(public.sem_acento(regexp_replace(btrim(coalesce(p_snapshot->>k,'')),'\s+',' ','g')) ORDER BY n)::text INTO chave
    FROM unnest(ARRAY['nicho','bairro','cidade','uf']) WITH ORDINALITY t(k,n);
  SELECT grupo_id INTO destino FROM public.google_grupo WHERE vendedor_id=p_vendedor AND identidade=chave;
  IF destino IS NOT NULL THEN RETURN destino; END IF;
  INSERT INTO public.grupo_importacao(nome,descricao,origem)
    VALUES (left((p_snapshot->>'nicho')||' · '||coalesce(nullif(p_snapshot->>'bairro',''),p_snapshot->>'cidade')||' / '||(p_snapshot->>'uf'),100),
      'Empresas do Google para '||(p_snapshot->>'nicho')||' em '||coalesce(nullif(p_snapshot->>'bairro','')||', ','')||(p_snapshot->>'cidade')||' / '||(p_snapshot->>'uf'),'Google') RETURNING id INTO destino;
  INSERT INTO public.google_grupo(grupo_id,vendedor_id,identidade) VALUES (destino,p_vendedor,chave);
  RETURN destino;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_grupo_destino(uuid,jsonb) FROM PUBLIC;
CREATE OR REPLACE FUNCTION grupo_prospeccao_ler(p_grupo uuid)
RETURNS TABLE(id uuid,nome text,descricao text,origem text,criterios text,criado_em timestamptz,total bigint,disponiveis bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.pode_ler() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT g.id,g.nome,g.descricao,g.origem,g.criterios,g.criado_em,c.total::bigint,c.disponiveis::bigint
    FROM public.grupo_importacao g CROSS JOIN LATERAL public.grupo_prospeccao_contagens(g.id) c
    WHERE g.id=p_grupo AND g.ativo AND (public.eh_gestor() OR NOT EXISTS (SELECT 1 FROM public.google_grupo gg WHERE gg.grupo_id=g.id AND gg.vendedor_id<>public.usuario_atual()));
END;
$$;
CREATE OR REPLACE FUNCTION grupos_prospeccao_listar(p_pagina integer DEFAULT 1)
RETURNS TABLE(id uuid,nome text,descricao text,origem text,criterios text,criado_em timestamptz,total bigint,disponiveis bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.pode_ler() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF p_pagina IS NULL OR p_pagina<1 OR p_pagina>10000 THEN RAISE EXCEPTION 'pagina invalida' USING ERRCODE='22023'; END IF;
  RETURN QUERY SELECT g.id,g.nome,g.descricao,g.origem,g.criterios,g.criado_em,c.total::bigint,c.disponiveis::bigint
    FROM (SELECT x.* FROM public.grupo_importacao x WHERE x.ativo
      AND (public.eh_gestor() OR NOT EXISTS (SELECT 1 FROM public.google_grupo gg WHERE gg.grupo_id=x.id AND gg.vendedor_id<>public.usuario_atual()))
      ORDER BY x.criado_em DESC,x.id DESC LIMIT 21 OFFSET (p_pagina-1)*20) g
    CROSS JOIN LATERAL public.grupo_prospeccao_contagens(g.id) c ORDER BY g.criado_em DESC,g.id DESC;
END;
$$;
CREATE OR REPLACE FUNCTION busca_empresa_grupos_google()
RETURNS TABLE(id uuid,nome text,criado_em timestamptz,total integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.pode_ler() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT g.id,g.nome,g.criado_em,count(DISTINCT ge.empresa_id)::integer
    FROM public.grupo_importacao g JOIN public.grupo_importacao_empresa ge ON ge.grupo_id=g.id
    WHERE g.ativo AND (EXISTS (SELECT 1 FROM public.google_grupo gg WHERE gg.grupo_id=g.id)
      OR EXISTS (SELECT 1 FROM public.empresa_origem_google og WHERE og.empresa_id=ge.empresa_id))
      AND (public.eh_gestor() OR NOT EXISTS (SELECT 1 FROM public.google_grupo gg WHERE gg.grupo_id=g.id AND gg.vendedor_id<>public.usuario_atual()))
    GROUP BY g.id ORDER BY g.criado_em DESC,g.id LIMIT 100;
END;
$$;
ALTER FUNCTION google_agente_entregar(uuid,jsonb,jsonb,uuid) RENAME TO google_entregar_legado;
REVOKE EXECUTE ON FUNCTION google_entregar_legado(uuid,jsonb,jsonb,uuid) FROM app_usuario;
CREATE FUNCTION google_agente_entregar(p_id uuid,p_empresas jsonb,p_recibo jsonb,p_executor uuid DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
<<entrega>>
DECLARE
  p public.google_planejamento%ROWTYPE;
  e public.google_execucao%ROWTYPE;
  l public.google_lote%ROWTYPE;
  c jsonb;
  ev jsonb;
  linha jsonb;
  identidade text;
  empresa_id uuid;
  por_cnpj uuid;
  por_google uuid;
  fone text;
  mail text;
  situacao text;
  motivo text;
  decisao text;
  indice integer;
  novas integer := 0;
  novas_empresas integer := 0;
  grupo_id uuid;
  inativo boolean;
  resposta text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(27,1);
  PERFORM public.google_execucao_validar(p_id,p_executor,true);
  SELECT * INTO e FROM public.google_execucao WHERE pedido_id=p_id FOR UPDATE;
  IF e.contrato=1 AND p_recibo->'versao' IS DISTINCT FROM '2'::jsonb THEN RETURN public.google_entregar_legado(p_id,p_empresas,p_recibo,p_executor); END IF;
  IF e.contrato<>2 OR p_recibo->'versao' IS DISTINCT FROM '2'::jsonb OR p_recibo->>'pedido_id' IS DISTINCT FROM p_id::text
    OR p_recibo->>'execucao_id' IS DISTINCT FROM e.id::text OR p_recibo->>'revisao' IS DISTINCT FROM e.revisao::text
    OR p_recibo->>'snapshot_sha256' IS DISTINCT FROM encode(sha256(convert_to(e.snapshot::text,'UTF8')),'hex')
    OR coalesce(p_recibo->>'lote_id','') !~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
    OR coalesce(p_recibo->>'origem_sha256','') !~ '^[0-9a-f]{64}$' OR coalesce(p_recibo->>'resultado_sha256','') !~ '^[0-9a-f]{64}$'
    OR length(coalesce(p_recibo->>'arquivo_original_id','')) NOT BETWEEN 1 AND 255 OR length(coalesce(p_recibo->>'arquivo_resultado_id','')) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'recibo invalido' USING ERRCODE='22023'; END IF;
  SELECT * INTO l FROM public.google_lote WHERE id=(p_recibo->>'lote_id')::uuid AND execucao_id=e.id FOR UPDATE;
  IF NOT FOUND OR l.candidatas IS DISTINCT FROM p_empresas THEN RAISE EXCEPTION 'lote divergente' USING ERRCODE='22023'; END IF;
  IF l.recibo IS NOT NULL THEN
    IF l.recibo IS DISTINCT FROM p_recibo THEN RAISE EXCEPTION 'publicacao divergente' USING ERRCODE='22023'; END IF;
    RETURN 'repetida';
  END IF;
  IF e.concluido_em IS NOT NULL THEN RAISE EXCEPTION 'execucao concluida' USING ERRCODE='55000'; END IF;
  c := public.google_criterios_normalizar(e.snapshot->'criterios');
  IF p_recibo->'verificacoes_requeridas' IS DISTINCT FROM public.google_verificacoes_requeridas(c) OR jsonb_typeof(p_recibo->'evidencias') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'verificacoes divergentes' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(p_recibo->'evidencias')>1000 THEN RAISE EXCEPTION 'evidencias excessivas' USING ERRCODE='22023'; END IF;
  FOR ev IN SELECT value FROM jsonb_array_elements(p_recibo->'evidencias') LOOP
    IF jsonb_typeof(ev)<>'object' OR EXISTS (SELECT 1 FROM unnest(ARRAY['candidata','criterio','opcao','estado','motivo','fonte','horario']) k WHERE jsonb_typeof(ev->k) IS DISTINCT FROM 'string')
      OR ev->>'estado' NOT IN ('aprovado','reprovado','nao_confirmado') OR length(ev->>'motivo') NOT BETWEEN 1 AND 500 OR length(ev->>'fonte') NOT BETWEEN 1 AND 2048
      OR ev->>'horario' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_empresas) x WHERE public.google_candidata_identidade(x.value)=ev->>'candidata')
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.google_criterios_regras(c)) r WHERE r.value->>'criterio'=ev->>'criterio' AND r.value->'opcoes' ? (ev->>'opcao')) THEN RAISE EXCEPTION 'evidencia invalida' USING ERRCODE='22023'; END IF;
    PERFORM (ev->>'horario')::timestamptz;
    IF ev->>'criterio'='telefone' AND ev->>'estado'='aprovado' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_empresas) x WHERE public.google_candidata_identidade(x.value)=ev->>'candidata' AND x.value->>'telefone'=ev->>'contato'
      AND x.value->>'telefone' ~ '^[0-9]{10,11}$' AND (ev->>'opcao'<>'fixo' OR x.value->>'telefone' ~ '^[0-9]{2}[2-5][0-9]{7}$')) THEN RAISE EXCEPTION 'contato divergente' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_recibo->'evidencias') x GROUP BY x.value->>'candidata',x.value->>'criterio',x.value->>'opcao' HAVING count(*)>1) THEN RAISE EXCEPTION 'evidencia repetida' USING ERRCODE='22023'; END IF;
  SELECT * INTO p FROM public.google_planejamento WHERE id=p_id FOR UPDATE;
  PERFORM id FROM public.usuario WHERE id IN (public.usuario_atual(),p.vendedor_id) ORDER BY id FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'sem permissao' USING ERRCODE='42501'; END IF;
  inativo := NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=p.vendedor_id AND ativo AND papel='vendedor' AND NOT senha_provisoria_pendente);
  SELECT coalesce(max(r.indice),0) INTO indice FROM public.google_resultado r WHERE r.planejamento_id=p_id;
  FOR linha IN SELECT value FROM jsonb_array_elements(p_empresas) LOOP
    indice := indice+1; empresa_id := NULL; por_cnpj := NULL; por_google := NULL;
    identidade := public.google_candidata_identidade(linha);
    fone := CASE WHEN linha->>'telefone' ~ '^[0-9]{10,11}$' THEN linha->>'telefone' END;
    mail := CASE WHEN linha->>'email' ~ '^[^[:space:]@]+@[^[:space:]@]+$' THEN lower(btrim(linha->>'email')) END;
    decisao := public.google_evidencias_decidir(c,p_recibo->'evidencias',identidade);
    situacao := 'pendente'; motivo := CASE decisao WHEN 'reprovado' THEN 'Não atende aos critérios selecionados.' ELSE 'Critério selecionado não confirmado.' END;
    IF inativo THEN motivo := 'Vendedor indisponível. Resultados preservados para o gestor.';
    ELSIF e.entregues+novas>=50 THEN motivo := 'Meta de 50 empresas atingida.';
    ELSIF decisao='aprovado' AND coalesce(nullif(btrim(linha->>'razao_social'),''),nullif(btrim(linha->>'nome_fantasia'),'')) IS NOT NULL
      AND (nullif(linha->>'cnpj','') IS NULL OR public.empresa_cnpj_valido(linha->>'cnpj')) THEN
      SELECT id INTO por_cnpj FROM public.empresa WHERE cnpj=nullif(linha->>'cnpj','') FOR UPDATE;
      SELECT o.empresa_id INTO por_google FROM public.empresa_origem_google o WHERE google_place_id=identidade FOR UPDATE;
      IF (por_cnpj IS NOT NULL AND por_google IS NOT NULL AND por_cnpj<>por_google) OR (por_google IS NOT NULL AND nullif(linha->>'cnpj','') IS NOT NULL AND EXISTS (SELECT 1 FROM public.empresa WHERE id=por_google AND cnpj IS DISTINCT FROM linha->>'cnpj')) THEN
        situacao := 'conflito'; motivo := 'CNPJ e identificador Google precisam de conferência.';
      ELSE
        empresa_id := coalesce(por_cnpj,por_google);
        IF EXISTS (SELECT 1 FROM public.empresa x WHERE x.id IS DISTINCT FROM entrega.empresa_id AND ((fone IS NOT NULL AND x.telefone=fone) OR (mail IS NOT NULL AND lower(x.email)=mail))) THEN
          situacao := 'repetida'; motivo := 'Telefone ou e-mail já encontrado na base da empresa.';
        ELSIF empresa_id IS NOT NULL AND (EXISTS (SELECT 1 FROM public.google_exclusividade x WHERE x.empresa_id=entrega.empresa_id)
          OR EXISTS (SELECT 1 FROM public.empresa_fila f WHERE f.empresa_id=entrega.empresa_id AND ((f.vendedor_id IS NOT NULL AND f.vendedor_id<>p.vendedor_id) OR (f.reservado_por IS NOT NULL AND f.reservado_por<>p.vendedor_id AND f.reservado_ate>clock_timestamp()))) OR public.empresa_cliente(entrega.empresa_id)) THEN
          situacao := 'indisponivel'; motivo := 'Empresa já destinada ou em atendimento.';
        ELSE
          IF empresa_id IS NULL THEN
            INSERT INTO public.empresa(cnpj,razao_social,nome_fantasia,telefone,email,cep,cnae_principal) VALUES (nullif(linha->>'cnpj',''),nullif(btrim(linha->>'razao_social'),''),nullif(btrim(linha->>'nome_fantasia'),''),fone,mail,
              CASE WHEN linha->>'cep' ~ '^[0-9]{8}$' THEN linha->>'cep' END,CASE WHEN linha->>'cnae_principal' ~ '^[0-9]{7}$' THEN linha->>'cnae_principal' END) RETURNING id INTO empresa_id;
            novas_empresas := novas_empresas+1;
          END IF;
          IF nullif(linha->>'google_place_id','') IS NOT NULL THEN INSERT INTO public.empresa_origem_google(google_place_id,empresa_id) VALUES (linha->>'google_place_id',empresa_id) ON CONFLICT DO NOTHING; END IF;
          INSERT INTO public.google_exclusividade(empresa_id,vendedor_id,planejamento_id) VALUES (empresa_id,p.vendedor_id,p_id);
          IF grupo_id IS NULL THEN grupo_id := public.google_grupo_destino(p.vendedor_id,e.snapshot); END IF;
          INSERT INTO public.grupo_importacao_empresa(grupo_id,empresa_id) VALUES (grupo_id,empresa_id) ON CONFLICT DO NOTHING;
          situacao := 'entregue'; motivo := NULL; novas := novas+1;
        END IF;
      END IF;
    END IF;
    INSERT INTO public.google_resultado(planejamento_id,lote_id,indice,empresa_id,dados,situacao,motivo,entregue_em,canais_verificados) VALUES (p_id,l.id,indice,empresa_id,linha,situacao,motivo,CASE WHEN situacao='entregue' THEN clock_timestamp() END,
      ARRAY(SELECT x.value->>'opcao' FROM jsonb_array_elements(p_recibo->'evidencias') x WHERE x.value->>'candidata'=identidade AND x.value->>'criterio'='telefone' AND x.value->>'estado'='aprovado'));
  END LOOP;
  resposta := CASE WHEN inativo THEN 'vendedor_inativo' ELSE 'ok' END;
  IF grupo_id IS NOT NULL THEN
    UPDATE public.grupo_importacao g SET inseridas=g.inseridas+novas_empresas,
      vinculadas=(SELECT count(*)::integer FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id=entrega.grupo_id) WHERE g.id=entrega.grupo_id;
  END IF;
  UPDATE public.google_execucao SET entregues=entregues+novas WHERE id=e.id;
  UPDATE public.google_lote SET recibo=p_recibo,resposta=jsonb_build_object('resultado',entrega.resposta,'entregues',novas),concluido_em=clock_timestamp() WHERE id=l.id;
  IF inativo THEN
    UPDATE public.google_execucao SET concluido_em=clock_timestamp(),motivo_parada='vendedor_inativo' WHERE id=e.id;
    UPDATE public.google_planejamento SET estado='cancelado',motivo='Vendedor indisponível.',concluido_em=clock_timestamp() WHERE id=p_id;
  END IF;
  RETURN resposta;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'horario invalido' USING ERRCODE='22023';
END;
$$;
REVOKE EXECUTE ON FUNCTION google_agente_entregar(uuid,jsonb,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_agente_entregar(uuid,jsonb,jsonb,uuid) TO app_usuario;
ALTER FUNCTION google_planilha_preparar(uuid,text) RENAME TO google_planilha_preparar_legado;
REVOKE EXECUTE ON FUNCTION google_planilha_preparar_legado(uuid,text) FROM app_usuario;
CREATE FUNCTION google_planilha_preparar(p_id uuid,p_destino text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb; c jsonb;
BEGIN
  r := public.google_planilha_preparar_legado(p_id,p_destino);
  IF EXISTS (SELECT 1 FROM public.google_planilha_tentativa t WHERE t.pedido_id=p_id AND t.versao=(r->>'versao')::integer AND jsonb_array_length(t.celulas)=13) THEN RETURN r||jsonb_build_object('contrato',1); END IF;
  SELECT public.google_criterios_normalizar(p.criterios) INTO c FROM public.google_planejamento p WHERE p.id=p_id;
  RETURN jsonb_set(r,ARRAY['dados','criterios'],c)||jsonb_build_object('contrato',2);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_planilha_preparar(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_planilha_preparar(uuid,text) TO app_usuario;
ALTER TABLE google_planilha_tentativa ADD CONSTRAINT google_planilha_tentativa_celulas_check CHECK (jsonb_typeof(celulas)='array' AND jsonb_array_length(celulas) IN (13,14));
CREATE OR REPLACE FUNCTION google_planilha_intencao(p_id uuid,p_versao integer,p_celulas jsonb,p_envio uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.google_sincronizacao%ROWTYPE; n integer; c jsonb;
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(41,2);
  PERFORM id FROM public.usuario WHERE id=public.usuario_atual() FOR SHARE;
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.google_sincronizacao WHERE pedido_id=p_id FOR UPDATE;
  IF NOT FOUND OR v.versao<>p_versao OR v.destino IS NULL OR v.envio_id IS NOT NULL THEN RETURN false; END IF;
  IF p_celulas IS NULL OR jsonb_typeof(p_celulas)<>'array' THEN RAISE EXCEPTION 'intencao invalida' USING ERRCODE='22023'; END IF;
  n := jsonb_array_length(p_celulas);
  IF n NOT IN (13,14) OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_celulas) x WHERE jsonb_typeof(x.value)<>'string')
    OR p_celulas->>0 IS DISTINCT FROM p_id::text OR p_celulas->>1 IS DISTINCT FROM v.revisao::text
    OR p_celulas->>12 IS DISTINCT FROM p_versao::text OR pg_column_size(p_celulas)>100000 THEN RAISE EXCEPTION 'intencao invalida' USING ERRCODE='22023'; END IF;
  IF n=13 AND NOT EXISTS (SELECT 1 FROM public.google_planilha_tentativa WHERE pedido_id=p_id AND versao=p_versao AND celulas=p_celulas) THEN RAISE EXCEPTION 'novo espelho exige criterios' USING ERRCODE='22023'; END IF;
  IF n=14 THEN
    SELECT public.google_criterios_normalizar(p.criterios) INTO c FROM public.google_planejamento p WHERE p.id=p_id;
    IF (p_celulas->>13)::jsonb IS DISTINCT FROM c THEN RAISE EXCEPTION 'criterios divergentes' USING ERRCODE='22023'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.google_planilha_tentativa WHERE pedido_id=p_id AND versao=p_versao AND celulas IS DISTINCT FROM p_celulas) THEN RAISE EXCEPTION 'intencao divergente' USING ERRCODE='22023'; END IF;
  INSERT INTO public.google_planilha_tentativa(pedido_id,versao,celulas) VALUES (p_id,p_versao,p_celulas) ON CONFLICT DO NOTHING;
  IF p_envio IS NOT NULL THEN UPDATE public.google_sincronizacao SET envio_id=p_envio,envio_versao=p_versao WHERE pedido_id=p_id; END IF;
  RETURN true;
END;
$$;
COMMIT;
