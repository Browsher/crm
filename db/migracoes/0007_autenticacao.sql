-- ver docs/db/0007.md
BEGIN;
CREATE SCHEMA autenticacao;
CREATE TABLE autenticacao.credencial (
  usuario_id     uuid PRIMARY KEY REFERENCES usuario (id) ON DELETE RESTRICT,
  senha_hash     text NOT NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE autenticacao.sessao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  token_hash  text NOT NULL UNIQUE,
  expira_em   timestamptz NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessao_usuario_idx ON autenticacao.sessao (usuario_id);
CREATE TABLE autenticacao.tentativa_login (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  origem      text,
  sucesso     boolean NOT NULL,
  ocorreu_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tentativa_login_email_idx ON autenticacao.tentativa_login (email, ocorreu_em DESC);
CREATE INDEX tentativa_login_origem_idx ON autenticacao.tentativa_login (origem, ocorreu_em DESC) WHERE origem IS NOT NULL;
ALTER TABLE autenticacao.credencial ENABLE ROW LEVEL SECURITY;
ALTER TABLE autenticacao.sessao ENABLE ROW LEVEL SECURITY;
ALTER TABLE autenticacao.tentativa_login ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA autenticacao TO app_conexao;
COMMIT;
