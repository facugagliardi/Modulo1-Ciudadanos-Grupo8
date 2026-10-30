# Integración de Ciudadanos con Atención Ciudadana y Rentas

Contrato implementado en la rama `aedelstein`, 27 de octubre de 2026. Complementa el catálogo Word v3.0; no acredita despliegue ni suscripciones registradas en Core.

Fuentes: contrato de M2 v1.78 (confirmado definitivo por M2), documento de eventos salientes de M5 del 10/10/2026 y FAQ del Core compartidos por el equipo. M2 aprobó el contrato v3.1 de M1, incluyendo actorId de empleados. El documento M5 conserva ejemplos legacy `c-00123`; en esta integración `citizenId` debe ser el UUID canónico real de M1.

## Identidad en login y renovación

No cambia el `sub` numérico del JWT ni se eliminan campos anteriores del login. Los tokens siguen llegando en headers.

La emision de access y refresh queda fijada en **HS256**, sin depender de la
longitud de la clave. Se conserva `APP_JWT_SECRET`: cuando esta en Base64, los
modulos verificadores deben decodificarla y usar los bytes resultantes como clave
HMAC, no el texto Base64. El ambiente de integracion actual utiliza Base64.
M1 conserva la lectura de tokens anteriores HS384/HS512 firmados con la misma
clave hasta su vencimiento; las nuevas emisiones usan HS256. La confirmacion
a los pares debe hacerse despues de desplegar este cambio y comprobar un login.

| Sujeto | Campos nuevos del cuerpo y claims del access/refresh |
|---|---|
| Ciudadano | `citizenId` = UUID almacenado en `ciudadano.uuid`; `actorId` = mismo UUID; `actorType` = `CIUDADANO` |
| Empleado | `actorId` = UUID almacenado en `cuenta_empleado.uuid`; `actorType` = `EMPLEADO`; no se inventa `citizenId` |

Se cubren `/auth/login`, `/auth/empleados/login` y `/auth/usuario/login`. Los logins ciudadanos conservan además `uuid` como alias anterior. El login unificado conserva `user_id` y su `role` histórico; el claim de autorización de ciudadanos queda unificado en `PERSONA`.

Ejemplo parcial de `/auth/login`:

```json
{
  "personaId": 8452,
  "tipoPersona": "CIUDADANO",
  "rol": "PERSONA",
  "uuid": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
  "citizenId": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
  "actorId": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
  "actorType": "CIUDADANO"
}
```

Los UUID del ejemplo son ilustrativos: cada módulo conserva el recibido de la cuenta real. Los empleados existentes reciben UUID una sola vez en la migración. Un empleado y un ciudadano con igual ID numérico no se consideran la misma identidad.

La renovación vuelve a leer la cuenta, conserva su UUID persistido y toma estado/rol actual. Los refresh anteriores al cambio, sin UUID, se actualizan al renovarse. Una cuenta bloqueada/inactiva no obtiene otro access por refresh. Esto no agrega revocación inmediata de access ya emitidos ni invalidación del refresh anterior.

**Acordar con M2:** su `ModuleUser.citizenId` actualmente se usa también para agentes. Para empleados deben aceptar `actorId` como identidad autenticada o definir un vínculo ciudadano real; M1 no entrega un ciudadano ficticio para llenar ese campo.

## Consumos implementados

| Productor | eventType | Resultado local |
|---|---|---|
| `atencion-ciudadana` | `ticketCreated` | Crea el seguimiento de un ticket identificado, en `REGISTERED` |
| `atencion-ciudadana` | `ticketUpdated` | Actualiza snapshot/delta público y usa `currentStatus` |
| Módulo operativo | `updateTicketStatus` | Actualiza sólo ticket conocido y del área responsable; infiere efecto informativo de `updateType` |
| `rentas` | `exemptionRequested` | Registra solicitud de exención en `REQUESTED` |
| `rentas` | `updateExemptionStatus` | Informa `APPROVED` o `REJECTED` |
| `rentas` | `paymentPlanRequested` | Registra solicitud de plan en `REQUESTED` |
| `rentas` | `updatePaymentPlanStatus` | Informa `GRANTED` o `REJECTED` |

M2 es autoridad sobre los tickets; M5 es autoridad sobre exenciones y planes. M1 no los aprueba, no genera un evento espejo y no crea un expediente automáticamente por estos siete eventos. Tampoco consulta ni reconcilia directamente con M2/M5.

`ticketUpdated` admite los updateType de v1.78: `STATUS_CHANGED`, `ROUTED`, `PROGRESS`, `PRIORITY_CHANGED`, `ESCALATION_CHANGED`, `INFORMATION_REQUIRED`, `INFORMATION_PROVIDED`, `DUPLICATE_LINKED`, `REOPENED`, `RESOLVED`, `CLOSED`, `CANCELLED`, `CONTENT_UPDATED`.

Proyección operativa aproximada: `STARTED/PROGRESS → IN_PROGRESS`, `INFORMATION_REQUIRED → PENDING_INFORMATION`, `RETURNED → IN_REVIEW`, `RESOLVED → RESOLVED`, `REJECTED → CANCELLED`. No equivale a confirmación de que M2 aceptó el hecho; puede haber diferencias persistentes, como permite v1.78.

Reglas de consumo:

- Ticket anónimo: ignorado sin cambios de negocio.
- `updateTicketStatus` de ticket desconocido: ignorado; no se crea otro ticket ni se consulta M2.
- Identidad del ciudadano: UUID real consultado en M1, sin asignar al primer vecino ni inventar equivalencias.
- El `citizenId` de un trámite ya registrado no puede cambiar silenciosamente.
- Se excluyen `internalMessage`, credenciales, tracking codes y actores privados del registro público de estos eventos. La proyección usa una lista blanca de campos; no expone el JSON crudo.
- El pedido `informationRequest.messageForCitizen` se muestra como mensaje público; la respuesta se recibe en M2.
- M1 no infiere autoría ciudadana a partir del productor ni interpreta el ID del ticket como identidad de una persona.
- Se deduplica por `eventId` dentro de la misma transacción que actualiza la proyección. Un fallo antes del commit permite reintentar.
- Se serializan escrituras simultáneas por trámite. Eventos antiguos o con igual instante no reemplazan el estado más nuevo.
- Para orden temporal se usa `createdAt`, `updatedAt` o `updateOccurredAt` de M2; para M5, fecha del sobre. Un alta M2 tardía puede completar datos iniciales sin retroceder el estado.
- M5 separa exención y plan por tipo + `requestId`; no se mezclan solicitudes con identificadores coincidentes. Un rechazo no inventa datos de otorgamiento.

Hay controles de sobre, origen, UUID, estados y los datos necesarios para la proyección. No se implementa aquí un validador completo del JSON Schema de M2 ni lógica operativa de cada variante.

## Consulta y presentación

`GET /ciudadanos/{id}/tramites-externos` devuelve `{items: [...]}` con el seguimiento público de ese ciudadano. Requiere ser ese ciudadano o tener `LEER_TERCEROS`; la comprobación de «propio» incluye tipo de sujeto.

El portal lo presenta dentro de “Mis trámites”, bajo “Seguimiento de otros módulos”, con estado informado, referencia pública y último mensaje. No ofrece acciones para resolver trámites de otro módulo ni enlaces construidos con URLs supuestas.

`POST /eventos/core/recibir` es una entrada manual para pruebas internas, protegida con `EDITAR_TERCEROS`. Usa el mismo dispatcher que RabbitMQ. No es el canal de integración de otros equipos: en operación envían al Core.

## Sobre y RabbitMQ

Salida: `occurredAt` con offset. Entrada: acepta `occurredAt` y el alias histórico `occuredAt`; rechaza ambas si representan instantes distintos. No se envían ambas a la vez. **Core confirmó el 28/10/2026 que `occurredAt` es la grafía oficial y que `occuredAt` en la FAQ es un error.**

Campos de salida: `eventId`, `eventType`, `eventVersion`, `occurredAt`, `sourceModule`, `correlationId`, opcional `causationId`, `data`. Se genera correlación para acciones directas y se conserva cuando el llamador la suministra. El ID del registro de un evento emitido coincide ahora con su `eventId` publicado.

El único listener consume la cola configurada en `APP_EVENTS_QUEUE` (default `q.ciudadanos`) y despacha por `eventType`. El consumidor de M8 se invoca sólo para `socialDocumentationRequested` de `desarrollo-social`.

M1 no declara exchanges, colas ni bindings. El Core administra esos recursos y las suscripciones; Spring comprueba la cola pasivamente. No se crean bindings de nuestra cola directamente a `muni.inbox`. El publicador usa el nombre configurado en `APP_EVENTS_EXCHANGE` sin intentar declarar el exchange ni exigir permiso `configure`. Esto tambien evita declaraciones durante el health check aunque el listener este desactivado. Los errores de consumo se rechazan sin requeue local para que Core administre sus reintentos/DLQ. Los tipos no relevantes se ignoran correctamente.

**Si un despliegue anterior creó un binding directo `muni.inbox → q.ciudadanos`, quitar el bean de Java no lo borra del broker. Core debe revisar y retirar ese binding antiguo.** No se eliminó infraestructura remota desde esta rama.

El listener sigue desactivado por defecto en desarrollo (`RABBITMQ_AUTO_STARTUP=false`). Activarlo sólo con cola y suscripciones disponibles.

## Base de datos y puesta en marcha

### Uso de esta rama en otra computadora

El código no depende de la IP de la PC que desarrolló estos cambios. La habilitación de red de Core sí depende de la salida pública de cada backend. Cada compañero debe traer la rama remota `aedelstein`, usar Java 21 e instalar las dependencias del frontend con `npm ci`.

Los comandos para quien todavía no tiene la rama local son `git fetch origin` y `git switch --track origin/aedelstein`. Si ya la tiene, usar `git switch aedelstein` y `git pull --ff-only` con el árbol de trabajo en condiciones de actualizarse.

Aplicar la migración que figura abajo sobre la base que vaya a utilizar esa instancia, antes de arrancar el backend actualizado. Si todos usan una misma base, coordinar su aplicación; no ejecutar los scripts de reinicio de esquema sobre datos compartidos.

Las credenciales de RabbitMQ y Core no se suben a Git ni viajan con el pull. Configurarlas en variables del proceso o en `src/main/resources/application-local.yml`, que está ignorado por Git, y activar el perfil local si se usa ese archivo. Un `.env` por sí solo no se carga automáticamente en Spring Boot ni en el script PowerShell. El secreto Core no reemplaza APP_JWT_SECRET; todas las instancias que deban validar los mismos JWT de usuario necesitan la clave de usuario acordada por privado.

Para trabajar en pantallas, login o pruebas locales sin conectarse al Core, conservar `RABBITMQ_AUTO_STARTUP=false`. No hace falta tener habilitada la IP de cada desarrollador para ese trabajo.

**Una cola compartida no hace broadcast a cada PC.** Si varios compañeros activan a la vez un consumidor de `q.ciudadanos`, RabbitMQ reparte los mensajes entre ellos. Si además usan bases diferentes, el seguimiento puede quedar dividido entre computadoras. Mantener un único backend consumidor coordinado, o acordar con Core colas/entornos de desarrollo separados antes de activar más instancias. La rama mantiene el consumidor desactivado por defecto.

Antes de reiniciar el backend modificado sobre una base existente, ejecutar `db/03_integracion_m2_m5.sql` en la base correcta. Agrega UUID a empleados existentes y la tabla de proyecciones; es reejecutable y conserva UUID ya asignados. No borra datos. Los scripts de esquema nuevo también se actualizaron.

No usar `retool_schema.sql` como migración de una base con datos: ese script incluye DROP de tablas.

No se aplicó esta migración a la base activa/remota ni se reinició el proceso del usuario. Hasta aplicar migración y desplegar, los nuevos campos y consumidores no están disponibles en ese ambiente.

## Registro con Core

Preparado `scripts/registrar-core.ps1`. Sin parámetros sólo muestra el plan. Para ejecutar el registro requiere:

- `CORE_API_URL`: `https://core-uade-2026.duckdns.org/api/v1`. El script también acepta la raíz del host y normaliza el prefijo para no duplicar `/api/v1`.
- `CORE_MODULE_SECRET`: secreto de máquina de `ciudadanos`, entregado al PO por canal privado. No compartirlo en Git ni en mensajes de integración.
- Credenciales RabbitMQ del ambiente mediante `RABBITMQ_USER`, `RABBITMQ_PASS`.

Sin switches, el script muestra un plan sin conectarse. `./scripts/registrar-core.ps1 -Consultar` obtiene token y consulta el mapa sin modificar publicaciones ni suscripciones. Para registrar únicamente el consumo operativo faltante, una vez coordinado: `./scripts/registrar-core.ps1 -Aplicar -SoloSuscripciones -Suscripciones updateTicketStatus`.

`-Aplicar` puede registrar las publicaciones implementadas y las suscripciones seleccionadas. Los dos cambios de estado de Rentas se excluyen del lote predeterminado hasta que M5 confirme sus nombres; después se pueden seleccionar explícitamente con `-Suscripciones updateExemptionStatus,updatePaymentPlanStatus`. Si Core devuelve error se detiene: algunas operaciones anteriores pueden haber tenido éxito; revisar el mapa antes de repetir.

No se ejecutó registro remoto desde M1. Core agregó la suscripción a updateTicketStatus. La consulta autenticada del mapa realizada posteriormente por M1 confirmó ciudadanos en consumedBy de los cinco tipos activos indicados abajo. Tampoco se declararon consumos de M3/M4 u otros tipos sin implementación.

### Ambiente confirmado por Core el 28 de octubre

Hay un único ambiente compartido, sin testing separado. Configurar estas variables en el proceso del backend cuando estén disponibles las credenciales:

```powershell
$env:CORE_API_URL = 'https://core-uade-2026.duckdns.org/api/v1'
$env:RABBITMQ_HOST = 'core-uade-2026.duckdns.org'
$env:RABBITMQ_PORT = '5671'
$env:RABBITMQ_VHOST = 'core'
$env:RABBITMQ_SSL_ENABLED = 'true'
```

`RABBITMQ_USER`, `RABBITMQ_PASS` y `CORE_MODULE_SECRET` se cargan por el canal privado del PO. Core indicó que la cuenta `ciudadanos` ya está activa y tiene secreto: recuperarlo por ese canal; no generar ni rotar otro desde M1. Las variables anteriores no conectan por sí solas ni habilitan el listener; `RABBITMQ_AUTO_STARTUP` se mantiene en false hasta coordinar la prueba compartida. `application.yml` mantiene verificación del certificado y hostname TLS.

Estado comunicado por Core y contrastado por M1 mediante GET autenticado a /api/v1/event-types/map:

| Suscripción | Estado informado |
|---|---|
| `ticketCreated` | Activa, maxAttempts 4 |
| `ticketUpdated` | Activa, maxAttempts 4 |
| `exemptionRequested` | Activa, maxAttempts 4 |
| `paymentPlanRequested` | Activa, maxAttempts 4 |
| `updateTicketStatus` | Suscripción agregada por Core con maxAttempts 4; mapa confirma ciudadanos en consumedBy. El owner todavía figura como ciudadanos |
| `updateExemptionStatus` | Nombre exacto no registrado; confirmar con Rentas antes de darlo de alta |
| `updatePaymentPlanStatus` | Nombre exacto no registrado; confirmar con Rentas antes de darlo de alta |

Core habilitó la IP de esta PC y entregó credenciales por privado; el secreto nuevo reemplaza al anterior. Se probaron sólo en memoria, sin guardarlos en archivos. Desde esta PC se verificó HTTP 200 al obtener token y consultar el mapa, autenticación AMQP TLS con validación de certificado/hostname y declaración pasiva de q.ciudadanos. La cola tenía 2 mensajes pendientes y 0 consumidores. No se publicó ni consumió ningún mensaje, y no se alteraron suscripciones. Esto verifica conexión y acceso, no el procesamiento de negocio.

Si se cambia de red o se despliega en un servidor hay que confirmar nuevamente la IP de salida. Core todavía no informó aquí el estado de la suscripción M8.

## Pendientes que deben responder los equipos

1. Core: nombres/suscripciones pendientes de Rentas y confirmación de M8. Acceso desde esta PC, credenciales y consumo registrado de updateTicketStatus ya verificados. Revalidar red si cambia el equipo de ejecución.
2. M2: desplegar y verificar el ajuste HS256, acordar cuentas de prueba y compartir por privado la clave Base64 y su interpretacion. La aceptación de actorId para empleados y el contrato v3.1 ya fueron confirmados por M2. El backend ya esta alojado en Render; falta confirmar a los pares el despliegue del algoritmo fijado.
3. M5: confirmar los nombres exactos `updateExemptionStatus` y `updatePaymentPlanStatus` contra su publicación real en Core, y fixtures con UUID canónico real de ciudadano; el documento adjunto aún contiene IDs de ejemplo `c-00123`. No es necesario convertir los `requestId` legacy en UUID para correlacionarlos: son claves externas de M5.
4. Acordar y ejecutar una prueba de punta a punta por Core después de migración y despliegue. Las pruebas locales no acreditan entrega del broker compartido.

## Verificación local

Resultado de esta revisión: 138 pruebas de backend aprobadas (11 sobre PostgreSQL aislado, sin omisiones), 448 pruebas de frontend aprobadas y build Vite correcto. El build advierte un bundle mayor a 500 kB; no impide compilar.

Pruebas de contratos de identidad en JSON y JWT, renovación, dispatcher, errores sin requeue, ambas grafías entrantes y publicación con mismo eventId persistido. Pruebas opt-in con PostgreSQL aislado verifican migración reejecutable, concurrencia, duplicados, rollback, orden temporal, anonimato, privacidad, rechazos y destinatarios desconocidos.

Para repetir las pruebas PostgreSQL, configurar `M1_TEST_POSTGRES_URL` hacia un servidor de pruebas con usuario `postgres` y acceso de prueba sin contraseña. La prueba crea y elimina su propio schema con nombre aleatorio; nunca lee el datasource de `application.yml`. Ejecutar Maven con Java 21. Sin esa variable, esas pruebas se omiten explícitamente.

El frontend se verifica con `npm test` y `npm run build`. No se declara aquí cobertura del 85% ni entrega real a otros módulos.
