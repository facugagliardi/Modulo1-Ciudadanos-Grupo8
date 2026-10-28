-- Ejecutar una vez antes de arrancar la version con identidad externa de empleados.
-- Reejecutable: conserva todos los UUID existentes y no borra datos.
BEGIN;
ALTER TABLE cuenta_empleado ADD COLUMN IF NOT EXISTS uuid UUID;
UPDATE cuenta_empleado SET uuid = gen_random_uuid() WHERE uuid IS NULL;
ALTER TABLE cuenta_empleado ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE cuenta_empleado ALTER COLUMN uuid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_empleado_uuid ON cuenta_empleado (uuid);

CREATE TABLE IF NOT EXISTS tramite_externo (
    source_module VARCHAR(60) NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    external_id VARCHAR(100) NOT NULL,
    ciudadano_id BIGINT NOT NULL REFERENCES ciudadano (ciudadano_id),
    estado VARCHAR(50) NOT NULL,
    actualizado_en TIMESTAMPTZ NOT NULL,
    datos_publicos TEXT NOT NULL,
    PRIMARY KEY (source_module, tipo, external_id)
);
CREATE INDEX IF NOT EXISTS ix_tramite_externo_ciudadano ON tramite_externo (ciudadano_id, actualizado_en DESC);
COMMIT;
