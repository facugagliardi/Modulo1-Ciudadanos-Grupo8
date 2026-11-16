# Plan de Pruebas, Matriz de Trazabilidad e Informe de Ejecución

**Sistema:** Módulo 1 — Ciudadanos, Organizaciones y Expedientes Digitales  
**Proyecto:** Desarrollo de Aplicaciones II — UADE  
**Revisión evaluada:** `f889808` y candidata local para `v2.0-entrega4`
**Fecha de Emisión:** 16 de Noviembre de 2026  
**Responsables:** Equipo de Desarrollo y Aseguramiento de Calidad (Grupo 8)  
**Estado:** Validación en curso. Cierre sujeto a evidencia de la revisión etiquetada.

---

## Tabla de Contenidos

1. [SECCIÓN 1: PLAN DE PRUEBAS (Test Plan)](#sección-1-plan-de-pruebas)
   - 1.1 [Objetivos y Alcance](#11-objetivos-y-alcance)
   - 1.2 [Arquitectura Bajo Prueba y Decisiones Técnicas (ADRs)](#12-arquitectura-bajo-prueba-y-decisiones-técnicas-adrs)
   - 1.3 [Estrategia y Niveles de Prueba](#13-estrategia-y-niveles-de-prueba)
     - Nivel Unitario (Lógica de Dominio y Patrón State)
     - Nivel de Integración y Persistencia (Transactional Outbox)
     - Nivel de Seguridad Integral (Eje D)
     - Nivel de Transiciones de Estado (Regla HTTP 409 Conflict)
     - Nivel End-to-End (E2E) con Playwright
     - Pruebas de Mutación (PITest) y Calidad Estática (SonarQube)
   - 1.4 [Ambientes y Datos de Prueba](#14-ambientes-y-datos-de-prueba)
   - 1.5 [Criterios de Entrada y Salida (Quality Gates)](#15-criterios-de-entrada-y-salida-quality-gates)
   - 1.6 [Herramientas Utilizadas](#16-herramientas-utilizadas)

2. [SECCIÓN 2: MATRIZ DE TRAZABILIDAD (Traceability Matrix)](#sección-2-matriz-de-trazabilidad)
   - 2.1 [Requerimientos Funcionales (RF-01 al RF-37)](#21-requerimientos-funcionales-rf-01-al-rf-37)
   - 2.2 [Requerimientos de Seguridad (Eje D)](#22-requerimientos-de-seguridad-eje-d)
   - 2.3 [Regla Transversal de Estados y Patrón State (HTTP 409 Conflict)](#23-regla-transversal-de-estados-y-patrón-state-http-409-conflict)

3. [SECCIÓN 3: INFORME DE EJECUCIÓN DE PRUEBAS](#sección-3-informe-de-ejecución-de-pruebas)

---

# SECCIÓN 1: PLAN DE PRUEBAS

## 1.1 Objetivos y Alcance

### Objetivos Generales
Verificar y certificar que el sistema **Módulo 1 (Ciudadanos, Organizaciones y Expedientes Digitales)** cumple con la totalidad de las especificaciones funcionales (`RF-01` a `RF-37`), los requisitos de seguridad avanzados del **Eje D** (BOLA, BFLA, JWT inválidos, Mass Assignment, Inyecciones SQL/Path, Rate Limiting 429 con cabecera `Retry-After`, auditoría OWASP ZAP sin alertas High y dependencias libres de CVEs críticas), la correcta implementación de los patrones arquitecturales registrados en los ADRs (ADR-001 Patrón State, ADR-002 Transactional Outbox, ADR-003 Ports & Adapters) y la regla estricta de que **toda transición de estado inválida debe retornar HTTP 409 Conflict**.

### Alcance del Sistema
- **Backend:** Monolito modular Spring Boot 3.5.16 sobre Java 21 LTS con separación de dominios (`persona`, `organizacion`, `domicilio`, `contacto`, `documentacion`, `expediente`, `intermodulo`, `evento`, `security`).
- **Persistencia:** Base de datos relacional PostgreSQL con JPA/Hibernate, bloqueos transaccionales (`pg_advisory_xact_lock`) y tabla `event_outbox`.
- **Mensajería:** RabbitMQ 4.x mediante exchange fanout compartido `muni.inbox` y cola dedicada multiplexada `q.ciudadanos`.
- **Seguridad:** Filtros Spring Security (`JwtAuthenticationFilter`, `RateLimitFilter`), control de acceso por titularidad (`AutorizacionService`) y autorización basada en roles.
- **Frontend:** SPA en React 18, Vite, Tailwind CSS, navegación con React Router y componentes interactivos accesibles.

---

## 1.2 Arquitectura Bajo Prueba y Decisiones Técnicas (ADRs)

El plan de pruebas incorpora la validación explícita de las tres Decisiones de Arquitectura (ADRs) adoptadas en la versión consolidada:

1. **ADR-001 (Patrón State en Ciudadano):**
   - La entidad `Ciudadano` delega su ciclo de vida (`ACTIVO`, `INACTIVO`, `BLOQUEADO`, `FALLECIDO`) a la interfaz polimórfica `CiudadanoState` y sus implementaciones concretas (`ActivoState`, `InactivoState`, `BloqueadoState`, `FallecidoState`).
   - Toda transición fuera de la lista blanca o desde un estado terminal como `FALLECIDO` lanza `ApiException.conflicto(...)` resultando en **HTTP 409 Conflict**.
2. **ADR-002 (Patrón Transactional Outbox en Publicación de Eventos):**
   - Los eventos de negocio se insertan en la tabla `event_outbox` en la misma transacción ACID de PostgreSQL antes de su despacho a RabbitMQ, garantizando atomicidad local e idempotencia con UUID canónicos.
3. **ADR-003 (Patrón Ports & Adapters para Almacenamiento de Archivos):**
   - El almacenamiento de documentación digital se desacopla a través del puerto `AlmacenamientoArchivos` y el adaptador concreto `AlmacenamientoLocal`, sanitizando nombres de archivo y previniendo ataques de Path Traversal.

---

## 1.3 Estrategia y Niveles de Prueba

La verificación del sistema se estructura en una pirámide de pruebas automatizadas:

```
                  / \
                 /E2E\       Playwright (5 recorridos críticos sobre Chromium)
                /-----\
               / Sec & \     Seguridad Eje D (13 tests) + Bruno (55+ peticiones)
              /  APIs   \    Transiciones State 409 en Ciudadano, Org, Exp
             /-----------\
            / Integración \   Spring Boot Test + Postgres + RabbitMQ + Outbox
           /---------------\
          /    Unitarias    \ JUnit 5 + Mockito + CiudadanoStateTest (334 tests)
         /-------------------\
```

### 1. Nivel Unitario (Lógica de Dominio y Patrón State)
- **Framework:** JUnit 5 (Jupiter), AssertJ, Mockito 5.
- **Alcance:**
  - `CiudadanoStateTest`: Valida cada estado concreto (`ActivoState`, `InactivoState`, `BloqueadoState`, `FallecidoState`), sus transiciones permitidas, la terminalidad de `FALLECIDO` y la respuesta 409 ante transiciones al mismo estado o inválidas.
  - 14 servicios core del negocio (`CiudadanoService`, `OrganizacionService`, `ExpedienteService`, `DocumentoService`, `DomicilioService`, `ContactoService`, etc.).
  - Mocks aislados para repositorios e infraestructura externa.

### 2. Nivel de Integración y Persistencia (Transactional Outbox)
- **Framework:** `@SpringBootTest`, Spring Data JPA, `JdbcTemplate`.
- **Alcance:** Integración con PostgreSQL, persistencia en `event_outbox`, consultas nativas, restricciones de unicidad de DNI/CUIT y bloqueos `pg_advisory_xact_lock` en proyectos de obra de M3.

### 3. Nivel de Seguridad Integral (Eje D)
- **Suites:** `EjeDSeguridadTest.java`, `SeguridadHttpTest.java`, `AutorizacionServiceTest.java`.
- **Controles Verificados:**
  1. **BOLA / IDOR:** Acceso a recursos de otros vecinos (perfil, contactos, domicilios, expedientes) $\to$ `403 Forbidden`.
  2. **BFLA:** Ciudadano (`PERSONA`) o Auditor intentando invocar endpoints administrativos $\to$ `403 Forbidden`.
  3. **JWT Inválidos:** Token con firma HMAC alterada, algoritmo modificado o malformado $\to$ `401 Unauthorized`.
  4. **Mass Assignment:** Inyección de campos sensibles (`rol`, `uuid`) en DTOs inmutables $\to$ `400 Bad Request`.
  5. **Inyecciones SQL y Path Traversal:** Sanitización en JPA y bloqueo de secuencias `../` en `AlmacenamientoLocal`.
  6. **Fuerza Bruta (Rate Limiting 429):** Bloqueo en `/auth/login` tras 5 intentos fallidos en 60s con cabecera `Retry-After: 60`.
  7. **OWASP ZAP y Cabeceras:** Cabeceras `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy` y respuestas de error sin stack trace.
  8. **SCA:** Dependencias Maven libres de vulnerabilidades críticas activas.

### 4. Nivel de Transiciones de Estado (Regla HTTP 409 Conflict)
- **Requerimiento:** Toda transición de estado no permitida debe arrojar **HTTP 409 Conflict**.
- **Entidades Auditadas:**
  - `Ciudadano`: Validación mediante patrón State (`ActivoState`, `InactivoState`, `BloqueadoState`, `FallecidoState`). Reintentos sobre el mismo estado o reactivación de fallecido $\to$ 409.
  - `Organizacion`: `PENDIENTE` $\to$ `ACTIVA` $\to$ `INACTIVA`/`BLOQUEADA`. Reintentos de activación sobre organizaciones dadas de baja $\to$ 409.
  - `Expediente`: `INICIADO` $\to$ `EN_TRAMITE` $\to$ `RESUELTO` $\to$ `ARCHIVADO`. Reapertura desde archivado o retrocesos $\to$ 409.
  - `SolicitudDocumentacion`: `PENDIENTE` $\to$ `CUMPLIDA` / `VENCIDA`. Reapertura de solicitud cumplida $\to$ 409.
  - `Representacion`: `VIGENTE` $\to$ `REVOCADA` / `VENCIDA`. Reactivación de poder revocado $\to$ 409.

### 5. Nivel End-to-End (E2E) con Playwright
- **Framework:** Playwright 1.64.1 sobre navegador Chromium contra el entorno Docker Compose real (Frontend React + Nginx, Backend Spring Boot, PostgreSQL, RabbitMQ).
- **5 Recorridos Críticos:** `E2E-01` (Login, validación y restricción a `/admin`), `E2E-02` (Auditor en solo lectura), `E2E-03` (Alta y aprobación de organización), `E2E-04` (Solicitud y carga documental con PDF sintético), `E2E-05` (Alta de expediente con actuación foliada visible en portal del vecino).

### 6. Mutación (PITest) y Calidad Estática (SonarQube)
- **PITest:** Análisis de mutación sobre bytecode (inversión de condicionales, mutación de retornos booleanos/numéricos). Umbral mínimo: $\ge 60\%$.
- **JaCoCo:** Umbrales mínimos en el núcleo de negocio: $\ge 80\%$ líneas y $\ge 70\%$ ramas.
- **SonarQube:** 0 Bugs, 0 Vulnerabilidades abiertas, 0 Blockers, Duplicación de código $\le 3\%$.

---

## 1.4 Ambientes y Datos de Prueba

| Entorno | Infraestructura | Propósito |
|---|---|---|
| **Local Unitario** | JVM 21 LTS local en memoria (`./mvnw test`). | Ejecución de suites unitarias y pruebas del patrón State. |
| **Docker Compose Testing** | Frontend (:8090), Backend (:8080), PostgreSQL (:5432), RabbitMQ (:5672). | Pruebas E2E de Playwright y colecciones Bruno. |
| **CI / CD Pipeline** | GitHub Actions (Ubuntu runner, Java 21, Node.js 22). | Pipeline automatizado de calidad y verificación continua. |

### Perfiles de Prueba Preconfigurados

Compose genera cuentas sintéticas y contraseñas aleatorias para cada entorno. Ver [Testing local](../TESTING_LOCAL.md) para acceder a ellas. Para probar integraciones, usar exclusivamente credenciales de servicio de TEST.

---

## 1.5 Criterios de Entrada y Salida (Quality Gates)

### Criterios de Salida (Exit Criteria)
1. **100% de Pruebas Aprobadas:** 0 fallos y 0 errores en Maven Surefire.
2. **Patrón State:** probar las transiciones permitidas y el rechazo HTTP 409 de las inválidas.
3. **Cobertura JaCoCo de Negocio:** Líneas $\ge 85\%$, ramas $\ge 70\%$. En frontend, mínimo 85% en líneas, ramas, funciones y sentencias.
4. **Resistencia PITest:** Score de mutación $\ge 60\%$.
5. **Seguridad Eje D:** ejecutar los casos automatizados y demostrar los controles pedidos en vivo.
6. **Consistencia de Estados:** 100% de transiciones no contempladas retornan **HTTP 409 Conflict**.
7. **OWASP ZAP:** escaneo baseline y activo autenticado con 0 alertas High. Justificar las Medium.
8. **E2E Playwright:** 5 recorridos críticos completados con éxito.

---

## 1.6 Herramientas Utilizadas

- **Ejecución y Pruebas Unitarias:** JUnit 5, Mockito 5, AssertJ, Spring Boot Test Starter.
- **Cobertura y Mutación:** JaCoCo 0.8.16, PITest Maven Plugin 1.30.1.
- **Análisis Estático:** SonarQube Community 26.10, PMD Plugin.
- **Pruebas E2E:** Playwright 1.64.1 (Chromium headless).
- **Pruebas de API y Contratos:** Bruno CLI 1.38, cURL.
- **Seguridad:** OWASP ZAP, OWASP Dependency-Check.

---

# SECCIÓN 2: MATRIZ DE TRAZABILIDAD (Traceability Matrix)

Los casos y referencias identificados se deben cotejar con las historias del 03/11 y los reportes de la candidata. La columna de estado indica si hay evidencia individual vinculada a la revisión.

## 2.1 Requerimientos Funcionales (RF-01 al RF-37)

| ID | Requerimiento Funcional | Endpoint REST / Operación | Componente Frontend | Clase & Método Backend | Caso JUnit 5 | Caso Bruno / E2E | Estado |
|:---|:---|:---|:---|:---|:---|:---|:---:|
| **RF-01** | Alta de ciudadano (DNI, nombre, CUIL, contacto) | `POST /auth/register` | `Registro.jsx` | `CiudadanoService.registrar()` | `AuthServiceTest.java` | `01_Auth/01_Register_Ciudadano_Success.bru`<br>`E2E-01` | Por cotejar |
| **RF-02** | Alta de organización (CUIT, razón social, tipo) | `POST /organizaciones` | `NuevaOrganizacion.jsx` | `OrganizacionService.crear()` | `OrganizacionServiceTest.java` | `03_Organizaciones/01_Post_Organizacion_Ciudadano_Success.bru`<br>`E2E-03` | Por cotejar |
| **RF-03** | Responsabilizar personas físicas sobre org (dueños) | `POST /organizaciones/{id}/duenos` | `DetalleOrganizacion.jsx` | `OrganizacionService.agregarDueno()` | `OrganizacionReglasTest.java` | `03_Organizaciones/07_Post_Duenos_Success.bru`<br>`E2E-03` | Por cotejar |
| **RF-04** | Modificar datos de ciudadano existente | `PUT /ciudadanos/{id}` | `EditarPerfil.jsx` | `CiudadanoService.actualizar()` | `CiudadanoDirectorioServiceTest.java` | `02_Ciudadanos/05_Put_Ciudadano_Ciudadano_Success.bru` | Por cotejar |
| **RF-05** | Ciclo de vida ciudadano con patrón State (ADR-001) | `PATCH /ciudadanos/{id}/estado` | `FichaVecino.jsx` | `Ciudadano.cambiarEstado()`<br>`CiudadanoState.java` | `CiudadanoStateTest.java`<br>`TransicionesEstadoTest.java` | `02_Ciudadanos/06_Patch_Estado_Empleado_Success.bru` | Por cotejar |
| **RF-06** | Validar unicidad de DNI y CUIT antes de registrar | `GET /ciudadanos/dni/{dni}`<br>`GET /organizaciones/cuit/{cuit}` | `Registro.jsx` | `CiudadanoRepository.findByDni()` | `CiudadanoDirectorioServiceTest.java` | `01_Auth/02_Register_Ciudadano_Conflict_409.bru` | Por cotejar |
| **RF-07** | Búsqueda de ciudadanos por DNI y filtros en padrón | `GET /ciudadanos` | `PadronVecinos.jsx` | `CiudadanoDirectorioService.buscar()` | `CiudadanoDirectorioServiceTest.java` | `02_Ciudadanos/01_Get_Padron_Empleado_Success.bru`<br>`E2E-01` | Por cotejar |
| **RF-08** | Cambio de estado organización (ACTIVA/INACTIVA) | `PATCH /organizaciones/{id}/estado` | `DetalleOrganizacion.jsx` | `OrganizacionService.cambiarEstado()` | `OrganizacionReglasTest.java` | `03_Organizaciones/06_Patch_Organizacion_Estado.bru`<br>`E2E-03` | Por cotejar |
| **RF-09** | Carga de múltiples domicilios por ciudadano | `POST /ciudadanos/{id}/domicilios` | `MisDomicilios.jsx` | `DomicilioService.crear()` | `DomicilioServiceTest.java` | `04_Domicilios/01_Post_Domicilio_Success.bru` | Por cotejar |
| **RF-10** | Establecer domicilio como principal | `PATCH /domicilios/{id}/principal` | `MisDomicilios.jsx` | `DomicilioService.marcarPrincipal()` | `DomicilioServiceTest.java` | `04_Domicilios/05_Patch_Domicilio_Principal.bru` | Por cotejar |
| **RF-11** | Historial de domicilios con vigenciaHasta | `DELETE /domicilios/{id}` | `MisDomicilios.jsx` | `DomicilioService.darDeBaja()` | `DomicilioServiceTest.java` | `04_Domicilios/06_Delete_Domicilio.bru` | Por cotejar |
| **RF-12** | Modificar datos de domicilio principal | `PUT /domicilios/{id}` | `MisDomicilios.jsx` | `DomicilioService.actualizar()` | `DomicilioServiceTest.java` | `04_Domicilios/01_Post_Domicilio_Success.bru` | Por cotejar |
| **RF-13** | Registrar múltiples vías de contacto (email/tel) | `POST /ciudadanos/{id}/contactos` | `MisContactos.jsx` | `ContactoService.crear()` | `ContactoServiceTest.java` | `05_Contactos/01_Post_Contacto_Success.bru` | Por cotejar |
| **RF-14** | Verificación de contacto con código de confirmación | `PATCH /contactos/{id}/verificar` | `MisContactos.jsx` | `ContactoService.verificar()` | `ContactoServiceTest.java` | `05_Contactos/03_Verify_Contacto.bru` | Por cotejar |
| **RF-15** | Modificar o eliminar contacto existente | `PUT /contactos/{id}`<br>`DELETE /contactos/{id}` | `MisContactos.jsx` | `ContactoService.eliminar()` | `ContactoServiceTest.java` | `05_Contactos/04_Delete_Contacto.bru` | Por cotejar |
| **RF-16** | Vincular ciudadanos en relaciones familiares | `POST /relaciones` | `MiFamilia.jsx` | `RelacionService.crear()` | `RelacionServiceTest.java` | `06_Relaciones/01_Post_Relacion_Success.bru` | Por cotejar |
| **RF-17** | Definir tipos recíprocos de parentesco | `PUT /relaciones/{id}` | `MiFamilia.jsx` | `RelacionService.actualizar()` | `RelacionServiceTest.java` | `06_Relaciones/01_Post_Relacion_Success.bru` | Por cotejar |
| **RF-18** | Asignar tutor / responsable legal sobre menor | `PATCH /relaciones/{id}/responsable` | `MiFamilia.jsx` | `RelacionService.cambiarResponsable()` | `RelacionServiceTest.java` | `06_Relaciones/04_Patch_Relacion_Responsable.bru` | Por cotejar |
| **RF-19** | Gestión de dueños y participaciones societarias | `POST /organizaciones/{id}/duenos` | `DetalleOrganizacion.jsx` | `OrganizacionService.agregarDueno()` | `OrganizacionReglasTest.java` | `03_Organizaciones/08_Delete_Duenos_Success.bru`<br>`E2E-03` | Por cotejar |
| **RF-20** | Otorgar poder de representación con alcance | `POST /representaciones` | `NuevaRepresentacion.jsx` | `RepresentacionService.crear()` | `RepresentacionReglasTest.java` | `07_Representaciones/01_Post_Representacion_Success.bru` | Por cotejar |
| **RF-21** | Revocación o vencimiento de representación | `PATCH /representaciones/{id}/estado` | `DetalleRepresentacion.jsx` | `RepresentacionService.cambiarEstado()` | `RepresentacionReglasTest.java` | `07_Representaciones/04_Patch_Representacion_Estado.bru` | Por cotejar |
| **RF-22** | Validación intermódulo de vigencia de poder | `GET /representaciones/vigencia` | `DetalleOrganizacion.jsx` | `RepresentacionService.consultarVigencia()` | `RepresentacionReglasTest.java` | `07_Representaciones/05_Get_Representacion_Vigencia.bru` | Por cotejar |
| **RF-23** | Carga de documentación vía puerto hexagonal (ADR-003) | `POST /ciudadanos/{id}/documentos` | `MisDocumentos.jsx` | `DocumentoService.cargar()`<br>`AlmacenamientoLocal.java` | `DocumentoServiceTest.java`<br>`AlmacenamientoLocalTest.java` | `08_Documentacion/01_Get_Documentos_Persona.bru`<br>`E2E-04` | Por cotejar |
| **RF-24** | Versionado correlativo de documentos | `POST /documentos/{id}/version` | `MisDocumentos.jsx` | `DocumentoService.nuevaVersion()` | `DocumentoServiceTest.java` | `08_Documentacion/02_Get_Documento_By_Id.bru` | Por cotejar |
| **RF-25** | Definir vigenciaHasta en documentos | `PUT /documentos/{id}/vigencia` | `DetalleDocumento.jsx` | `DocumentoService.actualizarVigencia()` | `DocumentoServiceTest.java` | `08_Documentacion/02_Get_Documento_By_Id.bru` | Por cotejar |
| **RF-26** | Trazabilidad de cargadoPor y validadoPor | `PATCH /documentos/{id}/validar` | `BandejaValidacionDoc.jsx` | `DocumentoService.validar()` | `DocumentoServiceTest.java` | `08_Documentacion/03_Patch_Validar_Documento_Success.bru`<br>`E2E-04` | Por cotejar |
| **RF-27** | Crear solicitud de documentación faltante | `POST /solicitudes-documentacion` | `NuevaSolicitudDoc.jsx` | `SolicitudDocumentacionService.crear()` | `SolicitudDocumentacionServiceTest.java` | `08_Documentacion/05_Post_Solicitud.bru`<br>`E2E-04` | Por cotejar |
| **RF-28** | Transición de estado de solicitud (PENDIENTE/CUMPLIDA) | `PATCH /solicitudes-documentacion/{id}/estado` | `MisSolicitudes.jsx` | `SolicitudDocumentacionService.cambiarEstado()` | `SolicitudDocumentacionServiceTest.java` | `08_Documentacion/07_Patch_Solicitud_Estado.bru`<br>`E2E-04` | Por cotejar |
| **RF-29** | Origen de solicitud (Interno o por evento M8) | Inbound AMQP: `socialDocumentationRequested` | `EventConsumerService.java` | `SolicitudDocumentacionService.java` | `SolicitudDocumentacionServiceTest.java` | `EventConsumerServiceTest.java` | Por cotejar |
| **RF-30** | Inicio de expediente digital con número único | `POST /expedientes` | `NuevoExpediente.jsx` | `ExpedienteService.crear()` | `ExpedienteServiceTest.java` | `09_Expedientes/01_Post_Expediente.bru`<br>`E2E-05` | Por cotejar |
| **RF-31** | Vinculación de expediente a ciudadano titular | `GET /expedientes/persona/{id}` | `MisExpedientes.jsx` | `ExpedienteService.obtenerPorTitular()` | `ExpedienteServiceTest.java` | `09_Expedientes/02_Get_Expedientes_Ciudadano.bru`<br>`E2E-05` | Por cotejar |
| **RF-32** | Transición de estado expediente con regla 409 | `PATCH /expedientes/{id}/estado` | `DetalleExpediente.jsx` | `ExpedienteService.cambiarEstado()` | `TransicionesEstadoTest.java` | `09_Expedientes/05_Patch_Expediente_Estado.bru` | Por cotejar |
| **RF-33** | Registro correlativo de actuaciones | `POST /expedientes/{id}/actuaciones` | `DetalleExpediente.jsx` | `ExpedienteService.agregarActuacion()` | `ExpedienteServiceTest.java` | `09_Expedientes/01_Post_Expediente.bru`<br>`E2E-05` | Por cotejar |
| **RF-34** | Adjuntar archivos y referencias en actuaciones | `POST /expedientes/{id}/actuaciones` | `DetalleExpediente.jsx` | `ExpedienteService.agregarActuacion()` | `ExpedienteServiceTest.java` | `09_Expedientes/01_Post_Expediente.bru`<br>`E2E-05` | Por cotejar |
| **RF-35** | Consulta de historial foliado de actuaciones | `GET /expedientes/{id}/actuaciones` | `DetalleExpediente.jsx` | `ExpedienteService.listarActuaciones()` | `ExpedienteServiceTest.java` | `09_Expedientes/04_Get_Actuaciones.bru`<br>`E2E-05` | Por cotejar |
| **RF-36** | Login seguro de ciudadano (CUIL + hash BCrypt) | `POST /auth/login` | `Login.jsx` | `AuthService.login()` | `AuthServiceTest.java` | `01_Auth/05_Login_Ciudadano_Success.bru`<br>`E2E-01` | Por cotejar |
| **RF-37** | Registro de nuevos usuarios con emisión de tokens | `POST /auth/register` | `Registro.jsx` | `AuthService.registrar()` | `AuthServiceTest.java` | `01_Auth/01_Register_Ciudadano_Success.bru`<br>`E2E-01` | Por cotejar |

---

## 2.2 Requerimientos de Seguridad (Eje D)

| ID | Control de Seguridad (Eje D) | Vector / Amenaza Mitigada | Componente / Filtro | Caso de Prueba JUnit | Caso Bruno Automatizado | Código Esperado | Estado |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **EJE-D-01** | **BOLA / IDOR:** Consulta perfil ajeno | Acceso a datos de otro vecino con JWT no titular | `AutorizacionService.java` | `EjeDSeguridadTest.deberiaDenegarAccesoARecursoAjeno_BOLA_IDOR()` | `11_Seguridad_EjeD/01_BOLA_IDOR_Acceso_Ciudadano_Ajeno_403.bru` | `403 Forbidden` | Por cotejar |
| **EJE-D-02** | **BOLA / IDOR:** Modificación contacto ajeno | Alteración de teléfono/email de otro usuario | `AutorizacionService.java` | `EjeDSeguridadTest.deberiaDenegarModificacionContactoAjeno_BOLA()` | `11_Seguridad_EjeD/02_BOLA_IDOR_Contacto_Ajeno_403.bru` | `403 Forbidden` | Por cotejar |
| **EJE-D-03** | **BOLA / IDOR:** Consulta domicilio ajeno | Visualización de propiedades privadas de terceros | `AutorizacionService.java` | `EjeDSeguridadTest.deberiaDenegarAccesoADomicilioAjeno_BOLA()` | `11_Seguridad_EjeD/03_BOLA_IDOR_Domicilio_Ajeno_403.bru` | `403 Forbidden` | Por cotejar |
| **EJE-D-04** | **BOLA / IDOR:** Consulta expediente ajeno | Lectura no autorizada de carátula y actuaciones | `AutorizacionService.java` | `EjeDSeguridadTest.deberiaDenegarAccesoAExpedienteAjeno_BOLA()` | `11_Seguridad_EjeD/04_BOLA_IDOR_Expediente_Ajeno_403.bru` | `403 Forbidden` | Por cotejar |
| **EJE-D-05** | **BFLA:** Ciudadano consulta padrón general | Escalada a funciones de gestión pública | `SecurityConfig.java` | `EjeDSeguridadTest.deberiaDenegarAccesoAFuncionAdministrativa_BFLA()` | `11_Seguridad_EjeD/05_BFLA_Ciudadano_Intenta_Listar_Padron_403.bru` | `403 Forbidden` | Por cotejar |
| **EJE-D-06** | **BFLA:** Ciudadano cambia estado expediente | Forzado de transición sin rol administrativo | `SecurityConfig.java` | `EjeDSeguridadTest.deberiaDenegarCambioEstadoExpediente_BFLA()` | `11_Seguridad_EjeD/06_BFLA_Ciudadano_Intenta_Cambiar_Estado_Expediente_403.bru` | `403 Forbidden` | Por cotejar |
| **EJE-D-07** | **BFLA:** Ciudadano valida documentación | Aprobación de documentos sin atribución | `SecurityConfig.java` | `EjeDSeguridadTest.deberiaDenegarValidacionDocumento_BFLA()` | `11_Seguridad_EjeD/07_BFLA_Ciudadano_Intenta_Validar_Documento_403.bru` | `403 Forbidden` | Por cotejar |
| **EJE-D-08** | **JWT:** Firma criptográfica adulterada | Token HMAC manipulado con clave ajena | `JwtAuthenticationFilter.java` | `EjeDSeguridadTest.deberiaRechazarJwtConFirmaInvalida()` | `11_Seguridad_EjeD/08_JWT_Firma_Adulterada_401.bru` | `401 Unauthorized` | Por cotejar |
| **EJE-D-09** | **JWT:** Token malformado o nulo | Cadena corrupta en header `Authorization` | `JwtAuthenticationFilter.java` | `EjeDSeguridadTest.deberiaRechazarJwtMalformado()` | `11_Seguridad_EjeD/09_JWT_Malformado_401.bru` | `401 Unauthorized` | Por cotejar |
| **EJE-D-10** | **Mass Assignment:** Propiedad no permitida | Inyección de campos como `"rol": "ADMINISTRATIVO"` | `GlobalExceptionHandler.java` | `EjeDSeguridadTest.deberiaRechazarMassAssignment_CamposSensibles()` | `11_Seguridad_EjeD/10_Mass_Assignment_Propiedad_No_Permitida_400.bru` | `400 Bad Request` | Por cotejar |
| **EJE-D-11** | **Inyección SQL:** Parámetros de consulta | Búsqueda maliciosa `' OR 1=1 --` | Spring Data JPA / `PreparedStatement` | `EjeDSeguridadTest.deberiaSanitizarInyeccionSqlEnParametros()` | `11_Seguridad_EjeD/11_Inyeccion_SQL_En_Parametros_Safe.bru` | `200 OK` (0 resultados) | Por cotejar |
| **EJE-D-12** | **Fuerza Bruta:** Rate Limiting en Login | Ataque automatizado por fuerza bruta | `RateLimitFilter.java` (5 req / 60s) | `EjeDSeguridadTest.deberiaBloquearPorFuerzaBruta_RateLimiting_429()` | `11_Seguridad_EjeD/12_Fuerza_Bruta_Bloqueo_429.bru` | `429 Too Many Requests`<br>`Retry-After: 60` | Por cotejar |
| **EJE-D-13** | **Cabeceras y respuestas de error** | Clickjacking, MIME sniffing, errores sin stack trace | `SecurityConfig.java`<br>`GlobalExceptionHandler` | `EjeDSeguridadTest.deberiaRetornarCabecerasDeSeguridad()` | `11_Seguridad_EjeD/13_Cabeceras_Seguridad_OWASP_ZAP.bru` | Cabeceras presentes | Por cotejar |

---

## 2.3 Regla Transversal de Estados y Patrón State (HTTP 409 Conflict)

| Entidad | Estado Actual | Estado Solicitado | Clasificación / Causa | Excepción / Mecanismo | Código HTTP | Caso JUnit 5 | Estado |
|---|---|---|---|---|:---:|---|:---:|
| `Ciudadano` | `FALLECIDO` | `ACTIVO` | Estado terminal irreversible (ADR-001) | `FallecidoState.cambiarEstado()` | **409 Conflict** | `CiudadanoStateTest.fallecidoStateEsTerminal()`<br>`TransicionesEstadoTest.unFallecidoNoVuelveAEstarActivo()` | Por cotejar |
| `Ciudadano` | `ACTIVO` | `ACTIVO` | Transición redundante al mismo estado | `AbstractCiudadanoState.cambiarEstado()` | **409 Conflict** | `CiudadanoStateTest.activoStateRechazaMismoEstado()`<br>`TransicionesEstadoTest.pasarAlMismoEstadoNoEsUnaTransicion()` | Por cotejar |
| `Expediente` | `ARCHIVADO` | `EN_TRAMITE` | Transición no admitida desde archivado | `TransicionesEstado.exigirExpediente()` | **409 Conflict** | `TransicionesEstadoTest.expedienteArchivadoNoAdmiteReapertura()` | Por cotejar |
| `Expediente` | `RESUELTO` | `INICIADO` | Retroceso inválido en ciclo de expediente | `TransicionesEstado.exigirExpediente()` | **409 Conflict** | `TransicionesEstadoTest.expedienteResueltoNoVuelveAIniciado()` | Por cotejar |
| `Organizacion` | `INACTIVA` | `INACTIVA` | Transición redundante | `TransicionesEstado.exigirOrganizacion()` | **409 Conflict** | `OrganizacionReglasTest.testCambioEstadoOrganizacion()` | Por cotejar |
| `SolicitudDoc` | `CUMPLIDA` | `PENDIENTE` | Estado cumplido terminal | `TransicionesEstado.exigirSolicitud()` | **409 Conflict** | `SolicitudDocumentacionServiceTest.testReaperturaInvalida()` | Por cotejar |
| `Representacion`| `REVOCADA` | `VIGENTE` | Reactivación de poder revocado prohibida | `TransicionesEstado.exigirRepresentacion()` | **409 Conflict** | `RepresentacionReglasTest.testReactivarPoderRevocado()` | Por cotejar |

---

# SECCIÓN 3: INFORME DE EJECUCIÓN DE PRUEBAS

## 3.1 Revisión publicada

El [run Testing G3 de `f889808`](https://github.com/facugagliardi/Modulo1-Ciudadanos-Grupo8/actions/runs/43913182033) falló en Java, React y Compose. El escaneo de secretos pasó en ese run.

| Etapa | Resultado de la revisión publicada | Causa observada |
| --- | --- | --- |
| Java | 334 tests, 14 errores | Spring detectó un controlador de test duplicado al levantar los contextos de contrato M3 y M8. |
| React | 84,68% de ramas | El gate exige 85%. |
| Compose | Cinco E2E pasaron. Falló SCA. | Trivy informó 19 alertas altas en `krb5-libs` y `libxslt` de la imagen PostgreSQL. |

## 3.2 Validación de la candidata local

| Control | Resultado local |
| --- | --- |
| Java 21, PostgreSQL y RabbitMQ | `mvnw verify` aprobó. 335 pruebas, 0 fallos, 0 errores y 0 omitidas. PMD aprobado. |
| JaCoCo | Negocio: 87,72% de líneas y 79,04% de ramas en las 16 clases seleccionadas por el gate. Global: 80,17% de líneas y 67,29% de ramas. |
| PIT | 658 de 879 mutantes detectados, 75% según PIT. Mínimo del gate: 60%. |
| React con Node 22 en Linux | 539 pruebas aprobadas. Cobertura: 92,48% líneas, 85,12% ramas, 89,09% funciones y 91,46% sentencias. Lint y build aprobados. |
| Compose | 99,5 s hasta servicios sanos con volúmenes nuevos y caché local de imágenes, antes de actualizar la última capa de Nginx. Se verificaron 11 respuestas HTTP, consumidor RabbitMQ y persistencia después de recrear contenedores. |
| E2E | Cinco recorridos aprobados en Chromium tras reconstruir la imagen frontend: ingreso, auditoría, organización, documentación y expediente. |
| State por HTTP | En un ciudadano sintético: `ACTIVO → ACTIVO` 409, `ACTIVO → FALLECIDO` 200, `FALLECIDO → ACTIVO` 409. |
| SCA | npm audit sin altas ni críticas en frontend. Trivy sin alertas altas o críticas sin tratamiento en las siete imágenes y en el inventario Java con dependencias de tests. Se conservaron las dos revisiones de aplicabilidad de Spring en los reportes. |
| Secretos | Gitleaks sin hallazgos en los archivos de la candidata y en las referencias locales del repositorio original. |

Los reportes que se adjunten a la entrega deben identificar el SHA del tag.

## 3.3 Defectos abiertos y evidencia pendiente

- `POST /auth/register` permite crear una cuenta activa sin exigir una verificación de DNI asociada. El formulario usa `POST /auth/verificar-dni` antes de llamar al alta. Con datos de prueba respondió HTTP 201 y el ingreso posterior respondió HTTP 200. Registrar el defecto en Jira y vincularlo a la revisión.
- Completar la matriz con los resultados por historia y sus evidencias. Cotejar los casos de API y contrato con el OpenAPI de la candidata.
- Adjuntar el Quality Gate de Sonar, el reporte ZAP baseline y activo autenticado, las corridas de estabilidad y la evidencia de las pruebas de seguridad en vivo.
- Medir el arranque en una máquina limpia. Adjuntar el ensayo de caída y recuperación del broker y el reporte de carga con 50 usuarios durante 5 minutos sobre tres endpoints críticos.
- Verificar `Idempotency-Key`, `ETag` / `If-Match`, respuestas Problem Details y la cobertura de integración requerida por la cátedra.
- Probar el flujo IA con datos sintéticos y acreditar inyección directa e indirecta, pedidos fuera de dominio, fuga entre usuarios y proveedor caído o lento. Confirmar el gateway exigido.
- Adjuntar el CI del tag `v2.0-entrega4`. El historial de GitHub, Jira, Teams y la demo en vivo requieren revisión del equipo antes de cerrar la entrega.
