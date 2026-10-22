-- ver docs/db/0040.md
BEGIN;
CREATE TABLE google_planejamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  dia date NOT NULL CHECK (extract(isodow FROM dia) BETWEEN 1 AND 5),
  nicho text NOT NULL CHECK (length(btrim(nicho)) BETWEEN 1 AND 100 AND nicho !~ '[[:cntrl:]]'),
  bairro text NOT NULL CHECK (length(bairro) <= 100 AND bairro !~ '[[:cntrl:]]'),
  cidade text NOT NULL CHECK (length(btrim(cidade)) BETWEEN 1 AND 100 AND cidade !~ '[[:cntrl:]]'),
  uf text NOT NULL CHECK (uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  estado text NOT NULL DEFAULT 'planejado' CHECK (estado IN ('planejado','aguardando','coletando','validando','concluido','falhou','cancelado')),
  snapshot jsonb,
  motivo text,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id,dia)
);
CREATE INDEX google_planejamento_dia_idx ON google_planejamento(dia,estado,criado_em,id);
ALTER TABLE google_planejamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_planejamento_leitura ON google_planejamento FOR SELECT TO app_usuario
  USING (pode_ler() AND (eh_gestor() OR vendedor_id=usuario_atual()));
GRANT SELECT ON google_planejamento TO app_usuario;
CREATE TABLE google_rotina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dia date NOT NULL UNIQUE,
  iniciado_em timestamptz NOT NULL
);
ALTER TABLE google_rotina ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_rotina_leitura ON google_rotina FOR SELECT TO app_usuario USING (pode_ler());
GRANT SELECT ON google_rotina TO app_usuario;
CREATE TABLE google_publicacao (
  planejamento_id uuid PRIMARY KEY REFERENCES google_planejamento(id) ON DELETE RESTRICT,
  empresas jsonb NOT NULL,
  recibo jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE google_publicacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_publicacao_leitura ON google_publicacao FOR SELECT TO app_usuario USING (eh_gestor());
GRANT SELECT ON google_publicacao TO app_usuario;
CREATE TABLE google_resultado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_id uuid NOT NULL REFERENCES google_planejamento(id) ON DELETE RESTRICT,
  indice integer NOT NULL,
  empresa_id uuid REFERENCES empresa(id) ON DELETE RESTRICT,
  dados jsonb NOT NULL,
  situacao text NOT NULL CHECK (situacao IN ('entregue','repetida','indisponivel','pendente','conflito')),
  motivo text,
  entregue_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(planejamento_id,indice)
);
CREATE INDEX google_resultado_empresa_idx ON google_resultado(empresa_id,entregue_em);
ALTER TABLE google_resultado ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_resultado_leitura ON google_resultado FOR SELECT TO app_usuario
  USING (pode_ler() AND (eh_gestor() OR (situacao='entregue' AND EXISTS (
    SELECT 1 FROM google_planejamento p WHERE p.id=planejamento_id AND p.vendedor_id=usuario_atual()))));
GRANT SELECT ON google_resultado TO app_usuario;
CREATE TABLE google_exclusividade (
  empresa_id uuid PRIMARY KEY REFERENCES empresa(id) ON DELETE RESTRICT,
  vendedor_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  planejamento_id uuid NOT NULL REFERENCES google_planejamento(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE google_exclusividade ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_exclusividade_leitura ON google_exclusividade FOR SELECT TO app_usuario
  USING (pode_ler() AND (eh_gestor() OR vendedor_id=usuario_atual()));
GRANT SELECT ON google_exclusividade TO app_usuario;
CREATE FUNCTION google_planejar(p_dia date,p_nicho text,p_bairro text,p_cidade text,p_uf text) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.pode_escrever() OR NOT EXISTS (SELECT 1 FROM public.usuario WHERE id=public.usuario_atual() AND papel='vendedor') THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501';
  END IF;
  IF p_dia IS NULL OR p_dia < (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
    OR extract(isodow FROM p_dia) NOT BETWEEN 1 AND 5 OR p_nicho IS NULL OR length(btrim(p_nicho)) NOT BETWEEN 1 AND 100
    OR p_cidade IS NULL OR length(btrim(p_cidade)) NOT BETWEEN 1 AND 100 OR p_bairro IS NULL OR length(p_bairro)>100
    OR p_uf IS NULL OR p_uf NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
    OR (p_nicho || p_bairro || p_cidade) ~ '[[:cntrl:]]' OR (p_nicho || p_bairro || p_cidade) ~ U&'[\0080-\009F]' THEN
    RAISE EXCEPTION 'plano invalido' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  IF NOT public.pode_escrever() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.google_rotina WHERE dia=p_dia)
    OR EXISTS (SELECT 1 FROM public.google_planejamento WHERE vendedor_id=public.usuario_atual() AND dia=p_dia AND estado<>'planejado') THEN
    RAISE EXCEPTION 'pedido ja iniciado' USING ERRCODE='55000';
  END IF;
  INSERT INTO public.google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf)
    VALUES (public.usuario_atual(),p_dia,btrim(p_nicho),btrim(p_bairro),btrim(p_cidade),p_uf)
    ON CONFLICT (vendedor_id,dia) DO UPDATE SET nicho=excluded.nicho,bairro=excluded.bairro,cidade=excluded.cidade,uf=excluded.uf
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_planejar(date,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_planejar(date,text,text,text,text) TO app_usuario;
CREATE FUNCTION google_agente_proximo_em(p_agora timestamptz) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_dia date := (p_agora AT TIME ZONE 'America/Sao_Paulo')::date;
  v_pedido public.google_planejamento%ROWTYPE;
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_pedido FROM public.google_planejamento WHERE estado IN ('coletando','validando','falhou') ORDER BY iniciado_em,id LIMIT 1;
  IF FOUND THEN RETURN to_jsonb(v_pedido); END IF;
  IF extract(isodow FROM v_dia) NOT BETWEEN 1 AND 5 OR (p_agora AT TIME ZONE 'America/Sao_Paulo')::time < time '09:00' THEN RETURN NULL; END IF;
  INSERT INTO public.google_rotina(dia,iniciado_em) VALUES (v_dia,p_agora) ON CONFLICT (dia) DO NOTHING;
  IF FOUND THEN
    UPDATE public.google_planejamento p SET estado='aguardando',snapshot=jsonb_build_object('nicho',p.nicho,'bairro',p.bairro,'cidade',p.cidade,'uf',p.uf)
      FROM public.usuario u WHERE p.dia=v_dia AND p.estado='planejado' AND u.id=p.vendedor_id AND u.ativo AND u.papel='vendedor' AND NOT u.senha_provisoria_pendente;
  END IF;
  UPDATE public.google_planejamento p SET estado='cancelado',motivo='Vendedor indisponível.'
    WHERE p.estado='aguardando' AND NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id=p.vendedor_id AND u.ativo AND u.papel='vendedor' AND NOT u.senha_provisoria_pendente);
  SELECT * INTO v_pedido FROM public.google_planejamento WHERE estado='aguardando' AND dia<=v_dia ORDER BY dia,criado_em,id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.google_planejamento SET estado='coletando',iniciado_em=p_agora WHERE id=v_pedido.id RETURNING * INTO v_pedido;
  RETURN to_jsonb(v_pedido);
END;
$$;
REVOKE EXECUTE ON FUNCTION google_agente_proximo_em(timestamptz) FROM PUBLIC;
CREATE FUNCTION google_agente_proximo() RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.google_agente_proximo_em(clock_timestamp()); $$;
REVOKE EXECUTE ON FUNCTION google_agente_proximo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_agente_proximo() TO app_usuario;
CREATE FUNCTION google_agente_etapa(p_id uuid,p_estado text,p_motivo text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(40,1);
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF p_estado IS NULL OR p_estado NOT IN ('coletando','validando','falhou') OR length(coalesce(p_motivo,''))>500
    OR coalesce(p_motivo,'') ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'etapa invalida' USING ERRCODE='22023'; END IF;
  UPDATE public.google_planejamento SET estado=p_estado,motivo=p_motivo WHERE id=p_id AND estado IN ('coletando','validando','falhou');
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido invalido' USING ERRCODE='22023'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_agente_etapa(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_agente_etapa(uuid,text,text) TO app_usuario;
CREATE FUNCTION google_agente_entregar(p_id uuid,p_empresas jsonb,p_recibo jsonb) RETURNS text
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
BEGIN
  IF NOT public.pode_escrever() OR NOT public.eh_gestor() THEN RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL OR p_empresas IS NULL OR jsonb_typeof(p_empresas)<>'array' OR jsonb_array_length(p_empresas)>50
    OR pg_column_size(p_empresas)>1000000 OR p_recibo IS NULL OR jsonb_typeof(p_recibo)<>'object'
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
    IF NOT v_inativo AND v_linha->'validado'='true'::jsonb AND coalesce(v_linha->'fechada','false'::jsonb)='false'::jsonb
      AND coalesce(v_linha->>'telefone','') ~ '^[0-9]{10,11}$'
      AND (public.empresa_cnpj_valido(v_cnpj) OR (length(v_google) BETWEEN 1 AND 255 AND v_google !~ '[[:cntrl:]]' AND v_google !~ U&'[\0080-\009F]'))
      AND (v_cnpj IS NULL OR public.empresa_cnpj_valido(v_cnpj))
      AND coalesce(nullif(btrim(v_linha->>'razao_social'),''),nullif(btrim(v_linha->>'nome_fantasia'),'')) IS NOT NULL THEN
      SELECT id INTO v_cnpj_id FROM public.empresa WHERE cnpj=v_cnpj FOR UPDATE;
      SELECT e.id INTO v_google_id FROM public.empresa_origem_google o JOIN public.empresa e ON e.id=o.empresa_id WHERE o.google_place_id=v_google FOR UPDATE OF e;
      IF (v_cnpj_id IS NOT NULL AND v_google_id IS NOT NULL AND v_cnpj_id<>v_google_id)
        OR (v_google_id IS NOT NULL AND v_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM public.empresa WHERE id=v_google_id AND cnpj IS DISTINCT FROM v_cnpj)) THEN
        v_situacao := 'conflito'; v_motivo := 'CNPJ e identificador Google precisam de conferência.';
      ELSE
        v_id := coalesce(v_cnpj_id,v_google_id);
        IF v_id IS NULL THEN
          INSERT INTO public.empresa(cnpj,razao_social,nome_fantasia,telefone,email,cep,cnae_principal)
            VALUES (v_cnpj,nullif(btrim(v_linha->>'razao_social'),''),nullif(btrim(v_linha->>'nome_fantasia'),''),v_linha->>'telefone',
              CASE WHEN v_linha->>'email' ~ '^[^[:space:]@]+@[^[:space:]@]+$' THEN lower(btrim(v_linha->>'email')) END,
              CASE WHEN v_linha->>'cep' ~ '^[0-9]{8}$' THEN v_linha->>'cep' END,
              CASE WHEN v_linha->>'cnae_principal' ~ '^[0-9]{7}$' THEN v_linha->>'cnae_principal' END)
            ON CONFLICT (cnpj) DO NOTHING RETURNING id INTO v_id;
          IF v_id IS NULL THEN SELECT id INTO v_id FROM public.empresa WHERE cnpj=v_cnpj FOR UPDATE; END IF;
        END IF;
        IF v_google IS NOT NULL THEN
          INSERT INTO public.empresa_origem_google(google_place_id,empresa_id) VALUES (v_google,v_id) ON CONFLICT DO NOTHING;
        END IF;
        IF EXISTS (SELECT 1 FROM public.google_exclusividade WHERE empresa_id=v_id AND vendedor_id<>v_pedido.vendedor_id)
          OR EXISTS (SELECT 1 FROM public.empresa_fila WHERE empresa_id=v_id AND
            ((vendedor_id IS NOT NULL AND vendedor_id<>v_pedido.vendedor_id) OR (reservado_por IS NOT NULL AND reservado_por<>v_pedido.vendedor_id AND reservado_ate>clock_timestamp())))
          OR public.empresa_cliente(v_id) THEN
          v_situacao := 'indisponivel'; v_motivo := 'Empresa já destinada ou em atendimento.';
        ELSIF EXISTS (SELECT 1 FROM public.google_exclusividade WHERE empresa_id=v_id) THEN
          v_situacao := 'repetida'; v_motivo := 'Empresa já entregue a este vendedor.';
        ELSE
          INSERT INTO public.google_exclusividade(empresa_id,vendedor_id,planejamento_id) VALUES (v_id,v_pedido.vendedor_id,p_id);
          v_situacao := 'entregue'; v_motivo := NULL;
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
REVOKE EXECUTE ON FUNCTION google_agente_entregar(uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION google_agente_entregar(uuid,jsonb,jsonb) TO app_usuario;
CREATE FUNCTION google_empresa_permitida(p_empresa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.eh_gestor() OR NOT EXISTS (SELECT 1 FROM public.google_exclusividade WHERE empresa_id=p_empresa AND vendedor_id<>public.usuario_atual()); $$;
REVOKE EXECUTE ON FUNCTION google_empresa_permitida(uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION empresa_origem_ativa(p_empresa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.google_empresa_permitida(p_empresa) AND (EXISTS (SELECT 1 FROM public.grupo_importacao_empresa ge
    JOIN public.grupo_importacao g ON g.id=ge.grupo_id WHERE ge.empresa_id=p_empresa AND g.ativo)
    OR EXISTS (SELECT 1 FROM public.google_exclusividade WHERE empresa_id=p_empresa));
$$;
CREATE OR REPLACE FUNCTION empresa_visivel_prospeccao(p_empresa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.google_empresa_permitida(p_empresa) AND (public.empresa_origem_ativa(p_empresa) OR EXISTS (
    SELECT 1 FROM public.empresa_fila WHERE empresa_id=p_empresa AND (vendedor_id=public.usuario_atual()
      OR (reservado_por=public.usuario_atual() AND reservado_ate>now()))));
$$;
CREATE FUNCTION google_exclusividade_proteger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.google_exclusividade x WHERE x.empresa_id=NEW.empresa_id
    AND ((NEW.vendedor_id IS NOT NULL AND NEW.vendedor_id<>x.vendedor_id) OR (NEW.reservado_por IS NOT NULL AND NEW.reservado_por<>x.vendedor_id))) THEN
    RAISE EXCEPTION 'empresa exclusiva de outro vendedor' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION google_exclusividade_proteger() FROM PUBLIC;
CREATE TRIGGER google_exclusividade_fila BEFORE INSERT OR UPDATE ON empresa_fila FOR EACH ROW EXECUTE FUNCTION google_exclusividade_proteger();
COMMIT;
