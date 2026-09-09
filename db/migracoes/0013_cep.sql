-- ver docs/db/0013.md
BEGIN;
CREATE TABLE cep (
  cep         text PRIMARY KEY CHECK (cep ~ '^[0-9]{8}$'),
  logradouro  text,
  faixa       text,
  bairro      text,
  localidade  text NOT NULL CHECK (btrim(localidade) <> ''),
  uf          char(2) NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  ibge        text NOT NULL CHECK (ibge ~ '^[0-9]{7}$')
);
CREATE TABLE cep_carga (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte          text NOT NULL,
  versao         text NOT NULL,
  publicado_em   date NOT NULL,
  arquivo_sha256 char(64) NOT NULL CHECK (arquivo_sha256 ~ '^[0-9a-f]{64}$'),
  linhas         integer NOT NULL CHECK (linhas > 0),
  carregado_em   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cep ENABLE ROW LEVEL SECURITY;
ALTER TABLE cep_carga ENABLE ROW LEVEL SECURITY;
CREATE POLICY cep_leitura ON cep FOR SELECT TO app_usuario USING (true);
GRANT SELECT ON cep TO app_usuario;
COMMIT;
