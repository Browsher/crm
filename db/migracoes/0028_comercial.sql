-- ver docs/db/0028.md
BEGIN;
CREATE TABLE negociacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa(id) ON DELETE RESTRICT,
  vendedor_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  etapa text NOT NULL DEFAULT 'primeiro_contato' CHECK (etapa IN ('primeiro_contato','em_negociacao','proposta_enviada')),
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  encerrada_em timestamptz,
  encerramento text CHECK (encerramento IN ('venda','devolucao','inatividade')),
  CHECK ((encerrada_em IS NULL) = (encerramento IS NULL)),
  CHECK (encerrada_em IS NULL OR encerrada_em >= iniciada_em)
);
CREATE UNIQUE INDEX negociacao_aberta_empresa_idx ON negociacao(empresa_id) WHERE encerrada_em IS NULL;
CREATE INDEX negociacao_vendedor_idx ON negociacao(vendedor_id, iniciada_em DESC, id DESC);
ALTER TABLE negociacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY negociacao_leitura ON negociacao FOR SELECT TO app_usuario USING (
  pode_ler() AND (eh_gestor() OR (vendedor_id = usuario_atual() AND EXISTS (
    SELECT 1 FROM empresa_fila f WHERE f.empresa_id = negociacao.empresa_id AND f.vendedor_id = usuario_atual()
  )))
);
GRANT SELECT ON negociacao TO app_usuario;
CREATE TABLE venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa(id) ON DELETE RESTRICT,
  autor_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  data date NOT NULL CHECK (isfinite(data)),
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  observacao text,
  chave uuid NOT NULL UNIQUE,
  criada_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX venda_empresa_idx ON venda(empresa_id, criada_em DESC, id DESC);
ALTER TABLE venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY venda_leitura ON venda FOR SELECT TO app_usuario USING (
  pode_ler() AND (eh_gestor() OR (autor_id = usuario_atual() AND EXISTS (
    SELECT 1 FROM empresa_fila f WHERE f.empresa_id = venda.empresa_id AND f.vendedor_id = usuario_atual()
  )))
);
GRANT SELECT ON venda TO app_usuario;
CREATE FUNCTION empresa_cliente(p_empresa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.venda v WHERE v.empresa_id = p_empresa); $$;
REVOKE EXECUTE ON FUNCTION empresa_cliente(uuid) FROM PUBLIC;
CREATE FUNCTION venda_encerrar_negociacao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.empresa WHERE id = NEW.empresa_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.empresa_fila f JOIN public.usuario u ON u.id = f.vendedor_id
    WHERE f.empresa_id = NEW.empresa_id AND f.vendedor_id = NEW.autor_id AND u.ativo AND u.papel = 'vendedor') THEN
    RAISE EXCEPTION 'venda exige vendedor responsavel ativo' USING ERRCODE = '23514';
  END IF;
  UPDATE public.negociacao SET encerrada_em = clock_timestamp(), encerramento = 'venda'
    WHERE empresa_id = NEW.empresa_id AND encerrada_em IS NULL;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION venda_encerrar_negociacao() FROM PUBLIC;
CREATE TRIGGER venda_negociacao BEFORE INSERT ON venda FOR EACH ROW EXECUTE FUNCTION venda_encerrar_negociacao();
INSERT INTO negociacao(empresa_id,vendedor_id)
  SELECT f.empresa_id,f.vendedor_id FROM empresa_fila f WHERE f.vendedor_id IS NOT NULL;
CREATE OR REPLACE FUNCTION empresa_assumir(p_empresa_id uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu   uuid := public.usuario_atual();
  v_dono uuid;
  v_resv uuid;
  v_ate  timestamptz;
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'troque a senha provisoria antes de assumir empresa' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.empresa e WHERE e.id = p_empresa_id FOR UPDATE;
  SELECT f.vendedor_id, f.reservado_por, f.reservado_ate
    INTO v_dono, v_resv, v_ate
    FROM public.empresa_fila f
   WHERE f.empresa_id = p_empresa_id;
  IF NOT FOUND THEN
    RETURN 'nao_encontrada';
  END IF;
  IF v_dono = v_eu THEN
    RETURN 'ja_e_sua';
  END IF;
  IF v_resv = v_eu AND v_ate <= now() THEN
    RETURN 'reserva_expirada';
  END IF;
  IF v_resv IS DISTINCT FROM v_eu THEN
    RAISE EXCEPTION 'esta empresa nao esta com voce' USING ERRCODE = '42501';
  END IF;
  UPDATE public.empresa_fila ef
     SET vendedor_id = v_eu, reservado_por = NULL, reservado_ate = NULL
   WHERE ef.empresa_id = p_empresa_id;
  INSERT INTO public.negociacao(empresa_id,vendedor_id) VALUES(p_empresa_id,v_eu);
  RETURN 'ok';
END;
$$;
CREATE OR REPLACE FUNCTION empresa_devolver(p_empresa_id uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu   uuid := public.usuario_atual();
  v_dono uuid;
  v_resv uuid;
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'troque a senha provisoria antes de devolver empresa' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.empresa e WHERE e.id = p_empresa_id FOR UPDATE;
  SELECT f.vendedor_id, f.reservado_por
    INTO v_dono, v_resv
    FROM public.empresa_fila f
   WHERE f.empresa_id = p_empresa_id;
  IF NOT FOUND THEN
    RETURN 'nao_encontrada';
  END IF;
  IF NOT COALESCE(v_dono = v_eu OR v_resv = v_eu, false) THEN
    RAISE EXCEPTION 'esta empresa nao esta com voce' USING ERRCODE = '42501';
  END IF;
  IF public.empresa_cliente(p_empresa_id) THEN
    RAISE EXCEPTION 'cliente nao pode voltar a prospeccao' USING ERRCODE = '42501';
  END IF;
  UPDATE public.negociacao SET encerrada_em = clock_timestamp(), encerramento = 'devolucao'
    WHERE empresa_id = p_empresa_id AND encerrada_em IS NULL;
  UPDATE public.empresa_fila ef
     SET vendedor_id = NULL,
         reservado_por = NULL,
         reservado_ate = NULL,
         elegivel_em = now() + interval '30 days'
   WHERE ef.empresa_id = p_empresa_id;
  RETURN 'ok';
END;
$$;
CREATE OR REPLACE FUNCTION fila_reservar(p_alvo uuid, p_nome text, p_cnae text, p_uf text, p_cidade text, p_bairro text, p_contexto_esperado uuid)
RETURNS TABLE (resultado text, empresa_id uuid, reservado_ate timestamptz, contexto uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_anterior uuid;
  v_candidata uuid;
  v_bloqueada uuid;
  v_contexto uuid;
  v_agora timestamptz;
  v_fila public.empresa_fila%ROWTYPE;
  v_dono_ativo boolean;
  v_busca text;
  v_excluidas uuid[] := '{}';
BEGIN
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF p_nome IS NULL OR length(p_nome) > 100
     OR (p_cnae IS NOT NULL AND p_cnae <> 'nao_informado' AND p_cnae !~ '^[0-9]{7}$')
     OR (p_uf IS NOT NULL AND p_uf !~ '^[A-Z]{2}$')
     OR (p_cidade IS NOT NULL AND (p_uf IS NULL OR p_cidade !~ '^[0-9]{7}$'))
     OR (p_bairro IS NOT NULL AND (p_cidade IS NULL OR btrim(p_bairro) = '' OR length(p_bairro) > 200)) THEN
    RAISE EXCEPTION 'filtro invalido' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(27, 1);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_eu::text, 25));
  IF NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  SELECT fc.versao INTO v_contexto FROM public.fila_contexto fc WHERE fc.usuario_id = v_eu;
  contexto := v_contexto;
  IF v_contexto IS DISTINCT FROM p_contexto_esperado THEN
    resultado := 'contexto_alterado'; RETURN NEXT; RETURN;
  END IF;
  SELECT f.empresa_id INTO v_anterior FROM public.empresa_fila f WHERE f.reservado_por = v_eu;
  IF v_anterior IS NOT NULL THEN
    SELECT e.id INTO v_bloqueada FROM public.empresa e WHERE e.id = v_anterior FOR UPDATE SKIP LOCKED;
    IF v_bloqueada IS NULL THEN
      resultado := 'indisponivel'; RETURN NEXT; RETURN;
    END IF;
  END IF;
  v_busca := '%' || replace(replace(replace(public.sem_acento(p_nome), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  LOOP
    v_agora := clock_timestamp();
    IF p_alvo IS NOT NULL THEN
      SELECT e.id INTO v_candidata FROM public.empresa e WHERE e.id = p_alvo FOR UPDATE SKIP LOCKED;
    ELSE
      SELECT e.id INTO v_candidata
        FROM public.empresa e
        LEFT JOIN public.empresa_fila f ON f.empresa_id = e.id
        LEFT JOIN public.usuario dono ON dono.id = f.vendedor_id
        LEFT JOIN public.cep c ON c.cep = e.cep
       WHERE NOT public.empresa_cliente(e.id) AND public.empresa_origem_ativa(e.id) AND e.id IS DISTINCT FROM v_anterior AND NOT (e.id = ANY(v_excluidas))
         AND (f.vendedor_id IS NULL OR dono.ativo = false)
         AND (f.reservado_ate IS NULL OR f.reservado_ate <= v_agora)
         AND (f.elegivel_em IS NULL OR f.elegivel_em <= v_agora)
         AND e.busca LIKE v_busca ESCAPE E'\\'
         AND (p_cnae IS NULL OR (p_cnae = 'nao_informado' AND e.cnae_principal IS NULL) OR e.cnae_principal = p_cnae)
         AND (p_uf IS NULL OR c.uf = p_uf)
         AND (p_cidade IS NULL OR c.ibge = p_cidade)
         AND (p_bairro IS NULL OR nullif(btrim(c.bairro), '') = p_bairro)
       ORDER BY f.elegivel_em ASC NULLS FIRST, e.criado_em, e.id
       LIMIT 1 FOR UPDATE OF e SKIP LOCKED;
    END IF;
    IF v_candidata IS NULL THEN
      resultado := CASE WHEN p_alvo IS NULL THEN 'sem_candidata' ELSE 'indisponivel' END;
      RETURN NEXT; RETURN;
    END IF;
    v_agora := clock_timestamp();
    SELECT f.* INTO v_fila FROM public.empresa_fila f WHERE f.empresa_id = v_candidata;
    SELECT u.ativo INTO v_dono_ativo FROM public.usuario u WHERE u.id = v_fila.vendedor_id;
    IF v_fila.reservado_por = v_eu AND v_fila.reservado_ate > v_agora THEN
      resultado := 'ok'; empresa_id := v_candidata; reservado_ate := v_fila.reservado_ate;
      RETURN NEXT; RETURN;
    END IF;
    IF NOT public.empresa_cliente(v_candidata) AND public.empresa_origem_ativa(v_candidata) AND (v_fila.vendedor_id IS NULL OR v_dono_ativo = false)
       AND (v_fila.reservado_ate IS NULL OR v_fila.reservado_ate <= v_agora)
       AND (v_fila.elegivel_em IS NULL OR v_fila.elegivel_em <= v_agora) THEN
      EXIT;
    END IF;
    IF p_alvo IS NOT NULL THEN
      resultado := 'indisponivel'; RETURN NEXT; RETURN;
    END IF;
    v_excluidas := array_append(v_excluidas, v_candidata);
  END LOOP;
  UPDATE public.empresa_fila f SET reservado_por = NULL, reservado_ate = NULL
   WHERE f.empresa_id = v_anterior AND f.reservado_por = v_eu;
  UPDATE public.negociacao n SET encerrada_em = clock_timestamp(), encerramento = 'devolucao'
    WHERE n.empresa_id = v_candidata AND n.encerrada_em IS NULL;
  INSERT INTO public.empresa_fila AS f (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
  VALUES (v_candidata, v_eu, v_agora + interval '30 minutes', v_agora)
  ON CONFLICT ON CONSTRAINT empresa_fila_pkey DO UPDATE
    SET vendedor_id = NULL, reservado_por = excluded.reservado_por, reservado_ate = excluded.reservado_ate,
        primeira_reserva_em = coalesce(f.primeira_reserva_em, excluded.primeira_reserva_em);
  INSERT INTO public.fila_contexto AS fc (usuario_id) VALUES (v_eu)
  ON CONFLICT (usuario_id) DO UPDATE SET versao = gen_random_uuid()
  RETURNING fc.versao INTO contexto;
  resultado := 'ok'; empresa_id := v_candidata; reservado_ate := v_agora + interval '30 minutes';
  RETURN NEXT;
END;
$$;
CREATE OR REPLACE FUNCTION empresa_consultar(p_nome text, p_cnae text, p_uf text, p_cidade text, p_bairro text, p_pagina integer)
RETURNS TABLE (id uuid, razao_social text, nome_fantasia text, cnae_principal text, cidade text, uf text, bairro text, disponibilidade text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_busca text;
BEGIN
  IF NOT public.pode_ler() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  IF p_nome IS NULL OR length(p_nome) > 100
     OR p_pagina IS NULL OR p_pagina < 1 OR p_pagina > 10000
     OR (p_cnae IS NOT NULL AND p_cnae <> 'nao_informado' AND p_cnae !~ '^[0-9]{7}$')
     OR (p_uf IS NOT NULL AND p_uf !~ '^[A-Z]{2}$')
     OR (p_cidade IS NOT NULL AND (p_uf IS NULL OR p_cidade !~ '^[0-9]{7}$'))
     OR (p_bairro IS NOT NULL AND (p_cidade IS NULL OR btrim(p_bairro) = '' OR length(p_bairro) > 200)) THEN
    RAISE EXCEPTION 'filtro invalido' USING ERRCODE = '22023';
  END IF;
  v_busca := '%' || replace(replace(replace(public.sem_acento(p_nome), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  RETURN QUERY
    SELECT e.id, e.razao_social, e.nome_fantasia, e.cnae_principal,
           c.localidade, c.uf::text, nullif(btrim(c.bairro), ''),
           CASE
             WHEN f.vendedor_id = v_eu THEN 'comigo'
             WHEN public.empresa_cliente(e.id) OR dono.ativo THEN 'outro_vendedor'
             WHEN f.reservado_ate > now() THEN
               CASE WHEN f.reservado_por = v_eu THEN 'reservada_comigo' ELSE 'outro_vendedor' END
             WHEN f.elegivel_em > now() THEN 'em_descanso'
             ELSE 'disponivel'
           END
      FROM public.empresa e
      LEFT JOIN public.cep c ON c.cep = e.cep
      LEFT JOIN public.empresa_fila f ON f.empresa_id = e.id
      LEFT JOIN public.usuario dono ON dono.id = f.vendedor_id
     WHERE public.empresa_visivel_prospeccao(e.id) AND e.busca LIKE v_busca ESCAPE E'\\'
       AND (p_cnae IS NULL OR (p_cnae = 'nao_informado' AND e.cnae_principal IS NULL) OR e.cnae_principal = p_cnae)
       AND (p_uf IS NULL OR c.uf = p_uf)
       AND (p_cidade IS NULL OR c.ibge = p_cidade)
       AND (p_bairro IS NULL OR nullif(btrim(c.bairro), '') = p_bairro)
     ORDER BY e.razao_social, e.id
     LIMIT 21 OFFSET (p_pagina - 1) * 20;
END;
$$;
CREATE OR REPLACE FUNCTION empresa_resumos(p_ids uuid[]) RETURNS TABLE (
  id uuid, razao_social text, nome_fantasia text, cnae_principal text,
  cidade text, uf text, bairro text, disponibilidade text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT e.id, e.razao_social, e.nome_fantasia, e.cnae_principal,
    c.localidade, c.uf::text, nullif(btrim(c.bairro), ''),
    CASE
      WHEN f.vendedor_id = public.usuario_atual() THEN 'comigo'
      WHEN public.empresa_cliente(e.id) OR dono.ativo THEN 'outro_vendedor'
      WHEN f.reservado_ate > now() THEN
        CASE WHEN f.reservado_por = public.usuario_atual() THEN 'reservada_comigo' ELSE 'outro_vendedor' END
      WHEN f.elegivel_em > now() THEN 'em_descanso'
      ELSE 'disponivel'
    END
  FROM public.empresa e
  LEFT JOIN public.cep c ON c.cep = e.cep
  LEFT JOIN public.empresa_fila f ON f.empresa_id = e.id
  LEFT JOIN public.usuario dono ON dono.id = f.vendedor_id
  WHERE public.empresa_visivel_prospeccao(e.id) AND e.id = ANY(p_ids);
$$;
CREATE OR REPLACE FUNCTION empresa_sugestoes() RETURNS TABLE (
  id uuid, razao_social text, nome_fantasia text, cnae_principal text,
  cidade text, uf text, bairro text, disponibilidade text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_ler() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT e.* FROM public.empresa_resumos(ARRAY(
    SELECT x.id FROM public.empresa x
    LEFT JOIN public.empresa_fila f ON f.empresa_id = x.id
    LEFT JOIN public.usuario dono ON dono.id = f.vendedor_id
    WHERE NOT public.empresa_cliente(x.id) AND public.empresa_origem_ativa(x.id) AND f.vendedor_id IS DISTINCT FROM public.usuario_atual()
      AND NOT coalesce(dono.ativo, false)
      AND (f.reservado_ate IS NULL OR f.reservado_ate <= now())
      AND (f.elegivel_em IS NULL OR f.elegivel_em <= now())
    ORDER BY x.razao_social, x.id LIMIT 10
  )) e
    ORDER BY e.razao_social, e.id LIMIT 10;
END;
$$;
COMMIT;
