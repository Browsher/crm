-- ver docs/db/0005.md
BEGIN;
CREATE POLICY usuario_ler ON usuario FOR SELECT TO app_usuario
  USING (pode_ler() AND (id = usuario_atual() OR eh_gestor()));
CREATE POLICY usuario_criar ON usuario FOR INSERT TO app_usuario
  WITH CHECK (eh_gestor());
CREATE POLICY usuario_alterar ON usuario FOR UPDATE TO app_usuario
  USING (eh_gestor() AND id <> usuario_atual())
  WITH CHECK (eh_gestor() AND id <> usuario_atual());
COMMIT;
