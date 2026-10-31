#!/bin/sh
set -eu
for script in /init/01_schema.sql /init/03_integracion_m2_m5.sql; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$script"
done
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v demo_password="$(cat /run/config/fixtures/demo-password)" -f /init/seed.sql
