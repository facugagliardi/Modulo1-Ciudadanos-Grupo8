-- Ejecutar antes de arrancar esta version. Conserva UUID existentes y datos historicos.
BEGIN;
ALTER TABLE documento ADD COLUMN IF NOT EXISTS uuid UUID;
UPDATE documento SET uuid = gen_random_uuid() WHERE uuid IS NULL;
ALTER TABLE documento ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE documento ALTER COLUMN uuid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_documento_uuid ON documento(uuid);
ALTER TABLE expediente ADD COLUMN IF NOT EXISTS uuid UUID;
UPDATE expediente SET uuid = gen_random_uuid() WHERE uuid IS NULL;
ALTER TABLE expediente ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE expediente ALTER COLUMN uuid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_expediente_uuid ON expediente(uuid);
ALTER TABLE solicitud_documentacion ADD COLUMN IF NOT EXISTS uuid UUID;
UPDATE solicitud_documentacion SET uuid = gen_random_uuid() WHERE uuid IS NULL;
ALTER TABLE solicitud_documentacion ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE solicitud_documentacion ALTER COLUMN uuid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_solicitud_documentacion_uuid ON solicitud_documentacion(uuid);
ALTER TABLE solicitud_documentacion ADD COLUMN IF NOT EXISTS contexto_social TEXT;
ALTER TABLE solicitud_documentacion ALTER COLUMN plazo DROP NOT NULL;

-- Solo eventos nuevos: no reproducir automaticamente publicaciones historicas de entrega desconocida.
CREATE TABLE IF NOT EXISTS event_outbox (
    event_id VARCHAR(36) PRIMARY KEY REFERENCES events(event_id),
    routing_key VARCHAR(255) NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_event_outbox_pending ON event_outbox(next_attempt_at) WHERE sent_at IS NULL;
COMMIT;
