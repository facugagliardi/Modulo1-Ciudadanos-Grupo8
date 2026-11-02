# Cambios para aplicar manualmente en Trello

No se modificó el tablero. Fuente de esta propuesta: ejecución E2E real del
02/11/2026 sobre aplicación 04b2033, más la tanda API ya documentada.
Si una tarjeta ya tiene un resultado posterior, conservar ese historial y
agregar esta ejecución como comentario; no reemplazar resultados del equipo.

## 1. Actualizar estos once CP frontend

Marcar ejecución automatizada **Aprobado**, fecha 02/11/2026, en los siguientes
casos. Mantener vinculada su HU y añadir el identificador E2E como evidencia.

| CP y tarjeta | HU | Evidencia |
| --- | --- | --- |
| [CP-FE-001](https://trello.com/c/rtLLqw3E) Ingreso de vecino | HU1 | E2E-01 |
| [CP-FE-003](https://trello.com/c/R07j0q9P) CUIT de diez dígitos | HU1 | E2E-01 |
| [CP-FE-005](https://trello.com/c/ShBVzoEe) Contraseña incorrecta | HU1 | E2E-01 |
| [CP-FE-014](https://trello.com/c/GY7uK7RT) Vecino a /admin | HU3 | E2E-01 |
| [CP-FE-013](https://trello.com/c/J3j7DXkF) Auditor sin escritura | HU3 | E2E-02 |
| [CP-FE-050](https://trello.com/c/1CLb05Wu) Vecino registra organización | HU11 | E2E-03; observación BUG-FE-005 |
| [CP-FE-053](https://trello.com/c/OY0am4jR) Responsable aprueba | HU11 | E2E-03; RESPONSABLE_AREA |
| [CP-FE-064](https://trello.com/c/H11Xx6Xj) Pedir documentación | HU14 | E2E-04 |
| [CP-FE-060](https://trello.com/c/InkrZa2U) Entregar archivo nuevo | HU13 | E2E-04; PDF sintético pequeño |
| [CP-FE-069](https://trello.com/c/B7xhto6y) Iniciar expediente | HU15 | E2E-05 |
| [CP-FE-070](https://trello.com/c/nALX9xOU) Actuación visible al vecino | HU15 | E2E-05 |

Comentario común para copiar, reemplazando el E2E correspondiente:

> Reejecutado automáticamente el 02/11/2026 con Playwright 1.64.1 / Chromium
> sobre Compose QA, aplicación 04b2033. Resultado del caso: APROBADO.
> Evidencia: E2E-XX de la tanda completa 5/5, cero omitidos y cero reintentos,
> 27,477 s. Ver E2E_TESTING_2026-11-02.md y e2e/tests/recorridos.spec.js en la
> rama aedelstein. JSON/log disponibles en la carpeta de evidencia local o en
> el artifact compose-reportes del CI del commit que incorpora estos tests.
> Ejecución asistida por IA; revisión humana del equipo pendiente.

Para CP-FE-050 agregar: “Aprueba el flujo de alta PENDIENTE con dueño y posterior
aprobación; se mantiene BUG-FE-005 por la indicación accesible de estado final”.
Para CP-FE-053: “Ejecutado con RESPONSABLE_AREA; no acredita ADMINISTRATIVO”.
Para CP-FE-060: “PDF sintético pequeño; no acredita tamaño máximo ni tipos
incorrectos/rechazados”.

**No marcar las HU completas por estos once casos.** En HU1/HU3/HU11/HU13/HU14/HU15
añadir únicamente referencia a los CP reejecutados. No cambiar los otros 74 CP
frontend basándose en esta tanda. Los resultados de Martín/Elías pueden
adjuntarse con su fecha y origen, diferenciados de esta reejecución.

## 2. Actualizar defectos sin cerrar más de lo verificado

- **BUG-FE-007, auditor crea organización:** pasar a corregido/validado y
  registrar backend 04b2033 + E2E-02. Front sin acciones de alta; ruta bloqueada;
  API 403 y sin persistencia. Vincular HU3/HU11 y CP-FE-013.
- **BUG-FE-005, PENDIENTE como estado final:** mantener abierto, menor/cosmético;
  reproducido durante E2E-03. Vincular CP-FE-050. La aprobación operativa pasó.
- **BUG-FE-008:** registrar que el backend ya evita confundir ID de empleado
  con ciudadano (04b2033, regresiones Java y API); mantener pendiente la
  revalidación del alta desde el formulario de empleado. E2E-03 crea como vecino.
- **BUG-FE-009:** mantener pendiente para ADMINISTRATIVO; no hay esa cuenta en
  el seed. E2E-03 con responsable no lo cierra.
- **BUG-FE-010:** mantener abierto; el camino feliz de E2E-04 no verifica que
  se rechacen documentos incorrectos o ya rechazados.
- **Verificación de contacto / CP-086 backend:** registrar defecto abierto
  vinculado a la HU de contactos: código incorrecto de seis dígitos devuelve
  200 y guarda verificado=true. Evidencia: dos fallos en la tanda Bruno.
  Si ya existe una tarjeta equivalente, añadir evidencia allí sin duplicarla.

## 3. Si incorporan también los CP backend de la planilla

Son CP-001…086, diferentes de CP-FE. Usar
`output/testing/qa-organizaciones-2026-11-02/resultados-por-caso.csv`:
75 aprobados, tres **a confirmar** (CP-015/046/056), un caso **fallado**
(CP-086, dos requests) y siete **no ejecutados** (039/040/057/058/071/072/073).
No trasladar automáticamente “Aprobado” del CSV a la HU completa.

Mantener visibles los tres criterios a confirmar: creador con otros dueños
al 100%, redistribución 60/40→70 y unicidad fiscal entre tipos de sujeto.
No reinterpretar la implementación como requisito aprobado.

## 4. Crear pendientes técnicos si aún no existen

- Actualizar las ocho requests con rutas antiguas y `origen: INTERNO` de Bruno.
- Completar casos API de carga/versionado/validación de documentos, solicitudes
  y autenticación; priorizar negativos y permisos.
- Asignar revisión funcional humana de los resultados y preparación del PDF.

Adjuntar [AUDITORIA_API_2026-11-02.md](AUDITORIA_API_2026-11-02.md), que distingue
56/80 endpoints con request de los 26/80 alcanzados por la tanda Bruno.
Esto no es cobertura Java ni aprobación general de la API.

La fecha interna sigue siendo 03/11; testing oficial 10/11 antes de 13:30.
No adelantar el tag definitivo ni declarar entrega en Teams por actualizar
estas tarjetas. Main/tag, PDF, demo y declaración de IA se trabajan después,
por separado.
