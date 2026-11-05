# Integración M1 - Obras: preparación y despliegue

Estado actualizado al 5 de noviembre de 2026. Complementa los contratos versionados en
`contracts/m1/v1.0` y los schemas de referencia M3 en
`src/test/resources/contracts/m3`.

## Recepción implementada

- `publicWorksProjectApproved`, origen `obras`, versión `1.0`: registra un
  proyecto por `publicWorksProjectId` UUID y crea un único expediente.
- `citizenId` es opcional. Su omisión crea un expediente institucional sin
  asignar un ciudadano ficticio; si llega, debe ser un UUID existente en M1.
- `publicWorksProjectCompleted` informa el estado de obra `COMPLETED`. No
  resuelve ni aprueba automáticamente el expediente administrativo.
- Una finalización anticipada queda registrada hasta recibir la aprobación.
  Se deduplican eventos y se controlan fechas por cada tipo de hecho.
- Se rechazan cambios de titular y `caseFileId` de otro expediente. Los errores
  transaccionales permiten reintentar sin perder el evento.
- Los UUID y fechas con zona se validan también en M1. Core informó que su
  versión actual no hace cumplir `format` de los schemas de data.
- El acceso a expedientes institucionales requiere `LEER_TERCEROS`; un ID
  numérico coincidente de empleado no equivale al ciudadano titular.

## Resolución administrativa acordada con M3

El contrato publicado de `caseFileResolved` usa `caseFileId` UUID,
`externalReference.type=PUBLIC_WORKS_PROJECT`, referencia UUID al proyecto,
`state=resolved`, `resolution=approved|rejected` y resumen real del dictamen.

M3 confirmó que la respuesta se emite únicamente al existir resolución administrativa
real. Para v1.0 no necesita el UUID del expediente al crearlo: lo registra al recibir
`caseFileResolved`, junto al número y resultado, y correlaciona por proyecto.

`POST /expedientes/{id}/resolucion-obra` recibe `{ "resultado": "approved"|"rejected",
"resumen": "dictamen real" }`. Exige `CAMBIAR_ESTADO_EXPEDIENTE`, proyecto vinculado,
estado `EN_TRAMITE` y correlación original persistida. El resultado no tiene valor
predeterminado. Estado, resumen, fecha, actor, eventId y outbox se guardan en una
transacción. El bloqueo de fila impide resolver/publicar dos veces. Si falla el outbox,
se revierte también la resolución. El PATCH genérico no permite resolver obras sin
dictamen. La UI interna permite registrar y consultar el resultado.

No se publica por la mera creación del expediente ni por la finalización de la obra.
La migración `db/07_resolucion_obras.sql` agrega los campos de auditoría, sin completar
ni publicar resoluciones históricas.

Core recibió el schema de la revisión inmutable
`0b1eab33e99e71dac8e3f947409e8dab981258bc`. El 5/11 Core verificó en AWS que
`caseFileResolved` pertenece a `ciudadanos`, pero `json_schema` sigue NULL; su equipo
debe asociarlo y confirmar el resultado antes de la prueba compartida.
Los dos schemas de proyectos y las tres
relaciones M1/M3 ya fueron confirmados activos, con `maxAttempts: 4`.
No volver a registrar esas relaciones desde M1.

## Despliegue de la recepción

1. Revisar y publicar los cambios de M3 en `aedelstein`, sin mezclar trabajos
   locales de otros módulos ni archivos de credenciales.
2. En la base de destino, aplicar `db/05_integracion_obras.sql` antes de
   arrancar el backend actualizado. La migración es reejecutable: permite
   titular nulo, agrega el vínculo de proyecto y su tabla de proyección.
   No ejecutar scripts de reconstrucción que eliminen tablas compartidas.
3. Desplegar la revisión elegida en Render; conservar las credenciales
   actuales y el único consumidor coordinado de `q.ciudadanos`.
4. Verificar arranque con Hibernate, `/actuator/health`, login y acceso a
   expedientes. Health no acredita consumo de negocio.
5. Con Obras/Core, publicar un proyecto sintético y compartir `eventId`,
   `publicWorksProjectId` y `correlationId`. Comprobar el recibo, una sola
   fila en `proyecto_obra_externo` y su expediente asociado.
6. Probar finalización, duplicados y orden inverso. El expediente conserva
   su estado administrativo y no emite `caseFileResolved` por estos hechos.

El 5/11 se aplicaron las migraciones 05, 06 y 07 en la base usada por Render,
conservando los conteos previos de registros. La clave pública de Core quedó guardada
en el ambiente del servicio. El backend actualizado se desplegó en
`ciudadanos-m1-backend` (`srv-dbhq5p5g1s2s73anghi0`), validó el esquema con Hibernate
y reconectó por AMQPS como `module_ciudadanos`. La validación HTTP del endpoint
rechaza payload incompleto sin modificar expedientes. El resultado de CI/despliegue
y las revisiones efectivas se conservan en `output/integracion-2026-11-05` del
workspace de preparación; esa evidencia no se distribuye con git clone.
M3 confirmó credenciales y red resueltas, listener permanente en Azure Test y una
prueba satisfactoria con M6/Core. Esa confirmación no acredita todavía la E2E M1/M3.
No se publicaron eventos de prueba al Core como parte de la preparación.
