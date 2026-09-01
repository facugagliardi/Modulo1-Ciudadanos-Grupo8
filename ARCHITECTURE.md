erDiagram

    persona {
        int id PK
        string tipo "check: ciudadano | juridica"
        int cuit
    }

    Ciudadano {
        int id PK "FK a persona.id"
        int domicilioId FK
        string documentoId FK "UNIQUE NOT NULL"
        string nombre
        string apellido
        date fechaNacimiento
        string estado
    }

    PersonaJuridica {
        bigint id PK "FK a persona.id"
        int documentoId FK
        string nombre
        date fecha_de_creacion
    }

    contraseñasPersonas {
        int personaId PK, FK
        string password
    }

    Relacion {
        int ciudadanoId1 FK
        int relacionId PK
        string relacionCiudadano1
        boolean esResponsable
        int ciudadanoId2 FK
        string relacionCiudadano2
    }

    ContactoCiudadano {
        int contactoId PK
        string tipo "EMAIL o TELEFONO"
        string valor
        boolean verificado
    }

    contacto_persona {
        int ciudadanoId PK, FK
        int contactoId PK, FK
    }

    Propiedades {
        int propiedadId PK
        string tipo
        string calle
        string numero
        string altura
        uuid idBarrio
        string longitud
        string latitud
    }

    personas_propiedades {
        int id_persona PK, FK
        int id_propiedad PK, FK
        date vigenteDesde
        date vigenteHasta
    }

    Organizacion {
        int organizacionId PK
        string taxId "UNIQUE NOT NULL"
        string razonSocial
        string nombre
        string tipo
        string estado
        int cuit
    }

    Persona_Organizacion {
        int id_persona PK, FK
        int id_organizacion PK, FK
    }

    Representacion {
        int personaId FK
        int organizacionId FK
        int representacionId PK
        string alcance
        date desde
        date hasta
        string estado
    }

    IntegrantesPersonasJuridicas {
        int eventId PK, FK
        int id_ciudadano PK, FK
        int id_persona_juridica FK
    }

    Documento {
        int documentoId PK
        int personaId FK
        string tipoDocumento
        int version
        date vigenciaHasta
        string cargadoPor
        string validadoPor
    }

    SolicitudDocumentacion {
        int solicitudId PK
        int titularId
        string tipoDocumento FK
        date plazo
        string estado
        string origen
        string detalle FK
    }

    Expediente {
        int expedienteId PK
        string numero "UNIQUE NOT NULL"
        int personaId FK
        string areaIniciadora
        string estado
        string caratula
        datetime fechaInicio
    }

    Actuacion {
        int expedienteId PK, FK
        int actuacionId PK
    }

    EventoOutbox {
        string eventId PK "VARCHAR(36)"
        string tipo
        string moduloOrigen
        string descripcion
        datetime fecha
        string adjuntos "JSON o referencias externas"
    }

    EventoProcesado {
        string eventId PK "VARCHAR(36)"
        string consumerId
        datetime processedAt
    }

    cuentasEmpleado {
        int empleadoId PK
        string nombreEmpleado
        string apellidoEmpleado
        string rol "MESA_ENTRADAS, ADMINISTRATIVO, RESPONSABLE_AREA, AUDITOR"
    }

    contraseñasEmpleados {
        int empleadoId PK, FK
        string password
    }

    %% ---------- Relaciones ----------
    persona ||--o| Ciudadano : "es un"
    persona ||--o| PersonaJuridica : "es un"
    persona ||--o| contraseñasPersonas : "tiene"

    Ciudadano ||--o{ Relacion : "ciudadanoId1"
    Ciudadano ||--o{ Relacion : "ciudadanoId2"

    Ciudadano ||--o{ contacto_persona : "tiene"
    ContactoCiudadano ||--o{ contacto_persona : "asociado a"

    persona ||--o{ personas_propiedades : "posee"
    Propiedades ||--o{ personas_propiedades : "poseida por"

    persona ||--o{ Persona_Organizacion : "pertenece a"
    Organizacion ||--o{ Persona_Organizacion : "tiene miembro"

    persona ||--o{ Representacion : "representa"
    Organizacion ||--o{ Representacion : "es representada por"

    Ciudadano ||--o{ IntegrantesPersonasJuridicas : "integra"
    PersonaJuridica ||--o{ IntegrantesPersonasJuridicas : "integrado por"
    EventoOutbox ||--o{ IntegrantesPersonasJuridicas : "genera"

    persona ||--o{ Documento : "carga"
    Documento ||--o{ SolicitudDocumentacion : "asociado a"
    Documento ||--o{ PersonaJuridica : "documentoId"

    persona ||--o{ Expediente : "titular de"
    Expediente ||--o{ Actuacion : "contiene"

    cuentasEmpleado ||--o| contraseñasEmpleados : "tiene"

    EventoOutbox ||--o| EventoProcesado : "procesado como"


# M1 — Ciudadanos, Organizaciones y Expedientes Digitales — Spec compacta

> Convenciones: `Auth`=Bearer usuario · `Svc`=Bearer token de servicio (inter-módulo) · `Pub`=sin auth.
> Errores base (omitidos abajo salvo que se agregue algo distinto): `400` payload inválido · `401` token ausente/inválido · `403` rol sin permiso · `404` no existe · `409` conflicto unicidad/estado · `500` no controlado.
> Modelo de datos: ver `diagrama_db.md` (persona→Ciudadano/PersonaJuridica, Propiedades, ContactoCiudadano, Relacion, Organizacion, Representacion, Documento, SolicitudDocumentacion, Expediente, Actuacion). Mongo: EventoOutbox/EventoProcesado.

---

## 1. Requerimientos funcionales (RF)

### Personas (persona → Ciudadano/PersonaJuridica)
- RF-01 Alta persona física (ciudadano): DNI, nombre, apellido, fechaNacimiento, CUIL, contacto.
- RF-02 Alta persona jurídica (organización): CUIT, razónSocial, nombreFantasía.
- RF-03 Responsabilizar personas físicas sobre una persona jurídica (dueños).
- RF-04 Modificar datos de ciudadano existente.
- RF-05 Marcar ciudadano: FALLECIDO / INACTIVO / BLOQUEADO (campo `estado`).
- RF-06 Validar unicidad de DNI y CUIT antes de registrar.
- RF-07 Buscar ciudadanos por DNI, nombre, domicilio, teléfono o email.
- RF-08 Dar de baja/activar organización (`estado`).

### Domicilios (Propiedades)
- RF-09 Múltiples domicilios por persona (física/jurídica).
- RF-10 Marcar domicilio como principal.
- RF-11 Historial de domicilios vía `vigenteDesde`/`vigenteHasta` (no se sobrescribe).
- RF-12 Actualizar domicilio principal.

### Contacto (ContactoCiudadano + contacto_persona)
- RF-13 Registrar ≥1 contacto (email/teléfono) por ciudadano.
- RF-14 Marcar contacto verificado/no verificado.
- RF-15 Modificar o eliminar contacto existente.

### Grupo familiar (Relacion)
- RF-16 Vincular dos ciudadanos (padre-hijo, cónyuge, tutor, etc.).
- RF-17 Tipo de relación por extremo (`relacionCiudadano1`/`relacionCiudadano2`).
- RF-18 Marcar `esResponsable` (útil para menores/personas a cargo).

### Organizaciones y representación
- RF-19 Asociar personas físicas como dueños/titulares de persona jurídica.
- RF-20 Otorgar representación (ciudadano→organización) con `alcance`, `desde`, `hasta`.
- RF-21 Baja/vencimiento de representación (`estado`, `hasta`).
- RF-22 Validar que solo representantes vigentes operen en nombre de la organización.

### Documentación (Documento, SolicitudDocumentacion)
- RF-23 Cargar documentación personal/institucional por persona.
- RF-24 Versionar documento al actualizarse (`version`).
- RF-25 Definir `vigenciaHasta` de un documento.
- RF-26 Registrar `cargadoPor` / `validadoPor`.
- RF-27 Generar solicitud de documentación faltante (tipo, plazo) hacia ciudadano/org.
- RF-28 Actualizar estado de solicitud: PENDIENTE / CUMPLIDA / VENCIDA.
- RF-29 Registrar `origen` de la solicitud (interna | evento `DocumentacionSolicitada`).

### Expedientes (Expediente, Actuacion)
- RF-30 Iniciar expediente: número único, carátula, área iniciadora.
- RF-31 Asociar expediente a persona titular.
- RF-32 Cambiar estado de expediente: INICIADO / EN_TRAMITE / RESUELTO / ARCHIVADO.
- RF-33 Registrar actuaciones (tipo, descripción, fecha, móduloOrigen, adjuntos).
- RF-34 Adjuntar archivos/referencias externas a una actuación.
- RF-35 Consultar historial completo de actuaciones de un expediente.

### Login / Auth
- RF-36 Login con CUIT/CUIL + contraseña, verifica identidad.
- RF-37 Registro de usuarios nuevos.

---

## 2. Eventos publicados (M1)

Formato común obligatorio: `eventId, occurredAt, eventType, producer{moduleId,service}, subject, data{...}` (+ `correlationId` si responde a un evento consumido).

| eventType | variante (`updateType`) | subject | data (campos clave) |
|---|---|---|---|
| `citizenUpdated` | REGISTERED | citizens/{id} | citizenId, updateType, details{dni,cuil,name,lastname,birthdate,state,address{propertyId,street,number,primary,effectiveFrom}}, updatedBy |
| `citizenUpdated` | BLOCKED | citizens/{id} | citizenId, updateType, details{reason,reviewRequired}, updatedBy |
| `citizenUpdated` | DECEASED | citizens/{id} | citizenId, updateType, details{deceasedAt,source}, updatedBy |
| `citizenUpdated` | ADDRESS_UPDATED | citizens/{id} | citizenId, updateType, details{previousAddress{propertyId,street,number,effectiveUntil}, newAddress{propertyId,street,number,primary,effectiveFrom}}, updatedBy |
| `updateTicketStatus` (M2) | ADDITIONAL_INFO_REQUIRED / IN_PROGRESS / UPDATED / COMPLETED | tickets/{id} | ticketId, updateType, publicMessage, internalMessage, details (varía; UPDATED trae `changes{campo:{previous,new}}`; COMPLETED trae `attachments[]`), updatedBy, statusChangedAt |
| `citizenInfoDelivered` | — (respuesta a consulta M6) | citizens/{id} | citizenId, fullName, documentId, phone, email, address{street,number,neighborhoodId}. Requiere `correlationId` |
| `organizationInfoDelivered` | — (respuesta a consulta M6) | organizations/{cuit} | cuit, legalName, tradeName, taxId, status. Requiere `correlationId` |
| `socialDocumentationDelivered` | responde a `socialDocumentationRequested` (M8) | citizens/{citizenId} | citizenId, applicationId, programId, files[]{fileId, number, initiatingArea, status, documentationRequests[]{requestId, documentType, status, documentId}}. Requiere `correlationId` |
| `organizationRegistered` | — | organizations/{cuit} | cuit, taxId, legalName, tradeName, type, status, holder{personId, personType} |
| `representationGranted` | — | representations/{id} | representationId, personId, cuit, scope, from, status |
| `representationExpired` | — | representations/{id} | representationId, personId, cuit, until, status |

**Evento consumido:** `socialDocumentationRequested` (M8) → payload: citizenId, applicationId, programId, requiredDocuments[]{type,description,required}, deadline, notes.

---

## 3. Endpoints REST v2

Formato de fila: `Método Path | Auth | RF | Request | Respuesta OK | Errores extra`

### Auth
| Endpoint | Auth | RF | Request | Respuesta | Errores extra |
|---|---|---|---|---|---|
| `POST /auth/login` | Pub | RF-36 | cuit/cuil, password | 200 body:{personaId,tipoPersona,rol} · headers: Authorization, X-Refresh-Token, X-Token-Expires-In | 401 credenciales, 403 bloqueada/inactiva, 404 no registrado |
| `POST /auth/register` | Pub | RF-01,02,37 | datos completos persona física o jurídica (sin domicilio) | 201: física {personaId,tipo,dni,nombre,apellido,fechaNacimiento,cuil,estado,creadoEn} · jurídica {personaId,tipo,cuit,razonSocial,nombreFantasia,estado,creadoEn} | 400 password débil/formato, 409 CUIT/CUIL ya existe |
| `POST /auth/empleados/login` | Pub | — | mail, password | 200 body:{empleadoId,rol} · headers Authorization/X-Refresh-Token/X-Token-Expires-In | 401 credenciales, 403 empleado inactivo |
| `POST /auth/refresh` | Pub (body) | — | refreshToken | 200/204, headers Authorization/X-Token-Expires-In | 400 refreshToken faltante, 401 vencido/inválido |
| `POST /auth/logout` | Auth | — | — | 204 | 401 |

### Ciudadanos
| Endpoint | Auth | RF | Request | Respuesta | Errores extra |
|---|---|---|---|---|---|
| `GET /ciudadanos/{id}` | Auth | — | — | 200 {id,dni,nombre,apellido,fechaNacimiento,cuil,estado,domicilioPrincipal,contactos[]} | 404 |
| `PUT /ciudadanos/{id}` | Auth | RF-04 | campos a modificar | 200 ciudadano actualizado | 403, 404, 409 CUIL duplicado |
| `GET /ciudadanos` | Auth | RF-07 | — (listado completo, filtra el front) | 200 {items:Ciudadano[]} | 403 |
| `PATCH /ciudadanos/{id}/estado` | Auth | RF-05 | nuevo estado | 200 {id,estadoAnterior,estadoNuevo,actualizadoEn} | 400 transición inválida, 403, 404 |
| `GET /ciudadanos/dni/{dni}` | Auth/Svc | RF-06 | — | 200 {existe,id?,nombre?,apellido?,estado?} (nunca 404) | 400 formato DNI |

### Organizaciones
| Endpoint | Auth | RF | Request | Respuesta | Errores extra |
|---|---|---|---|---|---|
| `POST /organizaciones` | Auth | RF-02,19 | cuit, razonSocial, nombreFantasia, personaId[] (dueños) | 201 {organizacionId,cuit,razonSocial,nombreFantasia,tipo,estado,creadoEn,duenos[]{personaId,dni,nombre,apellido}} | 400 CUIT inválido, 404 personaId no existe, 409 CUIT duplicado |
| `GET /organizaciones/{id}` | Auth | — | — | 200 {organizacionId,cuit,razonSocial,nombreFantasia,tipo,estado,domicilioPrincipal,duenos[]{personaId,dni,nombre,apellido,porcentajeTitularidad},representantesVigentes[]{personaId,nombre,apellido,alcance,desde,hasta}} | 404 |
| `PUT /organizaciones/{id}` | Auth | — | campos a modificar | 200 organización actualizada | 403, 404 |
| `GET /organizaciones` | Auth | — | — (listado completo) | 200 {items:Organizacion[]} | — |
| `PATCH /organizaciones/{id}/estado` | Auth | RF-08 | nuevo estado | 200 {organizacionId,estadoAnterior,estadoNuevo,actualizadoEn} | 400 transición inválida, 403, 404 |
| `GET /organizaciones/cuit/{cuit}` | Auth/Svc | RF-06 | — | 200 {existe,organizacionId?,razonSocial?,estado?} | 400 formato CUIT |
| `POST /organizaciones/{id}/duenos` | Auth | RF-19 | personaId, porcentajeTitularidad? | 201 {organizacionId,personaId,dni,porcentajeTitularidad?,asociadoEn} | 400, 403, 404 org/persona, 409 ya es dueño |
| `GET /organizaciones/{id}/duenos` | Auth | — | — | 200 {items:[{personaId,dni,nombre,apellido,porcentajeTitularidad}]} | 404 |
| `DELETE /organizaciones/{id}/duenos/{personaId}` | Auth | — | — | 204 | 403, 404 |

### Domicilios
| Endpoint | Auth | RF | Request | Respuesta | Errores extra |
|---|---|---|---|---|---|
| `POST /personas/{personaId}/domicilios` | Auth | RF-09 | tipo, calle, numero, idBarrio, coords | 201 {propiedadId,personaId,tipo,calle,numero,idBarrio,vigenteDesde,esPrincipal} | 400 dirección/coords, 404 persona |
| `GET /personas/{personaId}/domicilios` | Auth | RF-11 | — (incluye históricos) | 200 {items:[{propiedadId,tipo,calle,numero,esPrincipal,vigenteDesde,vigenteHasta}]} | 404 |
| `PUT /domicilios/{id}` | Auth | — | tipo, calle, numero, altura, idBarrio, longitud, latitud | 200 domicilio actualizado | 403, 404 |
| `PATCH /domicilios/{id}/principal` | Auth | RF-10,12 | — | 200 {propiedadId,personaId,esPrincipal:true,actualizadoEn} | 403, 404, 409 no pertenece a la persona |
| `DELETE /domicilios/{id}` | Auth | RF-11 | — | 200 {propiedadId,vigenteHasta} (cierra vigencia, no borra) | 403, 404, 409 único domicilio principal sin reemplazo |

### Contactos
| Endpoint | Auth | RF | Request | Respuesta | Errores extra |
|---|---|---|---|---|---|
| `POST /ciudadanos/{ciudadanoId}/contactos` | Auth | RF-13 | tipo (EMAIL/TELEFONO), valor | 201 {contactoId,ciudadanoId,tipo,valor,verificado:false,creadoEn} | 400 formato, 404 ciudadano, 409 duplicado |
| `GET /ciudadanos/{ciudadanoId}/contactos` | Auth | — | — | 200 {items:[{contactoId,tipo,valor,verificado}]} | 404 |
| `PUT /contactos/{id}` | Auth | RF-15 | tipo, valor | 200 {contactoId,tipo,valor,verificado:false} | 400, 403, 404 |
| `DELETE /contactos/{id}` | Auth | RF-15 | — | 204 | 403, 404 |
| `PATCH /contactos/{id}/verificar` | Auth | RF-14 | código verificación | 200 {contactoId,verificado:true,verificadoEn} | 400 código inválido, 404, 409 ya verificado |

### Grupo familiar / Relaciones
| Endpoint | Auth | RF | Request | Respuesta | Errores extra |
|---|---|---|---|---|---|
| `POST /relaciones` | Auth | RF-16,17,18 | ciudadanoId1, ciudadanoId2, relacionCiudadano1, relacionCiudadano2, esResponsable | 201 {relacionId,ciudadanoId1,ciudadanoId2,relacionCiudadano1,relacionCiudadano2,esResponsable,creadoEn} | 400 ids iguales/tipo inválido, 404 ciudadano, 409 relación ya existe |
| `GET /ciudadanos/{id}/relaciones` | Auth | — | — | 200 {items:[{relacionId,ciudadanoRelacionadoId,tipoRelacion,esResponsable}]} | 404 |
| `PUT /relaciones/{id}` | Auth | RF-17 | tipo relación (por extremo) | 200 relación actualizada | 400, 403, 404 |
| `PATCH /relaciones/{id}/responsable` | Auth | RF-18 | esResponsable | 200 {relacionId,esResponsable,actualizadoEn} | 400, 403, 404 |
| `DELETE /relaciones/{id}` | Auth | — | — | 204 | 403, 404 |

### Representaciones
| Endpoint | Auth | RF | Request | Respuesta | Errores extra |
|---|---|---|---|---|---|
| `POST /representaciones` | Auth | RF-20 | personaId, organizacionId, alcance, desde, hasta | 201 {representacionId,personaId,organizacionId,alcance,desde,hasta,estado:VIGENTE} | 400 fechas/alcance, 404 persona/org, 409 representación activa duplicada |
| `GET /organizaciones/{id}/representaciones` | Auth | — | — | 200 {items:[{representacionId,personaId,nombre,apellido,alcance,desde,hasta,estado}]} | 404 |
| `GET /personas/{id}/representaciones` | Auth | — | — | 200 {items:[{representacionId,organizacionId,razonSocial,alcance,desde,hasta,estado}]} | 404 |
| `PATCH /representaciones/{id}/estado` | Auth | RF-21 | nuevo estado | 200 {representacionId,estadoAnterior,estadoNuevo,actualizadoEn} | 400 transición inválida, 403, 404 |
| `GET /representaciones/vigencia` | Svc | RF-22 | ciudadanoId, organizacionId | 200 {vigente,representacionId?,alcance?,hasta?} | 400 faltan ids |

### Documentación
| Endpoint | Auth | RF | Request | Respuesta | Errores extra |
|---|---|---|---|---|---|
| `POST /personas/{personaId}/documentos` | Auth | RF-23,26 | archivo, tipoDocumento | 201 {documentoId,personaId,tipoDocumento,version:1,cargadoPor,fechaCreacion} | 400 archivo/tipo, 404 persona |
| `GET /personas/{personaId}/documentos` | Auth | — | — (listado completo) | 200 {items:[{documentoId,tipoDocumento,version,vigenciaHasta,validadoPor}]} | 404 |
| `GET /documentos/{id}` | Auth | — | — | 200 {documentoId,personaId,tipoDocumento,version,vigenciaHasta,cargadoPor,validadoPor,urlArchivo} | 403, 404 |
| `POST /documentos/{id}/version` | Auth | RF-24 | archivo | 201 {documentoId,version:n+1,cargadoPor,fechaCreacion} | 400 archivo, 404 |
| `PATCH /documentos/{id}/validar` | Auth | RF-25,26 | aprobado (bool) | 200 {documentoId,validadoPor,resultado:VALIDADO\|RECHAZADO,fechaValidacion} | 400 falta aprobado, 403, 404, 409 ya validado |
| `POST /solicitudes-documentacion` | Auth/Svc | RF-27,29 | titularId, tipoDocumento, plazo, origen | 201 {solicitudId,titularId,tipoDocumento,plazo,estado:PENDIENTE,origen,creadoEn} | 400 plazo pasado, 404 titular |
| `GET /solicitudes-documentacion` | Auth | — | — (listado completo) | 200 {items:SolicitudDocumentacion[]} | — |
| `GET /solicitudes-documentacion/{id}` | Auth | — | — | 200 {solicitudId,titularId,tipoDocumento,plazo,estado,origen,documentoId?} | 404 |
| `PATCH /solicitudes-documentacion/{id}/estado` | Auth | RF-28 | nuevo estado | 200 {solicitudId,estadoAnterior,estadoNuevo,actualizadoEn} | 400 transición inválida (ej. CUMPLIDA sin documentoId), 403, 404 |

### Expedientes y Actuaciones
| Endpoint | Auth | RF | Request | Respuesta | Errores extra |
|---|---|---|---|---|---|
| `GET /expedientes/{id}` | Auth | — | — | 200 {expedienteId,numero,personaId,caratula,areaIniciadora,estado,fechaInicio,actuacionesCount} | 403, 404 |
| `GET /expedientes` | Auth | — | — (listado completo) | 200 {items:Expediente[]} | — |
| `GET /expedientes/{id}/actuaciones` | Auth | RF-35 | — (historial completo) | 200 {items:[{actuacionId,tipo,descripcion,moduloOrigen,fecha,adjuntos[]}]} | 404 |

> Nota: alta de expediente/actuación (RF-30…34) no tiene endpoint explícito documentado en la v2; se infiere `POST /expedientes` y `POST /expedientes/{id}/actuaciones` con shape análogo a los GET — **a confirmar con el equipo**.

### Consultas inter-módulo (todas `Svc`)
| Endpoint | RF | Respuesta | Errores extra |
|---|---|---|---|
| `GET /ciudadanos/{id}/identidad` | — | 200 {id,dni,nombre,apellido,estado} | 404 |
| `GET /organizaciones/{id}/identidad` | — | 200 {organizacionId,cuit,razonSocial,estado} | 404 |
| `GET /ciudadanos/{id}/estado` | — | 200 {id,estado:ACTIVO\|INACTIVO\|FALLECIDO\|BLOQUEADO} | 404 |
| `GET /representaciones/vigencia` | RF-22 | ver tabla Representaciones | 400 |
| `GET /personas/{id}/domicilio-principal` | — | 200 {propiedadId,calle,numero,idBarrio,longitud,latitud} | 404 sin domicilio |
| `GET /ciudadanos/existe` | — | 200 {existe,id?,estado?} | 400 DNI inválido |

---

## 4. Cambios v1→v2 (contexto histórico, no repetir en implementación)
- Alta de persona física ya no es `POST /ciudadanos`; ocurre en `POST /auth/register`. Domicilio se carga después.
- `auth/register` recibe todos los datos de persona (física o jurídica).
- `auth/login` devuelve datos de sesión en body; token/refreshToken van en headers.
- `auth/empleados/login` recibe `mail` en vez de `usuario`.
- `GET /organizaciones/{id}` ahora devuelve taxId/CUIT, dueños, representantes y domicilio.
- `POST /organizaciones` recibe `personaId[]` en vez de objeto `duenos`.
- Endpoints de dueños devuelven también `dni`.
- `PUT /domicilios/{id}` recibe también `tipo`.
- Todos los `GET` de listado devuelven el listado completo; el filtrado/paginado es responsabilidad del front (sin query params de filtro).
