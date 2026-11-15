#!/bin/sh
set -eu
for script in /init/01_schema.sql /init/03_integracion_m2_m5.sql /init/04_integracion_social_segura.sql \
  /init/05_integracion_obras.sql /init/06_consultas_m6.sql /init/07_resolucion_obras.sql; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$script"
done
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v demo_password="$(cat /run/config/fixtures/demo-password)" -f /init/seed.sql
