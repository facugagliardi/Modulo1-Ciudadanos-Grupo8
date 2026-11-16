# Documentación de Eventos Asincrónicos del Sistema

**Sistema:** Módulo 1 — Ciudadanos, Organizaciones y Expedientes Digitales  
**Proyecto:** Desarrollo de Aplicaciones II — UADE  
**Versión del Sistema:** 2.1.0 (Actualizada con Integración de Patrón State [ADR-001], Transactional Outbox [ADR-002], Ports & Adapters [ADR-003], Seguridad Eje D y Regla 409 Conflict)  
**Fecha de Emisión:** 16 de Noviembre de 2026  
**Broker de Mensajería:** RabbitMQ 4.x (AMQP 0-9-1)  

---

## Tabla de Contenidos

1. [Topología de Mensajería y Arquitectura de Integración](#1-topología-de-mensajería-y-arquitectura-de-integración)
   - 1.1 Exchange y Colas en RabbitMQ
   - 1.2 Patrón Transactional Outbox (ADR-002)
   - 1.3 Idempotencia por Identificador Universal de Evento (`eventId`)
   - 1.4 Estructura del Sobre Común de Core (`EventEnvelope<T>`)

2. [Catálogo de Eventos Emitidos por M1 (Outbound)](#2-catálogo-de-eventos-emitidos-por-m1-outbound)
   - 2.1 `citizenUpdated` (REGISTERED, BLOCKED, DECEASED, ADDRESS_UPDATED)
   - 2.2 `caseFileResolved` (Hacia M3 Obras Públicas)
   - 2.3 `citizenInfoDelivered` (Hacia M6 Ambiente / Intermódulos)
   - 2.4 `organizationInfoDelivered` (Hacia M6 Ambiente / Intermódulos)
   - 2.5 `organizationRegistered` (Hacia Intermódulos)
   - 2.6 `representationGranted` (Hacia Intermódulos)
   - 2.7 `representationExpired` (Hacia Intermódulos)
   - 2.8 `socialDocumentationDelivered` (Hacia M8 Desarrollo Social)

3. [Catálogo de Eventos Consumidos por M1 (Inbound)](#3-catálogo-de-eventos-consumidos-por-m1-inbound)
   - 3.1 `socialDocumentationRequested` (Desde M8 Desarrollo Social)
   - 3.2 `publicWorksProjectApproved` (Desde M3 Obras Públicas)
   - 3.3 `publicWorksProjectCompleted` (Desde M3 Obras Públicas)
   - 3.4 `ticketCreated` (Desde M2 Atención Ciudadana)
   - 3.5 `ticketUpdated` (Desde M2 Atención Ciudadana)
   - 3.6 `updateTicketStatus` (Desde M2 Atención Ciudadana)
   - 3.7 `exemptionRequested` (Desde M5 Rentas)
   - 3.8 `updateExemptionStatus` (Desde M5 Rentas)
   - 3.9 `paymentPlanRequested` (Desde M5 Rentas)
   - 3.10 `updatePaymentPlanStatus` (Desde M5 Rentas)
   - 3.11 `casefileInitiated` / `casefileCreated` (Inicio de expediente intermódulo)
   - 3.12 Eventos Genéricos Entrantes vía HTTP (`/eventos/recibir`)

---

# 1. Topología de Mensajería y Arquitectura de Integración

## 1.1 Exchange y Colas en RabbitMQ
La arquitectura de integración asincrónica entre los distintos módulos municipales se basa en las directivas del Módulo Core:
1. **Exchange Compartido de Publicación (Outbound):**
   * Nombre: **`muni.inbox`**
   * Tipo: `fanout` (durable).
   * Comportamiento: Todos los módulos del municipio publican sus eventos salientes en este exchange. El componente Core gestiona las suscripciones y el ruteo hacia las colas correspondientes.
2. **Cola de Recepción de M1 (Inbound):**
   * Nombre: **`q.ciudadanos`**
   * Configuración: Cola durable administrada por Core. El listener de Spring AMQP en M1 consume pasivamente de esta cola (`@RabbitListener(queues = "${app.events.queue:q.ciudadanos}")`).

## 1.2 Patrón Transactional Outbox (ADR-002)
Para prevenir el problema del **Dual-Write** (inconsistencias entre la base de datos PostgreSQL y RabbitMQ):
* Cuando una operación de negocio muta datos (ej. registro de ciudadano, actualización de domicilio o resolución de expediente), el evento resultante se persiste dentro de la **misma transacción local de PostgreSQL** en la tabla `event_outbox` con estado inicial `EMITIDO`.
* Un worker de outbox despacha el mensaje hacia RabbitMQ solo después de confirmarse el commit en la base. Si la transacción de base de datos falla o hace rollback, el evento no se emite, garantizando consistencia absoluta.

## 1.3 Idempotencia por Identificador Universal de Evento (`eventId`)
* Todo evento entrante o saliente posee un `eventId` único canónico bajo formato **UUID v4** (RFC 4122).
* Antes de procesar cualquier evento inbound, el método `eventoService.estaProcesado(eventId)` verifica en la tabla `events` de PostgreSQL si el `eventId` ya fue registrado.
* Si el mensaje ya existe, el procesamiento se detiene de forma transparente retornando `"DUPLICADO"` o `"IDEMPOTENTE"`, sin volver a crear entidades ni arrojar excepciones en el broker.

## 1.4 Estructura del Sobre Común de Core (`EventEnvelope<T>`)
Todo evento en el sistema utiliza la siguiente plantilla universal:
```json
{
  "eventId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "eventType": "citizenUpdated",
  "eventVersion": "1.0",
  "occurredAt": "2026-11-16T12:00:00-03:00",
  "sourceModule": "ciudadanos",
  "correlationId": "7b745d35-536d-4387-a722-cb690586305d",
  "causationId": "d40e20ba-e2a8-4dd0-a11f-b6d6b58c68a8",
  "data": { ... }
}
```

---

# 2. Catálogo de Eventos Emitidos por M1 (Outbound)

---

### 2.1 `citizenUpdated` (REGISTERED, BLOCKED, DECEASED, ADDRESS_UPDATED)
* **Propósito:** Notificar a M2 (Atención Ciudadana) y M5 (Rentas) cualquier alta, bloqueo, fallecimiento o cambio de domicilio de un ciudadano.
* **Entradas:**
  * Exchange: `muni.inbox`
  * Routing Key: `modulo1.citizens.<updatetype>` (ej: `modulo1.citizens.registered`)
  * Sobre de Envío: `sourceModule: "ciudadanos"`, `eventType: "citizenUpdated"`
  * Carga Útil (`data`):
    ```json
    {
      "citizenId": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
      "updateType": "REGISTERED",
      "details": {
        "dni": "34567890",
        "cuil": "20345678901",
        "name": "Marcos",
        "lastname": "Ferreyra",
        "birthdate": "1990-04-12",
        "state": "ACTIVE",
        "nationality": "argentina",
        "address": {
          "propertyId": 5501,
          "street": "Av. Rivadavia",
          "number": "1450",
          "primary": true,
          "effectiveFrom": "2026-08-20"
        }
      },
      "updatedBy": {
        "userType": "SELF_SERVICE",
        "userId": "b63f5a2e-4b71-46e7-8b01-381c85d88f62"
      }
    }
    ```
    *Variantes de `updateType`:*
    * `REGISTERED`: Alta de vecino en `POST /auth/register`.
    * `BLOCKED`: Bloqueo administrativo en `PATCH /ciudadanos/{id}/estado`.
    * `DECEASED`: Marcación de fallecido en `PATCH /ciudadanos/{id}/estado`.
    * `ADDRESS_UPDATED`: Cambio de domicilio principal en `PATCH /domicilios/{id}/principal`.
* **Salida Correcta:**
  * El evento se guarda en PostgreSQL en la tabla `events` como `EMITIDO`, se inserta en `event_outbox` y se publica en `muni.inbox`.
* **Salidas Alternativas por Fallos:**
  * Error al serializar JSON $\to$ Lanza `IllegalStateException` y efectúa rollback de la transacción de base de datos para no dejar datos huérfanos.

---

### 2.2 `caseFileResolved` (Hacia M3 Obras Públicas)
* **Propósito:** Notificar la resolución administrativa formal de un trámite o expediente de obra a M3.
* **Entradas:**
  * Exchange: `muni.inbox`
  * Routing Key: `caseFileResolved`
  * Carga Útil (`data`):
    ```json
    {
      "caseFileId": "d40e20ba-e2a8-4dd0-a11f-b6d6b58c68a8",
      "fileNumber": "EXP-2026-001042",
      "status": "resolved",
      "outcome": "approved",
      "relatedObject": {
        "type": "PUBLIC_WORKS_PROJECT",
        "id": "7b745d35-536d-4387-a722-cb690586305d"
      },
      "resolutionSummary": "Ejemplo de dictamen administrativo favorable."
    }
    ```
  * Condición de Disparo: Invocación de `POST /expedientes/{id}/resolucion-obra`.
* **Salida Correcta:** Evento emitido con `correlationId` preservado.
* **Salidas Alternativas:** `IllegalArgumentException` si `correlationId` es nulo o no es UUID válido.

---

### 2.3 `citizenInfoDelivered` (Hacia M6 Ambiente / Intermódulos)
* **Propósito:** Entregar información de identidad y domicilio ante consultas intermodulares.
* **Routing Key:** `modulo1.citizens.infodelivered`
* **Carga Útil (`data`):**
  ```json
  {
    "citizenId": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
    "fullName": "Marcos Ferreyra",
    "documentId": "34567890",
    "phone": "+54 11 4455-6677",
    "email": "marcos.ferreyra@mail.com",
    "address": {
      "street": "San Martín",
      "number": "870",
      "neighborhoodId": "BARR-014"
    }
  }
  ```
* **Condición de Disparo:** Consulta GET a `/ciudadanos/{id}/identidad`.
* **Salida Correcta:** Emisión asincrónica al broker conservando el `X-Correlation-Id` recibido en la cabecera HTTP.

---

### 2.4 `organizationInfoDelivered` (Hacia M6 Ambiente / Intermódulos)
* **Propósito:** Entregar información consolidada de persona jurídica a otros módulos.
* **Routing Key:** `modulo1.organizations.infodelivered`
* **Carga Útil (`data`):**
  ```json
  {
    "organizationId": 3311,
    "cuit": 30712345678,
    "legalName": "Panadería Del Sol S.R.L.",
    "tradeName": "Panadería Del Sol",
    "taxId": "30712345678",
    "status": "ACTIVA"
  }
  ```
* **Condición de Disparo:** Consulta GET a `/organizaciones/{id}/identidad`.

---

### 2.5 `organizationRegistered` (Hacia Intermódulos)
* **Propósito:** Notificar la incorporación de una persona jurídica en el municipio.
* **Routing Key:** `modulo1.organizations.registered`
* **Carga Útil (`data`):**
  ```json
  {
    "organizationId": 3311,
    "cuit": 30712345678,
    "taxId": "30712345678",
    "legalName": "Panadería Del Sol S.R.L.",
    "tradeName": "Panadería Del Sol",
    "type": "COMMERCE",
    "status": "ACTIVE",
    "holder": {
      "personId": 8452,
      "personType": "LEGAL"
    }
  }
  ```
* **Condición de Disparo:** Aprobación de organización en `PATCH /organizaciones/{id}/aprobar`.

---

### 2.6 `representationGranted` (Hacia Intermódulos)
* **Propósito:** Notificar la designación de un apoderado legal sobre una persona jurídica.
* **Routing Key:** `modulo1.representations.granted`
* **Carga Útil (`data`):**
  ```json
  {
    "representationId": 990,
    "personId": 8452,
    "organizationId": 3311,
    "cuit": 30712345678,
    "scope": "LEGAL_REPRESENTATIVE",
    "from": "2026-08-21",
    "status": "VALID"
  }
  ```
* **Condición de Disparo:** Otorgamiento en `POST /representaciones`.

---

### 2.7 `representationExpired` (Hacia Intermódulos)
* **Propósito:** Informar el vencimiento o revocación de un poder de representación.
* **Routing Key:** `modulo1.representations.expired`
* **Carga Útil (`data`):**
  ```json
  {
    "representationId": 990,
    "personId": 8452,
    "organizationId": 3311,
    "cuit": 30712345678,
    "until": "2026-09-14",
    "status": "EXPIRED"
  }
  ```
* **Condición de Disparo:** Revocación en `PATCH /representaciones/{id}/estado`.

---

### 2.8 `socialDocumentationDelivered` (Hacia M8 Desarrollo Social)
* **Propósito:** Responder al Módulo 8 confirmando la creación de expedientes y solicitudes de documentación originadas por pedidos sociales.
* **Routing Key:** `socialDocumentationDelivered`
* **Carga Útil (`data`):**
  ```json
  {
    "citizenId": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
    "applicationId": "sol-00456",
    "programId": "prog-00789",
    "programEditionId": "edit-00123",
    "files": [
      {
        "fileId": "d40e20ba-e2a8-4dd0-a11f-b6d6b58c68a8",
        "number": "EXP-M8-sol-00456",
        "initiatingArea": "SOCIAL_DEVELOPMENT",
        "status": "IN_PROGRESS",
        "documentationRequests": [
          {
            "requestId": "sol-doc-3341",
            "documentType": "CERTIFICADO_DOMICILIO",
            "status": "PENDING"
          }
        ]
      }
    ]
  }
  ```
* **Condición de Disparo:** Procesamiento automático exitoso de un evento entrante `socialDocumentationRequested`.

---

# 3. Catálogo de Eventos Consumidos por M1 (Inbound)

---

### 3.1 `socialDocumentationRequested` (Desde M8 Desarrollo Social)
* **Cola de Consumo:** `q.ciudadanos`
* **Entradas (Sobre y Payload):**
  ```json
  {
    "eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "eventType": "socialDocumentationRequested",
    "eventVersion": "1.0",
    "occurredAt": "2026-11-16T12:00:00-03:00",
    "sourceModule": "desarrollo-social",
    "correlationId": "f0e1d2c3-b4a5-6789-0123-456789abcdef",
    "data": {
      "citizenId": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
      "applicationId": "550e8400-e29b-41d4-a716-446655440000",
      "programId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "programEditionId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "deadline": "2026-12-15",
      "notes": "Asistencia social familiar",
      "requiredDocuments": [
        {
          "requirementId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
          "type": "CERTIFICADO_DOMICILIO",
          "required": true
        }
      ]
    }
  }
  ```
* **Salida Correcta y Efectos de Negocio en M1:**
  1. Registra el evento en PostgreSQL como `RECIBIDO` en la tabla `events`.
  2. Crea un registro en la tabla `expediente` con número `EXP-M8-<applicationId>`, carátula `"Solicitud social <applicationId>"` y área iniciadora `"Desarrollo Social"`.
  3. Inserta las solicitudes de documentación correspondientes en la tabla `solicitud_documentacion` en estado `PENDIENTE` y `origen: EVENTO`.
  4. Emite automáticamente el evento de respuesta `socialDocumentationDelivered` hacia RabbitMQ, vinculando `causationId: eventId` y `correlationId`.
  5. Retorna `"APLICADO"`.
* **Salidas Alternativas por Fallos:**
  * **Duplicado por Idempotencia:** Si el `eventId` ya existe en la tabla `events` $\to$ Retorna `false` o `"DUPLICADO"` sin crear registros repetidos.
  * **Contrato Inválido:** Si `sourceModule != "desarrollo-social"` $\to$ Lanza `ApiException.invalido("socialDocumentationRequested debe provenir de desarrollo-social")`.
  * **Ciudadano Inexistente:** Si el `citizenId` no existe en la base de datos de M1 $\to$ Lanza `ApiException.noEncontrado("citizenId no existe en M1")`.
  * **Expediente Preexistente:** Si la `applicationId` ya tiene un expediente generado $\to$ Lanza `ApiException.conflicto("La applicationId ya tiene expediente...")`.

---

### 3.2 y 3.3 `publicWorksProjectApproved` y `publicWorksProjectCompleted` (Desde M3 Obras Públicas)
* **Cola:** `q.ciudadanos`
* **Entradas:**
  * `eventType`: `"publicWorksProjectApproved"` o `"publicWorksProjectCompleted"`
  * Payload (`data`):
    * `publicWorksProjectId` (UUID): Identificador de obra en M3.
    * `citizenId` (UUID, opcional): Vecino solicitante.
    * `approvedAt` / `completedAt`: Fecha y hora ISO 8601.
* **Salida Correcta y Efectos de Negocio:**
  * Adquiere un bloqueo transaccional distribuido mediante `pg_advisory_xact_lock(hashtextextended('M3:' + projectId, 0))`.
  * Comprueba idempotencia en `events`.
  * Inserta o actualiza la fila en la tabla `proyecto_obra_externo` vinculando la obra con su expediente administrativo en M1.
  * Retorna `"APLICADO"`.
* **Salidas Alternativas por Fallos:**
  * Mensaje duplicado $\to$ Retorna `"DUPLICADO"`.
  * Falla de persistencia o datos inválidos $\to$ Lanza `AmqpRejectAndDontRequeueException` hacia Dead Letter Queue para no ciclar en reintentos infinitos.

---

### 3.4, 3.5 y 3.6 `ticketCreated`, `ticketUpdated`, `updateTicketStatus` (Desde M2 Atención Ciudadana)
* **Cola:** `q.ciudadanos`
* **Entradas:**
  * Payload (`data`):
    * `ticketId`: Identificador del ticket de reclamo en M2.
    * `citizenId`: UUID del ciudadano.
    * `status`: Estado operativo (`REGISTERED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, etc.).
    * `updatedAt`: Timestamp de actualización.
* **Salida Correcta y Efectos de Negocio:**
  * Registra o actualiza el estado en la tabla `tramite_externo` con `source_module: "atencion-ciudadana"`.
  * Hace visible el reclamo al vecino en la pantalla *Trámites Externos* y en el endpoint `GET /ciudadanos/{id}/tramites-externos`.
  * Retorna `"APLICADO"`.

---

### 3.7 a 3.10 `exemptionRequested`, `updateExemptionStatus`, `paymentPlanRequested`, `updatePaymentPlanStatus` (Desde M5 Rentas)
* **Cola:** `q.ciudadanos`
* **Entradas:**
  * Payload (`data`):
    * `externalId`: Identificador del trámite impositivo en M5.
    * `citizenId`: UUID del ciudadano contribuyente.
    * `status`: Estado del beneficio (`STARTED`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED`).
* **Salida Correcta y Efectos de Negocio:**
  * Actualiza la tabla `tramite_externo` con `source_module: "rentas"`.
  * Retorna `"APLICADO"`.

---

### 3.11 `casefileInitiated` / `casefileCreated` (Inicio de Expediente Intermódulo)
* **Propósito:** Permitir a otros módulos del municipio solicitar el inicio de un expediente administrativo en M1 mediante mensajería asincrónica.
* **Entradas:**
  * Payload (`data`):
    * `citizenId`: UUID del vecino titular.
    * `caratula` o `title`: Descripción del trámite.
    * `areaIniciadora`: Nombre de la dependencia solicitante.
    * `requiredDocument` (opcional): Tipo de documentación requerida.
* **Salida Correcta y Efectos de Negocio:**
  * Crea el expediente en PostgreSQL en estado `INICIADO`.
  * Si incluye `requiredDocument`, genera la `SolicitudDocumentacion` en estado `PENDIENTE`.
  * Queda inmediatamente disponible para consulta en el Portal del Vecino.

---

### 3.12 Eventos Genéricos Entrantes vía HTTP (`POST /eventos/recibir`)
* **Propósito:** Canal de interoperabilidad HTTP y pruebas para simular la recepción de cualquier evento JSON del ecosistema municipal.
* **Entradas:** Objeto JSON con el sobre `EventEnvelope`.
* **Salida Correcta:**
  * Primer envío: `201 Created` (`"status": "GUARDADO_RECIBIDO"`).
* **Salidas Alternativas por Fallos:**
  * Reintento del mismo evento con idéntico `eventId`: `200 OK` (`"status": "DUPLICADO_IGNORADO"`).
  * Payload que no es un objeto JSON: `400 Bad Request` (`"JSON invalido"`).
