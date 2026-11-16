# Manual de Usuario del Sistema — Guía de Ejecución y Pruebas Operativas

**Sistema:** Módulo 1 — Ciudadanos, Organizaciones y Expedientes Digitales  
**Proyecto:** Desarrollo de Aplicaciones II — UADE  
**Versión del Sistema:** 2.1.0 (Actualizada con Integración de Patrón State [ADR-001], Transactional Outbox [ADR-002], Ports & Adapters [ADR-003], Seguridad Eje D y Regla 409 Conflict)  
**Fecha de Emisión:** 16 de Noviembre de 2026  
**URL Base Frontend:** `http://localhost:8090`  
**URL Base Backend REST:** `http://localhost:8080`  

---

## Instrucciones para la Evaluación del Manual

> [!IMPORTANT]
> **Metodología de Evaluación por Tareas Aleatorias:**  
> Este manual está diseñado para ser evaluado **eligiendo cualquier tarea del 1 al 25 al azar**.  
> Cada tarea es **autocontenida**, especifica las credenciales exactas a utilizar, los datos de prueba listos para copiar y pegar, el paso a paso detallado en la interfaz web de React, el comando **cURL** correspondiente para prueba por consola o terminal, y el comportamiento ante casos de éxito y de error (incluyendo la respuesta **HTTP 409 Conflict** ante transiciones de estado inválidas y **HTTP 403 / 429** ante violaciones de seguridad).

---

## Tabla de Credenciales Preconfiguradas para Pruebas

| Identificador | Rol en el Sistema | Usuario / CUIL / Email | Contraseña | Portal de Ingreso |
|---|---|---|---|---|
| **VECINO_TITULAR** | `PERSONA` | `20-34567890-1` | `ClaveVecino123!` | `/login` (Portal del Vecino) |
| **VECINO_TERCERO** | `PERSONA` | `27-38444555-8` | `ClaveVecino456!` | `/login` (Portal del Vecino) |
| **MESA_ENTRADAS** | `MESA_ENTRADAS` | `mesa.entradas@municipio.gob.ar` | `Mesa2026!Entrada` | `/login` (Gestión Administrativa) |
| **ADMINISTRATIVO** | `ADMINISTRATIVO` | `admin.tramites@municipio.gob.ar` | `Admin2026!Pase` | `/login` (Gestión Administrativa) |
| **RESPONSABLE_AREA** | `RESPONSABLE_AREA` | `director.general@municipio.gob.ar` | `Director2026!Seguro` | `/login` (Gestión Administrativa) |
| **AUDITOR** | `AUDITOR` | `auditor.control@municipio.gob.ar` | `Auditor2026!Lectura` | `/login` (Gestión Administrativa) |

---

## Índice Rápido de Tareas (Selección Aleatoria 1 al 25)

- [Tarea 01: Registro de Nuevo Vecino con Validación de DNI](#tarea-01-registro-de-nuevo-vecino-con-validación-de-dni)
- [Tarea 02: Inicio de Sesión de Vecino (Portal del Vecino)](#tarea-02-inicio-de-sesión-de-vecino-portal-del-vecino)
- [Tarea 03: Inicio de Sesión de Empleado Administrativo](#tarea-03-inicio-de-sesión-de-empleado-administrativo)
- [Tarea 04: Consulta de Perfil Propio y Edición de Datos](#tarea-04-consulta-de-perfil-propio-y-edición-de-datos)
- [Tarea 05: Consulta del Padrón de Ciudadanos y Búsqueda por DNI](#tarea-05-consulta-del-padrón-de-ciudadanos-y-búsqueda-por-dni)
- [Tarea 06: Alta de Nuevo Domicilio de Ciudadano](#tarea-06-alta-de-nuevo-domicilio-de-ciudadano)
- [Tarea 07: Designar Domicilio como Principal](#tarea-07-designar-domicilio-como-principal)
- [Tarea 08: Baja Lógica de Domicilio con Historial de Vigencia](#tarea-08-baja-lógica-de-domicilio-con-historial-de-vigencia)
- [Tarea 09: Agregar Vía de Contacto (Email o Teléfono)](#tarea-09-agregar-vía-de-contacto-email-o-teléfono)
- [Tarea 10: Verificación de Contacto mediante Código](#tarea-10-verificación-de-contacto-mediante-código)
- [Tarea 11: Vinculación Familiar y Designación de Responsable Legal](#tarea-11-vinculación-familiar-y-designación-de-responsable-legal)
- [Tarea 12: Alta de Organización por Vecino (Estado Pendiente)](#tarea-12-alta-de-organización-por-vecino-estado-pendiente)
- [Tarea 13: Aprobación de Organización por Responsable de Área](#tarea-13-aprobación-de-organización-por-responsable-de-área)
- [Tarea 14: Incorporación de Socios y Control de Porcentajes](#tarea-14-incorporación-de-socios-y-control-de-porcentajes)
- [Tarea 15: Otorgamiento de Poder de Representación Legal](#tarea-15-otorgamiento-de-poder-de-representación-legal)
- [Tarea 16: Revocación de Poder de Representación Legal](#tarea-16-revocación-de-poder-de-representación-legal)
- [Tarea 17: Carga Multipart de Documento Digital con Versionado](#tarea-17-carga-multipart-de-documento-digital-con-versionado)
- [Tarea 18: Validación de Documento por Empleado Administrativo](#tarea-18-validación-de-documento-por-empleado-administrativo)
- [Tarea 19: Generación de Solicitud de Documentación Faltante](#tarea-19-generación-de-solicitud-de-documentación-faltante)
- [Tarea 20: Cumplimiento de Solicitud de Documentación por Vecino](#tarea-20-cumplimiento-de-solicitud-de-documentación-por-vecino)
- [Tarea 21: Inicio de Expediente Digital con Carátula Oficial](#tarea-21-inicio-de-expediente-digital-con-carátula-oficial)
- [Tarea 22: Transición de Estado de Expediente (Con Validación 409)](#tarea-22-transición-de-estado-de-expediente-con-validación-409)
- [Tarea 23: Incorporación de Actuación Foliada a un Expediente](#tarea-23-incorporación-de-actuación-foliada-a-un-expediente)
- [Tarea 24: Verificación de Transición de Estado de Ciudadano (Patrón State con 409)](#tarea-24-verificación-de-transición-de-estado-de-ciudadano-patrón-state-con-409)
- [Tarea 25: Auditoría de Seguridad Eje D (BOLA, BFLA y Bloqueo 429)](#tarea-25-auditoría-de-seguridad-eje-d-bola-bfla-y-bloqueo-429)

---

## Tareas Operativas Detalladas

---

### Tarea 01: Registro de Nuevo Vecino con Validación de DNI
* **Objetivo:** Dar de alta un nuevo ciudadano en el sistema mediante el formulario público con validación previa de DNI.
* **Rol Requerido:** Público (sin autenticación).
* **Datos de Prueba:**
  * DNI: `35999888`
  * Nombre: `Esteban`
  * Apellido: `Quito`
  * Fecha de Nacimiento: `14/07/1992` (el campo formatea barras automáticamente)
  * CUIL: `20359998884`
  * Contraseña: `VecinoSeguro2026!`
* **Paso a Paso en la Interfaz (Frontend):**
  1. Abrir el navegador en `http://localhost:8090/registro`.
  2. Completar DNI, Nombre y Apellido.
  3. En Fecha de Nacimiento, ingresar los números continuos `14071992`; la interfaz insertará automáticamente las barras de separación (`14/07/1992`).
  4. Ingresar CUIL y Contraseña.
  5. Presionar el botón **"Registrarse"**.
* **Comando cURL de Prueba Directa:**
  ```bash
  curl -s -X POST http://localhost:8080/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "dni": "35999888",
      "nombre": "Esteban",
      "apellido": "Quito",
      "fechaNacimiento": "1992-07-14",
      "cuil": 20359998884,
      "password": "VecinoSeguro2026!"
    }'
  ```
* **Respuesta Exitosa Esperada:**
  * Código: `201 Created`
  * Cuerpo JSON con `id`, `uuid` asignado y `estado: "ACTIVO"`.
* **Casos de Rechazo:**
  * Reintentar con el mismo DNI/CUIL $\to$ Código `409 Conflict` (`"Ya existe un ciudadano registrado con ese DNI o CUIL"`).

---

### Tarea 02: Inicio de Sesión de Vecino (Portal del Vecino)
* **Objetivo:** Iniciar sesión como vecino titular para acceder a la bandeja de trámites y expedientes propios.
* **Rol Requerido:** Público.
* **Datos de Prueba:**
  * CUIL: `20345678901`
  * Contraseña: `ClaveVecino123!`
* **Paso a Paso en la Interfaz (Frontend):**
  1. Ingresar a `http://localhost:8090/login`.
  2. Seleccionar la solapa o formulario de **"Vecino"**.
  3. Ingresar CUIL y Contraseña. Presionar **"Iniciar Sesión"**.
  4. Se redirige automáticamente al Portal del Vecino (`/vecino`).
* **Comando cURL:**
  ```bash
  curl -i -X POST http://localhost:8080/auth/login \
    -H "Content-Type: application/json" \
    -d '{"cuil": 20345678901, "password": "ClaveVecino123!"}'
  ```
* **Respuesta Exitosa Esperada:**
  * Código: `200 OK`
  * Cabeceras devueltas: `Authorization: Bearer <jwt>`, `X-Refresh-Token: <refresh>`, `X-Token-Expires-In: 900`.
  * Cuerpo con datos del vecino y `rol: "PERSONA"`.

---

### Tarea 03: Inicio de Sesión de Empleado Administrativo
* **Objetivo:** Iniciar sesión con perfil administrativo para acceder al panel de gestión y padrón general.
* **Rol Requerido:** Empleado (`MESA_ENTRADAS`, `ADMINISTRATIVO` o `RESPONSABLE_AREA`).
* **Datos de Prueba:**
  * Email: `mesa.entradas@municipio.gob.ar`
  * Contraseña: `Mesa2026!Entrada`
* **Paso a Paso en la Interfaz (Frontend):**
  1. Ingresar a `http://localhost:8090/login`.
  2. Seleccionar la solapa **"Personal Municipal"**.
  3. Ingresar el correo institucional y la contraseña. Presionar **"Ingresar a Gestión"**.
  4. El sistema redirige al panel de administración (`/admin`).
* **Comando cURL:**
  ```bash
  curl -i -X POST http://localhost:8080/auth/empleados/login \
    -H "Content-Type: application/json" \
    -d '{"email": "mesa.entradas@municipio.gob.ar", "password": "Mesa2026!Entrada"}'
  ```
* **Respuesta Exitosa Esperada:**
  * Código: `200 OK`
  * Retorna JWT en cabecera `Authorization` y `rol: "MESA_ENTRADAS"`.

---

### Tarea 04: Consulta de Perfil Propio y Edición de Datos
* **Objetivo:** Modificar el nombre y datos personales de un ciudadano titular.
* **Rol Requerido:** `PERSONA` (titular ID 1).
* **Datos de Prueba:**
  * Nombre: `Marcos Antonio`
  * Apellido: `Ferreyra`
  * Fecha de Nacimiento: `1990-04-12`
* **Comando cURL:**
  ```bash
  curl -s -X PUT http://localhost:8080/ciudadanos/1 \
    -H "Authorization: Bearer $TOKEN_VECINO" \
    -H "Content-Type: application/json" \
    -d '{
      "nombre": "Marcos Antonio",
      "apellido": "Ferreyra",
      "fechaNacimiento": "1990-04-12"
    }'
  ```
* **Respuesta Exitosa:** `200 OK` con datos actualizados.
* **Casos de Rechazo:** Si el vecino intenta modificar el ciudadano con ID 2 $\to$ `403 Forbidden` (Protección BOLA/IDOR).

---

### Tarea 05: Consulta del Padrón de Ciudadanos y Búsqueda por DNI
* **Objetivo:** Consultar el padrón general de vecinos y buscar un ciudadano específico por DNI.
* **Rol Requerido:** `MESA_ENTRADAS` o superior.
* **Comando cURL:**
  ```bash
  # Consulta padrón general
  curl -s -X GET http://localhost:8080/ciudadanos \
    -H "Authorization: Bearer $TOKEN_EMPLEADO"

  # Búsqueda rápida por DNI (pública)
  curl -s -X GET http://localhost:8080/ciudadanos/dni/34567890
  ```
* **Respuesta Exitosa:** `200 OK` con array en `items: [...]` o datos de existencia `{"existe": true, "id": 1, ...}`.
* **Casos de Rechazo:** Consultar `/ciudadanos` con token de vecino $\to$ `403 Forbidden` (BFLA).

---

### Tarea 06: Alta de Nuevo Domicilio de Ciudadano
* **Objetivo:** Agregar una nueva dirección al legajo del ciudadano titular.
* **Rol Requerido:** `PERSONA` (titular) o `MESA_ENTRADAS`.
* **Datos de Prueba:**
  * Calle: `San Martín`, Número: `870`, Piso: `2`, Depto: `A`, Código Postal: `1004`
* **Comando cURL:**
  ```bash
  curl -s -X POST http://localhost:8080/ciudadanos/1/domicilios \
    -H "Authorization: Bearer $TOKEN_VECINO" \
    -H "Content-Type: application/json" \
    -d '{
      "calle": "San Martín",
      "numero": "870",
      "piso": "2",
      "departamento": "A",
      "codigoPostal": "1004",
      "principal": false
    }'
  ```
* **Respuesta Exitosa:** `201 Created` con `id` asignado al domicilio.

---

### Tarea 07: Designar Domicilio como Principal
* **Objetivo:** Marcar un domicilio existente como el principal del vecino, desmarcando el anterior de forma automática.
* **Rol Requerido:** `PERSONA` (titular) o empleado administrativo.
* **Comando cURL:**
  ```bash
  curl -s -X PATCH http://localhost:8080/domicilios/1/principal \
    -H "Authorization: Bearer $TOKEN_VECINO"
  ```
* **Respuesta Exitosa:** `200 OK` con `principal: true`.
* **Casos de Rechazo:** Domicilio dado de baja $\to$ `409 Conflict`.

---

### Tarea 08: Baja Lógica de Domicilio con Historial de Vigencia
* **Objetivo:** Dar de baja un domicilio manteniendo la vigencia histórica sin eliminar el registro físico.
* **Rol Requerido:** Titular o empleado administrativo.
* **Comando cURL:**
  ```bash
  curl -s -X DELETE http://localhost:8080/domicilios/1 \
    -H "Authorization: Bearer $TOKEN_VECINO"
  ```
* **Respuesta Exitosa:** `200 OK` con campo `vigenteHasta` registrado con la fecha actual.

---

### Tarea 09: Agregar Vía de Contacto (Email o Teléfono)
* **Objetivo:** Incorporar un correo electrónico secundario al legajo del vecino.
* **Rol Requerido:** Titular o empleado con permiso de edición.
* **Datos de Prueba:**
  * Tipo: `EMAIL`, Valor: `marcos.ferreyra@mail.com`
* **Comando cURL:**
  ```bash
  curl -s -X POST http://localhost:8080/ciudadanos/1/contactos \
    -H "Authorization: Bearer $TOKEN_VECINO" \
    -H "Content-Type: application/json" \
    -d '{"tipo": "EMAIL", "valor": "marcos.ferreyra@mail.com"}'
  ```
* **Respuesta Exitosa:** `201 Created` con `verificado: false`.

---

### Tarea 10: Verificación de Contacto mediante Código
* **Objetivo:** Confirmar y marcar como verificado un canal de comunicación.
* **Rol Requerido:** Titular del contacto.
* **Comando cURL:**
  ```bash
  curl -s -X PATCH http://localhost:8080/contactos/1/verificar \
    -H "Authorization: Bearer $TOKEN_VECINO" \
    -H "Content-Type: application/json" \
    -d '{"codigo": "123456"}'
  ```
* **Respuesta Exitosa:** `200 OK` con `verificado: true`.

---

### Tarea 11: Vinculación Familiar y Designación de Responsable Legal
* **Objetivo:** Crear un vínculo de parentesco (Padre-Hijo) y asignar responsabilidad legal.
* **Rol Requerido:** Titular o empleado de mesa de entradas.
* **Comando cURL:**
  ```bash
  curl -s -X POST http://localhost:8080/relaciones \
    -H "Authorization: Bearer $TOKEN_VECINO" \
    -H "Content-Type: application/json" \
    -d '{
      "ciudadanoId1": 1,
      "ciudadanoId2": 2,
      "relacionCiudadano1": "PADRE",
      "relacionCiudadano2": "HIJO",
      "esResponsable": true
    }'
  ```
* **Respuesta Exitosa:** `201 Created` con relación bidireccional registrada.

---

### Tarea 12: Alta de Organización por Vecino (Estado Pendiente)
* **Objetivo:** Registrar una persona jurídica por parte de un vecino (nace en estado PENDIENTE).
* **Rol Requerido:** `PERSONA` autenticada.
* **Datos de Prueba:**
  * CUIT: `30712345678`
  * Razón Social: `Panadería Del Sol S.R.L.`
  * Tipo: `SRL`
* **Comando cURL:**
  ```bash
  curl -s -X POST http://localhost:8080/organizaciones \
    -H "Authorization: Bearer $TOKEN_VECINO" \
    -H "Content-Type: application/json" \
    -d '{
      "cuit": "30712345678",
      "razonSocial": "Panadería Del Sol S.R.L.",
      "nombre": "Panadería Del Sol",
      "tipo": "SRL"
    }'
  ```
* **Respuesta Exitosa:** `201 Created` con `estado: "PENDIENTE"`.

---

### Tarea 13: Aprobación de Organización por Responsable de Área
* **Objetivo:** Revisar y aprobar una organización pendiente cambiando su estado a ACTIVA.
* **Rol Requerido:** `RESPONSABLE_AREA`.
* **Comando cURL:**
  ```bash
  curl -s -X PATCH http://localhost:8080/organizaciones/1/aprobar \
    -H "Authorization: Bearer $TOKEN_RESPONSABLE_AREA"
  ```
* **Respuesta Exitosa:** `200 OK` con `estado: "ACTIVA"`.
* **Casos de Rechazo:** Intentar aprobar una organización que no está pendiente $\to$ `409 Conflict`.

---

### Tarea 14: Incorporación de Socios y Control de Porcentajes
* **Objetivo:** Agregar un nuevo socio a una organización verificando que la suma de porcentajes no supere el 100%.
* **Rol Requerido:** Dueño o administrativo.
* **Comando cURL:**
  ```bash
  curl -s -X POST http://localhost:8080/organizaciones/1/duenos \
    -H "Authorization: Bearer $TOKEN_VECINO" \
    -H "Content-Type: application/json" \
    -d '{"personaId": 2, "porcentaje": 40.00}'
  ```
* **Respuesta Exitosa:** `201 Created` con detalle de socios.
* **Casos de Rechazo:** Enviar un porcentaje que haga que el total sume $> 100\%$ $\to$ `409 Conflict`.

---

### Tarea 15: Otorgamiento de Poder de Representación Legal
* **Objetivo:** Designar a un ciudadano como apoderado legal de una organización.
* **Rol Requerido:** Dueño de la organización o administrativo.
* **Comando cURL:**
  ```bash
  curl -s -X POST http://localhost:8080/representaciones \
    -H "Authorization: Bearer $TOKEN_VECINO" \
    -H "Content-Type: application/json" \
    -d '{
      "personaId": 1,
      "organizacionId": 1,
      "alcance": "ADMINISTRATIVO_GENERAL",
      "desde": "2026-11-01",
      "hasta": "2027-11-01"
    }'
  ```
* **Respuesta Exitosa:** `201 Created` con `estado: "VIGENTE"`.

---

### Tarea 16: Revocación de Poder de Representación Legal
* **Objetivo:** Revocar anticipadamente un poder de representación otorgado.
* **Rol Requerido:** Dueño o administrativo.
* **Comando cURL:**
  ```bash
  curl -s -X PATCH http://localhost:8080/representaciones/1/estado \
    -H "Authorization: Bearer $TOKEN_VECINO" \
    -H "Content-Type: application/json" \
    -d '{"estado": "REVOCADA"}'
  ```
* **Respuesta Exitosa:** `200 OK` con `estado: "REVOCADA"`.
* **Casos de Rechazo:** Intentar reactivar a `VIGENTE` un poder ya revocado $\to$ `409 Conflict`.

---

### Tarea 17: Carga Multipart de Documento Digital con Versionado
* **Objetivo:** Subir un archivo PDF de DNI al legajo del ciudadano titular.
* **Rol Requerido:** Titular del ciudadano o empleado administrativo.
* **Paso a Paso en la Interfaz (Frontend):**
  1. Ingresar al Portal del Vecino y dirigirse a **"Mis Documentos"**.
  2. Presionar **"Subir Documento"**.
  3. Seleccionar Tipo: `DNI_FRENTE` y adjuntar un archivo PDF.
  4. Presionar **"Cargar"**.
* **Comando cURL:**
  ```bash
  curl -s -X POST http://localhost:8080/ciudadanos/1/documentos \
    -H "Authorization: Bearer $TOKEN_VECINO" \
    -F "tipoDocumento=DNI_FRENTE" \
    -F "archivo=@mi_dni.pdf;type=application/pdf"
  ```
* **Respuesta Exitosa:** `201 Created` con `version: 1`, `estado: "PENDIENTE"`.

---

### Tarea 18: Validación de Documento por Empleado Administrativo
* **Objetivo:** Auditar y aprobar un documento cargado por un vecino.
* **Rol Requerido:** `ADMINISTRATIVO` o `RESPONSABLE_AREA`.
* **Comando cURL:**
  ```bash
  curl -s -X PATCH http://localhost:8080/documentos/1/validar \
    -H "Authorization: Bearer $TOKEN_ADMINISTRATIVO" \
    -H "Content-Type: application/json" \
    -d '{
      "aprobado": true,
      "observaciones": "Documento verificado y legible"
    }'
  ```
* **Respuesta Exitosa:** `200 OK` con `validadoPor: "<id_empleado>"`.
* **Casos de Rechazo:** Intentar validar con rol `PERSONA` $\to$ `403 Forbidden` (BFLA).

---

### Tarea 19: Generación de Solicitud de Documentación Faltante
* **Objetivo:** Exigir a un vecino la presentación de un certificado con fecha límite.
* **Rol Requerido:** `MESA_ENTRADAS` o `ADMINISTRATIVO`.
* **Comando cURL:**
  ```bash
  curl -s -X POST http://localhost:8080/solicitudes-documentacion \
    -H "Authorization: Bearer $TOKEN_MESA_ENTRADAS" \
    -H "Content-Type: application/json" \
    -d '{
      "titularId": 1,
      "tipoDocumento": "CERTIFICADO_DOMICILIO",
      "plazo": "2026-12-01",
      "detalle": "Requerido para trámite de habilitación"
    }'
  ```
* **Respuesta Exitosa:** `201 Created` con `estado: "PENDIENTE"`.

---

### Tarea 20: Cumplimiento de Solicitud de Documentación por Vecino
* **Objetivo:** Marcar como cumplida una solicitud pendiente tras la presentación del archivo.
* **Rol Requerido:** Administrativo o sistema.
* **Comando cURL:**
  ```bash
  curl -s -X PATCH http://localhost:8080/solicitudes-documentacion/1/estado \
    -H "Authorization: Bearer $TOKEN_ADMINISTRATIVO" \
    -H "Content-Type: application/json" \
    -d '{"estado": "CUMPLIDA"}'
  ```
* **Respuesta Exitosa:** `200 OK` con `estado: "CUMPLIDA"`.
* **Casos de Rechazo:** Intentar reabrir una solicitud ya cumplida $\to$ `409 Conflict`.

---

### Tarea 21: Inicio de Expediente Digital con Carátula Oficial
* **Objetivo:** Iniciar formalmente un expediente administrativo municipal.
* **Rol Requerido:** `MESA_ENTRADAS`, `ADMINISTRATIVO` o `RESPONSABLE_AREA`.
* **Comando cURL:**
  ```bash
  curl -s -X POST http://localhost:8080/expedientes \
    -H "Authorization: Bearer $TOKEN_MESA_ENTRADAS" \
    -H "Content-Type: application/json" \
    -d '{
      "ciudadanoId": 1,
      "caratula": "Solicitud de Permiso de Edificación",
      "areaIniciadora": "Obras Particulares",
      "numero": "EXP-2026-009941"
    }'
  ```
* **Respuesta Exitosa:** `201 Created` con `estado: "INICIADO"`.
* **Casos de Rechazo:** Reutilizar un número de expediente existente $\to$ `409 Conflict`.

---

### Tarea 22: Transición de Estado de Expediente (Con Validación 409)
* **Objetivo:** Avanzar el estado de un expediente a `EN_TRAMITE` y verificar que una transición inválida arroje 409.
* **Rol Requerido:** `ADMINISTRATIVO` o `RESPONSABLE_AREA`.
* **Comando cURL (Transición Válida):**
  ```bash
  curl -s -X PATCH http://localhost:8080/expedientes/1/estado \
    -H "Authorization: Bearer $TOKEN_ADMINISTRATIVO" \
    -H "Content-Type: application/json" \
    -d '{"estado": "EN_TRAMITE"}'
  ```
  *Respuesta:* `200 OK` con `estadoNuevo: "EN_TRAMITE"`.
* **Comando cURL (Transición Inválida que debe dar 409):**
  Intentar transicionar un expediente en estado `ARCHIVADO` hacia `EN_TRAMITE`:
  ```bash
  curl -i -X PATCH http://localhost:8080/expedientes/2/estado \
    -H "Authorization: Bearer $TOKEN_ADMINISTRATIVO" \
    -H "Content-Type: application/json" \
    -d '{"estado": "EN_TRAMITE"}'
  ```
  *Respuesta:* `409 Conflict` (`"Transicion invalida de ARCHIVADO a EN_TRAMITE"`).

---

### Tarea 23: Incorporación de Actuación Foliada a un Expediente
* **Objetivo:** Agregar una nueva actuación numerada al historial del expediente.
* **Rol Requerido:** `ADMINISTRATIVO`.
* **Comando cURL:**
  ```bash
  curl -s -X POST http://localhost:8080/expedientes/1/actuaciones \
    -H "Authorization: Bearer $TOKEN_ADMINISTRATIVO" \
    -H "Content-Type: application/json" \
    -d '{
      "tipo": "INFORME_TECNICO",
      "descripcion": "Verificación catastral positiva.",
      "moduloOrigen": "obras",
      "adjuntos": "{\"planoId\": \"PL-004\"}"
    }'
  ```
* **Respuesta Exitosa:** `201 Created` con `actuacionId` numerada correlativamente.

---

### Tarea 24: Verificación de Transición de Estado de Ciudadano (Patrón State con 409)
* **Objetivo:** Verificar la regla de que las transiciones inválidas en el ciclo de vida del ciudadano gobernadas por el Patrón State (ADR-001) devuelven estrictamente **HTTP 409 Conflict**.
* **Rol Requerido:** `RESPONSABLE_AREA`.
* **Comando cURL (Transición Válida):**
  ```bash
  curl -s -X PATCH http://localhost:8080/ciudadanos/1/estado \
    -H "Authorization: Bearer $TOKEN_RESPONSABLE_AREA" \
    -H "Content-Type: application/json" \
    -d '{"estado": "INACTIVO"}'
  ```
  *Respuesta:* `200 OK` con `estadoNuevo: "INACTIVO"`.
* **Comando cURL (Transición Inválida de Retorno sobre Fallecido - 409):**
  Intentar reactivar a `ACTIVO` un ciudadano cuyo estado actual es `FALLECIDO`:
  ```bash
  curl -i -X PATCH http://localhost:8080/ciudadanos/99/estado \
    -H "Authorization: Bearer $TOKEN_RESPONSABLE_AREA" \
    -H "Content-Type: application/json" \
    -d '{"estado": "ACTIVO"}'
  ```
  *Respuesta:* `409 Conflict` (`"Transicion invalida de FALLECIDO a ACTIVO. Destinos permitidos: ninguno, FALLECIDO es un estado final"`).

---

### Tarea 25: Auditoría de Seguridad Eje D (BOLA, BFLA y Bloqueo 429)
* **Objetivo:** Validar en vivo las protecciones contra acceso a datos ajenos, escalada de privilegios y ataque de fuerza bruta.
* **Prueba A: BOLA / IDOR (Acceso a Recurso Ajeno):**
  Vecino con ID 1 intenta consultar el perfil del ciudadano con ID 2:
  ```bash
  curl -i -X GET http://localhost:8080/ciudadanos/2 \
    -H "Authorization: Bearer $TOKEN_VECINO_1"
  ```
  *Resultado:* `403 Forbidden` (`"No tiene permiso para acceder a los datos de este ciudadano"`).

* **Prueba B: BFLA (Función Administrativa con Rol de Vecino):**
  Vecino intenta acceder al padrón completo:
  ```bash
  curl -i -X GET http://localhost:8080/ciudadanos \
    -H "Authorization: Bearer $TOKEN_VECINO_1"
  ```
  *Resultado:* `403 Forbidden` (`"Rol sin permiso para esta operacion"`).

* **Prueba C: Rate Limiting / Fuerza Bruta (HTTP 429):**
  Ejecutar 6 intentos seguidos de login fallido desde la terminal:
  ```bash
  for i in {1..6}; do
    curl -i -s -X POST http://localhost:8080/auth/login \
      -H "Content-Type: application/json" \
      -d '{"cuil": 20345678901, "password": "PasswordEquivocado!"}' | grep -E "HTTP/|Retry-After"
  done
  ```
  *Resultado en el 6to intento:*  
  `HTTP/1.1 429 Too Many Requests`  
  `Retry-After: 60`  
  `{"status": 429, "error": "Too Many Requests", "message": "Demasiados intentos fallidos. Intente nuevamente en 60 segundos."}`
