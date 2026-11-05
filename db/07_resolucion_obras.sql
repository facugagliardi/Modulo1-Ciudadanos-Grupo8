-- No publica eventos historicos. Conserva el resultado administrativo efectivo y su auditoria.
BEGIN;
ALTER TABLE expediente ADD COLUMN IF NOT EXISTS resolucion_obra VARCHAR(20);
ALTER TABLE expediente ADD COLUMN IF NOT EXISTS resumen_resolucion_obra VARCHAR(4000);
ALTER TABLE expediente ADD COLUMN IF NOT EXISTS resuelto_en TIMESTAMPTZ;
ALTER TABLE expediente ADD COLUMN IF NOT EXISTS resuelto_por VARCHAR(200);
ALTER TABLE expediente ADD COLUMN IF NOT EXISTS resolucion_event_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_expediente_resolucion_event ON expediente(resolucion_event_id);
COMMIT;
