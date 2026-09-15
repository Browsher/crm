-- ver docs/db/0030.md
BEGIN;
CREATE OR REPLACE FUNCTION funil_etapa_definir(p_id uuid,p_etapa text,p_anterior text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_n public.negociacao;
BEGIN
  v_n := public.funil_bloquear(p_id);
  IF v_n.id IS NULL THEN RETURN 'sem_permissao'; END IF;
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
REVOKE EXECUTE ON FUNCTION funil_etapa_definir(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION funil_etapa_definir(uuid,text,text) TO app_usuario;
COMMIT;
