# Contexto — Frontend del Módulo 1 (Ciudadanos, Organizaciones y Expedientes Digitales)

> **Para quién es este documento**: para cualquier persona o agente que tenga que escribir
> el frontend de este módulo. Está pensado para ser **autocontenido**: si lo leés entero,
> podés escribir el front sin abrir el repo del backend ni una sola vez.
>
> **Regla de oro**: este documento refleja **el código real del backend**, no la
> documentación del backend. Donde `ARCHITECTURE.md` y el código no coinciden, acá está lo
> que el código hace. Ver §10 para la lista de discrepancias.
>
> Backend: la raíz de este repositorio (este frontend vive en `frontend/`).
> Última verificación contra el código: **2026-09-05**

---

## Índice

1. [Qué estamos construyendo](#1-qué-estamos-construyendo)
2. [Qué le exige la cátedra al frontend](#2-qué-le-exige-la-cátedra-al-frontend)
3. [Cómo hablar con el backend](#3-cómo-hablar-con-el-backend)
4. [Las once reglas que rompen el front si las ignorás](#4-las-once-reglas-que-rompen-el-front-si-las-ignorás)
5. [Referencia completa de la API (59 endpoints)](#5-referencia-completa-de-la-api)
6. [Roles y permisos](#6-roles-y-permisos)
7. [Vocabulario cerrado: listas blancas, enums y transiciones](#7-vocabulario-cerrado)
8. [Formato de error](#8-formato-de-error)
9. [Levantar el backend y datos de prueba](#9-levantar-el-backend-y-datos-de-prueba)
10. [Discrepancias y decisiones abiertas](#10-discrepancias-y-decisiones-abiertas)
11. [Pantallas sugeridas](#11-pantallas-sugeridas)

---

## 1. Qué estamos construyendo

### El TPO

**Desarrollo de Aplicaciones II — UADE.** La Municipalidad de Ciudad UADE quiere una
plataforma distribuida. Nueve equipos, nueve módulos independientes, cada uno con **su
propio frontend, su propio backend y su propia base de datos**. Ningún módulo accede a la
base de otro. Se integran por **eventos asincrónicos** y, cuando hace falta una respuesta
inmediata, por **API REST**.

Los nueve módulos:

| # | Módulo | Qué hace |
|---|---|---|
| **1** | **Ciudadanos, Organizaciones y Expedientes** | **Nosotros.** Identidad municipal, domicilios, representaciones, documentación, expedientes |
| 2 | Atención ciudadana | Reclamos, solicitudes, denuncias, SLA |
| 3 | Obras públicas | Proyectos, órdenes de trabajo, cuadrillas |
| 4 | Habilitaciones | Establecimientos, inspecciones, actas, clausuras |
| 5 | Rentas | Tasas, liquidaciones, pagos, planes de pago |
| 6 | Ambiente y servicios urbanos | Recolección, arbolado, contenedores |
| 7 | Tránsito | Infracciones, operativos, cortes de calle |
| 8 | Desarrollo social | Programas, beneficios, visitas sociales |
| 9 | Core | Hub de eventos, identidad técnica, catálogos globales, notificaciones |

### Dónde encaja el Módulo 1

Somos el **registro civil digital de la plataforma** y la **raíz del ecosistema**: el
enunciado establece que *todo vecino debe registrarse en el Módulo 1 para poder entrar a
los demás módulos*. Somos dueños del `citizenId`, del `organizationId` y del número de
expediente. Ninguno de los otros ocho módulos puede operar con una persona real sin
nosotros.

| Somos dueños de | **No** somos dueños de |
|---|---|
| Ciudadanos, sus estados y contactos | Reclamos, obras, habilitaciones, tributos, beneficios (M2–M8) |
| Domicilios e historial de domicilios | Credenciales, tokens y roles técnicos (M9) |
| Grupos familiares y responsabilidades | Broker de eventos y DLQ global (M9) |
| Organizaciones, CUIT y representaciones | Envío de mails, SMS y notificaciones (M9) |
| Documentación personal e institucional | Catálogo global de barrios y zonas (M9) |
| Expedientes digitales y sus actuaciones | Validación real contra RENAPER o AFIP (se simula) |

**Consecuencia práctica para el front**: `idBarrio` es un `UUID` que en teoría sale del
catálogo global del M9. Hoy no hay integración con M9 — hay que decidir de dónde salen esos
UUID (§10).

### Las entregas

| Entrega | Qué se pide |
|---|---|
| **Primera** | Cada módulo con su **BE y FE hechos**, Swagger, **BE y FE desplegados** |
| **Segunda** | Módulos completamente integrados (eventos andando entre módulos) |
| **Final** | Guilds con el *journey* del cliente atravesando varios módulos |

El frontend es parte de la **primera** entrega. No es opcional ni queda para el final.

---

## 2. Qué le exige la cátedra al frontend

Del enunciado, sección 6.1, textual. Esto es la lista de corrección:

- **Consumirá exclusivamente la API del backend del módulo.** No accede a bases de datos ni
  a las APIs de otros módulos.
- **Validaciones de formularios.**
- **Búsquedas, filtros y paginación.** ← ver §4.2: el backend **no** los provee, son del front.
- **Estados de carga** (loading / error / vacío).
- **Mostrar las operaciones disponibles según el rol autenticado.** ← §6.
- **Al menos un tablero o vista de indicadores.**
- **Cobertura de tests: mínimo 85 % en FE** (y 85 % en BE, por separado).
- **Desplegado en un entorno accesible.**

Además, del enunciado general: manejo centralizado de errores, autenticación y
autorización por roles, mensajes de error claros, y documentación técnica y funcional.

**Nomenclatura acordada por el equipo** (PDF de alcance, §8): *todo lo que es código, en
inglés; todo lo que ve el vecino, en español*. Ojo: el backend **no** cumple esto (§10.1).
Lo que sí conviene sostener sin discusión es que **la UI y todos los mensajes al vecino van
en español**: `"No encontramos un vecino con ese DNI"`, no `CITIZEN_NOT_FOUND`.

---

## 3. Cómo hablar con el backend

### Base URL

```
http://localhost:8080
```

**No hay context-path ni prefijo `/api/v1`.** Las rutas cuelgan de la raíz:
`http://localhost:8080/ciudadanos/1`.

Puerto configurable con la variable de entorno `SERVER_PORT`.

### CORS

Ya está configurado y es permisivo — no hace falta proxy en desarrollo:

```
allowedOriginPatterns: ["*"]
allowedMethods:        GET, POST, PUT, PATCH, DELETE, OPTIONS
allowedHeaders:        ["*"]
exposedHeaders:        Authorization, X-Refresh-Token, X-Token-Expires-In
allowCredentials:      false (no seteado)
```

Como `allowCredentials` es false, **no uses cookies**. El token va en el header
`Authorization`.

### Los tokens viajan en HEADERS, nunca en el body

Esta es la primera trampa y la más común. `POST /auth/login` devuelve en el **body** solo
`{personaId, tipoPersona, rol}`. Los tokens vienen en los **headers de la respuesta**:

```
Authorization:      Bearer eyJhbGciOiJIUzI1NiJ9...
X-Refresh-Token:    eyJhbGciOiJIUzI1NiJ9...
X-Token-Expires-In: 900
```

Están expuestos por CORS, así que el browser te deja leerlos. Con `fetch`:

```js
const res  = await fetch(`${BASE}/auth/login`, {
  method:  "POST",
  headers: { "Content-Type": "application/json" },
  body:    JSON.stringify({ cuit: "20345678901", password: "Ciudadano.2026" }),
});
const body         = await res.json();                              // {personaId, tipoPersona, rol}
const accessToken  = res.headers.get("Authorization").slice(7);     // sacar "Bearer "
const refreshToken = res.headers.get("X-Refresh-Token");
const expiresIn    = Number(res.headers.get("X-Token-Expires-In")); // 900 segundos
```

Con **axios**, acordate de que `response.headers` normaliza a minúsculas:
`response.headers["authorization"]`, `response.headers["x-refresh-token"]`.

### En cada request autenticado

```
Authorization: Bearer <accessToken>
```

Si el token falta, está vencido o es inválido → **401** con el cuerpo de error estándar
(`"Token ausente o invalido"`).

### Vida de los tokens

| Token | Duración | Nota |
|---|---|---|
| Access | **900 s (15 min)** | claim `typ: "access"` |
| Refresh | **604800 s (7 días)** | claim `typ: "refresh"`; no sirve para autenticar requests |

**Estrategia recomendada para el front**: interceptor que, ante un 401, intenta
`POST /auth/refresh` una sola vez y reintenta el request original; si el refresh también
falla, limpia la sesión y manda al login.

### `POST /auth/refresh`

```
POST /auth/refresh          (público, no lleva Authorization)
body: { "refreshToken": "<el refresh guardado>" }
→ 204 No Content, SIN body
   headers: Authorization, X-Refresh-Token, X-Token-Expires-In
```

**Devuelve 204, no 200.** No intentes parsear el body — no hay. Y **rota el par completo**:
guardá también el nuevo `X-Refresh-Token`.

### Contenido del JWT

Podés decodificar el payload en el front (base64) para saber quién sos sin pegarle a la API:

```json
{
  "iss":      "modulo1-ciudadanos",
  "sub":      "42",
  "sub_type": "CIUDADANO",
  "rol":      "PERSONA",
  "typ":      "access",
  "iat":      1756762800,
  "exp":      1756763700
}
```

| Claim | Para qué te sirve en el front |
|---|---|
| `sub` | El `personaId` o `empleadoId`. Es con lo que armás las rutas `/ciudadanos/{sub}` |
| `sub_type` | `CIUDADANO` \| `JURIDICA` \| `EMPLEADO` \| `SERVICIO` — decide si mostrás portal del vecino o backoffice |
| `rol` | `PERSONA` \| `MESA_ENTRADAS` \| `ADMINISTRATIVO` \| `RESPONSABLE_AREA` \| `AUDITOR` \| `SERVICIO` — decide qué botones se ven (§6) |
| `exp` | Para refrescar proactivamente antes de que venza |

**No confíes en el JWT para seguridad** — es solo para pintar la UI. El backend valida de
verdad y devuelve 403 igual.

### Rutas públicas (sin token)

```
POST /auth/login
POST /auth/register
POST /auth/empleados/login
POST /auth/refresh
GET  /actuator/health
```

**Todo lo demás requiere token, incluido `POST /auth/logout`.**

### Formato de fechas

| Tipo | Formato JSON | Ejemplo |
|---|---|---|
| `LocalDate` | `"yyyy-MM-dd"` | `"1997-03-08"` |
| `OffsetDateTime` | ISO-8601 con offset | `"2026-09-01T19:34:55.123-03:00"` |

Hibernate corre en UTC. Los `<input type="date">` de HTML ya emiten `yyyy-MM-dd`, así que
entran directo.

---

## 4. Las once reglas que rompen el front si las ignorás

Esta sección es la más importante del documento. Cada punto es un 400 o un bug real
esperando a pasar.

### 4.1 `fail-on-unknown-properties` está en `true`

Un campo de más en el body **no se ignora en silencio**: hace fallar el request con 400.

```json
POST /ciudadanos/1/contactos
{"tipo":"EMAIL","valor":"a@b.com","verificado":true}

→ 400 {"message":"Campo no permitido: 'verificado'. Campos aceptados: tipo, valor"}
```

**Consecuencia directa**: **nunca reenvíes a un PUT el objeto que te devolvió un GET.** Los
DTO de update son subconjuntos estrictos del DTO de respuesta.

```js
// ❌ MAL — el ciudadano trae id, estado, domicilioPrincipal, contactos → 400
const c = await api.get(`/ciudadanos/${id}`);
await api.put(`/ciudadanos/${id}`, { ...c, nombre: "Ana" });

// ✅ BIEN — solo los 5 campos que el DTO acepta
await api.put(`/ciudadanos/${id}`, {
  nombre: "Ana", apellido: c.apellido, fechaNacimiento: c.fechaNacimiento,
  dni: c.dni, cuil: c.cuil,
});
```

Del lado bueno: esto también significa que el backend está blindado contra *mass
assignment*. No hay forma de tocar `estado`, `cuit` o `verificado` por un PUT — para eso
existen los `PATCH` dedicados.

### 4.2 Los GET de listado devuelven TODO, sin filtros ni paginación

**Ningún** endpoint de listado acepta query params de filtro, orden o página. Todos
devuelven el conjunto completo envuelto en `{ "items": [...] }`.

```
GET /ciudadanos              → {"items":[ ...todos los ciudadanos... ]}
GET /organizaciones          → {"items":[ ...todas... ]}
GET /expedientes             → {"items":[ ...todos los que puedas ver... ]}
```

Mandar `?nombre=ana&page=2` no rompe (Spring lo ignora) pero **tampoco filtra**.

Esto es a la vez la restricción más grande del backend y **exactamente lo que la cátedra le
pide al front** (búsquedas, filtros, paginación). Traducción: el front baja la lista
completa y filtra/pagina/ordena en memoria o en un store del cliente.

**RF-07** exige buscar ciudadanos por *DNI, nombre, domicilio, teléfono o email*. Con
`GET /ciudadanos` solo tenés DNI, nombre, apellido, fechaNacimiento, cuil y estado — para
buscar por domicilio/teléfono/email hay que traer los contactos y domicilios de cada uno
(`GET /ciudadanos/{id}` los trae, pero de a uno). Ver §10.5.

### 4.3 `PUT /ciudadanos/{id}` es parcial; `PUT /domicilios/{id}` NO lo es

| Endpoint | Comportamiento |
|---|---|
| `PUT /ciudadanos/{id}` | **Parcial**: `null` = "no tocar este campo". Podés mandar solo `{nombre}` |
| `PUT /domicilios/{id}` | **Reemplazo**: `tipo`, `calle` y `numero` son obligatorios y sobrescriben |
| `PUT /contactos/{id}` | **Reemplazo**: `tipo` y `valor` obligatorios |
| `PUT /organizaciones/{id}` | **Parcial**: los tres campos son opcionales |
| `PUT /relaciones/{id}` | **Reemplazo**: los dos campos obligatorios |

### 4.4 `PATCH /domicilios/{id}/principal` va sin body

No lleva request DTO. Mandar `{}` funciona; mandar cualquier campo → 400.

### 4.5 Todos los `PATCH .../estado` devuelven el mismo objeto, con el campo `id`

No importa si es un ciudadano, una organización, una representación, un expediente o una
solicitud — la respuesta es siempre:

```json
{ "id": 7, "estadoAnterior": "INICIADO", "estadoNuevo": "EN_TRAMITE",
  "actualizadoEn": "2026-09-05T10:12:00-03:00" }
```

**El campo se llama `id`, nunca `organizacionId` / `solicitudId` / `representacionId`**
(aunque `ARCHITECTURE.md` diga lo contrario).

### 4.6 Multipart: el campo se llama `archivo`

```js
const fd = new FormData();
fd.append("archivo", file);           // nombre EXACTO
fd.append("tipoDocumento", "DNI");    // solo en POST /personas/{id}/documentos

await fetch(`${BASE}/personas/${personaId}/documentos`, {
  method:  "POST",
  headers: { Authorization: `Bearer ${token}` },   // ← NO setear Content-Type
  body:    fd,
});
```

**No fijes `Content-Type` a mano**: el browser tiene que poner el `boundary`.

- `POST /personas/{personaId}/documentos` → `archivo` + `tipoDocumento`
  (`tipoDocumento` también funciona como query string: `?tipoDocumento=DNI`)
- `POST /documentos/{id}/version` → **solo** `archivo`
- Extensiones permitidas: `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`
- Content-types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`
- Máximo **10 MB** por archivo (12 MB por request) → **413** si te pasás
- Nombre de archivo con `..`, `/` o `\` → 400

**Validá tamaño y extensión en el front antes de subir**, así el usuario ve el error al
instante en vez de esperar la subida entera para comerse un 413.

### 4.7 CUIT/CUIL entran flexibles, salen normalizados

Podés mandar `"20-40123456-7"` o `"20401234567"` — el backend acepta ambos. Pero **siempre
te los devuelve como String de 11 dígitos sin guiones**: `"20401234567"`.

Si querés mostrarlos con guiones en la UI, formateá vos: `XX-XXXXXXXX-X`.

### 4.8 Tipos que sorprenden

| Campo | Tipo real | Ojo con |
|---|---|---|
| `longitud`, `latitud` | **String**, no number | `"-34.6037"`, máx. 50 chars |
| `idBarrio` | **UUID** | `"3fa85f64-5717-4562-b3fc-2c963f66afa6"` |
| `porcentajeTitularidad` | **BigDecimal** | Mandalo como número JSON: `50.00`. Rango 0.01–100.00 |
| `cuit`, `cuil`, `dni` | **String**, no number | Los ceros a la izquierda importan |
| `esResponsable`, `esPrincipal`, `verificado`, `aprobado` | boolean | — |
| `adjuntos` (actuaciones) | `List<String>` | URLs o ids externos; nunca viene `null`, viene `[]` |

### 4.9 `DELETE /domicilios/{id}` no borra, y puede dar 409

Cierra la vigencia (`vigenteHasta`), no elimina la fila — el historial de domicilios es
inmutable por diseño (regla de negocio 4 del alcance).

Devuelve **200 con body** (no 204):

```json
{ "propiedadId": 12, "vigenteHasta": "2026-09-05", "nuevoPrincipalId": 15 }
```

`nuevoPrincipalId` es `null` si no hubo reemplazo. Y da **409** si es el único domicilio
principal vigente: hay que cargar otro antes. **El front debería impedir el intento**
(deshabilitar "eliminar" cuando queda un solo domicilio) en vez de dejar que el usuario se
coma el 409.

### 4.10 `actuacionId` es un contador POR expediente

No es global. El expediente 5 y el expediente 9 tienen los dos una actuación con
`actuacionId: 1`. La clave real es el par `(expedienteId, actuacionId)`.

Si usás `actuacionId` como `key` de React en una lista que mezcla expedientes, vas a tener
colisiones. Usá `` `${expedienteId}-${actuacionId}` ``.

### 4.11 Un mismo estado repetido también es 400

Mandar `PATCH /ciudadanos/1/estado` con el estado que ya tiene → 400
(`"El ciudadano ya esta en estado ACTIVO"`). No es idempotente.

**En la UI**: el dropdown de cambio de estado debe excluir el estado actual y ofrecer solo
los destinos alcanzables según §7.3.

---

## 5. Referencia completa de la API

**59 endpoints.** Base `http://localhost:8080`. Todos requieren
`Authorization: Bearer <token>` salvo los marcados **Pub**.

Convenciones de esta sección:
- **Permiso** = qué hace falta *además* de estar autenticado. "propio" = sos el titular.
- Los campos marcados con `*` son obligatorios.
- Errores comunes (400 payload inválido, 401 sin token, 403 sin permiso, 404 no existe,
  500) se omiten; solo se listan los específicos.

---

### 5.1 Auth

#### `POST /auth/register` — **Pub** — 201

Alta de persona física **o** jurídica. Un solo endpoint, un solo DTO, discriminado por
`tipo`. **No devuelve tokens**: hay que hacer login después.

**Request** (el DTO declara los 10 campos siempre; los que no apliquen se omiten):

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `tipo` * | `"CIUDADANO"` \| `"JURIDICA"` | siempre | — |
| `cuit` * | String | siempre | 11 dígitos, con o sin guiones |
| `password` * | String | siempre | mínimo 8 caracteres |
| `dni` | String | si CIUDADANO | `^[0-9]{7,9}$` |
| `nombre` | String | si CIUDADANO | — |
| `apellido` | String | si CIUDADANO | — |
| `fechaNacimiento` | `"yyyy-MM-dd"` | si CIUDADANO | — |
| `razonSocial` | String | si JURIDICA | — |
| `nombreFantasia` | String | si JURIDICA | — |
| `fechaDeCreacion` | `"yyyy-MM-dd"` | no | opcional para JURIDICA |

**Response 201** (los campos `null` no se serializan):

```json
// CIUDADANO
{ "personaId": 7, "tipo": "CIUDADANO", "dni": "40123456", "nombre": "Ana",
  "apellido": "Perez", "fechaNacimiento": "1997-03-08", "cuil": "20401234567",
  "estado": "ACTIVO", "creadoEn": "2026-09-05T10:00:00-03:00" }

// JURIDICA
{ "personaId": 8, "tipo": "JURIDICA", "cuit": "30712345678",
  "razonSocial": "Kiosco SRL", "nombreFantasia": "El Kiosco",
  "estado": "ACTIVO", "creadoEn": "2026-09-05T10:00:00-03:00" }
```

> Física devuelve `cuil`; jurídica devuelve `cuit`. Es el mismo dato con distinto nombre.

**Errores**: 400 password < 8, faltan campos del tipo · 409 CUIT/CUIL ya existe · 409 DNI ya existe

**Nota para el front**: el flujo natural es *register → login automático → portal*. Como
register no devuelve tokens, encadená los dos requests vos.

---

#### `POST /auth/login` — **Pub** — 200

Login de **personas** (ciudadanos y jurídicas).

**Request**: `{ "cuit": "20345678901", "password": "..." }` (ambos obligatorios; acepta CUIT o CUIL, con o sin guiones)

**Response body**: `{ "personaId": 3, "tipoPersona": "CIUDADANO", "rol": "PERSONA" }`
**Response headers**: `Authorization`, `X-Refresh-Token`, `X-Token-Expires-In`

`rol` siempre vale `"PERSONA"` acá. `tipoPersona` es `CIUDADANO` o `JURIDICA`.

**Errores**: 401 credenciales · 403 persona bloqueada/inactiva · 404 no registrado

---

#### `POST /auth/empleados/login` — **Pub** — 200

Login de **empleados municipales**. Ojo: se loguean con **mail**, no con CUIT.

**Request**: `{ "mail": "admin@municipio.gob.ar", "password": "..." }`
**Response body**: `{ "empleadoId": 1, "rol": "RESPONSABLE_AREA" }`
**Response headers**: los tres de siempre

**Errores**: 401 credenciales · 403 empleado inactivo

> **Decisión de diseño para el front**: son dos formularios de login distintos, porque son
> dos endpoints distintos con campos distintos. O hacés dos pantallas (`/login` y
> `/login-empleado`), o un toggle "Soy vecino / Soy empleado" en la misma.

---

#### `POST /auth/refresh` — **Pub** — 204

Ver §3. Request `{ "refreshToken": "..." }`, response **204 sin body**, tokens nuevos en
headers. Rota el par completo.

**Errores**: 400 refreshToken faltante · 401 vencido/inválido/no es de tipo refresh

---

#### `POST /auth/logout` — autenticado — 204

Sin body de request ni de response.

> ⚠️ **No revoca nada.** Los tokens son stateless y no hay denylist. El front tiene que
> descartar los tokens de su lado; el access token robado sigue siendo válido hasta que
> vence (15 min). Para el TPO alcanza, pero conviene saberlo.

---

### 5.2 Ciudadanos

#### `GET /ciudadanos` — permiso `LISTAR_PADRON` — 200

Listado **completo** del padrón. Un rol `PERSONA` recibe **403**.

```json
{ "items": [
  { "id": 3, "dni": "34567890", "nombre": "Diego", "apellido": "Lopez",
    "fechaNacimiento": "1989-04-12", "cuil": "20345678901", "estado": "ACTIVO" }
]}
```

Campos de cada item: `id`, `dni`, `nombre`, `apellido`, `fechaNacimiento`, `cuil`, `estado`.
Sin domicilio ni contactos — para eso está el detalle.

---

#### `GET /ciudadanos/{id}` — propio o `LEER_TERCEROS` — 200

Detalle completo, con domicilio principal y contactos embebidos.

```json
{ "id": 3, "dni": "34567890", "nombre": "Diego", "apellido": "Lopez",
  "fechaNacimiento": "1989-04-12", "cuil": "20345678901", "estado": "ACTIVO",
  "domicilioPrincipal": {
    "propiedadId": 1, "tipo": "CASA", "calle": "Av. Siempreviva", "numero": "742",
    "altura": null, "idBarrio": null, "longitud": null, "latitud": null,
    "esPrincipal": true, "vigenteDesde": "2026-01-01", "vigenteHasta": null },
  "contactos": [
    { "contactoId": 1, "tipo": "EMAIL", "valor": "diego@mail.com", "verificado": false }
  ]}
```

`domicilioPrincipal` es `null` si no cargó ninguno.

---

#### `PUT /ciudadanos/{id}` — propio o `EDITAR_TERCEROS` — 200

**Parcial**: `null` = no tocar. Acepta **exactamente estos 5 campos** y ninguno más:

| Campo | Tipo | Validación |
|---|---|---|
| `nombre` | String | máx. 255 |
| `apellido` | String | máx. 255 |
| `fechaNacimiento` | `"yyyy-MM-dd"` | debe ser pasada (`@Past`) |
| `dni` | String | `^[0-9]{7,9}$` |
| `cuil` | String | `^[0-9-]{11,13}$` |

**Response**: el `CiudadanoResponse` completo actualizado.
**Errores**: 409 CUIL o DNI duplicado

---

#### `PATCH /ciudadanos/{id}/estado` — permiso `CAMBIAR_ESTADO_TITULAR` — 200

Solo `RESPONSABLE_AREA`. Es la operación menos reversible del sistema.

**Request**: `{ "estado": "BLOQUEADO" }` — uno de `ACTIVO`/`INACTIVO`/`BLOQUEADO`/`FALLECIDO`
**Response**: `CambioEstadoResponse` (§4.5)
**Errores**: 400 transición inválida o mismo estado (§7.3)

---

#### `GET /ciudadanos/dni/{dni}` — autenticado — 200

Chequeo de existencia por DNI. **Nunca devuelve 404**: devuelve `{"existe": false}`.

```json
{ "existe": true, "id": 3, "nombre": "Diego", "apellido": "Lopez", "estado": "ACTIVO" }
{ "existe": false }
```

**Errores**: 400 si el DNI no matchea `^[0-9]{7,9}$`

**Uso en el front**: validación en vivo del campo DNI en el alta asistida — avisar
"ya existe un vecino con ese DNI" antes de mandar el formulario.

---

#### `GET /ciudadanos/existe?dni=34567890` — autenticado — 200

Misma respuesta que el anterior, pero el DNI va por query param. Existe por el contrato
inter-módulo, pero **en el código no está restringido**: cualquier autenticado puede usarlo
(§10.4).

---

### 5.3 Relaciones (grupo familiar)

#### `POST /relaciones` — participante o `EDITAR_TERCEROS` — 201

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `ciudadanoId1` * | Long | sí | — |
| `ciudadanoId2` * | Long | sí | distinto de `ciudadanoId1` |
| `relacionCiudadano1` * | String | sí | lista blanca `TIPOS_RELACION` (§7.1) |
| `relacionCiudadano2` * | String | sí | lista blanca `TIPOS_RELACION` |
| `esResponsable` | Boolean | no | default `false` |

La relación se declara **desde los dos extremos**: si 1 es `PADRE` de 2, entonces
`relacionCiudadano1: "PADRE"` y `relacionCiudadano2: "HIJO"`. El front debería sugerir el
recíproco automáticamente.

**Response 201**: `{relacionId, ciudadanoId1, ciudadanoId2, relacionCiudadano1, relacionCiudadano2, esResponsable, creadoEn}`
**Errores**: 400 ids iguales o tipo fuera de lista · 404 ciudadano · 409 relación ya existe

---

#### `GET /ciudadanos/{id}/relaciones` — propio o `LEER_TERCEROS` — 200

```json
{ "items": [
  { "relacionId": 1, "ciudadanoRelacionadoId": 5, "nombre": "Ana", "apellido": "Lopez",
    "tipoRelacion": "HIJA", "esResponsable": true }
]}
```

Ya viene con `nombre` y `apellido` del otro extremo — no hace falta un GET por cada
familiar. `tipoRelacion` es el tipo **del otro** respecto de este ciudadano.

---

#### `PUT /relaciones/{id}` — participante o `EDITAR_TERCEROS` — 200
Request: `{ "relacionCiudadano1": "TUTOR", "relacionCiudadano2": "TUTELADO" }` (ambos obligatorios, lista blanca)
Response: `RelacionResponse`

#### `PATCH /relaciones/{id}/responsable` — participante o `EDITAR_TERCEROS` — 200
Request: `{ "esResponsable": true }`
Response: `{ "relacionId": 1, "esResponsable": true, "actualizadoEn": "..." }`

#### `DELETE /relaciones/{id}` — participante o `EDITAR_TERCEROS` — 204
Sin body.

---

### 5.4 Domicilios

> Aplican a **cualquier persona** (física o jurídica), por eso la ruta es `/personas/{id}`
> y no `/ciudadanos/{id}`.

#### `POST /personas/{personaId}/domicilios` — propio o `EDITAR_TERCEROS` — 201

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `tipo` * | String | sí | lista blanca `TIPOS_PROPIEDAD` (§7.1) |
| `calle` * | String | sí | máx. 255 |
| `numero` * | String | sí | máx. 50 |
| `altura` | String | no | máx. 50 (piso/depto) |
| `idBarrio` | UUID | no | del catálogo global del M9 |
| `longitud` | String | no | máx. 50 |
| `latitud` | String | no | máx. 50 |
| `esPrincipal` | Boolean | no | si `true`, cierra el principal anterior |

**Response 201**: `{propiedadId, personaId, tipo, calle, numero, idBarrio, vigenteDesde, esPrincipal}`

---

#### `GET /personas/{personaId}/domicilios` — propio o `LEER_TERCEROS` — 200

Incluye los **históricos** (los que tienen `vigenteHasta` seteado), ordenados por
`vigenteDesde` descendente.

```json
{ "items": [
  { "propiedadId": 2, "tipo": "DEPARTAMENTO", "calle": "Corrientes", "numero": "1500",
    "altura": "3B", "idBarrio": null, "longitud": null, "latitud": null,
    "esPrincipal": true, "vigenteDesde": "2026-03-01", "vigenteHasta": null },
  { "propiedadId": 1, "tipo": "CASA", "calle": "Siempreviva", "numero": "742",
    "altura": null, "idBarrio": null, "longitud": null, "latitud": null,
    "esPrincipal": false, "vigenteDesde": "2020-01-01", "vigenteHasta": "2026-03-01" }
]}
```

**Idea de UI**: una línea de tiempo de domicilios, con el vigente destacado y los anteriores
en gris. Es una de las cosas que mejor muestra el diseño del módulo (regla: *un domicilio no
se modifica, se cierra el vigente y se abre uno nuevo*).

---

#### `PUT /domicilios/{id}` — propio o `EDITAR_TERCEROS` — 200
**No es parcial.** `tipo`, `calle` y `numero` son obligatorios. Mismos campos que el POST
**menos `esPrincipal`**. Response: `DomicilioResponse` completo.

#### `PATCH /domicilios/{id}/principal` — propio o `EDITAR_TERCEROS` — 200
**Sin body.** Response: `{propiedadId, personaId, esPrincipal: true, actualizadoEn}`
**Errores**: 409 si el domicilio no pertenece a esa persona

#### `DELETE /domicilios/{id}` — propio o `EDITAR_TERCEROS` — **200 con body**
Ver §4.9. Response: `{propiedadId, vigenteHasta, nuevoPrincipalId}` · 409 si es el único principal

---

### 5.5 Contactos

#### `POST /ciudadanos/{ciudadanoId}/contactos` — propio o `EDITAR_TERCEROS` — 201

**Request**: `{ "tipo": "EMAIL", "valor": "a@b.com" }` — ambos obligatorios, `valor` máx. 255

`tipo` ∈ `EMAIL` | `TELEFONO`.

Validación del backend, además del formato:
- **EMAIL**: regex de mail; se **normaliza a minúsculas** antes de guardar
- **TELEFONO**: `^\+?[0-9][0-9\s-]{7,19}$`; se guarda **sin espacios ni guiones**

O sea: mandás `"+54 11 4444-5555"` y te vuelve `"+541144445555"`. Si tu UI muestra lo que
mandó el usuario en vez de lo que devolvió el server, van a divergir.

**Response 201**: `{contactoId, ciudadanoId, tipo, valor, verificado: false, creadoEn}`
**Errores**: 400 formato · 409 el ciudadano ya tiene ese mismo tipo+valor

---

#### `GET /ciudadanos/{ciudadanoId}/contactos` — propio o `LEER_TERCEROS` — 200
`{ "items": [ {contactoId, tipo, valor, verificado} ] }`

#### `PUT /contactos/{id}` — titular o `EDITAR_TERCEROS` — 200
Request: `{tipo, valor}` (ambos obligatorios). **Editar un contacto lo vuelve `verificado: false`.**

#### `DELETE /contactos/{id}` — titular o `EDITAR_TERCEROS` — 204

#### `PATCH /contactos/{id}/verificar` — titular o `EDITAR_TERCEROS` — 200
Request: `{ "codigo": "123456" }` — `^[0-9]{6}$`
Response: `{contactoId, verificado: true, verificadoEn}`
Errores: 400 código con formato inválido · 409 ya verificado

> ⚠️ **La verificación no verifica nada.** No hay emisión ni almacenamiento de códigos:
> **cualquier código de 6 dígitos funciona**. En la demo, mostrá el flujo completo
> (pedir código → ingresarlo → verificado) sabiendo que el backend lo acepta siempre.

---

### 5.6 Organizaciones

#### `POST /organizaciones` — autenticado — 201

**Cualquier usuario autenticado puede crear una organización**, incluido un `PERSONA`.

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `cuit` * | String | sí | 11 dígitos, con o sin guiones |
| `razonSocial` * | String | sí | máx. 255 |
| `nombreFantasia` | String | no | máx. 255 |
| `tipo` | String | no | lista blanca `TIPOS_ORGANIZACION`; default `"OTRO"` |
| `taxId` | String | no | máx. 255; default = `cuit` sin guiones |
| `duenos` * | array | sí, **no vacío** | ver abajo |

Cada elemento de `duenos`:
```json
{ "personaId": 3, "porcentajeTitularidad": 60.00 }
```
`personaId` obligatorio; `porcentajeTitularidad` opcional, entre 0.01 y 100.00.

> ⚠️ `ARCHITECTURE.md` dice que este endpoint recibe `personaId[]` (array de números). **Es
> falso.** Recibe un array de objetos. Usá el shape de arriba.

**Response 201**: el `OrganizacionResponse` completo (ver GET de detalle).
**Errores**: 400 CUIT inválido · 404 personaId no existe · 409 CUIT duplicado · 409 la suma de titularidades supera 100

---

#### `GET /organizaciones` — autenticado — 200
```json
{ "items": [
  { "organizacionId": 1, "cuit": "30712345678", "taxId": "30712345678",
    "razonSocial": "Kiosco SRL", "nombreFantasia": "El Kiosco", "tipo": "SRL",
    "estado": "ACTIVA", "creadoEn": "..." }
]}
```

---

#### `GET /organizaciones/{id}` — autenticado — 200

```json
{ "organizacionId": 1, "cuit": "30712345678", "taxId": "30712345678",
  "razonSocial": "Kiosco SRL", "nombreFantasia": "El Kiosco", "tipo": "SRL",
  "estado": "ACTIVA", "creadoEn": "...",
  "domicilioPrincipal": { ...DomicilioResponse o null... },
  "duenos": [
    { "personaId": 3, "dni": "34567890", "nombre": "Diego", "apellido": "Lopez",
      "porcentajeTitularidad": 60.00 } ],
  "representantesVigentes": [
    { "personaId": 5, "nombre": "Ana", "apellido": "Perez", "alcance": "TOTAL",
      "desde": "2026-01-01", "hasta": "2026-12-31" } ] }
```

Con un solo GET tenés todo para la pantalla de detalle: datos, domicilio, dueños y
representantes vigentes.

---

#### `PUT /organizaciones/{id}` — dueño, representante vigente o `EDITAR_TERCEROS` — 200
**Parcial.** Solo 3 campos: `razonSocial` (máx. 255), `nombreFantasia` (máx. 255), `tipo`
(lista blanca). **No se puede cambiar el CUIT.**

#### `PATCH /organizaciones/{id}/estado` — permiso `CAMBIAR_ESTADO_TITULAR` — 200
Request: `{ "estado": "INACTIVA" }` ∈ `ACTIVA`/`INACTIVA`/`BLOQUEADA`. Response: `CambioEstadoResponse`

#### `GET /organizaciones/cuit/{cuit}` — autenticado — 200
`{ "existe": true, "organizacionId": 1, "razonSocial": "Kiosco SRL", "estado": "ACTIVA" }`
Nunca 404. 400 si el CUIT no son 11 dígitos.

#### `POST /organizaciones/{id}/duenos` — dueño, representante o `EDITAR_TERCEROS` — 201
Request: `{ "personaId": 9, "porcentajeTitularidad": 40.00 }`
Response: `{organizacionId, personaId, dni, porcentajeTitularidad, asociadoEn}`
Errores: 404 org/persona · 409 ya es dueño · 409 la suma supera 100

#### `GET /organizaciones/{id}/duenos` — autenticado — 200
`{ "items": [ {personaId, dni, nombre, apellido, porcentajeTitularidad} ] }`

#### `DELETE /organizaciones/{id}/duenos/{personaId}` — dueño, representante o `EDITAR_TERCEROS` — 204
**409 si es el único dueño** — una organización no puede quedarse sin dueños.

---

### 5.7 Representaciones

> Una representación habilita a una **persona física** a actuar en nombre de una
> **organización**, con alcance y vencimiento. El Módulo 4 (Habilitaciones) depende de esto
> para autorizar trámites.

#### `POST /representaciones` — dueño, representante o `GESTIONAR_REPRESENTACIONES` — 201

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `personaId` * | Long | sí | debe existir |
| `organizacionId` * | Long | sí | debe existir |
| `alcance` * | String | sí | `TOTAL` \| `TRAMITES` \| `FIRMA` \| `CONSULTA` |
| `desde` * | `"yyyy-MM-dd"` | sí | — |
| `hasta` | `"yyyy-MM-dd"` | no | `null` = sin vencimiento |

**Response 201**: `{representacionId, personaId, organizacionId, alcance, desde, hasta, estado: "VIGENTE"}`
**Errores**: 400 fechas inválidas o alcance fuera de lista · 404 persona/org · 409 representación activa duplicada

---

#### `GET /organizaciones/{id}/representaciones` — autenticado — 200
`{ "items": [ {representacionId, personaId, nombre, apellido, alcance, desde, hasta, estado} ] }`

#### `GET /personas/{id}/representaciones` — propio o `LEER_TERCEROS` — 200
`{ "items": [ {representacionId, organizacionId, razonSocial, alcance, desde, hasta, estado} ] }`

> **Este endpoint alimenta el "Mis organizaciones" del portal del vecino.**

#### `PATCH /representaciones/{id}/estado` — dueño, representante o `GESTIONAR_REPRESENTACIONES` — 200
Request: `{ "estado": "REVOCADA" }` ∈ `VIGENTE`/`VENCIDA`/`REVOCADA`. Response: `CambioEstadoResponse`

#### `GET /representaciones/vigencia?ciudadanoId=3&organizacionId=1` — permiso `CONSULTA_INTERMODULO` — 200
`{ "vigente": true, "representacionId": 4, "alcance": "TOTAL", "hasta": "2026-12-31" }`
400 si falta alguno de los dos query params. **Un rol `PERSONA` recibe 403.**

> 💡 **Detalle importante**: el `estado` que devuelven los GET es **calculado**. Si
> `hasta < hoy` y la fila dice `VIGENTE`, la API te devuelve `VENCIDA` sin escribir en la
> base. Confiá en lo que devuelve la API, no recalcules las fechas en el front.

---

### 5.8 Expedientes y actuaciones

#### `POST /expedientes` — permiso `GESTIONAR_EXPEDIENTES` — 201

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `numero` | String | **no** | máx. 100; si lo omitís se autogenera `EXP-{año}-{6 dígitos}` |
| `personaId` * | Long | sí | el titular |
| `caratula` * | String | sí | máx. 255 |
| `areaIniciadora` * | String | sí | máx. 255, texto libre |

**Response 201**: ver `ExpedienteResponse` abajo.
**Errores**: 409 número duplicado

> Lo normal es **omitir `numero`** y dejar que el backend lo genere.

---

#### `GET /expedientes` — autenticado — 200

**Visibilidad variable**: con `LEER_TERCEROS` devuelve todos; sin él, solo los expedientes
donde el usuario del token es el titular. No hay error — simplemente ves menos.

```json
{ "items": [
  { "expedienteId": 1, "numero": "EXP-2026-000001", "personaId": 3,
    "caratula": "Habilitación comercial", "areaIniciadora": "Habilitaciones",
    "estado": "EN_TRAMITE", "fechaInicio": "2026-09-01T10:00:00-03:00",
    "actuacionesCount": 4 }
]}
```

`actuacionesCount` te sirve para mostrar el contador sin pedir las actuaciones.

#### `GET /expedientes/{id}` — titular o `LEER_TERCEROS` — 200
Mismo shape que un item del listado.

#### `PATCH /expedientes/{id}/estado` — permiso `CAMBIAR_ESTADO_EXPEDIENTE` — 200
Request: `{ "estado": "EN_TRAMITE" }` ∈ `INICIADO`/`EN_TRAMITE`/`RESUELTO`/`ARCHIVADO`
Response: `CambioEstadoResponse` · 400 transición inválida (§7.3)

---

#### `POST /expedientes/{id}/actuaciones` — permiso `GESTIONAR_EXPEDIENTES` — 201

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `tipo` * | String | sí | lista blanca `TIPOS_ACTUACION` (§7.1) |
| `descripcion` * | String | sí | texto libre |
| `moduloOrigen` * | String | sí | texto libre (`"M1"`, `"M4"`, `"Habilitaciones"`...) |
| `adjuntos` | `string[]` | no | URLs o ids externos |

**Errores**: **409 si el expediente está `ARCHIVADO`** (regla: un expediente archivado no admite nuevas actuaciones)

---

#### `GET /expedientes/{id}/actuaciones` — titular o `LEER_TERCEROS` — 200

```json
{ "items": [
  { "expedienteId": 1, "actuacionId": 1, "tipo": "INICIO",
    "descripcion": "Se inicia el expediente", "moduloOrigen": "M1",
    "fecha": "2026-09-01T10:00:00-03:00", "adjuntos": [] }
]}
```

`adjuntos` nunca es `null` — viene `[]`. `actuacionId` es secuencial **por expediente** (§4.10).

> **Ésta es la vista estrella del módulo**: la línea de tiempo del expediente. Es lo que
> el alcance llama "historia completa" y lo que hace visible que M1 es el registro formal
> de lo que hacen todas las áreas.

---

### 5.9 Documentación

#### `POST /personas/{personaId}/documentos` — propio o `EDITAR_TERCEROS` — 201
**multipart/form-data** — ver §4.6. Campos: `archivo` (file) + `tipoDocumento` (String, lista blanca `TIPOS_DOCUMENTO`).

**Response 201**: `{documentoId, personaId, tipoDocumento, version: 1, cargadoPor, fechaCreacion}`
**Errores**: 400 extensión/content-type no permitido, archivo vacío, nombre con path traversal · 400 falta la parte `archivo` o el param `tipoDocumento` · **413 archivo > 10 MB**

#### `POST /documentos/{id}/version` — propio o `EDITAR_TERCEROS` — 201
**multipart/form-data** con **solo** `archivo`. Sube `version` en +1.
Response: `{documentoId, version: n+1, cargadoPor, fechaCreacion, ...}`

> ⚠️ El versionado **pisa la fila**: no hay historial consultable de versiones anteriores.
> El archivo viejo queda en disco pero no hay endpoint para listarlo. No prometas en la UI
> un "ver versiones anteriores" que el backend no puede cumplir.

#### `GET /personas/{personaId}/documentos` — propio o `LEER_TERCEROS` — 200
```json
{ "items": [
  { "documentoId": 1, "tipoDocumento": "DNI", "version": 2,
    "vigenciaHasta": "2030-01-01", "validadoPor": "EMPLEADO:1:RESPONSABLE_AREA",
    "resultadoValidacion": "VALIDADO" }
]}
```

#### `GET /documentos/{id}` — propio o `LEER_TERCEROS` — 200
```json
{ "documentoId": 1, "personaId": 3, "tipoDocumento": "DNI", "version": 2,
  "vigenciaHasta": "2030-01-01", "cargadoPor": "CIUDADANO:3:PERSONA",
  "validadoPor": "EMPLEADO:1:RESPONSABLE_AREA", "resultadoValidacion": "VALIDADO",
  "fechaValidacion": "...", "urlArchivo": "...", "fechaCreacion": "..." }
```

`cargadoPor` / `validadoPor` tienen el formato `"{TipoSujeto}:{id}:{Rol}"` —
ej. `"EMPLEADO:42:RESPONSABLE_AREA"`. **Parsealo para mostrarlo lindo**, no lo muestres crudo.

#### `PATCH /documentos/{id}/validar` — permiso `VALIDAR_DOCUMENTACION` — 200
Request: `{ "aprobado": true, "vigenciaHasta": "2030-01-01" }`
- `aprobado` obligatorio (Boolean)
- `vigenciaHasta` opcional; **400 si es pasada**; solo se aplica si `aprobado: true`

Response: `{documentoId, validadoPor, resultado: "VALIDADO"|"RECHAZADO", vigenciaHasta, fechaValidacion}`
Errores: **409 si el documento ya fue validado** (no está en `PENDIENTE`)

---

### 5.10 Solicitudes de documentación

#### `POST /solicitudes-documentacion` — permiso `SOLICITAR_DOCUMENTACION` — 201

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `titularId` * | Long | sí | persona a la que se le pide |
| `tipoDocumento` * | String | sí | lista blanca `TIPOS_DOCUMENTO` |
| `plazo` * | `"yyyy-MM-dd"` | sí | **400 si es pasada** |
| `origen` | `"INTERNA"` \| `"EVENTO"` | no | default `INTERNA` |

**Response 201**: `{solicitudId, titularId, tipoDocumento, plazo, estado: "PENDIENTE", origen, documentoId: null, creadoEn}`

#### `GET /solicitudes-documentacion` — autenticado — 200
Con `LISTAR_PADRON` devuelve todas; sin él, solo las del propio titular. `{items: [SolicitudResponse]}`

#### `GET /solicitudes-documentacion/{id}` — titular o `LEER_TERCEROS` — 200

#### `PATCH /solicitudes-documentacion/{id}/estado` — propio o `EDITAR_TERCEROS` — 200
```json
{ "estado": "CUMPLIDA", "documentoId": 7 }
```
- `estado` obligatorio ∈ `PENDIENTE`/`CUMPLIDA`/`VENCIDA`
- `documentoId` **obligatorio si `estado: "CUMPLIDA"`** (400 si falta); el documento debe
  pertenecer al titular de la solicitud
- Pasar a `VENCIDA` exige además el permiso `SOLICITAR_DOCUMENTACION`

Response: `CambioEstadoResponse`

> **Flujo de UI**: el vecino ve sus solicitudes pendientes con el plazo; sube el documento
> (`POST /personas/{id}/documentos`), obtiene el `documentoId`, y con eso cierra la
> solicitud (`PATCH .../estado` con `CUMPLIDA` + `documentoId`). Son **dos requests
> encadenados** — encapsulalos en una sola acción de la UI.

---

### 5.11 Consultas inter-módulo

Todas requieren permiso `CONSULTA_INTERMODULO`. **Un rol `PERSONA` recibe 403 en todas.**
Existen para que otros módulos nos consulten; el front del vecino no las usa, pero el
backoffice sí puede.

| Endpoint | Response |
|---|---|
| `GET /ciudadanos/{id}/identidad` | `{id, dni, nombre, apellido, estado}` |
| `GET /ciudadanos/{id}/estado` | `{id, estado}` |
| `GET /organizaciones/{id}/identidad` | `{organizacionId, cuit, razonSocial, estado}` |
| `GET /personas/{id}/domicilio-principal` | `{propiedadId, calle, numero, idBarrio, longitud, latitud}` — **404 si no hay principal vigente** |
| `GET /representaciones/vigencia?ciudadanoId&organizacionId` | ver §5.7 |
| `GET /ciudadanos/existe?dni=` | ver §5.2 (en la práctica no está restringido) |

---

## 6. Roles y permisos

### Las dos reglas

El backend decide el acceso con dos reglas, y entenderlas ahorra la mitad del trabajo de la
UI:

1. **Sobre lo propio** — cada titular administra sus datos **sin necesitar ningún permiso**.
   Sobre una organización, también su dueño y su representante vigente. Por eso el rol
   `PERSONA` tiene el conjunto de permisos **vacío** y aun así puede operar.
2. **Sobre lo ajeno** — hace falta el permiso que corresponda, según el rol del token.

### Los seis roles

| Rol | Quién | Se obtiene con |
|---|---|---|
| `PERSONA` | ciudadanos **y** personas jurídicas | `POST /auth/login` |
| `MESA_ENTRADAS` | recepción | `POST /auth/empleados/login` |
| `ADMINISTRATIVO` | gestión | `POST /auth/empleados/login` |
| `RESPONSABLE_AREA` | supervisión | `POST /auth/empleados/login` |
| `AUDITOR` | control | `POST /auth/empleados/login` |
| `SERVICIO` | otro módulo llamando a M1 | **todavía no se emite** |

Los tres roles de empleado del medio son una **escalera**: mesa de entradas carga,
administrativo además resuelve, responsable de área además decide. `AUDITOR` queda fuera a
propósito: ve todo y no escribe nada.

### La matriz

| Permiso | PERSONA | MESA_ENTRADAS | ADMINISTRATIVO | RESPONSABLE_AREA | AUDITOR | SERVICIO |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `LEER_TERCEROS` — ver el legajo de otro | — | ✅ | ✅ | ✅ | ✅ | — |
| `LISTAR_PADRON` — descargar el listado completo | — | ✅ | ✅ | ✅ | ✅ | — |
| `EDITAR_TERCEROS` — modificar datos de otro | — | ✅ | ✅ | ✅ | — | — |
| `SOLICITAR_DOCUMENTACION` | — | ✅ | ✅ | ✅ | — | — |
| `GESTIONAR_EXPEDIENTES` — crear expedientes y actuaciones | — | ✅ | ✅ | ✅ | — | — |
| `CONSULTA_INTERMODULO` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `VALIDAR_DOCUMENTACION` | — | — | ✅ | ✅ | — | — |
| `CAMBIAR_ESTADO_EXPEDIENTE` | — | — | ✅ | ✅ | — | — |
| `GESTIONAR_REPRESENTACIONES` | — | — | ✅ | ✅ | — | — |
| `CAMBIAR_ESTADO_TITULAR` — bloquear / marcar fallecido | — | — | — | ✅ | — | — |

### Qué NO puede hacer un `PERSONA` (403 garantizado)

Esta es la lista que necesitás para no mostrarle botones que no funcionan:

- `GET /ciudadanos` (el padrón completo)
- `PATCH /ciudadanos/{id}/estado`, `PATCH /organizaciones/{id}/estado`
- `PATCH /documentos/{id}/validar`
- `POST /solicitudes-documentacion`
- `POST /expedientes`, `POST /expedientes/{id}/actuaciones`, `PATCH /expedientes/{id}/estado`
- Todos los `/identidad`, `/estado`, `/domicilio-principal`, `/representaciones/vigencia`
- Leer o editar el legajo de **otra** persona

Y lo que **sí** puede: todo sobre sus propios datos, más crear organizaciones, listarlas y
verlas (esos tres no tienen chequeo adicional — cualquier autenticado puede).

### Cómo implementarlo en el front

```js
// Derivado del claim "rol" del JWT — espejo de Rol.java
const PERMISOS = {
  PERSONA:          [],
  MESA_ENTRADAS:    ["LEER_TERCEROS","LISTAR_PADRON","EDITAR_TERCEROS",
                     "SOLICITAR_DOCUMENTACION","GESTIONAR_EXPEDIENTES","CONSULTA_INTERMODULO"],
  ADMINISTRATIVO:   [/* los 6 de arriba */ "VALIDAR_DOCUMENTACION",
                     "CAMBIAR_ESTADO_EXPEDIENTE","GESTIONAR_REPRESENTACIONES"],
  RESPONSABLE_AREA: [/* los 9 de arriba */ "CAMBIAR_ESTADO_TITULAR"],
  AUDITOR:          ["LEER_TERCEROS","LISTAR_PADRON","CONSULTA_INTERMODULO"],
  SERVICIO:         ["CONSULTA_INTERMODULO"],
};

const puede = (rol, permiso) => PERMISOS[rol]?.includes(permiso) ?? false;
```

**Dos advertencias**:
1. Esto es solo para **pintar la UI**. El backend valida igual; ocultar un botón no es
   seguridad.
2. Si alguien toca `Rol.java` en el backend, este objeto queda desincronizado. Dejá un
   comentario apuntando al archivo fuente.

Aun así, la cátedra pide explícitamente *"mostrar las operaciones disponibles según el rol
autenticado"* — o sea que este objeto **es** parte del entregable, no un atajo.

---

## 7. Vocabulario cerrado

Nada entra al modelo sin estar enumerado. Todo lo que sigue devuelve **400** si mandás algo
distinto, con un mensaje que enumera lo aceptado.

### 7.1 Listas blancas (campos String)

El backend normaliza a **MAYÚSCULAS** y hace `trim()` antes de comparar, así que `"casa"` y
`" Casa "` son válidos. Igual, mandá siempre en mayúsculas.

| Constante | Dónde se usa | Valores |
|---|---|---|
| `TIPOS_RELACION` | `relacionCiudadano1/2` | `PADRE`, `MADRE`, `HIJO`, `HIJA`, `CONYUGE`, `CONVIVIENTE`, `HERMANO`, `HERMANA`, `TUTOR`, `TUTELADO`, `APODERADO`, `OTRO` |
| `TIPOS_PROPIEDAD` | `tipo` de domicilio | `CASA`, `DEPARTAMENTO`, `LOCAL`, `OFICINA`, `GALPON`, `TERRENO`, `OTRO` |
| `ALCANCES_REPRESENTACION` | `alcance` | `TOTAL`, `TRAMITES`, `FIRMA`, `CONSULTA` |
| `TIPOS_DOCUMENTO` | `tipoDocumento` | `DNI`, `PASAPORTE`, `CUIL`, `CUIT`, `ESTATUTO`, `PODER`, `CONSTANCIA_CUIT`, `PARTIDA_NACIMIENTO`, `CERTIFICADO_DOMICILIO`, `CERTIFICADO_DISCAPACIDAD`, `OTRO` |
| `TIPOS_ORGANIZACION` | `tipo` de organización | `SA`, `SRL`, `SAS`, `COOPERATIVA`, `FUNDACION`, `ASOCIACION_CIVIL`, `ONG`, `UNIPERSONAL`, `OTRO` |
| `TIPOS_ACTUACION` | `tipo` de actuación | `INICIO`, `PASE`, `NOTIFICACION`, `DICTAMEN`, `RESOLUCION`, `PEDIDO_DOCUMENTACION`, `ARCHIVO`, `OTRO` |

> ⚠️ **No hay endpoint que devuelva estas listas.** Están hardcodeadas en el backend
> (`common/ListasBlancas.java`) y el front tiene que replicarlas. Además, el backend las
> guarda en un `Set` sin orden garantizado, así que **el orden de los dropdowns lo definís
> vos** — poné el más frecuente primero y `OTRO` al final.
>
> Y acá está el lugar donde el front hace la traducción que pide la convención del equipo:
> valor `CONYUGE` en el request, etiqueta *"Cónyuge"* en la pantalla.

### 7.2 Enums (campos tipados)

| Enum | Valores | Usado en |
|---|---|---|
| `EstadoCiudadano` | `ACTIVO`, `INACTIVO`, `FALLECIDO`, `BLOQUEADO` | ciudadanos **y personas jurídicas** |
| `TipoPersona` | `CIUDADANO`, `JURIDICA` | register, login |
| `EstadoOrganizacion` | `ACTIVA`, `INACTIVA`, `BLOQUEADA` | organizaciones (en femenino) |
| `EstadoRepresentacion` | `VIGENTE`, `VENCIDA`, `REVOCADA` | representaciones |
| `EstadoExpediente` | `INICIADO`, `EN_TRAMITE`, `RESUELTO`, `ARCHIVADO` | expedientes |
| `EstadoSolicitud` | `PENDIENTE`, `CUMPLIDA`, `VENCIDA` | solicitudes de documentación |
| `OrigenSolicitud` | `INTERNA`, `EVENTO` | solicitudes |
| `ResultadoValidacion` | `PENDIENTE`, `VALIDADO`, `RECHAZADO` | documentos |
| `TipoContacto` | `EMAIL`, `TELEFONO` | contactos |
| `RolEmpleado` | `MESA_ENTRADAS`, `ADMINISTRATIVO`, `RESPONSABLE_AREA`, `AUDITOR` | login de empleados |

> ⚠️ **Trampa**: `EstadoOrganizacion` está en femenino (`ACTIVA`) pero **una persona
> jurídica registrada por `/auth/register` usa `EstadoCiudadano` (`ACTIVO`, masculino)**.
> Son dos entidades distintas: `PersonaJuridica` (nace del register) vs `Organizacion`
> (nace de `POST /organizaciones`). Si tu componente de badge de estado es genérico, tiene
> que aceptar las dos formas.

### 7.3 Máquinas de transición

Esto es lo que decide **qué botones habilitar** en cada pantalla. Un destino que no está en
la lista → 400. El mismo estado que el actual → 400 también.

```
CIUDADANO / PERSONA JURÍDICA
  ACTIVO     → INACTIVO, BLOQUEADO, FALLECIDO
  INACTIVO   → ACTIVO, BLOQUEADO, FALLECIDO
  BLOQUEADO  → ACTIVO, INACTIVO, FALLECIDO
  FALLECIDO  → ninguno                          ← TERMINAL

ORGANIZACION
  ACTIVA     → INACTIVA, BLOQUEADA
  INACTIVA   → ACTIVA, BLOQUEADA
  BLOQUEADA  → ACTIVA, INACTIVA                 ← ninguno es terminal

REPRESENTACION
  VIGENTE    → VENCIDA, REVOCADA
  VENCIDA    → ninguno                          ← TERMINAL
  REVOCADA   → ninguno                          ← TERMINAL

SOLICITUD
  PENDIENTE  → CUMPLIDA, VENCIDA
  VENCIDA    → CUMPLIDA                         ← se puede cumplir fuera de plazo
  CUMPLIDA   → ninguno                          ← TERMINAL

EXPEDIENTE
  INICIADO   → EN_TRAMITE, ARCHIVADO
  EN_TRAMITE → RESUELTO, ARCHIVADO
  RESUELTO   → ARCHIVADO
  ARCHIVADO  → ninguno                          ← TERMINAL
```

Copiá este mapa tal cual a una constante del front y derivá de ahí las opciones del
dropdown de cambio de estado. Es la forma de que el usuario nunca vea un 400 evitable.

---

## 8. Formato de error

**Todos** los errores del backend tienen la misma forma. Un solo
`@RestControllerAdvice` los traduce.

```json
{
  "timestamp": "2026-09-01T19:34:55.123-03:00",
  "status":    400,
  "error":     "Bad Request",
  "message":   "Campo no permitido: 'verificado'. Campos aceptados: tipo, valor",
  "path":      "/ciudadanos/1/contactos",
  "errores":   { "valor": "valor es obligatorio" }
}
```

`errores` (mapa campo → motivo) aparece **solo** en los 400 por Bean Validation. En el resto
se omite (no viene `null`, directamente no está la clave).

### Códigos

| Código | Cuándo | Qué hacer en el front |
|---|---|---|
| **400** | payload inválido, campo no permitido, valor fuera de lista blanca, transición inválida, path variable mal tipado, JSON roto | Si viene `errores`, pintá cada campo del formulario. Si no, mostrá `message` |
| **401** | token ausente, inválido o vencido | Intentar refresh una vez; si falla, limpiar sesión → login |
| **403** | rol o titularidad insuficiente | Mostrar `message` (dice qué rol tenés y qué permiso falta) |
| **404** | el recurso no existe | Pantalla de "no encontrado" |
| **405** | método no permitido en esa ruta | Bug del front |
| **409** | unicidad o conflicto de estado | Mensaje específico: DNI/CUIT repetido, contacto duplicado, único domicilio principal |
| **413** | archivo más grande que el máximo | Validar tamaño antes de subir (§4.6) |
| **500** | error no controlado | `message` dice solo `"Error interno"`. Mostrar algo genérico |

### Mensajes típicos, y cómo traducirlos

El backend habla en español pero técnico. La convención del equipo dice que **el vecino ve
español claro**, así que conviene un mapa de traducción en el front:

| Mensaje del backend | Para el vecino |
|---|---|
| `"Campo no permitido: 'X'. Campos aceptados: a, b, c"` | Bug del front — logueá, no lo muestres |
| `"Valor invalido en 'estado': se esperaba uno de: ACTIVO, ..."` | Bug del front |
| `"tipo invalido: 'CHALET'. Valores permitidos: CASA, ..."` | *"Seleccioná un tipo de vivienda válido"* |
| `"Transicion invalida de INICIADO a RESUELTO. Destinos permitidos: ARCHIVADO, EN_TRAMITE"` | *"Un expediente iniciado no puede resolverse directamente"* |
| `"Tu rol (MESA_ENTRADAS) no tiene permiso para validar documentacion. Requiere: VALIDAR_DOCUMENTACION"` | *"No tenés permiso para validar documentación"* |
| `"El archivo supera el tamano maximo permitido"` | *"El archivo no puede superar los 10 MB"* |
| 409 en `/auth/register` | *"Ya existe una persona registrada con ese CUIT"* |

Fijate que los dos primeros son **bugs del front**, no errores del usuario: si aparecen en
producción, es que mandaste un campo de más. Loguealos aparte.

**Implementación recomendada**: un solo interceptor de errores (axios interceptor o wrapper
de fetch) que normaliza todo a `{status, message, errores}` y de ahí sale tanto el toast
como el pintado de campos. Eso cubre el requisito de *"manejo centralizado de errores"*.

---

## 9. Levantar el backend y datos de prueba

### Levantar

```bash
cd ..    # la raíz del repo, donde está el backend

# 1. Bases de datos (una sola vez)
psql -U postgres -f db/00_crear_database.sql
psql -U postgres -d ciudadanos_m1 -f db/01_schema.sql
psql -U postgres -d ciudadanos_m1 -f db/02_datos_iniciales.sql   # los datos de abajo
mongosh "mongodb://localhost:27017" --file db/mongodb_setup.txt

# 2. API (no hace falta Maven instalado, el repo trae ./mvnw)
./mvnw spring-boot:run       # queda en http://localhost:8080
```

Instrucciones completas de instalación por sistema operativo: `INSTALACION.md` del backend.
Todas las variables de entorno tienen default para local.

Health check: `GET http://localhost:8080/actuator/health` (público).

### Empleados semilla

Los tres con contraseña **`Empleado.2026`**, vía `POST /auth/empleados/login`:

| mail | nombre | rol |
|---|---|---|
| `admin@municipio.gob.ar` | Ana Suarez | `RESPONSABLE_AREA` — **todos los permisos** |
| `mesa@municipio.gob.ar` | Bruno Ferrari | `MESA_ENTRADAS` |
| `auditor@municipio.gob.ar` | Carla Molina | `AUDITOR` — solo lectura |

> ⚠️ **No hay empleado semilla con rol `ADMINISTRATIVO`.** Si necesitás probar
> `VALIDAR_DOCUMENTACION` o `GESTIONAR_REPRESENTACIONES` en el escalón del medio, usá
> `admin@` (que también los tiene) o insertá un empleado a mano.

### Ciudadano semilla

Vía `POST /auth/login`:

| cuit/cuil | password | datos |
|---|---|---|
| `20345678901` | `Ciudadano.2026` | Diego Lopez, DNI `34567890`, nac. 1989-04-12, `ACTIVO` |

### Los tres requests para verificar que todo anda

```bash
# 1. Login de empleado — mirá los HEADERS de la respuesta
curl -i -X POST localhost:8080/auth/empleados/login \
  -H 'Content-Type: application/json' \
  -d '{"mail":"admin@municipio.gob.ar","password":"Empleado.2026"}'

# 2. Padrón completo (necesita LISTAR_PADRON → el token de arriba sirve)
curl -s localhost:8080/ciudadanos -H "Authorization: Bearer <TOKEN>"

# 3. Alta de un ciudadano nuevo (público)
curl -i -X POST localhost:8080/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"tipo":"CIUDADANO","cuit":"20-40123456-7","password":"clave-segura-1",
       "dni":"40123456","nombre":"Ana","apellido":"Perez","fechaNacimiento":"1997-03-08"}'
```

---

## 10. Discrepancias y decisiones abiertas

> Esta sección existe para ahorrarle horas al que siga. Son conflictos **reales y no
> resueltos**, no errores a corregir sin pensar.

### 10.1 🔴 Español vs. inglés — el conflicto grande

El PDF de alcance del propio Grupo 8 (§8, "Convención de nomenclatura entre equipos")
establece, como propuesta transversal a los nueve equipos:

> *Regla: todo lo que es código, en inglés; todo lo que ve el vecino, en español.*
> Endpoints `/api/v1/citizens/{id}/addresses` · campos `citizenId`, `birthDate` · entidades
> `Citizen`, `Organization`, `Case` · estados `ACTIVE`, `BLOCKED`, `DECEASED` · roles
> `CITIZEN`, `SUPERVISOR`, `AUDITOR` · errores `CITIZEN_NOT_FOUND`, `DUPLICATE_DNI`.

**El backend implementado no cumple nada de eso.** Está íntegramente en español:

| Convención acordada | Backend real |
|---|---|
| `/api/v1/citizens/{id}` | `/ciudadanos/{id}` (sin `/api/v1`) |
| `citizenId`, `birthDate`, `mainAddress` | `personaId`, `fechaNacimiento`, `domicilioPrincipal` |
| `ACTIVE`, `BLOCKED`, `DECEASED` | `ACTIVO`, `BLOQUEADO`, `FALLECIDO` |
| `CITIZEN`, `FRONT_DESK`, `SUPERVISOR` | `PERSONA`, `MESA_ENTRADAS`, `RESPONSABLE_AREA` |
| `CITIZEN_NOT_FOUND` (código de error) | mensajes en prosa española, sin código |

**Qué hacer**: el front habla con **lo que existe hoy** (español, sin `/api/v1`). Cambiar el
backend a inglés sería reescribir 59 endpoints, todos los DTOs, los enums y el schema de la
base — y romper cualquier integración ya empezada.

**Qué llevar al equipo**: decidir si (a) se ratifica el español y se corrige el documento de
alcance, o (b) se agrega una capa de traducción. La opción (a) es la sensata a esta altura
del proyecto. Lo que **no** puede pasar es que quede sin decidir, porque los otros ocho
módulos leyeron el documento de alcance y esperan `citizenId`.

**Lo único que sí conviene sostener sin discusión**: *lo que ve el vecino, en español*. Eso
depende solo del front y se cumple igual.

### 10.2 Roles: seis contra seis, pero distintos

| PDF de alcance | Backend | ¿Equivalen? |
|---|---|---|
| `CITIZEN` | `PERSONA` | Sí, pero `PERSONA` cubre también a las jurídicas |
| `FRONT_DESK` | `MESA_ENTRADAS` | Sí |
| `ADMIN_STAFF` | `ADMINISTRATIVO` | Sí |
| `AREA_OWNER` | — | **No hay equivalente directo** |
| `SUPERVISOR` | `RESPONSABLE_AREA` | Aproximadamente (el backend fusiona AREA_OWNER + SUPERVISOR) |
| `AUDITOR` | `AUDITOR` | Sí |
| — | `SERVICIO` | Existe en el código pero **no se emite**: ningún endpoint entrega un token con ese rol |

El front se guía por el backend: cinco roles reales (`PERSONA` + los cuatro de empleado).

### 10.3 Estados de expediente: falta `PENDING_INFO`

El PDF de alcance define el ciclo del expediente como:

```
OPENED → IN_PROGRESS → PENDING_INFO ⇄ IN_PROGRESS → RESOLVED → ARCHIVED
```

El backend tiene **cuatro** estados y **no tiene `PENDING_INFO`**:

```
INICIADO → EN_TRAMITE → RESUELTO → ARCHIVADO
```

O sea: el estado "esperando documentación del vecino" no existe como estado del expediente.
Se modela indirectamente con una `SolicitudDocumentacion` en `PENDIENTE`. Si la UI quiere
mostrar "expediente esperando documentación", tiene que cruzar el expediente con las
solicitudes del titular — no hay un campo que lo diga.

También falta la regla *"no pasa a RESOLVED sin al menos una actuación"* (regla de negocio 8
del alcance): el backend **no** la valida. El front puede prevenirla deshabilitando el botón
si `actuacionesCount === 0`.

### 10.4 `ARCHITECTURE.md` está desactualizado

No confíes en él para escribir requests. Diferencias verificadas contra el código:

| # | `ARCHITECTURE.md` dice | El código hace |
|---|---|---|
| 1 | `POST /organizaciones` recibe `personaId[]` | Recibe `duenos: [{personaId, porcentajeTitularidad}]` |
| 2 | `DELETE /domicilios/{id}` → `{propiedadId, vigenteHasta}` | Devuelve además `nuevoPrincipalId` |
| 3 | `POST /auth/refresh` → "200/204" | Siempre **204**, y devuelve los **tres** headers |
| 4 | `PATCH .../estado` → `{organizacionId, ...}` | Siempre `CambioEstadoResponse` con el campo **`id`** |
| 5 | `GET /ciudadanos/{id}/relaciones` sin nombre | Trae `nombre` y `apellido` |
| 6 | `GET /personas/{id}/domicilios` sin coords | Trae `altura`, `idBarrio`, `longitud`, `latitud` |
| 7 | `PATCH /documentos/{id}/validar` sin `vigenciaHasta` | Lo acepta en request y lo devuelve |
| 8 | `GET /personas/{id}/documentos` sin `resultadoValidacion` | Lo trae |
| 9 | `GET /expedientes/{id}/actuaciones` sin `expedienteId` | Lo trae en cada item |
| 10 | `POST /expedientes`, `POST .../actuaciones`, `PATCH .../estado` "a confirmar" | **Están implementados** y funcionan |

**Ningún endpoint documentado falta en el código.** Los 59 están.

### 10.5 Cosas del alcance que el backend todavía no hace

Importa para no prometer en la UI lo que no se puede cumplir:

| Funcionalidad del alcance | Estado real |
|---|---|
| **Publicación de eventos** (`citizenRegistered`, `organizationRegistered`, etc.) | ❌ `EventoOutbox` y su repositorio existen en Mongo, pero **no hay productor ni publisher**. Nada se publica |
| **Consumo de eventos** de M2–M8 | ❌ No implementado |
| **Línea de tiempo consolidada del vecino** ("Mis trámites" con hechos de otros módulos) | ❌ Depende del consumo de eventos. Hoy solo se puede mostrar lo propio de M1 |
| **Vencimiento automático de representaciones** (proceso programado) | ❌ No hay job. El estado `VENCIDA` se **calcula** al leer, pero no se persiste ni se publica `representationExpired` |
| **Verificación real de contactos** (código por mail/SMS) | ⚠️ Simulada: cualquier código de 6 dígitos pasa |
| **`logout` que revoque el token** | ⚠️ Devuelve 204 pero no revoca nada (tokens stateless, sin denylist) |
| **Historial de versiones de documentos** | ⚠️ `version` sube pero pisa la fila; no hay endpoint para ver versiones anteriores |
| **Motivo obligatorio en cambios de estado** (regla 11 del alcance) | ❌ Ningún `PATCH .../estado` acepta un campo `motivo` |
| **Búsqueda de ciudadanos por domicilio / teléfono / email** (RF-07) | ⚠️ `GET /ciudadanos` no trae esos datos. Solo se puede filtrar por DNI, nombre, apellido, CUIL, estado y fecha de nacimiento |
| **Archivos en almacenamiento compartido** | ⚠️ Se guardan en disco local (`./archivos-documentos`). Con más de una instancia desplegada, se rompe |

**Para la primera entrega esto alcanza** (la integración por eventos es la segunda entrega).
Pero el tablero de indicadores y el "Mis trámites" van a mostrar solo datos de M1.

### 10.6 Preguntas abiertas para el equipo

1. **¿De dónde salen los `idBarrio` (UUID)?** El alcance dice que del catálogo global del
   M9. Sin M9, el front no tiene una lista de barrios que ofrecer. Opciones: dejar el campo
   libre/opcional (es opcional en el backend), o hardcodear un catálogo provisorio.
2. **¿Se ratifica el español?** Ver §10.1.
3. **¿Un solo front o dos?** Portal del vecino y backoffice tienen usuarios, roles y
   pantallas muy distintos. Se puede hacer una sola app que bifurca por `sub_type`, o dos
   apps. Recomendación: **una sola app con dos layouts**, decidido por `sub_type` del JWT —
   es menos código, un solo deploy, y cumple igual el requisito de "operaciones según rol".
4. **¿Cómo se hace la búsqueda con listados completos?** Si el padrón crece, bajar
   `GET /ciudadanos` entero en cada carga no escala. Para el TPO alcanza; si molesta, la
   solución correcta es agregar query params al backend (no hackearlo en el front).

---

## 11. Pantallas sugeridas

No es vinculante — es un punto de partida que cubre los requisitos de la cátedra y usa los
endpoints que existen.

### Portal del vecino (`sub_type: CIUDADANO | JURIDICA`, rol `PERSONA`)

| Pantalla | Endpoints |
|---|---|
| **Registro** | `POST /auth/register` → `POST /auth/login` encadenados |
| **Login** | `POST /auth/login` |
| **Mi perfil** | `GET /ciudadanos/{sub}` · `PUT /ciudadanos/{sub}` |
| **Mis domicilios** (línea de tiempo, marcar principal) | `GET/POST /personas/{sub}/domicilios` · `PUT/PATCH/DELETE /domicilios/{id}` |
| **Mis contactos** | `GET/POST /ciudadanos/{sub}/contactos` · `PUT/DELETE /contactos/{id}` · `PATCH /contactos/{id}/verificar` |
| **Mi grupo familiar** | `GET /ciudadanos/{sub}/relaciones` · `POST /relaciones` · `PATCH /relaciones/{id}/responsable` |
| **Mis organizaciones** (las que represento o poseo) | `GET /personas/{sub}/representaciones` · `GET /organizaciones/{id}` |
| **Mis documentos** | `GET /personas/{sub}/documentos` · `POST` (multipart) · `POST /documentos/{id}/version` |
| **Documentación que me piden** | `GET /solicitudes-documentacion` · subir + `PATCH .../estado` con `CUMPLIDA` |
| **Mis expedientes** + timeline | `GET /expedientes` · `GET /expedientes/{id}/actuaciones` |

### Backoffice (`sub_type: EMPLEADO`)

| Pantalla | Endpoints | Rol mínimo |
|---|---|---|
| **Login de empleado** | `POST /auth/empleados/login` | — |
| **Padrón** — tabla con búsqueda, filtros y paginación **del lado del front** | `GET /ciudadanos` | `LISTAR_PADRON` |
| **Legajo del vecino** (perfil + domicilios + contactos + familia + expedientes) | `GET /ciudadanos/{id}` y sus sub-recursos | `LEER_TERCEROS` |
| **Alta asistida** (con chequeo de DNI en vivo) | `GET /ciudadanos/dni/{dni}` · `POST /auth/register` | `EDITAR_TERCEROS` |
| **Cambiar estado del titular** | `PATCH /ciudadanos/{id}/estado` | `CAMBIAR_ESTADO_TITULAR` |
| **Organizaciones** — listado, alta, dueños, representantes | `/organizaciones/*` · `/representaciones/*` | varía |
| **Bandeja de validación de documentos** | `GET /personas/{id}/documentos` · `PATCH /documentos/{id}/validar` | `VALIDAR_DOCUMENTACION` |
| **Pedir documentación** | `POST /solicitudes-documentacion` | `SOLICITAR_DOCUMENTACION` |
| **Expedientes** — listado, alta, actuaciones, cambio de estado | `/expedientes/*` | `GESTIONAR_EXPEDIENTES` |
| **Tablero de indicadores** (requisito de cátedra) | ver abajo | `LISTAR_PADRON` + `LEER_TERCEROS` |

### El tablero de indicadores

Se arma **enteramente en el front**, agregando en memoria los listados completos (que es
justamente lo que el backend te obliga a bajar). Métricas posibles sin ningún endpoint
nuevo:

- Ciudadanos por estado (`GET /ciudadanos` → contar por `estado`)
- Altas por mes (agrupar por `fechaNacimiento`... mejor: por `creadoEn` de las
  organizaciones, que sí lo trae)
- Organizaciones por tipo y por estado (`GET /organizaciones`)
- Expedientes por estado y por área iniciadora (`GET /expedientes`)
- Expedientes sin actuaciones (`actuacionesCount === 0`) — trabajo estancado
- Solicitudes de documentación pendientes y **vencidas** (`plazo < hoy` y estado `PENDIENTE`)
- Representaciones por vencer en los próximos 30 días
- Documentos pendientes de validación (`resultadoValidacion === "PENDIENTE"`)

Las dos últimas son especialmente buenas para la defensa: muestran que el front entiende las
reglas de negocio del módulo, no solo que sabe dibujar un gráfico de torta.

---

## Apéndice — Los 59 endpoints de un vistazo

```
AUTH (5)
  POST   /auth/register                              Pub    201
  POST   /auth/login                                 Pub    200 + headers
  POST   /auth/empleados/login                       Pub    200 + headers
  POST   /auth/refresh                               Pub    204 + headers
  POST   /auth/logout                                Auth   204

CIUDADANOS (6)
  GET    /ciudadanos                                 LISTAR_PADRON
  GET    /ciudadanos/{id}                            propio | LEER_TERCEROS
  PUT    /ciudadanos/{id}                            propio | EDITAR_TERCEROS
  PATCH  /ciudadanos/{id}/estado                     CAMBIAR_ESTADO_TITULAR
  GET    /ciudadanos/dni/{dni}                       Auth
  GET    /ciudadanos/existe?dni=                     Auth

RELACIONES (5)
  POST   /relaciones                                 participante | EDITAR_TERCEROS   201
  GET    /ciudadanos/{id}/relaciones                 propio | LEER_TERCEROS
  PUT    /relaciones/{id}                            participante | EDITAR_TERCEROS
  PATCH  /relaciones/{id}/responsable                participante | EDITAR_TERCEROS
  DELETE /relaciones/{id}                            participante | EDITAR_TERCEROS   204

DOMICILIOS (5)
  POST   /personas/{personaId}/domicilios            propio | EDITAR_TERCEROS         201
  GET    /personas/{personaId}/domicilios            propio | LEER_TERCEROS
  PUT    /domicilios/{id}                            propio | EDITAR_TERCEROS
  PATCH  /domicilios/{id}/principal                  propio | EDITAR_TERCEROS   (sin body)
  DELETE /domicilios/{id}                            propio | EDITAR_TERCEROS   (200 c/body)

CONTACTOS (5)
  POST   /ciudadanos/{ciudadanoId}/contactos         propio | EDITAR_TERCEROS         201
  GET    /ciudadanos/{ciudadanoId}/contactos         propio | LEER_TERCEROS
  PUT    /contactos/{id}                             titular | EDITAR_TERCEROS
  DELETE /contactos/{id}                             titular | EDITAR_TERCEROS        204
  PATCH  /contactos/{id}/verificar                   titular | EDITAR_TERCEROS

ORGANIZACIONES (9)
  POST   /organizaciones                             Auth                             201
  GET    /organizaciones                             Auth
  GET    /organizaciones/{id}                        Auth
  PUT    /organizaciones/{id}                        dueño | repr. | EDITAR_TERCEROS
  PATCH  /organizaciones/{id}/estado                 CAMBIAR_ESTADO_TITULAR
  GET    /organizaciones/cuit/{cuit}                 Auth
  POST   /organizaciones/{id}/duenos                 dueño | repr. | EDITAR_TERCEROS  201
  GET    /organizaciones/{id}/duenos                 Auth
  DELETE /organizaciones/{id}/duenos/{personaId}     dueño | repr. | EDITAR_TERCEROS  204

REPRESENTACIONES (5)
  POST   /representaciones                           dueño | repr. | GESTIONAR_REPR.  201
  GET    /organizaciones/{id}/representaciones       Auth
  GET    /personas/{id}/representaciones             propio | LEER_TERCEROS
  PATCH  /representaciones/{id}/estado               dueño | repr. | GESTIONAR_REPR.
  GET    /representaciones/vigencia?...              CONSULTA_INTERMODULO

EXPEDIENTES (6)
  POST   /expedientes                                GESTIONAR_EXPEDIENTES            201
  GET    /expedientes                                Auth (filtra por titularidad)
  GET    /expedientes/{id}                           titular | LEER_TERCEROS
  PATCH  /expedientes/{id}/estado                    CAMBIAR_ESTADO_EXPEDIENTE
  POST   /expedientes/{id}/actuaciones               GESTIONAR_EXPEDIENTES            201
  GET    /expedientes/{id}/actuaciones               titular | LEER_TERCEROS

DOCUMENTOS (5)
  POST   /personas/{personaId}/documentos            propio | EDITAR_TERCEROS   multipart 201
  GET    /personas/{personaId}/documentos            propio | LEER_TERCEROS
  GET    /documentos/{id}                            propio | LEER_TERCEROS
  POST   /documentos/{id}/version                    propio | EDITAR_TERCEROS   multipart 201
  PATCH  /documentos/{id}/validar                    VALIDAR_DOCUMENTACION

SOLICITUDES (4)
  POST   /solicitudes-documentacion                  SOLICITAR_DOCUMENTACION          201
  GET    /solicitudes-documentacion                  Auth (filtra por titularidad)
  GET    /solicitudes-documentacion/{id}             titular | LEER_TERCEROS
  PATCH  /solicitudes-documentacion/{id}/estado      propio | EDITAR_TERCEROS

INTER-MÓDULO (4) — todos CONSULTA_INTERMODULO
  GET    /ciudadanos/{id}/identidad
  GET    /ciudadanos/{id}/estado
  GET    /organizaciones/{id}/identidad
  GET    /personas/{id}/domicilio-principal
```

---

## Dónde mirar si este documento no alcanza

| Necesitás | Andá a |
|---|---|
| El código de un endpoint | `backend/src/main/java/ar/edu/uade/ciudadanos/{dominio}/*Controller.java` |
| Los campos exactos de un DTO | `.../{dominio}/dto/*.java` (son `record` de Java) |
| Las listas blancas y transiciones | `.../common/ListasBlancas.java`, `.../common/TransicionesEstado.java` |
| La matriz de permisos | `.../security/Rol.java` |
| CORS, rutas públicas, JWT | `.../config/SecurityConfig.java`, `.../security/JwtService.java` |
| El manejo de errores | `.../common/GlobalExceptionHandler.java` |
| Configuración y límites | `backend/src/main/resources/application.yml` |
| Datos semilla | `backend/db/02_datos_iniciales.sql` |
| Instalación paso a paso | `backend/INSTALACION.md` |
| Roles, endpoints, limitaciones conocidas | `backend/README.md` — **está bien mantenido** |
| Modelo de datos, RF, eventos | `backend/ARCHITECTURE.md` — **desactualizado en los endpoints** (§10.4) |

**Ante cualquier duda: manda el código.**
