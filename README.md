# M1 — Ciudadanos, Organizaciones y Expedientes Digitales

Backend del Módulo 1. Estructura base: capa de persistencia completa del modelo de
`diagrama_db_desarrollo_de_apps_2.json` (PostgreSQL + MongoDB) y los endpoints de
autenticación con JWT. Los requerimientos y el contrato REST salen de `ARCHITECTURE.md`.

- **Spring Boot** 3.5.16 · **Java** 21 · Maven wrapper incluido (no hace falta tener Maven)
- **PostgreSQL** — datos transaccionales (personas, organizaciones, expedientes)
- **MongoDB** — outbox de eventos, cuyo payload cambia según el `eventType`

---

## Puesta en marcha

**Instalación completa (qué instalar en una máquina nueva, paso a paso, por sistema
operativo): [`INSTALACION.md`](INSTALACION.md).** Resumen:

```bash
# 1. Bases de datos
psql -U postgres -f db/00_crear_database.sql
psql -U postgres -d ciudadanos_m1 -f db/01_schema.sql
psql -U postgres -d ciudadanos_m1 -f db/02_datos_iniciales.sql   # opcional
mongosh "mongodb://localhost:27017" --file db/mongodb_setup.txt

# 2. API (no hace falta tener Maven: el repo trae ./mvnw)
./mvnw spring-boot:run
./mvnw test          # 51 tests, no necesitan las bases
```

Todas las variables de entorno tienen default para local; las de producción están
listadas en `INSTALACION.md`. La única que conviene definir siempre es
`APP_JWT_SECRET` (mínimo 32 bytes, `openssl rand -base64 48`).

`spring.jpa.hibernate.ddl-auto=validate`: la app **no** crea tablas. Si una entidad y
`db/01_schema.sql` se desincronizan, el arranque falla con el detalle, en vez de romper
más tarde en runtime.

---

## Roles y permisos

Seis roles. Los servicios **nunca preguntan por un rol**: preguntan por un `Permiso`, y
el mapeo rol → permisos vive en un solo lugar ([`Rol.java`](src/main/java/ar/edu/uade/ciudadanos/security/Rol.java)).
Cambiar quién puede qué es tocar ese enum y nada más.

### Los roles

| Rol | Quién | De dónde sale |
|---|---|---|
| `PERSONA` | ciudadanos **y** personas jurídicas | `POST /auth/login` |
| `MESA_ENTRADAS` | recepción | `POST /auth/empleados/login` |
| `ADMINISTRATIVO` | gestión | `POST /auth/empleados/login` |
| `RESPONSABLE_AREA` | supervisión | `POST /auth/empleados/login` |
| `AUDITOR` | control | `POST /auth/empleados/login` |
| `SERVICIO` | otro módulo llamando a M1 | *todavía no se emite* |

**Ciudadanos y personas jurídicas comparten el rol `PERSONA`**: los dos son titulares que
operan sobre lo propio, y no hay ninguna operación que uno pueda y el otro no. Lo que los
distingue es el **tipo de persona**, que viaja aparte: en el claim `sub_type` del JWT y en
`tipoPersona` del cuerpo del login.

Los tres primeros roles de empleado son una **escalera**: mesa de entradas carga,
administrativo además resuelve, responsable de área además decide. `AUDITOR` queda fuera
de la escalera a propósito — ve todo y no escribe nada.

### La matriz

| Permiso | PERSONA | MESA_ENTRADAS | ADMINISTRATIVO | RESPONSABLE_AREA | AUDITOR | SERVICIO |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `LEER_TERCEROS` — ver el legajo de otro | — | ✅ | ✅ | ✅ | ✅ | — |
| `LISTAR_PADRON` — descargar el listado completo | — | ✅ | ✅ | ✅ | ✅ | — |
| `EDITAR_TERCEROS` — modificar datos de otro | — | ✅ | ✅ | ✅ | — | — |
| `SOLICITAR_DOCUMENTACION` — RF-27, RF-28 | — | ✅ | ✅ | ✅ | — | — |
| `GESTIONAR_EXPEDIENTES` — RF-30, RF-33 | — | ✅ | ✅ | ✅ | — | — |
| `CONSULTA_INTERMODULO` — endpoints `Svc` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `VALIDAR_DOCUMENTACION` — RF-25, RF-26 | — | — | ✅ | ✅ | — | — |
| `CAMBIAR_ESTADO_EXPEDIENTE` — RF-32 | — | — | ✅ | ✅ | — | — |
| `GESTIONAR_REPRESENTACIONES` — RF-20, RF-21 | — | — | ✅ | ✅ | — | — |
| `CAMBIAR_ESTADO_TITULAR` — RF-05, RF-08 | — | — | — | ✅ | — | — |

Decisiones que conviene revisar con el equipo:

- **Bloquear o marcar fallecido a alguien es solo del responsable de área.** Es la acción
  menos reversible del sistema (`FALLECIDO` es terminal), así que la dejé en el escalón
  más alto.
- **`SERVICIO` solo tiene `CONSULTA_INTERMODULO`.** Un módulo externo usa `/identidad` y
  `/estado`, que devuelven lo mínimo; no puede traerse el legajo completo ni el padrón.
  Para eso existen esos endpoints acotados.
- **`AUDITOR` no escribe nada**, ni siquiera datos de terceros. Si tiene que poder cerrar
  observaciones, hay que darle algún permiso de escritura.

### Las dos reglas

La matriz de arriba gobierna las operaciones **sobre datos ajenos**. Sobre lo propio no
hace falta ningún permiso:

1. **Sobre lo propio** — cada titular administra sus datos. Sobre una organización,
   también su dueño y su representante vigente (RF-22). Por eso `PERSONA` tiene el
   conjunto de permisos vacío y aun así puede operar.
2. **Sobre lo ajeno** — hace falta el `Permiso` que corresponda, según el rol del token.

Las dos viven en [`AutorizacionService`](src/main/java/ar/edu/uade/ciudadanos/security/AutorizacionService.java),
que expone `exigirLecturaDePersona` / `exigirEscrituraSobrePersona` (la separación
lectura-escritura es lo que le permite al auditor ver sin tocar) y
`exigirEscrituraSobreOrganizacion` / `exigirGestionDeRepresentaciones`.

El 403 dice qué rol tenés y qué permiso falta:

```json
{"status":403,"message":"Tu rol (MESA_ENTRADAS) no tiene permiso para validar documentacion. Requiere: VALIDAR_DOCUMENTACION"}
```

### El rol en el JWT

Va en el claim `rol` del access token y del refresh token, junto con `sub_type`:

```json
{
  "iss": "modulo1-ciudadanos",
  "sub": "42",
  "sub_type": "EMPLEADO",
  "rol": "RESPONSABLE_AREA",
  "typ": "access",
  "iat": 1756762800,
  "exp": 1756763700
}
```

`JwtAuthenticationFilter` lo convierte en la autoridad `ROLE_RESPONSABLE_AREA` y lo deja
en el `AuthPrincipal`. También queda en la traza de auditoría: `cargadoPor` y `validadoPor`
guardan `EMPLEADO:42:RESPONSABLE_AREA`, así se sabe con qué atribuciones se actuó.

---

## Endpoints

59 rutas. La columna dice qué hace falta además de estar autenticado.

### Auth
| Endpoint | Acceso | RF |
|---|---|---|
| `POST /auth/register` | público | RF-01, RF-02, RF-37 |
| `POST /auth/login` | público | RF-36 |
| `POST /auth/empleados/login` | público | — |
| `POST /auth/refresh` | público | — |
| `POST /auth/logout` | autenticado | — |

Los tokens viajan en headers, nunca en el cuerpo: `Authorization: Bearer <jwt>`,
`X-Refresh-Token`, `X-Token-Expires-In`. Están expuestos vía CORS para que el front
pueda leerlos.

### Ciudadanos
| Endpoint | Acceso | RF |
|---|---|---|
| `GET /ciudadanos` | `LISTAR_PADRON` | RF-07 |
| `GET /ciudadanos/{id}` | propio o `LEER_TERCEROS` | — |
| `PUT /ciudadanos/{id}` | propio o `EDITAR_TERCEROS` | RF-04 |
| `PATCH /ciudadanos/{id}/estado` | `CAMBIAR_ESTADO_TITULAR` | RF-05 |
| `GET /ciudadanos/dni/{dni}` | autenticado | RF-06 |

### Organizaciones
| Endpoint | Acceso | RF |
|---|---|---|
| `POST /organizaciones` | autenticado | RF-02, RF-19 |
| `GET /organizaciones` · `GET /organizaciones/{id}` | autenticado | — |
| `PUT /organizaciones/{id}` | dueño, representante vigente o `EDITAR_TERCEROS` | — |
| `PATCH /organizaciones/{id}/estado` | `CAMBIAR_ESTADO_TITULAR` | RF-08 |
| `GET /organizaciones/cuit/{cuit}` | autenticado | RF-06 |
| `POST /organizaciones/{id}/duenos` · `DELETE .../{personaId}` | dueño, representante o `EDITAR_TERCEROS` | RF-19 |
| `GET /organizaciones/{id}/duenos` | autenticado | — |

### Domicilios
| Endpoint | Acceso | RF |
|---|---|---|
| `POST /personas/{personaId}/domicilios` | propio o `EDITAR_TERCEROS` | RF-09 |
| `GET /personas/{personaId}/domicilios` | propio o `LEER_TERCEROS` | RF-11 |
| `PUT /domicilios/{id}` | propio o `EDITAR_TERCEROS` | — |
| `PATCH /domicilios/{id}/principal` | propio o `EDITAR_TERCEROS` | RF-10, RF-12 |
| `DELETE /domicilios/{id}` | propio o `EDITAR_TERCEROS` | RF-11 |

### Contactos
| Endpoint | Acceso | RF |
|---|---|---|
| `POST /ciudadanos/{ciudadanoId}/contactos` | propio o `EDITAR_TERCEROS` | RF-13 |
| `GET /ciudadanos/{ciudadanoId}/contactos` | propio o `LEER_TERCEROS` | — |
| `PUT /contactos/{id}` · `DELETE /contactos/{id}` | titular o `EDITAR_TERCEROS` | RF-15 |
| `PATCH /contactos/{id}/verificar` | titular o `EDITAR_TERCEROS` | RF-14 |

### Relaciones
| Endpoint | Acceso | RF |
|---|---|---|
| `POST /relaciones` | participante o `EDITAR_TERCEROS` | RF-16, RF-17, RF-18 |
| `GET /ciudadanos/{id}/relaciones` | propio o `LEER_TERCEROS` | — |
| `PUT /relaciones/{id}` · `PATCH .../responsable` · `DELETE` | participante o `EDITAR_TERCEROS` | RF-17, RF-18 |

### Representaciones
| Endpoint | Acceso | RF |
|---|---|---|
| `POST /representaciones` | dueño, representante o `GESTIONAR_REPRESENTACIONES` | RF-20 |
| `PATCH /representaciones/{id}/estado` | dueño, representante o `GESTIONAR_REPRESENTACIONES` | RF-21 |
| `GET /organizaciones/{id}/representaciones` | autenticado | — |
| `GET /personas/{id}/representaciones` | propio o `LEER_TERCEROS` | — |
| `GET /representaciones/vigencia?ciudadanoId&organizacionId` | `CONSULTA_INTERMODULO` | RF-22 |

### Documentación
| Endpoint | Acceso | RF |
|---|---|---|
| `POST /personas/{personaId}/documentos` (multipart) | propio o `EDITAR_TERCEROS` | RF-23, RF-26 |
| `POST /documentos/{id}/version` (multipart) | propio o `EDITAR_TERCEROS` | RF-24 |
| `GET /personas/{personaId}/documentos` · `GET /documentos/{id}` | propio o `LEER_TERCEROS` | — |
| `PATCH /documentos/{id}/validar` | `VALIDAR_DOCUMENTACION` | RF-25, RF-26 |
| `POST /solicitudes-documentacion` | `SOLICITAR_DOCUMENTACION` | RF-27, RF-29 |
| `GET /solicitudes-documentacion` | todas con `LISTAR_PADRON`, si no las propias | — |
| `GET /solicitudes-documentacion/{id}` | propio o `LEER_TERCEROS` | — |
| `PATCH /solicitudes-documentacion/{id}/estado` | propio o `EDITAR_TERCEROS` | RF-28 |

### Expedientes
| Endpoint | Acceso | RF |
|---|---|---|
| `GET /expedientes` | todos con `LEER_TERCEROS`, si no los propios | — |
| `GET /expedientes/{id}` · `GET .../actuaciones` | titular o `LEER_TERCEROS` | RF-35 |
| `POST /expedientes` **(inferido)** | `GESTIONAR_EXPEDIENTES` | RF-30, RF-31 |
| `POST /expedientes/{id}/actuaciones` **(inferido)** | `GESTIONAR_EXPEDIENTES` | RF-33, RF-34 |
| `PATCH /expedientes/{id}/estado` **(inferido)** | `CAMBIAR_ESTADO_EXPEDIENTE` | RF-32 |

**Inferido** = la spec v2 no documenta la ruta y la marca *"a confirmar con el equipo"*;
el RF existe, así que está implementado con el shape análogo al del GET.

### Consultas inter-módulo — todas `CONSULTA_INTERMODULO`
`GET /ciudadanos/{id}/identidad` · `GET /ciudadanos/{id}/estado` ·
`GET /organizaciones/{id}/identidad` · `GET /personas/{id}/domicilio-principal` ·
`GET /ciudadanos/existe?dni=` · `GET /representaciones/vigencia`

### Probar rápido

```bash
# Alta de persona física
curl -i -X POST localhost:8080/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"tipo":"CIUDADANO","cuit":"20-40123456-7","password":"clave-segura-1",
       "dni":"40123456","nombre":"Ana","apellido":"Perez","fechaNacimiento":"1997-03-08"}'

# Login (mirar los headers de la respuesta)
curl -i -X POST localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"cuit":"20401234567","password":"clave-segura-1"}'
```

Con `db/02_datos_iniciales.sql` cargado hay un empleado por rol:
`admin@municipio.gob.ar` (RESPONSABLE_AREA), `mesa@municipio.gob.ar` (MESA_ENTRADAS) y
`auditor@municipio.gob.ar` (AUDITOR), todos con clave `Empleado.2026`; y el ciudadano
CUIL `20345678901` / `Ciudadano.2026`.

---

## Listas blancas

Nada entra al modelo sin estar enumerado. Hay cuatro capas, y todas devuelven **400**
con un mensaje que dice qué se aceptaba:

**1. Campos del payload** — `spring.jackson.deserialization.fail-on-unknown-properties: true`.
Los DTO *son* la lista blanca: un campo de más no se ignora en silencio, hace fallar el
request. El mensaje enumera los campos válidos.

```json
{"tipo":"EMAIL","valor":"a@b.com","verificado":true}
→ 400 "Campo no permitido: 'verificado'. Campos aceptados: tipo, valor"
```

Esto también cierra el *mass assignment*: los DTO de update solo declaran lo modificable,
así que no hay forma de tocar `estado`, `cuit` o `verificado` por un `PUT`.

**2. Valores de texto libre** — `common/ListasBlancas.java`. El diagrama los define como
`VARCHAR` sin restringir; sin esto entra cualquier cosa y el dato queda inconsistente
entre módulos. Cubre tipos de relación, de propiedad, de documento, de organización, de
actuación y alcances de representación. Normaliza a mayúsculas y recorta espacios.

```json
{"relacionCiudadano1":"CUÑADO", ...}
→ 400 "relacionCiudadano1 invalido: 'CUÑADO'. Valores permitidos: PADRE, MADRE, HIJO, ..."
```

**3. Transiciones de estado** — `common/TransicionesEstado.java`. Un mapa por entidad de
`estado actual → estados alcanzables`, en vez de `if`s repartidos. `FALLECIDO`,
`ARCHIVADO`, `REVOCADA` y `CUMPLIDA` son terminales.

```json
{"estado":"RESUELTO"}   // sobre un expediente INICIADO
→ 400 "Transicion invalida de INICIADO a RESUELTO. Destinos permitidos: ARCHIVADO, EN_TRAMITE"
```

**4. Archivos** — `documentacion/almacenamiento/ArchivosPermitidos.java`. Se validan
extensión **y** content-type (`.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`), más el nombre
contra *path traversal*. El content-type lo manda el navegador y es trivial de falsear,
así que por sí solo no alcanza para decidir qué se escribe en el servidor.

---

## Manejo de errores

Un solo `@RestControllerAdvice` (`common/GlobalExceptionHandler.java`) traduce todo al
mismo cuerpo:

```json
{
  "timestamp": "2026-09-01T19:34:55.123-03:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Campo no permitido: 'verificado'. Campos aceptados: tipo, valor",
  "path": "/ciudadanos/1/contactos",
  "errores": { "valor": "valor es obligatorio" }
}
```

`errores` aparece solo en los 400 por Bean Validation, con el detalle campo por campo.

| Código | Cuándo |
|---|---|
| 400 | payload inválido, campo no permitido, valor fuera de lista blanca, transición inválida, path variable mal tipado, JSON roto |
| 401 | token ausente, inválido o vencido |
| 403 | rol o titularidad insuficiente |
| 404 | el recurso no existe |
| 405 | método no permitido en esa ruta |
| 409 | unicidad o conflicto de estado (CUIT/DNI repetido, contacto duplicado, único domicilio principal) |
| 413 | archivo más grande que el máximo |
| 500 | error no controlado — se loguea completo, pero la respuesta dice solo `"Error interno"` |

Las restricciones de la base (`unique`, `check`, FK) están cubiertas por
`DataIntegrityViolationException → 409`: los servicios validan antes para dar un mensaje
útil, y si algo se escapa por una carrera entre dos requests igual sale 409 y no 500.

---

## Estructura

```
src/main/java/ar/edu/uade/ciudadanos/
├── auth/            AuthController, AuthService, DTOs
├── security/        JwtService, JwtAuthenticationFilter, AutorizacionService, @SoloInterno
├── config/          SecurityConfig (stateless, CORS, rutas públicas)
├── common/          ApiException, ErrorResponse, GlobalExceptionHandler,
│                    ListasBlancas, TransicionesEstado, ListaResponse
├── persona/         Ciudadano, Relacion, PersonaDirectorioService
├── domicilio/       Propiedad, PersonaPropiedad (vigencias)
├── contacto/        ContactoCiudadano, ContactoPersona
├── organizacion/    Organizacion, duenos, Representacion
├── documentacion/   Documento, SolicitudDocumentacion, almacenamiento/
├── expediente/      Expediente, Actuacion
├── intermodulo/     Consultas Svc que cruzan varios dominios
└── evento/          EventoOutbox, EventoProcesado (MongoDB)
```

Cada paquete tiene `entity/` (o `document/`), `repository/`, `dto/`, el service y el
controller. Las 21 tablas del diagrama están mapeadas (19 en Postgres + 2 colecciones en
Mongo).

---

## Decisiones y desvíos respecto del diagrama

Fuente: `diagrama_db_desarrollo_de_apps_2.json` (draw.io) — 21 tablas y 23 relaciones.
Reemplaza al Mermaid de `ARCHITECTURE.md`, que tenía errores. Cada desvío está además
comentado en la línea correspondiente de `db/01_schema.sql`.

### Errores del diagrama que hay que corregir

| Dónde | Problema | Qué hice |
|---|---|---|
| `contraseñasPersonas.password`, `contraseñasEmpleados.password` | `VARCHAR(50)` — un hash **BCrypt ocupa 60 caracteres**, no entra y truncaría la clave | `VARCHAR(100)` |
| `persona.cuit`, `Organizacion.cuit` | `INT` — un CUIT/CUIL tiene 11 dígitos y no entra en 32 bits | `BIGINT` |
| `Ciudadano.documentId` | flecha a `Documento.documentoId`, pero es `VARCHAR(255)` contra un `INT`: esa FK no puede existir | lo tomo como el **DNI** (único, sin FK), que es lo que consultan RF-06 y `GET /ciudadanos/dni/{dni}` |
| `cuentasEmpleado` | la fila `apellidoEmpleado` aparece **dos veces** | asumo que la segunda debía ser `mail`, que es lo que `POST /auth/empleados/login` recibe |
| `Documento.personaid` | dice `INT NOT NULL` pero no tiene flecha a `persona` | implementé la FK |
| `persona.id` vs `PersonaJuridica.id` | una es `int` y la otra `bigint` siendo la misma clave | `BIGINT` en todas |
| fila suelta `documentoId int not null → Documento` | no pertenece a ninguna tabla; parece un resto de una versión anterior | la ignoré |

### Conflictos entre el diagrama y la spec de endpoints

| Columna | Diagrama | Qué hice |
|---|---|---|
| `Propiedades.altura` | `NOT NULL` | **nullable**: `POST /personas/{id}/domicilios` no recibe altura |
| `PersonaJuridica.fecha_de_creacion` | `NOT NULL` | **nullable**: el alta por `/auth/register` no la pide |

### Columnas agregadas

Ninguna está en el diagrama; cada una la exige un endpoint documentado.

| Tabla | Columna | Por qué |
|---|---|---|
| `persona_juridica` | `razon_social`, `estado` | respuesta de `POST /auth/register` para jurídica |
| `personas_propiedades` | `es_principal` | RF-10/RF-12; el diagrama no tiene dónde marcar el principal |
| `persona_organizacion` | `porcentaje_titularidad`, `asociado_en` | los devuelven los endpoints de dueños |
| `documento` | `url_archivo`, `fecha_creacion`, `resultado_validacion`, `fecha_validacion` | `GET /documentos/{id}` y `PATCH /documentos/{id}/validar` |
| `contacto_ciudadano` | `verificado_en`, `creado_en` | `PATCH /contactos/{id}/verificar` y el `POST` |
| `cuenta_empleado` | `mail`, `activo` | login por mail; 403 si el empleado está inactivo |
| `persona`, `organizacion`, `relacion`, `solicitud_documentacion` | `creado_en` | todos sus `POST` devuelven `creadoEn` |
| `evento_outbox` | `publicado`, `publicado_en` | sin esto la colección no funciona como cola: no habría forma de saber qué quedó pendiente de publicar |

### Detalles de mapeo

- `PersonaJuridica.nombre` (el del diagrama) se usa como **nombre de fantasía**, igual
  que `Organizacion.nombre`. Por eso `nombreFantasia` del endpoint se guarda ahí, y
  `razon_social` va aparte.
- `contacto_persona.ciudadanoId` referencia **`persona`**, no `ciudadano`: así lo
  dibuja la flecha, y permite que una jurídica también tenga contactos.
- Los nombres con `ñ` (`contraseñasPersonas`, `contraseñasEmpleados`) pasaron a
  `credencial_persona` y `credencial_empleado`.
- `EventoProcesado` usa `eventId` como `_id`, como marca el diagrama. Eso implica que
  **un evento no puede ser procesado por dos consumers distintos**; si eso hace falta,
  la clave tiene que pasar a ser el par `eventId + consumerId`.
- El sobre de `EventoOutbox` (`aggregateType`/`aggregateId`/`eventType`/`payload`/
  `info`/`details`) es el del diagrama. El contrato de eventos de `ARCHITECTURE.md`
  (`occurredAt`, `producer`, `data`, `correlationId`) se serializa dentro de `payload`,
  y `subject` se parte en `aggregateType` + `aggregateId`.

### Corregido respecto de la versión anterior

`integrantes_personas_juridicas` ya **no tiene `event_id` en la PK**. El Mermaid lo
mostraba como `PK (eventId, id_ciudadano)` con una relación a `EventoOutbox`; el
diagrama real es una tabla puente pura `(id_ciudadano, id_persona_juridica)`.

---

## Sobre la autenticación

- Las claves se guardan con **BCrypt**; en ninguna parte del código se persiste texto plano.
- El access token dura 15 min y el refresh 7 días (configurable en `app.jwt`).
- El JWT lleva `sub` (personaId o empleadoId), `sub_type` (CIUDADANO/JURIDICA/EMPLEADO)
  y `rol` — ver [Roles y permisos](#roles-y-permisos). El claim `typ` separa access de
  refresh, así que un refresh token no sirve para autenticar requests.

---

## Limitaciones conocidas

Cosas que están implementadas con la forma correcta pero que **no son seguras o completas
todavía**. Cada una está también comentada en el código.

**1. `POST /auth/logout` no revoca nada.** Los tokens son stateless y no hay denylist.
Devuelve 204 y el cliente descarta sus tokens; un access token robado sigue válido hasta
que vence (15 min). Para corte inmediato de sesión hace falta un claim `jti` y una
denylist (Redis o una tabla) que consulte el filtro.

**2. `PATCH /contactos/{id}/verificar` acepta cualquier código de 6 dígitos.** No hay
emisión ni almacenamiento de códigos, así que la verificación no verifica nada. Falta una
tabla de códigos con vencimiento y el envío por mail/SMS.

**3. El rol `SERVICIO` existe pero no se emite.** Ningún endpoint entrega un token con
ese rol, así que hoy las consultas inter-módulo las cubren los roles de empleado, que
también tienen `CONSULTA_INTERMODULO`. Falta definir cómo se autentican los módulos entre
sí (client credentials, mTLS, clave compartida); cuando eso exista, el permiso ya está
puesto y no hay que tocar ninguna anotación.

**4. Los archivos se guardan en el disco local** (`AlmacenamientoLocal`). Sirve para
desarrollo y para un único nodo; con más de una instancia hace falta almacenamiento
compartido. Está detrás de la interfaz `AlmacenamientoArchivos` justamente para que mudarse
a S3/MinIO sea cambiar la implementación y nada más.

**5. El número de expediente se calcula contando filas.** Bajo concurrencia, dos altas
simultáneas pueden pedir el mismo número y la segunda choca contra `uk_expediente_numero`
(409). Lo correcto es una secuencia de Postgres por año.

**6. El versionado de documentos pisa la fila.** `RF-24` sube `version` en el mismo
registro porque el modelo tiene una sola columna `version`. Los archivos viejos quedan en
disco con su número de versión, pero **no hay historial consultable de versiones
anteriores**: haría falta una tabla `documento_version`.

**7. Los eventos todavía no se publican.** `EventoOutbox` y su repositorio están, pero no
hay ni productor que escriba los eventos de la sección 2 de `ARCHITECTURE.md` ni publisher
que los tome de la cola.

## Laboratorio P2P con ActiveMQ

El laboratorio guiado usa la cola `documentacion.solicitada`. El endpoint recibe datos de
una solicitud de documentación y el productor los envía como un `TextMessage` JSON. Hay dos
consumidores sobre la misma cola, por lo que ActiveMQ entrega cada mensaje a uno solo.

1. Levantar el broker: `docker compose -f docker-compose.activemq.yml up -d`.
2. Arrancar el backend con `MENSAJERIA_P2P_ENABLED=true`.
3. Enviar uno o más `POST /mensajeria/laboratorio/solicitudes-documentacion` autenticados.
4. Revisar el log: cada `mensajeId` debe aparecer una sola vez, junto al nombre del consumidor.

Ejemplo de cuerpo:

```json
{
  "ciudadanoId": 42,
  "solicitudId": "SOL-2026-001",
  "programaId": "PROGRAMA-SOCIAL",
  "fechaLimite": "2026-11-30T18:00:00-03:00",
  "documentosRequeridos": [
    { "tipo": "DNI", "descripcion": "Documento de identidad", "obligatorio": true }
  ]
}
```

Esta implementación sirve para el laboratorio. La publicación de los eventos definitivos
del TP debe salir del outbox y el consumidor debe persistir su resultado e ignorar duplicados.

---

