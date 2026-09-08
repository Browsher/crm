-- ver docs/db/0001.md
BEGIN;
CREATE TABLE usuario (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL CHECK (btrim(nome) <> ''),
  email          text NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND email <> ''),
  papel          text NOT NULL CHECK (papel IN ('vendedor', 'gestor')),
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  atualizado_em  timestamptz,
  atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT
);
CREATE INDEX usuario_nome_idx ON usuario (nome);
CREATE INDEX usuario_gestor_ativo_idx ON usuario (papel) WHERE ativo;
GRANT SELECT, INSERT, UPDATE ON usuario TO app_usuario;
COMMIT;
