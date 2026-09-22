-- ver docs/db/0032.md
BEGIN;
CREATE TABLE whatsapp_vinculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL UNIQUE REFERENCES usuario(id),
  instancia text NOT NULL UNIQUE,
  CONSTRAINT whatsapp_vinculo_instancia_valida CHECK (
    length(instancia) BETWEEN 1 AND 200 AND instancia = btrim(instancia) AND instancia !~ '[[:cntrl:]]'
  )
);
ALTER TABLE whatsapp_vinculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_vinculo FORCE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_vinculo_ler ON whatsapp_vinculo FOR SELECT TO app_usuario USING (eh_gestor());
CREATE POLICY whatsapp_vinculo_inserir ON whatsapp_vinculo FOR INSERT TO app_usuario WITH CHECK (eh_gestor() AND pode_escrever());
CREATE POLICY whatsapp_vinculo_alterar ON whatsapp_vinculo FOR UPDATE TO app_usuario
  USING (eh_gestor() AND pode_escrever()) WITH CHECK (eh_gestor() AND pode_escrever());
CREATE POLICY whatsapp_vinculo_remover ON whatsapp_vinculo FOR DELETE TO app_usuario USING (eh_gestor() AND pode_escrever());
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_vinculo TO app_usuario;
CREATE FUNCTION whatsapp_vinculo_validar() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_gestor() OR NOT public.pode_escrever() THEN
    RAISE EXCEPTION 'usuario sem permissao' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.usuario WHERE id = NEW.vendedor_id AND ativo AND papel = 'vendedor' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'vendedor invalido' USING ERRCODE = '23514', CONSTRAINT = 'whatsapp_vinculo_vendedor_valido';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.instancia IS DISTINCT FROM OLD.instancia OR NEW.vendedor_id IS DISTINCT FROM OLD.vendedor_id) THEN
    NEW.id := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION whatsapp_vinculo_validar() FROM PUBLIC;
CREATE TRIGGER whatsapp_vinculo_validar BEFORE INSERT OR UPDATE ON whatsapp_vinculo
  FOR EACH ROW EXECUTE FUNCTION whatsapp_vinculo_validar();
COMMIT;
