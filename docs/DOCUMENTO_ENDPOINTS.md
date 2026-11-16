# Documentación de Endpoints del Sistema

**Sistema:** Módulo 1 — Ciudadanos, Organizaciones y Expedientes Digitales  
**Proyecto:** Desarrollo de Aplicaciones II — UADE  
**Versión del Sistema:** 2.1.0 (Actualizada con Integración de Patrón State [ADR-001], Transactional Outbox [ADR-002], Ports & Adapters [ADR-003], Seguridad Eje D y Regla 409 Conflict)  
**Fecha de Emisión:** 16 de Noviembre de 2026  
**URL Base de la API:** `http://localhost:8080`  

---

## Convenciones de Formato y Estructura Común

### Formato de Errores (RFC 7807 / `ErrorResponse`)
Todas las respuestas de error en el sistema adoptan la siguiente estructura estándar:
```json
{
  "timestamp": "2026-11-16T12:00:00-03:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Descripción legible del motivo del error",
  "path": "/ruta/solicitada",
  "errores": {
    "campo": "Motivo específico de validación"
  }
}
```

### Cabeceras de Seguridad Obligatorias
Todas las respuestas HTTP del backend incluyen:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: default-src 'self'`
- `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`

---

## 1. Módulo Autenticación y Sesión (`/auth`)

---

### 1.1 `POST /auth/register` — Alta de Ciudadano (RF-01, RF-37)
* **Descripción:** Da de alta un nuevo ciudadano en estado `ACTIVO` y persiste sus credenciales con BCrypt.
* **Autorización:** Público (sin autenticación).
* **Entradas:**
  * Headers: `Content-Type: application/json`
  * Body (`RegisterRequest`):
    ```json
    {
      "dni": "34567890",
      "nombre": "Marcos",
      "apellido": "Ferreyra",
      "fechaNacimiento": "1990-04-12",
      "cuil": 20345678901,
      "password": "Password123!"
    }
    ```
    *Campos y Restricciones:* `dni` (String, no blanco, 7 a 8 dígitos), `nombre`/`apellido` (String, no blanco, máx 100 caracteres), `fechaNacimiento` (LocalDate, fecha pasada obligatoria), `cuil` (Long, 11 dígitos numéricos), `password` (String, no blanco, mín 8 caracteres).
* **Salida Correcta:**
  * Código: `201 Created`
  * Body (`RegisterResponse`):
    ```json
    {
      "id": 1,
      "uuid": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
      "nombre": "Marcos",
      "apellido": "Ferreyra",
      "dni": "34567890",
      "cuil": 20345678901,
      "estado": "ACTIVO"
    }
    ```
* **Salidas Alternativas por Fallos:**
  * **`400 Bad Request` (Validación):** Si faltan campos requeridos o `fechaNacimiento` es futura. Retorna mapa `errores`.
  * **`400 Bad Request` (Mass Assignment):** Si el cliente envía propiedades no permitidas como `"rol": "ADMINISTRATIVO"` $\to$ `"Campo no permitido: 'rol'"`.
  * **`409 Conflict` (Unicidad):** Si ya existe un ciudadano registrado con el mismo DNI o CUIL $\to$ `"Ya existe un ciudadano registrado con ese DNI o CUIL"`.

---

### 1.2 `POST /auth/login` — Login de Ciudadano con CUIL (RF-36)
* **Descripción:** Autentica a un vecino por CUIL y contraseña, emitiendo access y refresh tokens en cabeceras HTTP.
* **Autorización:** Público.
* **Entradas:**
  * Body (`LoginRequest`):
    ```json
    {
      "cuil": 20345678901,
      "password": "Password123!"
    }
    ```
* **Salida Correcta:**
  * Código: `200 OK`
  * Headers:
    * `Authorization: Bearer <access_token>` (expira en 900 s)
    * `X-Refresh-Token: <refresh_token>` (expira en 7 días)
    * `X-Token-Expires-In: 900`
  * Body (`LoginResponse`):
    ```json
    {
      "id": 1,
      "uuid": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
      "nombre": "Marcos",
      "apellido": "Ferreyra",
      "rol": "PERSONA",
      "estado": "ACTIVO"
    }
    ```
* **Salidas Alternativas por Fallos:**
  * **`400 Bad Request`:** CUIL o contraseña ausentes en el JSON.
  * **`401 Unauthorized`:** Contraseña errónea o CUIL no registrado en el sistema $\to$ `"Credenciales invalidas"`.
  * **`403 Forbidden`:** Cuenta del vecino en estado `BLOQUEADO` o `FALLECIDO` $\to$ `"La cuenta se encuentra bloqueada o inactiva"`.
  * **`429 Too Many Requests`:** Si se detectan más de 5 intentos fallidos consecutivos desde la misma IP en 60 segundos. Incluye cabecera `Retry-After: 60` $\to$ `"Demasiados intentos fallidos. Intente nuevamente en 60 segundos."`.

---

### 1.3 `POST /auth/empleados/login` — Login de Personal Municipal
* **Descripción:** Autentica a operadores y directores municipales por email institucional.
* **Autorización:** Público.
* **Entradas:**
  * Body (`EmpleadoLoginRequest`):
    ```json
    {
      "email": "mesa.entradas@municipio.gob.ar",
      "password": "Mesa2026!Entrada"
    }
    ```
* **Salida Correcta:**
  * Código: `200 OK`
  * Headers: `Authorization`, `X-Refresh-Token`, `X-Token-Expires-In`
  * Body (`EmpleadoLoginResponse`):
    ```json
    {
      "id": 10,
      "nombre": "Laura",
      "apellido": "Gómez",
      "email": "mesa.entradas@municipio.gob.ar",
      "rol": "MESA_ENTRADAS"
    }
    ```
* **Salidas Alternativas por Fallos:**
  * **`401 Unauthorized`:** Credenciales institucionales incorrectas.
  * **`429 Too Many Requests`:** Bloqueo temporal por fuerza bruta.

---

### 1.4 `POST /auth/usuario/login` — Login Alternativo Unificado
* **Descripción:** Endpoint alternativo con contrato `{ gmail, password }`.
* **Entradas:** `{"gmail": "usuario1@gmail.com", "password": "Password123!"}`
* **Salida Correcta:** `200 OK` con `{"user_id": 1, "dni": 34567890, "role": "CIUDADANO", "auth": true}`.
* **Salidas Alternativas:** `401 Unauthorized` ante contraseña inválida; `429 Too Many Requests`.

---

### 1.5 `POST /auth/refresh` — Renovación de Sesión
* **Descripción:** Emite un nuevo par de access y refresh tokens a partir de un refresh token vigente.
* **Entradas:** Body `{"refreshToken": "<jwt_refresh_token_string>"}`.
* **Salida Correcta:** `204 No Content` con nuevas cabeceras `Authorization`, `X-Refresh-Token` y `X-Token-Expires-In`.
* **Salidas Alternativas:** `401 Unauthorized` si el refresh token expiró, la firma no coincide o fue manipulado.

---

### 1.6 `POST /auth/logout` — Cierre de Sesión
* **Descripción:** Desconecta la sesión en el cliente y limpia el contexto en el servidor.
* **Salida Correcta:** `204 No Content`.

---

## 2. Módulo Ciudadanos y Directorio (`/ciudadanos`)

---

### 2.1 `GET /ciudadanos` — Padrón General de Vecinos (RF-07)
* **Descripción:** Lista la totalidad de los ciudadanos registrados en el municipio.
* **Autorización:** Empleado con permiso `LEER_TERCEROS` (`MESA_ENTRADAS`, `ADMINISTRATIVO`, `RESPONSABLE_AREA`, `AUDITOR`).
* **Entradas:** Sin parámetros obligatorios.
* **Salida Correcta:**
  * Código: `200 OK`
  * Body (`ListaResponse<CiudadanoResumenResponse>`):
    ```json
    {
      "items": [
        {
          "id": 1,
          "uuid": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
          "dni": "34567890",
          "cuil": 20345678901,
          "nombre": "Marcos",
          "apellido": "Ferreyra",
          "estado": "ACTIVO"
        }
      ]
    }
    ```
* **Salidas Alternativas por Fallos:**
  * **`401 Unauthorized`:** Token ausente o inválido.
  * **`403 Forbidden` (BFLA):** Rol `PERSONA` intentando consultar el padrón general $\to$ `"Rol sin permiso para esta operacion"`.

---

### 2.2 `GET /ciudadanos/dni/{dni}` y `GET /ciudadanos/existe?dni={dni}` — Comprobación de Unicidad de DNI (RF-06)
* **Descripción:** Consulta si un DNI ya se encuentra registrado. Nunca retorna 404 para no romper formularios de alta.
* **Autorización:** Público / Semipúblico.
* **Entradas:** Path variable `{dni}` o Query param `dni`.
* **Salida Correcta:**
  * Código: `200 OK`
  * Body: `{"existe": true, "id": 1, "nombre": "Marcos", "apellido": "Ferreyra"}` (o `{"existe": false, ...}`).
* **Salidas Alternativas por Fallos:**
  * **`400 Bad Request`:** Parámetro DNI con caracteres alfabéticos o longitud inválida.

---

### 2.3 `GET /ciudadanos/{id}` — Consulta de Ficha de Ciudadano (RF-07)
* **Descripción:** Devuelve la información completa del legajo del ciudadano.
* **Autorización:** Titular (`sub == id`) o empleado con `LEER_TERCEROS`.
* **Entradas:** Path variable `{id}` (Long).
* **Salida Correcta:**
  * Código: `200 OK`
  * Body (`CiudadanoResponse`):
    ```json
    {
      "id": 1,
      "uuid": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
      "dni": "34567890",
      "cuil": 20345678901,
      "nombre": "Marcos",
      "apellido": "Ferreyra",
      "fechaNacimiento": "1990-04-12",
      "estado": "ACTIVO"
    }
    ```
* **Salidas Alternativas por Fallos:**
  * **`403 Forbidden` (BOLA / IDOR):** Vecino autenticado intentando acceder al legajo de otro vecino $\to$ `"No tiene permiso para acceder a los datos de este ciudadano"`.
  * **`404 Not Found`:** Ciudadano no encontrado con ese ID.

---

### 2.4 `PUT /ciudadanos/{id}` — Modificación de Datos de Ciudadano (RF-04)
* **Descripción:** Actualiza nombre, apellido o fecha de nacimiento del ciudadano.
* **Autorización:** Titular o empleado con `EDITAR_TERCEROS`.
* **Entradas:**
  * Path variable: `{id}`
  * Body (`ActualizarCiudadanoRequest`):
    ```json
    {
      "nombre": "Marcos Antonio",
      "apellido": "Ferreyra",
      "fechaNacimiento": "1990-04-12"
    }
    ```
* **Salida Correcta:** `200 OK` con `CiudadanoResponse` actualizado.
* **Salidas Alternativas por Fallos:**
  * **`400 Bad Request`:** Fecha de nacimiento futura o nombres vacíos.
  * **`403 Forbidden` (BOLA):** Modificación sobre ciudadano ajeno.
  * **`404 Not Found`:** Ciudadano no encontrado.

---

### 2.5 `PATCH /ciudadanos/{id}/estado` — Transición de Estado de Ciudadano (RF-05, ADR-001)
* **Descripción:** Ejecuta una transición en el ciclo de vida del ciudadano gobernada por el Patrón State.
* **Autorización:** Exclusivo rol `RESPONSABLE_AREA`.
* **Entradas:**
  * Path variable: `{id}`
  * Body (`CambioEstadoCiudadanoRequest`):
    ```json
    {
      "estado": "INACTIVO"
    }
    ```
    *Valores válidos:* `ACTIVO`, `INACTIVO`, `BLOQUEADO`, `FALLECIDO`.
* **Salida Correcta:**
  * Código: `200 OK`
  * Body (`CambioEstadoResponse`):
    ```json
    {
      "id": 1,
      "estadoAnterior": "ACTIVO",
      "estadoNuevo": "INACTIVO",
      "actualizadoEn": "2026-11-16T12:05:00-03:00"
    }
    ```
* **Salidas Alternativas por Fallos:**
  * **`400 Bad Request`:** Estado nulo o texto que no pertenece al enum `EstadoCiudadano`.
  * **`403 Forbidden` (BFLA):** Invocado por roles `PERSONA`, `MESA_ENTRADAS` o `ADMINISTRATIVO`.
  * **`404 Not Found`:** Ciudadano inexistente.
  * **`409 Conflict` (Patrón State ADR-001):**
    * Transición desde estado terminal `FALLECIDO` $\to$ `"Transicion invalida de FALLECIDO a ACTIVO. Destinos permitidos: ninguno, FALLECIDO es un estado final"`.
    * Transición al mismo estado actual $\to$ `"El ciudadano ya esta en estado ACTIVO"`.

---

## 3. Módulo Domicilios de Ciudadanos (`/ciudadanos/{id}/domicilios`, `/domicilios`)

---

### 3.1 `POST /ciudadanos/{ciudadanoId}/domicilios` — Alta de Domicilio (RF-09, RF-10)
* **Autorización:** Titular o empleado con `EDITAR_TERCEROS`.
* **Entradas:**
  * Path variable: `{ciudadanoId}`
  * Body (`CrearDomicilioRequest`):
    ```json
    {
      "calle": "Av. Rivadavia",
      "numero": "1450",
      "piso": "3",
      "departamento": "B",
      "codigoPostal": "1033",
      "idBarrio": "d40e20ba-e2a8-4dd0-a11f-b6d6b58c68a8",
      "principal": true
    }
    ```
* **Salida Correcta:** `201 Created` con `DomicilioCreadoResponse` (`id`, `calle`, `numero`, `principal`, `vigenteDesde`).
* **Salidas Alternativas por Fallos:**
  * **`400 Bad Request`:** Calle o número vacíos.
  * **`403 Forbidden` (BOLA):** Cargar domicilio a otro ciudadano.
  * **`404 Not Found`:** Ciudadano no existe.

---

### 3.2 `GET /ciudadanos/{ciudadanoId}/domicilios` — Listar Domicilios (RF-09)
* **Autorización:** Titular o empleado con `LEER_TERCEROS`.
* **Salida Correcta:** `200 OK` con `ListaResponse<DomicilioResponse>`.
* **Salidas Alternativas:** `403 Forbidden` (BOLA); `404 Not Found`.

---

### 3.3 `PATCH /domicilios/{id}/principal` — Marcar Domicilio Principal (RF-10, RF-12)
* **Autorización:** Titular o empleado con `EDITAR_TERCEROS`.
* **Salida Correcta:** `200 OK` con `{"id": 1, "principal": true, "actualizadoEn": "..."}`.
* **Salidas Alternativas por Fallos:**
  * **`403 Forbidden` (BOLA):** Domicilio de otro vecino.
  * **`404 Not Found`:** Domicilio inexistente.
  * **`409 Conflict`:** Intentar marcar como principal un domicilio dado de baja $\to$ `"No se puede marcar como principal un domicilio dado de baja"`.

---

### 3.4 `DELETE /domicilios/{id}` — Baja Lógica de Domicilio (RF-11)
* **Autorización:** Titular o empleado con `EDITAR_TERCEROS`.
* **Salida Correcta:** `200 OK` con `DomicilioCerradoResponse` registrando `vigenteHasta: hoy`.
* **Salidas Alternativas:** `403 Forbidden` (BOLA); `404 Not Found`; `409 Conflict` si es el único domicilio principal vigente.

---

## 4. Módulo Vías de Contacto (`/ciudadanos/{id}/contactos`, `/contactos`)

---

### 4.1 `POST /ciudadanos/{ciudadanoId}/contactos` — Alta de Contacto (RF-13)
* **Autorización:** Titular o empleado con `EDITAR_TERCEROS`.
* **Entradas:** Body `{"tipo": "EMAIL", "valor": "marcos.ferreyra@mail.com"}` (o tipo `TELEFONO`).
* **Salida Correcta:** `201 Created` con `{"id": 101, "tipo": "EMAIL", "valor": "...", "verificado": false}`.
* **Salidas Alternativas:**
  * `400 Bad Request`: Formato de email o teléfono inválido.
  * `403 Forbidden`: BOLA sobre ciudadano ajeno.
  * `409 Conflict`: Contacto duplicado.

---

### 4.2 `PATCH /contactos/{id}/verificar` — Verificación de Contacto (RF-14)
* **Autorización:** Titular o administrativo.
* **Entradas:** Body `{"codigo": "123456"}`.
* **Salida Correcta:** `200 OK` con `verificado: true`.
* **Salidas Alternativas:** `400 Bad Request` ante código inválido; `404 Not Found`.

---

### 4.3 `DELETE /contactos/{id}` — Eliminación de Contacto (RF-15)
* **Autorización:** Titular o administrativo.
* **Salida Correcta:** `204 No Content`.
* **Salidas Alternativas:** `403 Forbidden` (BOLA); `404 Not Found`; `409 Conflict` al intentar eliminar el único contacto del ciudadano.

---

## 5. Módulo Relaciones Familiares (`/relaciones`, `/ciudadanos/{id}/relaciones`)

---

### 5.1 `POST /relaciones` — Vincular Ciudadanos (RF-16, RF-17, RF-18)
* **Autorización:** Titular de ciudadano 1 o empleado de mesa de entradas.
* **Entradas:**
  * Body (`CrearRelacionRequest`):
    ```json
    {
      "ciudadanoId1": 1,
      "ciudadanoId2": 2,
      "relacionCiudadano1": "PADRE",
      "relacionCiudadano2": "HIJO",
      "esResponsable": true
    }
    ```
* **Salida Correcta:** `201 Created` con `RelacionResponse`.
* **Salidas Alternativas por Fallos:**
  * **`400 Bad Request`:** Mismo ID en ambos extremos o tipo de parentesco fuera de lista blanca.
  * **`404 Not Found`:** Alguno de los ciudadanos no existe.
  * **`409 Conflict`:** Vínculo familiar preexistente entre ambos ciudadanos.

---

### 5.2 `PATCH /relaciones/{id}/responsable` — Modificar Responsabilidad Legal (RF-18)
* **Autorización:** Empleado administrativo o titular con patria potestad.
* **Entradas:** Body `{"esResponsable": true}`.
* **Salida Correcta:** `200 OK` con `ResponsableResponse`.
* **Salidas Alternativas:** `400 Bad Request`; `404 Not Found`.

---

## 6. Módulo Organizaciones y Titularidad (`/organizaciones`, `/personas/{id}/organizaciones`)

---

### 6.1 `POST /organizaciones` — Alta de Organización (RF-02)
* **Autorización:** Vecino autenticado (queda en estado PENDIENTE y dueño inicial 100%) o empleado.
* **Entradas:**
  * Body (`CrearOrganizacionRequest`):
    ```json
    {
      "cuit": "30712345678",
      "razonSocial": "Panadería Del Sol S.R.L.",
      "nombre": "Panadería Del Sol",
      "tipo": "SRL"
    }
    ```
* **Salida Correcta:** `201 Created` con `OrganizacionResponse` (`estado: "PENDIENTE"`).
* **Salidas Alternativas:** `400 Bad Request` ante CUIT inválido; `409 Conflict` si el CUIT ya existe.

---

### 6.2 `PATCH /organizaciones/{id}/aprobar` y `PATCH /organizaciones/{id}/rechazar` (RF-08)
* **Autorización:** Exclusivo rol `RESPONSABLE_AREA`.
* **Salida Correcta:** `200 OK` con estado cambiado a `ACTIVA` (o `INACTIVA`/`BLOQUEADA`).
* **Salidas Alternativas por Fallos:**
  * **`403 Forbidden` (BFLA):** Invocado por roles `PERSONA`, `MESA_ENTRADAS` o `ADMINISTRATIVO`.
  * **`409 Conflict`:** La organización no se encuentra en estado `PENDIENTE` $\to$ `"Solo organizaciones en estado PENDIENTE pueden ser aprobadas"`.

---

### 6.3 `POST /organizaciones/{id}/duenos` — Agregar Socio / Dueño (RF-03, RF-19)
* **Autorización:** Dueño o administrativo.
* **Entradas:** Body `{"personaId": 2, "porcentaje": 30.00}`.
* **Salida Correcta:** `201 Created` con `DuenoAgregadoResponse`.
* **Salidas Alternativas por Fallos:**
  * **`400 Bad Request`:** Porcentaje $\le 0$ o $> 100$.
  * **`409 Conflict`:** Si la suma de participaciones supera el 100,00% $\to$ `"La participacion total de dueños superaria el 100%"`.

---

## 7. Módulo Representaciones Legales (`/representaciones`)

---

### 7.1 `POST /representaciones` — Otorgar Poder de Representación (RF-20)
* **Autorización:** Dueño de la organización o administrativo.
* **Entradas:** Body con `personaId`, `organizacionId`, `alcance`, `desde`, `hasta`.
* **Salida Correcta:** `201 Created` con `RepresentacionResponse` en estado `VIGENTE`.
* **Salidas Alternativas:** `400 Bad Request` si `hasta` es anterior a `desde`; `409 Conflict` ante poder idéntico vigente.

---

### 7.2 `GET /representaciones/vigencia` — Comprobación Intermódulo (RF-22)
* **Autorización:** Marcado con `@SoloInterno` (rol `SERVICIO` o empleado administrativo).
* **Entradas:** Query params `?ciudadanoId=1&organizacionId=10`.
* **Salida Correcta:** `200 OK` con `VigenciaRepresentacionResponse` (`vigente: true/false`).
* **Salidas Alternativas:** `401/403` si se invoca sin token de servicio.

---

### 7.3 `PATCH /representaciones/{id}/estado` — Revocar / Vencer Poder (RF-21)
* **Autorización:** Dueño de la organización o administrativo.
* **Entradas:** Body `{"estado": "REVOCADA"}`.
* **Salida Correcta:** `200 OK` con nuevo estado.
* **Salidas Alternativas:** `409 Conflict` si se intenta reactivar un poder ya revocado.

---

## 8. Módulo Documentación Digital y Archivos (`/documentos`, `/ciudadanos/{id}/documentos`)

---

### 8.1 `POST /ciudadanos/{ciudadanoId}/documentos` — Carga Multipart (RF-23, ADR-003)
* **Autorización:** Titular o administrativo.
* **Entradas:**
  * `Content-Type: multipart/form-data`
  * Param: `tipoDocumento=DNI_FRENTE` (o `CERTIFICADO_DOMICILIO`, `CONSTANCIA_AFIP`, etc.)
  * Parte binaria: `archivo` (archivo PDF o imagen)
* **Salida Correcta:** `201 Created` con `DocumentoCreadoResponse` (`version: 1`, `estado: "PENDIENTE"`).
* **Salidas Alternativas por Fallos:**
  * **`400 Bad Request`:** Tipo de documento no reconocido o archivo vacío.
  * **`403 Forbidden` (BOLA):** Cargar documento en el legajo de otro vecino.
  * **`413 Payload Too Large`:** El archivo supera los 10 MB permitidos.

---

### 8.2 `GET /documentos/{id}/archivo` — Visualización Binaria
* **Autorización:** Titular o empleado con `LEER_TERCEROS`.
* **Salida Correcta:** `200 OK` con bytes binarios, cabecera `Content-Type: application/pdf` y `Content-Disposition: inline`.
* **Salidas Alternativas:** `403 Forbidden` (BOLA); `404 Not Found` si el archivo no existe en almacenamiento local.

---

### 8.3 `PATCH /documentos/{id}/validar` — Validación Documental (RF-26)
* **Autorización:** Exclusivo rol `ADMINISTRATIVO` o `RESPONSABLE_AREA`.
* **Entradas:** Body `{"aprobado": true, "observaciones": "Legible y válido"}`.
* **Salida Correcta:** `200 OK` con `DocumentoValidadoResponse` y `validadoPor: "<id>"`.
* **Salidas Alternativas:** `403 Forbidden` (BFLA si lo invoca vecino o auditor); `409 Conflict` si ya estaba validado.

---

## 9. Módulo Solicitudes de Documentación (`/solicitudes-documentacion`)

---

### 9.1 `POST /solicitudes-documentacion` — Crear Solicitud (RF-27, RF-29)
* **Autorización:** `MESA_ENTRADAS` o `ADMINISTRATIVO`.
* **Entradas:** Body con `titularId`, `tipoDocumento`, `plazo`, `detalle`.
* **Salida Correcta:** `201 Created` con `SolicitudResponse` en estado `PENDIENTE`.
* **Salidas Alternativas:** `400 Bad Request` si el plazo es pasado; `404 Not Found` titular inexistente.

---

### 9.2 `PATCH /solicitudes-documentacion/{id}/estado` — Cambiar Estado (RF-28)
* **Autorización:** Administrativo o sistema.
* **Entradas:** Body `{"estado": "CUMPLIDA"}`.
* **Salida Correcta:** `200 OK` con estado actualizado.
* **Salidas Alternativas:** `409 Conflict` si se intenta pasar a `PENDIENTE` una solicitud ya cumplida.

---

## 10. Módulo Expedientes Digitales y Actuaciones (`/expedientes`)

---

### 10.1 `POST /expedientes` — Iniciar Expediente Digital (RF-30, RF-31)
* **Autorización:** `MESA_ENTRADAS`, `ADMINISTRATIVO` o `RESPONSABLE_AREA`.
* **Entradas:**
  * Body (`CrearExpedienteRequest`):
    ```json
    {
      "ciudadanoId": 1,
      "caratula": "Permiso de Obra Mayor",
      "areaIniciadora": "Obras Particulares",
      "numero": "EXP-2026-001042"
    }
    ```
* **Salida Correcta:** `201 Created` con `ExpedienteResponse` en estado `INICIADO`.
* **Salidas Alternativas por Fallos:**
  * **`400 Bad Request`:** Carátula vacía.
  * **`404 Not Found`:** Ciudadano titular inexistente.
  * **`409 Conflict`:** Número de expediente ya registrado (`existsByNumero`).

---

### 10.2 `PATCH /expedientes/{id}/estado` — Transición de Estado de Expediente (RF-32)
* **Autorización:** Exclusivo rol `ADMINISTRATIVO` o `RESPONSABLE_AREA`.
* **Entradas:** Body `{"estado": "EN_TRAMITE"}` (o `RESUELTO`, `ARCHIVADO`).
* **Salida Correcta:** `200 OK` con `CambioEstadoResponse`.
* **Salidas Alternativas por Fallos:**
  * **`403 Forbidden` (BFLA):** Invocado por vecino o auditor.
  * **`404 Not Found`:** Expediente no encontrado.
  * **`409 Conflict`:**
    * Transición desde `ARCHIVADO` hacia `EN_TRAMITE` $\to$ `"Transicion invalida de ARCHIVADO a EN_TRAMITE. Destinos permitidos: ninguno, ARCHIVADO es un estado final"`.
    * Retroceso desde `RESUELTO` hacia `INICIADO` $\to$ `"Transicion invalida de RESUELTO a INICIADO"`.

---

### 10.3 `POST /expedientes/{id}/actuaciones` — Agregar Actuación Foliada (RF-33, RF-34)
* **Autorización:** Empleado administrativo.
* **Entradas:** Body con `tipo`, `descripcion`, `moduloOrigen`, `adjuntos`.
* **Salida Correcta:** `201 Created` con `ActuacionResponse` y número correlativo asignado.
* **Salidas Alternativas:** `400 Bad Request`; `404 Not Found`; `409 Conflict` si el expediente está `ARCHIVADO`.

---

### 10.4 `GET /expedientes/{id}/actuaciones` — Historial de Actuaciones (RF-35)
* **Autorización:** Titular o empleado con `LEER_TERCEROS`.
* **Salida Correcta:** `200 OK` con `ListaResponse<ActuacionResponse>`.
* **Salidas Alternativas:** `403 Forbidden` (BOLA sobre expediente ajeno); `404 Not Found`.

---

## 11. Módulo Consultas Intermodulares y Directorio M6 (`/integraciones/v1`)

* Endpoints: `GET /ciudadanos/{id}/identidad`, `GET /organizaciones/{id}/identidad`, `GET /personas/{id}/domicilio-principal`, `GET /integraciones/v1/ciudadanos/{uuid}`, `GET /integraciones/v1/organizaciones/{uuid}`.
* **Autorización:** Marcados con `@SoloInterno` (rol `SERVICIO` o empleado administrativo).
* **Salida Correcta:** `200 OK` con DTO correspondiente y emisión automática de eventos hacia RabbitMQ (`citizenInfoDelivered`, `organizationInfoDelivered`).
* **Salidas Alternativas:** `400 Bad Request` ante UUID malformado; `401/403` si se llama desde el exterior sin token de servicio; `404 Not Found` si el sujeto no existe.

---

## 12. Módulo Trámites Externos Proyectados (`/ciudadanos/{id}/tramites-externos`)

* **Endpoint:** `GET /ciudadanos/{id}/tramites-externos`
* **Autorización:** Titular o empleado con `LEER_TERCEROS`.
* **Salida Correcta:** `200 OK` con lista de reclamos de M2 y deudas de M5 proyectadas en la base local.
* **Salidas Alternativas:** `403 Forbidden` (BOLA); `404 Not Found`.

---

## 13. Módulo Auditoría y Pruebas de Eventos (`/eventos`, `/eventos/core`)

* Endpoints: `GET /eventos?tipo=EMITIDO|RECIBIDO`, `POST /eventos/publicar-ejemplo/{nombre}`, `POST /eventos/recibir`, `POST /eventos/core/recibir`.
* **Salida Correcta:** `200 OK` o `201 Created` informando persistencia en PostgreSQL o descarte por idempotencia (`DUPLICADO_IGNORADO`).
* **Salidas Alternativas:** `400 Bad Request` ante JSON inválido; `403 Forbidden` si no se posee rol de edición.
