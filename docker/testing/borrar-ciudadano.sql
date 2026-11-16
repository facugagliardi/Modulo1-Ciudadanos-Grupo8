-- Borra un ciudadano de prueba y todo lo que cuelga de el (credencial, contactos,
-- documentos, eventos). SOLO para el entorno local de docker compose. Uso:
--   docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U ciudadanos_app -d ciudadanos_m1 \
--     -v dni=12345678 < docker/testing/borrar-ciudadano.sql
-- Los archivos quedan en el volumen: documento-<ciudadano_id>-v*.
BEGIN;
CREATE TEMP TABLE objetivo AS SELECT ciudadano_id, uuid FROM ciudadano WHERE documento_id = :'dni';
SELECT 'ciudadanos a borrar: ' || count(*) FROM objetivo;
DELETE FROM event_outbox WHERE event_id IN (SELECT event_id FROM events WHERE payload::text LIKE ANY (SELECT '%' || uuid || '%' FROM objetivo))
   OR payload::text LIKE ANY (SELECT '%' || uuid || '%' FROM objetivo);
DELETE FROM events       WHERE payload::text LIKE ANY (SELECT '%' || uuid || '%' FROM objetivo);
CREATE TEMP TABLE contactos AS SELECT contacto_id FROM contacto_ciudadano_rel WHERE ciudadano_id IN (SELECT ciudadano_id FROM objetivo);
DELETE FROM contacto_ciudadano_rel WHERE ciudadano_id IN (SELECT ciudadano_id FROM objetivo);
DELETE FROM contacto_ciudadano WHERE contacto_id IN (SELECT contacto_id FROM contactos);
DELETE FROM solicitud_documentacion WHERE titular_id IN (SELECT ciudadano_id FROM objetivo);
DELETE FROM documento WHERE ciudadano_id IN (SELECT ciudadano_id FROM objetivo);
DELETE FROM credencial_ciudadano WHERE ciudadano_id IN (SELECT ciudadano_id FROM objetivo);
DELETE FROM ciudadano WHERE ciudadano_id IN (SELECT ciudadano_id FROM objetivo);
COMMIT;
