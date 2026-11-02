# Auditoría de cobertura API — 02/11/2026

Inventario del código publicado **04b2033**, excluyendo los cambios locales de
integración M3/M6 que seguían sin publicar. Fuentes: controladores Java,
`bruno-collection` del mismo commit, ZIP de HU recibido y reporte real de la
tanda `adaptada-corregida`. Se revisa esa ejecución existente; no se repitió
la tanda de organizaciones.

| Indicador | Resultado |
| --- | ---: |
| Endpoints propios publicados, método + ruta | 80 |
| Requests HTTP en colección del repo | 66 |
| Requests HTTP en ZIP de HU | 108 |
| Endpoints con request en colección del repo | 44 |
| Endpoints con request en ZIP de HU | 26 |
| Endpoints con request en alguna colección | 56/80 |
| Endpoints sin request en ambas | 24 |
| Endpoints con aserción explícita 4xx/5xx en alguna colección | 17/80 |
| Requests del repo sin ruta vigente | 8 |
| Endpoints alcanzados por la tanda Bruno ejecutada | 26/80 |
| Requests aprobados / fallados, considerando aserciones | 103 / 5 |

**56/80 mide presencia de requests, no aprobación, cobertura de código ni
criterios completos.** En Bruno, `status: pass` puede indicar sólo transporte
exitoso: se sumaron también errores y todas las aserciones, incluidas pre/post.
Por eso el resultado sigue siendo 103/108, con 182/190 aserciones aprobadas,
75/79 CP aprobados y siete CP sin ejecutar. No se atribuye ejecución reciente
a la colección antigua del repo.

## Rutas desactualizadas

Ocho archivos del repo usan seis combinaciones método/ruta inexistentes en
este commit:

- GET `/personas-juridicas/8`.
- POST `/personas-juridicas/8/integrantes`.
- DELETE `/personas-juridicas/2/integrantes/1`.
- Dos POST `/personas/1/domicilios`.
- Dos GET `/personas/1/domicilios`.
- GET `/personas/1/documentos`.

También se detectó `origen: INTERNO` en
`08_Documentacion/05_Post_Solicitud.bru`, mientras el enum vigente usa
`INTERNA`/`EVENTO`. Requiere corregir el contrato del request antes de usarlo
como evidencia de aceptación. No se cambiaron silenciosamente esas colecciones.

## Huecos y prioridad posterior

**Documentación:** de siete endpoints, el repo sólo incluye GET del documento
y validación; el ZIP de HU no cubre ninguno. Faltan carga, listado del titular,
pendientes, nueva versión y descarga. E2E-04 agrega una ejecución real de
carga/listado/descarga y cumplimiento de solicitud; no sustituye sus casos
negativos ni cubre nueva versión/validación.

**Autenticación:** faltan usuario unificado, refresh y logout en ambas
colecciones. E2E-01 cubre login, rechazo y guardas; no acredita vencimiento real
de 15 minutos ni renovación.

**Expedientes:** falta POST de actuación en ambas colecciones. E2E-05 agrega
alta y actuación desde UI, con lectura por titular. Los casos de archivado,
cambio de estado y publicación de resolución siguen teniendo su alcance propio.

**Domicilios:** faltan POST/GET por ciudadano y GET/PUT por domicilio. La
presencia de rutas antiguas `/personas/...` no cubre esos endpoints.

**Otros:** sin requests para Core recibir; varios receptores/consultas de
eventos; trámites externos del ciudadano; DELETE domicilio de organización;
GET ciudadanos/existe; PUT relación. El CSV contiene las 24 faltantes exactas.

Los cinco fallos Bruno conservan la clasificación de
[QA_ORGANIZACIONES_2026-11-02.md](QA_ORGANIZACIONES_2026-11-02.md): tres
criterios a confirmar (CP-015/046/056) y defecto real de código de verificación
de contacto (dos requests de CP-086). Ninguno se convirtió en aprobado por
esta auditoría. CP backend y CP-FE son identificadores diferentes.

## Reproducir y revisar evidencia

Desde la raíz del repo, con los archivos recibidos disponibles:

```powershell
python scripts/auditar-cobertura-api.py --ref 04b2033 --hu-zip C:/Users/ari_e/Downloads/bruno-tests-HU.zip --evidencia ../output/testing/qa-organizaciones-2026-11-02/adaptada-corregida/bruno.json --salida ../output/testing/auditoria-api-2026-11-02
```

Salida local fuera del repo: `output/testing/auditoria-api-2026-11-02/`:
`inventario.json` con mapeos, archivos y resultados por endpoint;
`endpoints.csv` con positivos/negativos, presencia y ejecución.
SHA-256 del ZIP: `ace0dddd1a1b2a1aa786ca71b925b75f65db2bab0f3204dc03222a93e01618a8`.

Límites del parser: analiza anotaciones literales directas de los controladores
del commit, prioriza rutas fijas frente a variables y rechaza ambigüedades.
No incluye Actuator ni handlers del framework. Identifica status literales en
aserciones; para esta versión no quedaron requests mapeados con aserciones de
status no interpretadas. El archivo crudo conserva el detalle para revisión.
