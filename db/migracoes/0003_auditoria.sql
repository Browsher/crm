-- ver docs/db/0003.md
BEGIN;
CREATE FUNCTION definir_auditoria() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.criado_em := now();
    NEW.criado_por := public.usuario_atual();
    NEW.atualizado_em := NULL;
    NEW.atualizado_por := NULL;
    RETURN NEW;
  END IF;
  NEW.criado_em := OLD.criado_em;
  NEW.criado_por := OLD.criado_por;
  NEW.atualizado_em := now();
  NEW.atualizado_por := public.usuario_atual();
  RETURN NEW;
END
$$;
CREATE TRIGGER usuario_auditoria BEFORE INSERT OR UPDATE ON usuario
FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
COMMIT;
