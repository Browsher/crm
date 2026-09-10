-- ver docs/db/0020.md
BEGIN;
CREATE VIEW usuario_publico AS SELECT id, nome FROM usuario;
GRANT SELECT ON usuario_publico TO app_usuario;
COMMIT;
