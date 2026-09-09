-- ver docs/db/0014.md
BEGIN;
CREATE TABLE empresa (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj          text NOT NULL UNIQUE CHECK (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  razao_social  text NOT NULL CHECK (btrim(razao_social) <> ''),
  nome_fantasia text CHECK (btrim(nome_fantasia) <> ''),
  contato_nome  text CHECK (btrim(contato_nome) <> ''),
  telefone      text NOT NULL CHECK (telefone ~ '^[0-9]{10,11}$'),
  email         text CHECK (email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
  cep           text CHECK (cep ~ '^[0-9]{8}$'),
  numero        text CHECK (btrim(numero) <> ''),
  complemento   text CHECK (btrim(complemento) <> ''),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  atualizado_em  timestamptz,
  atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT empresa_endereco_precisa_de_cep
    CHECK (cep IS NOT NULL OR (numero IS NULL AND complemento IS NULL))
);
CREATE TRIGGER empresa_auditoria BEFORE INSERT OR UPDATE ON empresa
FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
ALTER TABLE empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_leitura  ON empresa FOR SELECT USING (eh_gestor());
CREATE POLICY empresa_insercao ON empresa FOR INSERT WITH CHECK (pode_escrever() AND eh_gestor());
GRANT SELECT, INSERT ON empresa TO app_usuario;
CREATE POLICY cep_carga_leitura ON cep_carga FOR SELECT USING (eh_gestor());
GRANT SELECT ON cep_carga TO app_usuario;
COMMIT;
