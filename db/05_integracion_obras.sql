-- Aplicar antes de desplegar M3. No emite eventos ni modifica expedientes existentes.
BEGIN;
ALTER TABLE expediente ALTER COLUMN ciudadano_id DROP NOT NULL;
ALTER TABLE expediente ADD COLUMN IF NOT EXISTS public_works_project_id UUID;
ALTER TABLE expediente ADD COLUMN IF NOT EXISTS estado_obra VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS uk_expediente_proyecto_obra ON expediente(public_works_project_id);
CREATE TABLE IF NOT EXISTS proyecto_obra_externo (
    project_id UUID PRIMARY KEY,
    expediente_id BIGINT UNIQUE REFERENCES expediente(expediente_id),
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    approval_data TEXT,
    completion_data TEXT,
    correlation_id UUID
);
COMMIT;
