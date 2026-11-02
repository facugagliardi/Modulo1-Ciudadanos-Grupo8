# Integración M1 - Obras: preparación y despliegue

Estado al 2 de noviembre de 2026. Complementa los contratos versionados en
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

## Resolución pendiente de acuerdo bilateral

El contrato publicado de `caseFileResolved` usa `caseFileId` UUID,
`externalReference.type=PUBLIC_WORKS_PROJECT`, referencia UUID al proyecto,
`state=resolved`, `resolution=approved|rejected` y resumen real del dictamen.

No hay disparador automático de la respuesta. Antes de implementarlo y
activarlo, M1 y Obras deben confirmar el momento de emisión, cómo capturar el
dictamen efectivo y cómo informar el UUID antes de la resolución si M3 lo
necesita. No inferir aprobación administrativa desde un evento de proyecto.

Core recibió el schema de la revisión inmutable
`0b1eab33e99e71dac8e3f947409e8dab981258bc`; su asociación seguía pendiente en
la última respuesta compartida. Los dos schemas de proyectos y las tres
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

No se aplicó la migración a la base compartida ni se desplegó Render como
parte de esta preparación. La conexión de Obras desde Azure requiere la
verificación del equipo M3/Core; no se necesita su contraseña para las
pruebas locales de M1.
