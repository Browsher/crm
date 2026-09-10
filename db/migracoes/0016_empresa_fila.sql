-- ver docs/db/0016.md
BEGIN;
CREATE TABLE empresa_fila (
  empresa_id          uuid PRIMARY KEY REFERENCES empresa (id) ON DELETE RESTRICT,
  vendedor_id         uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  reservado_por       uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  reservado_ate       timestamptz,
  elegivel_em         timestamptz,
  primeira_reserva_em timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  atualizado_em  timestamptz,
  atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT empresa_fila_reserva_coerente CHECK ((reservado_por IS NULL) = (reservado_ate IS NULL)),
  CONSTRAINT empresa_fila_posse_ou_reserva CHECK (vendedor_id IS NULL OR reservado_por IS NULL)
);
CREATE TRIGGER empresa_fila_auditoria BEFORE INSERT OR UPDATE ON empresa_fila
FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
ALTER TABLE empresa_fila ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_fila_leitura ON empresa_fila FOR SELECT
  USING (eh_gestor() OR vendedor_id = usuario_atual() OR reservado_por = usuario_atual());
GRANT SELECT ON empresa_fila TO app_usuario;
DROP POLICY empresa_leitura ON empresa;
CREATE POLICY empresa_leitura ON empresa FOR SELECT USING (
  eh_gestor() OR EXISTS (
    SELECT 1 FROM empresa_fila f
     WHERE f.empresa_id = empresa.id
       AND (f.vendedor_id = usuario_atual()
            OR (f.reservado_por = usuario_atual() AND f.reservado_ate > now()))
  )
);
COMMIT;
