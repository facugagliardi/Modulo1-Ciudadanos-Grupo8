-- =============================================================================
-- M1 - Ciudadanos, Organizaciones y Expedientes Digitales
-- Paso 1 de 2: creacion de la base y del rol de la aplicacion.
--
-- Ejecutar como superusuario, CONECTADO A OTRA BASE (por ejemplo "postgres"):
--   psql -U postgres -f 00_crear_database.sql
--
-- CREATE DATABASE no puede correr dentro de una transaccion ni desde la propia
-- base que crea; por eso este archivo esta separado del esquema (01_schema.sql).
-- =============================================================================

-- Rol de la aplicacion. Cambiar la clave antes de usarlo fuera de local.
DROP ROLE IF EXISTS ciudadanos_app;
CREATE ROLE ciudadanos_app WITH LOGIN PASSWORD 'ciudadanos';

DROP DATABASE IF EXISTS ciudadanos_m1;
CREATE DATABASE ciudadanos_m1
    WITH OWNER = ciudadanos_app
         ENCODING = 'UTF8'

         TEMPLATE = template0;

COMMENT ON DATABASE ciudadanos_m1 IS 'Modulo 1 - personas, organizaciones, documentacion y expedientes';

-- Si el sistema no tiene el locale es_AR.UTF-8, reemplazar las dos lineas
-- LC_* por LC_COLLATE = 'C' y LC_CTYPE = 'C'.
