-- Aplicar antes de desplegar consultas M6. Conserva los UUID existentes.
BEGIN;
ALTER TABLE organizacion ADD COLUMN IF NOT EXISTS uuid UUID;
ALTER TABLE organizacion ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
UPDATE organizacion SET uuid = gen_random_uuid() WHERE uuid IS NULL;
ALTER TABLE organizacion ALTER COLUMN uuid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizacion_uuid ON organizacion(uuid);
COMMIT;
