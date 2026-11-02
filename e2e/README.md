# Recorridos E2E de la entrega de testing

Playwright 1.64.1 + Chromium, contra frontend compilado, proxy, backend,
PostgreSQL y RabbitMQ de Compose. No hay respuestas API simuladas.

| Recorrido | HU / casos del handoff | Verificación |
| --- | --- | --- |
| E2E-01 | HU1: CP-FE-001/003/005; HU3: CP-FE-014 | Ingreso, validación local, credenciales erróneas y acceso de vecino a /admin |
| E2E-02 | HU3: CP-FE-013 | Auditor sin acciones de escritura, ruta protegida y POST 401/403 sin persistencia |
| E2E-03 | HU11: CP-FE-050/053 | Alta por vecino, dueño 100%, PENDIENTE → aprobación por RESPONSABLE_AREA → ACTIVA |
| E2E-04 | HU14: CP-FE-064; HU13: CP-FE-060 | Pedido desde gestión, entrega por vecino, CUMPLIDA y descarga idéntica |
| E2E-05 | HU15: CP-FE-069/070 | Alta de expediente y actuación numerada, visible en portal del titular |

Son cinco recorridos, vinculados a once CP; no acreditan todas las HU ni los
85 CP frontend. Se usa un PDF sintético pequeño; no acredita límites de tamaño.
La aprobación se prueba con RESPONSABLE_AREA, no con ADMINISTRATIVO.

Desde la raíz del repo:

```powershell
docker compose up --build -d --wait --wait-timeout 720
Set-Location e2e
npm ci --ignore-scripts
npm run install:browser
npm test
```

Para ejecutar uno: `npm test -- --grep E2E-03`. Todos crean datos nuevos; no
eliminan recursos ni vacían volúmenes. Usar exclusivamente Compose de testing.
Las cuentas provienen del servicio `credenciales`, se capturan en memoria y
se heredan sólo por el proceso de pruebas. No hace falta copiar contraseñas.

Opciones: `E2E_BASE_URL` (por defecto http://localhost:8090),
`E2E_COMPOSE_FILE` (resuelta desde esta carpeta), `E2E_COMPOSE_PROJECT`,
`E2E_REPORT_DIR`, `E2E_SOURCE_REF`. En un puerto distinto, configurar también
`APP_CORS_ALLOWED_ORIGINS` en Compose con ese origen exacto.

Resultados en `reportes/resultados.json`, `ejecucion.json`, `ejecucion.log` y
PNG si falla una página. Se omiten claves conocidas y JWT de textos. No se
publican trazas, videos, storageState ni contextos DOM; `test-results` es local
e ignorado. Sin retries, skip ni test.only. Un fallo conserva código de salida
distinto de cero. CI lo ejecuta dentro del job Compose y publica sus reportes.

Configuración basada en la documentación oficial de
[Playwright](https://playwright.dev/docs/test-configuration) y su
[integración continua](https://playwright.dev/docs/ci-intro).
