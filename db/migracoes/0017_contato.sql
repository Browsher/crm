-- ver docs/db/0017.md
BEGIN;
CREATE TABLE contato (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
  tipo       text NOT NULL CHECK (btrim(tipo) <> ''),
  nota       text CHECK (btrim(nota) <> ''),
  proximo_passo      text CHECK (btrim(proximo_passo) <> ''),
  proximo_passo_data date,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  atualizado_em  timestamptz,
  atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT contato_proximo_passo_coerente
    CHECK ((proximo_passo IS NULL) = (proximo_passo_data IS NULL))
);
CREATE TRIGGER contato_auditoria BEFORE INSERT OR UPDATE ON contato
FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
CREATE INDEX contato_empresa_idx ON contato (empresa_id, criado_em DESC);
ALTER TABLE contato ENABLE ROW LEVEL SECURITY;
CREATE POLICY contato_leitura ON contato FOR SELECT
  USING (EXISTS (SELECT 1 FROM empresa e WHERE e.id = contato.empresa_id));
GRANT SELECT ON contato TO app_usuario;
COMMIT;
