-- =============================================================================
-- Datos minimos para levantar el entorno de desarrollo.
-- SOLO PARA LOCAL: las claves de abajo son publicas, no van a ningun otro lado.
--
--   psql -U ciudadanos_app -d ciudadanos_m1 -f 02_datos_iniciales.sql
--
-- Los hashes son BCrypt (mismo encoder que usa AuthService).
--   empleado  admin@municipio.gob.ar / Empleado.2026
--   ciudadano CUIL 20345678901       / Ciudadano.2026
-- =============================================================================

BEGIN;

-- Un empleado por rol, para probar POST /auth/empleados/login.
INSERT INTO cuenta_empleado (mail, nombre_empleado, apellido_empleado, rol, activo) VALUES
    ('admin@municipio.gob.ar',    'Ana',   'Suarez',   'RESPONSABLE_AREA', TRUE),
    ('mesa@municipio.gob.ar',     'Bruno', 'Ferrari',  'MESA_ENTRADAS',    TRUE),
    ('auditor@municipio.gob.ar',  'Carla', 'Molina',   'AUDITOR',          TRUE)
ON CONFLICT (mail) DO NOTHING;

-- Misma clave para los tres: Empleado.2026
INSERT INTO credencial_empleado (empleado_id, password)
SELECT empleado_id, '$2a$10$5wk7utMNVACoSK/ep2JKzOdPoYV0FVubY9tKwNmEPw8xyNu99RU6K'
FROM cuenta_empleado
WHERE mail IN ('admin@municipio.gob.ar', 'mesa@municipio.gob.ar', 'auditor@municipio.gob.ar')
ON CONFLICT (empleado_id) DO NOTHING;

-- Ciudadano de prueba para POST /auth/login. Se puede crear igual por
-- POST /auth/register; esto solo evita tener que hacerlo a mano cada vez.
INSERT INTO persona (tipo, cuit) VALUES ('CIUDADANO', 20345678901)
ON CONFLICT (cuit) DO NOTHING;

INSERT INTO ciudadano (persona_id, documento_id, nombre, apellido, fecha_nacimiento, estado)
SELECT id, '34567890', 'Diego', 'Lopez', DATE '1989-04-12', 'ACTIVO'
FROM persona WHERE cuit = 20345678901
ON CONFLICT (persona_id) DO NOTHING;

-- Clave: Ciudadano.2026
INSERT INTO credencial_persona (persona_id, password)
SELECT id, '$2a$10$UR3R7UFRgE9Zn/1kgMBZgeRZQElVTI3lc6T0VL0KykfZmyve2k4GG'
FROM persona WHERE cuit = 20345678901
ON CONFLICT (persona_id) DO NOTHING;

COMMIT;
