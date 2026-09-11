-- ver docs/db/0023.md
BEGIN;
ALTER TABLE empresa ADD COLUMN cnae_principal text
  CHECK (cnae_principal IS NULL OR cnae_principal ~ '^[0-9]{7}$');
COMMIT;
