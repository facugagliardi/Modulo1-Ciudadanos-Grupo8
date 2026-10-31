-- Exclusivo del PostgreSQL nuevo de Compose. No ejecutar contra Retool.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO cuenta_empleado (mail, nombre_empleado, apellido_empleado, rol, activo) VALUES
  ('admin@testing.invalid', 'Admin', 'Testing', 'RESPONSABLE_AREA', TRUE),
  ('mesa@testing.invalid', 'Mesa', 'Testing', 'MESA_ENTRADAS', TRUE),
  ('auditor@testing.invalid', 'Auditor', 'Testing', 'AUDITOR', TRUE);
INSERT INTO credencial_empleado (empleado_id, password)
SELECT empleado_id, crypt(:'demo_password', gen_salt('bf', 10)) FROM cuenta_empleado;
INSERT INTO ciudadano (uuid, documento_id, nombre, apellido, fecha_nacimiento, estado, cuit) VALUES
  ('b63f5a2e-4b71-46e7-8b01-381c85d88f62', '34567890', 'Vecino', 'Testing', '1989-04-12', 'ACTIVO', 20345678901),
  ('3a195ff8-882c-4918-9ca8-0f91a7ccf343', '23456789', 'Otra', 'Vecina', '1990-05-10', 'ACTIVO', 27234567890);
INSERT INTO credencial_ciudadano (ciudadano_id, password)
SELECT ciudadano_id, crypt(:'demo_password', gen_salt('bf', 10)) FROM ciudadano;
COMMIT;
