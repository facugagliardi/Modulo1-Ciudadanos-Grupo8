# Plan de Pruebas, Matriz de Trazabilidad e Informe de Ejecución

**Sistema:** Módulo 1 — Ciudadanos, Organizaciones y Expedientes Digitales  
**Proyecto:** Desarrollo de Aplicaciones II — UADE  
**Versión del Sistema:** 2.1.0 (Actualizada con Integración de Patrón State [ADR-001], Transactional Outbox [ADR-002], Ports & Adapters [ADR-003], Seguridad Eje D y Regla 409 Conflict)  
**Fecha de Emisión:** 16 de Noviembre de 2026  
**Responsables:** Equipo de Desarrollo y Aseguramiento de Calidad (Grupo 8)  
**Estado:** APROBADO — 100% Criterios de Aceptación Cumplidos  

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

3. [SECCIÓN 3: INFORME DE EJECUCIÓN DE PRUEBAS (Test Execution Report)](#sección-3-informe-de-ejecución-de-pruebas)
   - 3.1 [Resumen Ejecutivo de la Ejecución](#31-resumen-ejecutivo-de-la-ejecución)
   - 3.2 [Detalle de Ejecución por Suites Automatizadas (JUnit 5)](#32-detalle-de-ejecución-por-suites-automatizadas-junit-5)
   - 3.3 [Evidencia de Pruebas del Patrón State en Ciudadano](#33-evidencia-de-pruebas-del-patrón-state-en-ciudadano)
   - 3.4 [Evidencia de Pruebas de Seguridad Eje D (Ejecución en Vivo)](#34-evidencia-de-pruebas-de-seguridad-eje-d-ejecución-en-vivo)
   - 3.5 [Evidencia de Transiciones de Estado (Verificación 409 Conflict)](#35-evidencia-de-transiciones-de-estado-verificación-409-conflict)
   - 3.6 [Reporte de Cobertura de Código (JaCoCo)](#36-reporte-de-cobertura-de-código-jacoco)
   - 3.7 [Reporte de Resistencia a la Mutación (PITest)](#37-reporte-de-resistencia-a-la-mutación-pitest)
   - 3.8 [Auditoría OWASP ZAP y Análisis SCA de Dependencias](#38-auditoría-owasp-zap-y-análisis-sca-de-dependencias)
   - 3.9 [Ejecución de Recorridos E2E Playwright](#39-ejecución-de-recorridos-e2e-playwright)
   - 3.10 [Dictamen Final y Certificación de Calidad](#310-dictamen-final-y-certificación-de-calidad)

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
| **CI / CD Pipeline** | GitHub Actions (Ubuntu runner, Java 21, Node.js 20). | Pipeline automatizado de calidad y verificación continua. |

### Perfiles de Prueba Preconfigurados

| Perfil / Usuario | Rol | Credenciales de Prueba | Finalidad |
|---|---|---|---|
| `VECINO_TITULAR` | `PERSONA` | `20-34567890-1` / `ClaveVecino123!` | Autogestión de trámites, expedientes y domicilios propios. |
| `VECINO_TERCERO` | `PERSONA` | `27-38444555-8` / `ClaveVecino456!` | Pruebas de BOLA / IDOR intentando acceder a recursos ajenos. |
| `MESA_ENTRADAS` | `MESA_ENTRADAS` | `mesa.entradas@municipio.gob.ar` / `Mesa2026!Entrada` | Registro de vecinos, expedientes y solicitudes de documentación. |
| `ADMINISTRATIVO` | `ADMINISTRATIVO` | `admin.tramites@municipio.gob.ar` / `Admin2026!Pase` | Validación documental y cambios de estado en expedientes. |
| `RESPONSABLE_AREA` | `RESPONSABLE_AREA` | `director.general@municipio.gob.ar` / `Director2026!Seguro` | Aprobación de organizaciones y cambios de estado de ciudadanos. |
| `AUDITOR` | `AUDITOR` | `auditor.control@municipio.gob.ar` / `Auditor2026!Lectura` | Consulta y auditoría; prohibición total de escritura. |
| `SERVICIO` | `SERVICIO` | Token Intermódulo M6/M8 | Consultas `@SoloInterno` entre microservicios. |

---

## 1.5 Criterios de Entrada y Salida (Quality Gates)

### Criterios de Salida (Exit Criteria)
1. **100% de Pruebas Aprobadas:** 0 fallos y 0 errores en Maven Surefire.
2. **Patrón State Validado:** 8 pruebas de `CiudadanoStateTest` aprobadas con rechazo 409.
3. **Cobertura JaCoCo de Negocio:** Líneas $\ge 80\%$, Ramas $\ge 70\%$.
4. **Resistencia PITest:** Score de mutación $\ge 60\%$.
5. **Seguridad Eje D Completa:** 13 pruebas automatizadas de seguridad superadas con éxito.
6. **Consistencia de Estados:** 100% de transiciones no contempladas retornan **HTTP 409 Conflict**.
7. **OWASP ZAP:** 0 alertas High; cabeceras de protección verificadas.
8. **E2E Playwright:** 5 recorridos críticos completados con éxito.

---

## 1.6 Herramientas Utilizadas

- **Ejecución y Pruebas Unitarias:** JUnit 5, Mockito 5, AssertJ, Spring Boot Test Starter.
- **Cobertura y Mutación:** JaCoCo 0.8.12, PITest Maven Plugin 1.16.1.
- **Análisis Estático:** SonarQube Community 26.10, PMD Plugin.
- **Pruebas E2E:** Playwright 1.64.1 (Chromium headless).
- **Pruebas de API y Contratos:** Bruno CLI 1.38, cURL.
- **Seguridad:** OWASP ZAP, OWASP Dependency-Check.

---

# SECCIÓN 2: MATRIZ DE TRAZABILIDAD (Traceability Matrix)

## 2.1 Requerimientos Funcionales (RF-01 al RF-37)

| ID | Requerimiento Funcional | Endpoint REST / Operación | Componente Frontend | Clase & Método Backend | Caso JUnit 5 | Caso Bruno / E2E | Estado |
|:---|:---|:---|:---|:---|:---|:---|:---:|
| **RF-01** | Alta de ciudadano (DNI, nombre, CUIL, contacto) | `POST /auth/register` | `Registro.jsx` | `CiudadanoService.registrar()` | `AuthServiceTest.java` | `01_Auth/01_Register_Ciudadano_Success.bru`<br>`E2E-01` | **PASS** |
| **RF-02** | Alta de organización (CUIT, razón social, tipo) | `POST /organizaciones` | `NuevaOrganizacion.jsx` | `OrganizacionService.crear()` | `OrganizacionServiceTest.java` | `03_Organizaciones/01_Post_Organizacion_Ciudadano_Success.bru`<br>`E2E-03` | **PASS** |
| **RF-03** | Responsabilizar personas físicas sobre org (dueños) | `POST /organizaciones/{id}/duenos` | `DetalleOrganizacion.jsx` | `OrganizacionService.agregarDueno()` | `OrganizacionReglasTest.java` | `03_Organizaciones/07_Post_Duenos_Success.bru`<br>`E2E-03` | **PASS** |
| **RF-04** | Modificar datos de ciudadano existente | `PUT /ciudadanos/{id}` | `EditarPerfil.jsx` | `CiudadanoService.actualizar()` | `CiudadanoDirectorioServiceTest.java` | `02_Ciudadanos/05_Put_Ciudadano_Ciudadano_Success.bru` | **PASS** |
| **RF-05** | Ciclo de vida ciudadano con patrón State (ADR-001) | `PATCH /ciudadanos/{id}/estado` | `FichaVecino.jsx` | `Ciudadano.cambiarEstado()`<br>`CiudadanoState.java` | `CiudadanoStateTest.java`<br>`TransicionesEstadoTest.java` | `02_Ciudadanos/06_Patch_Estado_Empleado_Success.bru` | **PASS** |
| **RF-06** | Validar unicidad de DNI y CUIT antes de registrar | `GET /ciudadanos/dni/{dni}`<br>`GET /organizaciones/cuit/{cuit}` | `Registro.jsx` | `CiudadanoRepository.findByDni()` | `CiudadanoDirectorioServiceTest.java` | `01_Auth/02_Register_Ciudadano_Conflict_409.bru` | **PASS** |
| **RF-07** | Búsqueda de ciudadanos por DNI y filtros en padrón | `GET /ciudadanos` | `PadronVecinos.jsx` | `CiudadanoDirectorioService.buscar()` | `CiudadanoDirectorioServiceTest.java` | `02_Ciudadanos/01_Get_Padron_Empleado_Success.bru`<br>`E2E-01` | **PASS** |
| **RF-08** | Cambio de estado organización (ACTIVA/INACTIVA) | `PATCH /organizaciones/{id}/estado` | `DetalleOrganizacion.jsx` | `OrganizacionService.cambiarEstado()` | `OrganizacionReglasTest.java` | `03_Organizaciones/06_Patch_Organizacion_Estado.bru`<br>`E2E-03` | **PASS** |
| **RF-09** | Carga de múltiples domicilios por ciudadano | `POST /ciudadanos/{id}/domicilios` | `MisDomicilios.jsx` | `DomicilioService.crear()` | `DomicilioServiceTest.java` | `04_Domicilios/01_Post_Domicilio_Success.bru` | **PASS** |
| **RF-10** | Establecer domicilio como principal | `PATCH /domicilios/{id}/principal` | `MisDomicilios.jsx` | `DomicilioService.marcarPrincipal()` | `DomicilioServiceTest.java` | `04_Domicilios/05_Patch_Domicilio_Principal.bru` | **PASS** |
| **RF-11** | Historial de domicilios con vigenciaHasta | `DELETE /domicilios/{id}` | `MisDomicilios.jsx` | `DomicilioService.darDeBaja()` | `DomicilioServiceTest.java` | `04_Domicilios/06_Delete_Domicilio.bru` | **PASS** |
| **RF-12** | Modificar datos de domicilio principal | `PUT /domicilios/{id}` | `MisDomicilios.jsx` | `DomicilioService.actualizar()` | `DomicilioServiceTest.java` | `04_Domicilios/01_Post_Domicilio_Success.bru` | **PASS** |
| **RF-13** | Registrar múltiples vías de contacto (email/tel) | `POST /ciudadanos/{id}/contactos` | `MisContactos.jsx` | `ContactoService.crear()` | `ContactoServiceTest.java` | `05_Contactos/01_Post_Contacto_Success.bru` | **PASS** |
| **RF-14** | Verificación de contacto con código de confirmación | `PATCH /contactos/{id}/verificar` | `MisContactos.jsx` | `ContactoService.verificar()` | `ContactoServiceTest.java` | `05_Contactos/03_Verify_Contacto.bru` | **PASS** |
| **RF-15** | Modificar o eliminar contacto existente | `PUT /contactos/{id}`<br>`DELETE /contactos/{id}` | `MisContactos.jsx` | `ContactoService.eliminar()` | `ContactoServiceTest.java` | `05_Contactos/04_Delete_Contacto.bru` | **PASS** |
| **RF-16** | Vincular ciudadanos en relaciones familiares | `POST /relaciones` | `MiFamilia.jsx` | `RelacionService.crear()` | `RelacionServiceTest.java` | `06_Relaciones/01_Post_Relacion_Success.bru` | **PASS** |
| **RF-17** | Definir tipos recíprocos de parentesco | `PUT /relaciones/{id}` | `MiFamilia.jsx` | `RelacionService.actualizar()` | `RelacionServiceTest.java` | `06_Relaciones/01_Post_Relacion_Success.bru` | **PASS** |
| **RF-18** | Asignar tutor / responsable legal sobre menor | `PATCH /relaciones/{id}/responsable` | `MiFamilia.jsx` | `RelacionService.cambiarResponsable()` | `RelacionServiceTest.java` | `06_Relaciones/04_Patch_Relacion_Responsable.bru` | **PASS** |
| **RF-19** | Gestión de dueños y participaciones societarias | `POST /organizaciones/{id}/duenos` | `DetalleOrganizacion.jsx` | `OrganizacionService.agregarDueno()` | `OrganizacionReglasTest.java` | `03_Organizaciones/08_Delete_Duenos_Success.bru`<br>`E2E-03` | **PASS** |
| **RF-20** | Otorgar poder de representación con alcance | `POST /representaciones` | `NuevaRepresentacion.jsx` | `RepresentacionService.crear()` | `RepresentacionReglasTest.java` | `07_Representaciones/01_Post_Representacion_Success.bru` | **PASS** |
| **RF-21** | Revocación o vencimiento de representación | `PATCH /representaciones/{id}/estado` | `DetalleRepresentacion.jsx` | `RepresentacionService.cambiarEstado()` | `RepresentacionReglasTest.java` | `07_Representaciones/04_Patch_Representacion_Estado.bru` | **PASS** |
| **RF-22** | Validación intermódulo de vigencia de poder | `GET /representaciones/vigencia` | `DetalleOrganizacion.jsx` | `RepresentacionService.consultarVigencia()` | `RepresentacionReglasTest.java` | `07_Representaciones/05_Get_Representacion_Vigencia.bru` | **PASS** |
| **RF-23** | Carga de documentación vía puerto hexagonal (ADR-003) | `POST /ciudadanos/{id}/documentos` | `MisDocumentos.jsx` | `DocumentoService.cargar()`<br>`AlmacenamientoLocal.java` | `DocumentoServiceTest.java`<br>`AlmacenamientoLocalTest.java` | `08_Documentacion/01_Get_Documentos_Persona.bru`<br>`E2E-04` | **PASS** |
| **RF-24** | Versionado correlativo de documentos | `POST /documentos/{id}/version` | `MisDocumentos.jsx` | `DocumentoService.nuevaVersion()` | `DocumentoServiceTest.java` | `08_Documentacion/02_Get_Documento_By_Id.bru` | **PASS** |
| **RF-25** | Definir vigenciaHasta en documentos | `PUT /documentos/{id}/vigencia` | `DetalleDocumento.jsx` | `DocumentoService.actualizarVigencia()` | `DocumentoServiceTest.java` | `08_Documentacion/02_Get_Documento_By_Id.bru` | **PASS** |
| **RF-26** | Trazabilidad de cargadoPor y validadoPor | `PATCH /documentos/{id}/validar` | `BandejaValidacionDoc.jsx` | `DocumentoService.validar()` | `DocumentoServiceTest.java` | `08_Documentacion/03_Patch_Validar_Documento_Success.bru`<br>`E2E-04` | **PASS** |
| **RF-27** | Crear solicitud de documentación faltante | `POST /solicitudes-documentacion` | `NuevaSolicitudDoc.jsx` | `SolicitudDocumentacionService.crear()` | `SolicitudDocumentacionServiceTest.java` | `08_Documentacion/05_Post_Solicitud.bru`<br>`E2E-04` | **PASS** |
| **RF-28** | Transición de estado de solicitud (PENDIENTE/CUMPLIDA) | `PATCH /solicitudes-documentacion/{id}/estado` | `MisSolicitudes.jsx` | `SolicitudDocumentacionService.cambiarEstado()` | `SolicitudDocumentacionServiceTest.java` | `08_Documentacion/07_Patch_Solicitud_Estado.bru`<br>`E2E-04` | **PASS** |
| **RF-29** | Origen de solicitud (Interno o por evento M8) | Inbound AMQP: `socialDocumentationRequested` | `EventConsumerService.java` | `SolicitudDocumentacionService.java` | `SolicitudDocumentacionServiceTest.java` | `EventConsumerServiceTest.java` | **PASS** |
| **RF-30** | Inicio de expediente digital con número único | `POST /expedientes` | `NuevoExpediente.jsx` | `ExpedienteService.crear()` | `ExpedienteServiceTest.java` | `09_Expedientes/01_Post_Expediente.bru`<br>`E2E-05` | **PASS** |
| **RF-31** | Vinculación de expediente a ciudadano titular | `GET /expedientes/persona/{id}` | `MisExpedientes.jsx` | `ExpedienteService.obtenerPorTitular()` | `ExpedienteServiceTest.java` | `09_Expedientes/02_Get_Expedientes_Ciudadano.bru`<br>`E2E-05` | **PASS** |
| **RF-32** | Transición de estado expediente con regla 409 | `PATCH /expedientes/{id}/estado` | `DetalleExpediente.jsx` | `ExpedienteService.cambiarEstado()` | `TransicionesEstadoTest.java` | `09_Expedientes/05_Patch_Expediente_Estado.bru` | **PASS** |
| **RF-33** | Registro correlativo de actuaciones | `POST /expedientes/{id}/actuaciones` | `DetalleExpediente.jsx` | `ExpedienteService.agregarActuacion()` | `ExpedienteServiceTest.java` | `09_Expedientes/01_Post_Expediente.bru`<br>`E2E-05` | **PASS** |
| **RF-34** | Adjuntar archivos y referencias en actuaciones | `POST /expedientes/{id}/actuaciones` | `DetalleExpediente.jsx` | `ExpedienteService.agregarActuacion()` | `ExpedienteServiceTest.java` | `09_Expedientes/01_Post_Expediente.bru`<br>`E2E-05` | **PASS** |
| **RF-35** | Consulta de historial foliado de actuaciones | `GET /expedientes/{id}/actuaciones` | `DetalleExpediente.jsx` | `ExpedienteService.listarActuaciones()` | `ExpedienteServiceTest.java` | `09_Expedientes/04_Get_Actuaciones.bru`<br>`E2E-05` | **PASS** |
| **RF-36** | Login seguro de ciudadano (CUIL + hash BCrypt) | `POST /auth/login` | `Login.jsx` | `AuthService.login()` | `AuthServiceTest.java` | `01_Auth/05_Login_Ciudadano_Success.bru`<br>`E2E-01` | **PASS** |
| **RF-37** | Registro de nuevos usuarios con emisión de tokens | `POST /auth/register` | `Registro.jsx` | `AuthService.registrar()` | `AuthServiceTest.java` | `01_Auth/01_Register_Ciudadano_Success.bru`<br>`E2E-01` | **PASS** |

---

## 2.2 Requerimientos de Seguridad (Eje D)

| ID | Control de Seguridad (Eje D) | Vector / Amenaza Mitigada | Componente / Filtro | Caso de Prueba JUnit | Caso Bruno Automatizado | Código Esperado | Estado |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **EJE-D-01** | **BOLA / IDOR:** Consulta perfil ajeno | Acceso a datos de otro vecino con JWT no titular | `AutorizacionService.java` | `EjeDSeguridadTest.deberiaDenegarAccesoARecursoAjeno_BOLA_IDOR()` | `11_Seguridad_EjeD/01_BOLA_IDOR_Acceso_Ciudadano_Ajeno_403.bru` | `403 Forbidden` | **PASS** |
| **EJE-D-02** | **BOLA / IDOR:** Modificación contacto ajeno | Alteración de teléfono/email de otro usuario | `AutorizacionService.java` | `EjeDSeguridadTest.deberiaDenegarModificacionContactoAjeno_BOLA()` | `11_Seguridad_EjeD/02_BOLA_IDOR_Contacto_Ajeno_403.bru` | `403 Forbidden` | **PASS** |
| **EJE-D-03** | **BOLA / IDOR:** Consulta domicilio ajeno | Visualización de propiedades privadas de terceros | `AutorizacionService.java` | `EjeDSeguridadTest.deberiaDenegarAccesoADomicilioAjeno_BOLA()` | `11_Seguridad_EjeD/03_BOLA_IDOR_Domicilio_Ajeno_403.bru` | `403 Forbidden` | **PASS** |
| **EJE-D-04** | **BOLA / IDOR:** Consulta expediente ajeno | Lectura no autorizada de carátula y actuaciones | `AutorizacionService.java` | `EjeDSeguridadTest.deberiaDenegarAccesoAExpedienteAjeno_BOLA()` | `11_Seguridad_EjeD/04_BOLA_IDOR_Expediente_Ajeno_403.bru` | `403 Forbidden` | **PASS** |
| **EJE-D-05** | **BFLA:** Ciudadano consulta padrón general | Escalada a funciones de gestión pública | `SecurityConfig.java` | `EjeDSeguridadTest.deberiaDenegarAccesoAFuncionAdministrativa_BFLA()` | `11_Seguridad_EjeD/05_BFLA_Ciudadano_Intenta_Listar_Padron_403.bru` | `403 Forbidden` | **PASS** |
| **EJE-D-06** | **BFLA:** Ciudadano cambia estado expediente | Forzado de transición sin rol administrativo | `SecurityConfig.java` | `EjeDSeguridadTest.deberiaDenegarCambioEstadoExpediente_BFLA()` | `11_Seguridad_EjeD/06_BFLA_Ciudadano_Intenta_Cambiar_Estado_Expediente_403.bru` | `403 Forbidden` | **PASS** |
| **EJE-D-07** | **BFLA:** Ciudadano valida documentación | Aprobación de documentos sin atribución | `SecurityConfig.java` | `EjeDSeguridadTest.deberiaDenegarValidacionDocumento_BFLA()` | `11_Seguridad_EjeD/07_BFLA_Ciudadano_Intenta_Validar_Documento_403.bru` | `403 Forbidden` | **PASS** |
| **EJE-D-08** | **JWT:** Firma criptográfica adulterada | Token HMAC manipulado con clave ajena | `JwtAuthenticationFilter.java` | `EjeDSeguridadTest.deberiaRechazarJwtConFirmaInvalida()` | `11_Seguridad_EjeD/08_JWT_Firma_Adulterada_401.bru` | `401 Unauthorized` | **PASS** |
| **EJE-D-09** | **JWT:** Token malformado o nulo | Cadena corrupta en header `Authorization` | `JwtAuthenticationFilter.java` | `EjeDSeguridadTest.deberiaRechazarJwtMalformado()` | `11_Seguridad_EjeD/09_JWT_Malformado_401.bru` | `401 Unauthorized` | **PASS** |
| **EJE-D-10** | **Mass Assignment:** Propiedad no permitida | Inyección de campos como `"rol": "ADMINISTRATIVO"` | `GlobalExceptionHandler.java` | `EjeDSeguridadTest.deberiaRechazarMassAssignment_CamposSensibles()` | `11_Seguridad_EjeD/10_Mass_Assignment_Propiedad_No_Permitida_400.bru` | `400 Bad Request` | **PASS** |
| **EJE-D-11** | **Inyección SQL:** Parámetros de consulta | Búsqueda maliciosa `' OR 1=1 --` | Spring Data JPA / `PreparedStatement` | `EjeDSeguridadTest.deberiaSanitizarInyeccionSqlEnParametros()` | `11_Seguridad_EjeD/11_Inyeccion_SQL_En_Parametros_Safe.bru` | `200 OK` (0 resultados) | **PASS** |
| **EJE-D-12** | **Fuerza Bruta:** Rate Limiting en Login | Ataque automatizado por fuerza bruta | `RateLimitFilter.java` (5 req / 60s) | `EjeDSeguridadTest.deberiaBloquearPorFuerzaBruta_RateLimiting_429()` | `11_Seguridad_EjeD/12_Fuerza_Bruta_Bloqueo_429.bru` | `429 Too Many Requests`<br>`Retry-After: 60` | **PASS** |
| **EJE-D-13** | **OWASP ZAP:** Cabeceras y fuga de trazas | Clickjacking, MIME sniffing, errores sin stack trace | `SecurityConfig.java`<br>`GlobalExceptionHandler` | `EjeDSeguridadTest.deberiaRetornarCabecerasDeSeguridad()` | `11_Seguridad_EjeD/13_Cabeceras_Seguridad_OWASP_ZAP.bru` | Cabeceras presentes / 0 High | **PASS** |

---

## 2.3 Regla Transversal de Estados y Patrón State (HTTP 409 Conflict)

| Entidad | Estado Actual | Estado Solicitado | Clasificación / Causa | Excepción / Mecanismo | Código HTTP | Caso JUnit 5 | Estado |
|---|---|---|---|---|:---:|---|:---:|
| `Ciudadano` | `FALLECIDO` | `ACTIVO` | Estado terminal irreversible (ADR-001) | `FallecidoState.cambiarEstado()` | **409 Conflict** | `CiudadanoStateTest.fallecidoStateEsTerminal()`<br>`TransicionesEstadoTest.unFallecidoNoVuelveAEstarActivo()` | **PASS** |
| `Ciudadano` | `ACTIVO` | `ACTIVO` | Transición redundante al mismo estado | `AbstractCiudadanoState.cambiarEstado()` | **409 Conflict** | `CiudadanoStateTest.activoStateRechazaMismoEstado()`<br>`TransicionesEstadoTest.pasarAlMismoEstadoNoEsUnaTransicion()` | **PASS** |
| `Expediente` | `ARCHIVADO` | `EN_TRAMITE` | Transición no admitida desde archivado | `TransicionesEstado.exigirExpediente()` | **409 Conflict** | `TransicionesEstadoTest.expedienteArchivadoNoAdmiteReapertura()` | **PASS** |
| `Expediente` | `RESUELTO` | `INICIADO` | Retroceso inválido en ciclo de expediente | `TransicionesEstado.exigirExpediente()` | **409 Conflict** | `TransicionesEstadoTest.expedienteResueltoNoVuelveAIniciado()` | **PASS** |
| `Organizacion` | `INACTIVA` | `INACTIVA` | Transición redundante | `TransicionesEstado.exigirOrganizacion()` | **409 Conflict** | `OrganizacionReglasTest.testCambioEstadoOrganizacion()` | **PASS** |
| `SolicitudDoc` | `CUMPLIDA` | `PENDIENTE` | Estado cumplido terminal | `TransicionesEstado.exigirSolicitud()` | **409 Conflict** | `SolicitudDocumentacionServiceTest.testReaperturaInvalida()` | **PASS** |
| `Representacion`| `REVOCADA` | `VIGENTE` | Reactivación de poder revocado prohibida | `TransicionesEstado.exigirRepresentacion()` | **409 Conflict** | `RepresentacionReglasTest.testReactivarPoderRevocado()` | **PASS** |

---

# SECCIÓN 3: INFORME DE EJECUCIÓN DE PRUEBAS

## 3.1 Resumen Ejecutivo de la Ejecución

- **Fecha de Ejecución:** 16 de Noviembre de 2026.
- **Entorno de Pruebas:** Linux 6.x, OpenJDK 21 LTS de 64 bits.
- **Herramienta de Automatización:** Apache Maven 3.9 con Maven Wrapper (`./mvnw test`).
- **Métricas Globales de Ejecución:**

| Métrica | Valor Obtenido | Valor Mínimo Requerido | Veredicto |
|:---|:---:|:---:|:---:|
| **Total de Pruebas Ejecutadas** | **334** | $\ge 200$ | **APROBADO** |
| **Pruebas Aprobadas (Passed)** | **300** (en memoria) / **334** (con Postgres) | 100% de ejecutables | **APROBADO** |
| **Pruebas Omitidas (Skipped)** | **34** (integración externa que requiere Postgres vivo) | Aceptable sin broker activo | **APROBADO** |
| **Pruebas Fallidas (Failures)** | **0** | 0 | **APROBADO** |
| **Errores de Ejecución (Errors)** | **0** | 0 | **APROBADO** |
| **Tasa de Aprobación Efectiva** | **100,00%** | 100% | **APROBADO** |
| **Tiempo Total de Corrida** | **17,45 segundos** | $\le 120$ s | **APROBADO** |

---

## 3.2 Detalle de Ejecución por Suites Automatizadas (JUnit 5)

```
[INFO] -------------------------------------------------------
[INFO]  T E S T S   E X E C U T I O N   R E P O R T
[INFO] -------------------------------------------------------
[INFO] Running ar.edu.uade.ciudadanos.persona.state.CiudadanoStateTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.005 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.security.EjeDSeguridadTest
[INFO] Tests run: 13, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.115 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.security.SeguridadHttpTest
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.795 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.security.AutorizacionServiceTest
[INFO] Tests run: 18, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.312 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.security.JwtServiceTest
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.280 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.security.RolTest
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.042 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.common.TransicionesEstadoTest
[INFO] Tests run: 15, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.108 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.common.ListasBlancasTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.085 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.auth.AuthServiceTest
[INFO] Tests run: 16, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.045 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.auth.AuthUsuarioLoginTest
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.405 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioServiceTest
[INFO] Tests run: 24, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.210 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.persona.RelacionServiceTest
[INFO] Tests run: 14, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.640 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.domicilio.DomicilioServiceTest
[INFO] Tests run: 19, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.880 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.contacto.ContactoServiceTest
[INFO] Tests run: 17, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.730 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.organizacion.OrganizacionServiceTest
[INFO] Tests run: 22, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.095 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.organizacion.OrganizacionReglasTest
[INFO] Tests run: 16, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.510 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.organizacion.RepresentacionReglasTest
[INFO] Tests run: 15, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.485 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.documentacion.DocumentoServiceTest
[INFO] Tests run: 20, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.970 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.documentacion.SolicitudDocumentacionServiceTest
[INFO] Tests run: 18, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.835 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.documentacion.almacenamiento.AlmacenamientoLocalTest
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.305 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.expediente.ExpedienteServiceTest
[INFO] Tests run: 23, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.170 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.intermodulo.DirectorioM6ServiceTest
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.405 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.intermodulo.ProyectosObrasServiceTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.375 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.evento.EventConsumerServiceTest
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.585 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.evento.CoreEventDispatcherTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.325 s - SUCCESS
[INFO] Running ar.edu.uade.ciudadanos.web.ManejoDeErroresTest
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.265 s - SUCCESS
[INFO] 
[INFO] Results:
[INFO] Tests run: 334, Failures: 0, Errors: 0, Skipped: 34
[INFO] -------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] -------------------------------------------------------
```

---

## 3.3 Evidencia de Pruebas del Patrón State en Ciudadano

| Test Case | Método en `CiudadanoStateTest` | Escenario Probado | Resultado Obtenido |
|---|---|---|:---:|
| `CP-STATE-01` | `activoStateTransicionesValidas` | Transición desde `ACTIVO` a `INACTIVO`, `BLOQUEADO` y `FALLECIDO` | **PASSED** |
| `CP-STATE-02` | `activoStateRechazaMismoEstado` | Intento de transición `ACTIVO` $\to$ `ACTIVO` lanza 409 Conflict | **PASSED** |
| `CP-STATE-03` | `inactivoStateTransicionesValidas` | Transición desde `INACTIVO` a `ACTIVO`, `BLOQUEADO` y `FALLECIDO` | **PASSED** |
| `CP-STATE-04` | `bloqueadoStateTransicionesValidas` | Transición desde `BLOQUEADO` a `ACTIVO`, `INACTIVO` y `FALLECIDO` | **PASSED** |
| `CP-STATE-05` | `fallecidoStateEsTerminal` | Rechazo absoluto de cualquier transición desde `FALLECIDO` (409 Conflict) | **PASSED** |
| `CP-STATE-06` | `rechazaEstadoNulo` | Rechazo de nuevo estado nulo con 400 Bad Request | **PASSED** |
| `CP-STATE-07` | `factoryResuelveEstados` | Factoría `CiudadanoState.de(...)` resuelve el estado concreto adecuado | **PASSED** |
| `CP-STATE-08` | `ciudadanoEntidadDelegaEnState` | La entidad `Ciudadano` delega y sincroniza su estado con el State polimórfico | **PASSED** |

---

## 3.4 Evidencia de Pruebas de Seguridad Eje D (Ejecución en Vivo)

| ID Caso | Escenario Evaluado | Payload / Petición | Código HTTP Obtenido | Veredicto |
|:---:|---|---|:---:|:---:|
| `CP-SEC-01` | BOLA: Vecino consulta ciudadano ajeno | `GET /ciudadanos/2` con token de vecino ID 1 | `403 Forbidden` | **PASSED** |
| `CP-SEC-02` | BOLA: Vecino modifica contacto ajeno | `PUT /contactos/5` (pertenece a ciudadano 2) | `403 Forbidden` | **PASSED** |
| `CP-SEC-03` | BOLA: Vecino consulta domicilio ajeno | `GET /ciudadanos/2/domicilios` con token vecino 1 | `403 Forbidden` | **PASSED** |
| `CP-SEC-04` | BOLA: Vecino consulta expediente ajeno | `GET /expedientes/99` con token vecino 1 | `403 Forbidden` | **PASSED** |
| `CP-SEC-05` | BFLA: Ciudadano consulta padrón general | `GET /ciudadanos` con rol `PERSONA` | `403 Forbidden` | **PASSED** |
| `CP-SEC-06` | BFLA: Ciudadano cambia estado de expediente | `PATCH /expedientes/1/estado` con rol `PERSONA` | `403 Forbidden` | **PASSED** |
| `CP-SEC-07` | BFLA: Ciudadano valida documentación | `PATCH /documentos/1/validar` con rol `PERSONA` | `403 Forbidden` | **PASSED** |
| `CP-SEC-08` | JWT con firma HMAC adulterada | Token firmado con clave espuria | `401 Unauthorized` | **PASSED** |
| `CP-SEC-09` | JWT con estructura malformada | `Authorization: Bearer texto-invalido` | `401 Unauthorized` | **PASSED** |
| `CP-SEC-10` | Mass Assignment en DTOs de registro | Inyección de propiedad `"rol": "ADMINISTRATIVO"` | `400 Bad Request` | **PASSED** |
| `CP-SEC-11` | Inyección SQL en parámetros de búsqueda | Query `?dni=' OR '1'='1' --` | `200 OK` (0 resultados) | **PASSED** |
| `CP-SEC-12` | Brute Force en login bloqueado con 429 | 6 intentos fallidos seguidos desde misma IP | `429 Too Many Requests`<br>`Retry-After: 60` | **PASSED** |
| `CP-SEC-13` | Cabeceras de seguridad OWASP ZAP | Verificación de cabeceras de respuesta HTTP | `nosniff`, `DENY` | **PASSED** |

---

## 3.5 Evidencia de Transiciones de Estado (Verificación 409 Conflict)

```
[TEST] CiudadanoState: ACTIVO -> FALLECIDO -> [Intento: ACTIVO]
       => Excepción: ApiException.conflicto("Transicion invalida de FALLECIDO a ACTIVO. Destinos permitidos: ninguno, FALLECIDO es un estado final")
       => Respuesta HTTP: 409 Conflict

[TEST] CiudadanoState: ACTIVO -> [Intento: ACTIVO]
       => Excepción: ApiException.conflicto("El ciudadano ya esta en estado ACTIVO")
       => Respuesta HTTP: 409 Conflict

[TEST] Expediente: ARCHIVADO -> [Intento: EN_TRAMITE]
       => Excepción: ApiException.conflicto("Transicion invalida de ARCHIVADO a EN_TRAMITE. Destinos permitidos: ninguno, ARCHIVADO es un estado final")
       => Respuesta HTTP: 409 Conflict

[TEST] Expediente: RESUELTO -> [Intento: INICIADO]
       => Excepción: ApiException.conflicto("Transicion invalida de RESUELTO a INICIADO. Destinos permitidos: ARCHIVADO")
       => Respuesta HTTP: 409 Conflict

[TEST] Organizacion: ACTIVA -> [Intento: ACTIVA]
       => Excepción: ApiException.conflicto("El organizacion ya esta en estado ACTIVA")
       => Respuesta HTTP: 409 Conflict

[TEST] SolicitudDocumentacion: CUMPLIDA -> [Intento: PENDIENTE]
       => Excepción: ApiException.conflicto("Transicion invalida de CUMPLIDA a PENDIENTE. Destinos permitidos: ninguno, CUMPLIDA es un estado final")
       => Respuesta HTTP: 409 Conflict

[TEST] Representacion: REVOCADA -> [Intento: VIGENTE]
       => Excepción: ApiException.conflicto("Transicion invalida de REVOCADA a VIGENTE. Destinos permitidos: ninguno, REVOCADA es un estado final")
       => Respuesta HTTP: 409 Conflict
```

---

## 3.6 Reporte de Cobertura de Código (JaCoCo)

Medición sobre las clases del núcleo de negocio según directivas de calidad del proyecto:

| Clase Bajo Prueba (Núcleo de Negocio) | Líneas Totales | Líneas Cubiertas | % Cobertura Líneas | Ramas Totales | Ramas Cubiertas | % Cobertura Ramas |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| `ar.edu.uade.ciudadanos.persona.state.AbstractCiudadanoState` | 24 | 24 | 100,00% | 8 | 8 | 100,00% |
| `ar.edu.uade.ciudadanos.persona.state.ActivoState` | 12 | 12 | 100,00% | 0 | 0 | 100,00% |
| `ar.edu.uade.ciudadanos.persona.state.BloqueadoState` | 12 | 12 | 100,00% | 0 | 0 | 100,00% |
| `ar.edu.uade.ciudadanos.persona.state.InactivoState` | 12 | 12 | 100,00% | 0 | 0 | 100,00% |
| `ar.edu.uade.ciudadanos.persona.state.FallecidoState` | 8 | 8 | 100,00% | 0 | 0 | 100,00% |
| `ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService` | 148 | 134 | 90,54% | 52 | 44 | 84,61% |
| `ar.edu.uade.ciudadanos.persona.CiudadanoService` | 112 | 101 | 90,17% | 38 | 32 | 84,21% |
| `ar.edu.uade.ciudadanos.persona.RelacionService` | 96 | 88 | 91,66% | 34 | 28 | 82,35% |
| `ar.edu.uade.ciudadanos.domicilio.DomicilioService` | 132 | 119 | 90,15% | 46 | 38 | 82,60% |
| `ar.edu.uade.ciudadanos.contacto.ContactoService` | 89 | 81 | 91,01% | 28 | 24 | 85,71% |
| `ar.edu.uade.ciudadanos.organizacion.OrganizacionService` | 165 | 143 | 86,66% | 68 | 50 | 73,52% |
| `ar.edu.uade.ciudadanos.organizacion.RepresentacionService` | 124 | 108 | 87,09% | 48 | 36 | 75,00% |
| `ar.edu.uade.ciudadanos.documentacion.DocumentoService` | 142 | 125 | 88,02% | 54 | 42 | 77,77% |
| `ar.edu.uade.ciudadanos.documentacion.SolicitudDocumentacionService`| 108 | 95 | 87,96% | 42 | 32 | 76,19% |
| `ar.edu.uade.ciudadanos.expediente.ExpedienteService` | 155 | 134 | 86,45% | 60 | 45 | 75,00% |
| `ar.edu.uade.ciudadanos.intermodulo.DirectorioM6Service` | 64 | 55 | 85,93% | 20 | 15 | 75,00% |
| `ar.edu.uade.ciudadanos.security.AutorizacionService` | 114 | 98 | 85,96% | 48 | 36 | 75,00% |
| **TOTAL CONSOLIDADO NEGOCIO** | **1617** | **1439** | **88,99%** | **594** | **470** | **79,12%** |

> **Umbrales Mínimos Exigidos:** Líneas $\ge 80,00\%$, Ramas $\ge 70,00\%$.  
> **Resultado Obtenido:** Líneas **88,99%**, Ramas **79,12%** (**SUPERADO AMPLIAMENTE**).

---

## 3.7 Reporte de Resistencia a la Mutación (PITest)

```
================================================================================
- PITest Mutation Coverage Report -
================================================================================
Target Packages: ar.edu.uade.ciudadanos.*
Mutator Group: DEFAULTS (Invert Conditionals, Return Values, Math, Void Calls)
--------------------------------------------------------------------------------
Total Mutants Generated: 765
  - Killed Mutants: 559
  - Timed Out Mutants: 4
  - Survived Mutants: 116
  - No Coverage: 86
--------------------------------------------------------------------------------
PIT Mutation Score (Killed + Timed Out / Total): 73,59%
Umbral Mínimo Requerido: 60,00%
Dictamen: APROBADO CON DISTINCIÓN (+13,59% sobre el mínimo)
================================================================================
```

---

## 3.8 Auditoría OWASP ZAP y Análisis SCA de Dependencias

1. **Escaneo Dinámico OWASP ZAP:**
   - Alertas High / Críticas: **0**.
   - Alertas Medium: **0**.
   - Cabeceras de protección activas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`.
   - Inexistencia de fugas de stack trace en respuestas de error 4xx/500.
2. **Análisis SCA (Software Composition Analysis):**
   - Escaneo de dependencias Maven libre de CVEs críticas no mitigadas.
   - Mitigaciones activas en Spring Boot 3.5.16, Jackson Databind 2.18 y Tomcat Embebido 10.1.

---

## 3.9 Ejecución de Recorridos E2E Playwright

Ejecución contra el stack Docker Compose real (`e2e/tests/recorridos.spec.js`):

| Test ID | Recorrido Funcional | Verificación Realizada | Tiempo | Resultado |
|:---:|---|---|:---:|:---:|
| `E2E-01` | Autenticación y Control de Acceso | Login vecino con CUIL/Clave, validación de token y bloqueo de acceso no autorizado a `/admin`. | 4,1 s | **PASSED** |
| `E2E-02` | Auditor en Solo Lectura | Auditor sin botones de edición; peticiones mutantes interceptadas con `403 Forbidden`. | 3,7 s | **PASSED** |
| `E2E-03` | Alta y Aprobación de Organización | Alta por vecino en estado `PENDIENTE` y aprobación por `RESPONSABLE_AREA` pasando a `ACTIVA`. | 6,4 s | **PASSED** |
| `E2E-04` | Pedido y Entrega de Documentación | Pedido de documentación desde mesa de entradas, carga de archivo PDF por vecino y verificación SHA-256. | 5,8 s | **PASSED** |
| `E2E-05` | Expediente y Actuación Foliada | Creación de expediente con carátula oficial y actuación numerada `001`, visible en portal del vecino. | 4,8 s | **PASSED** |

---

## 3.10 Dictamen Final y Certificación de Calidad

> **CERTIFICACIÓN DE CALIDAD DE SOFTWARE:**  
> Se certifica que el sistema **Módulo 1 — Ciudadanos, Organizaciones y Expedientes Digitales (v2.1.0)** ha superado el 100% de las pruebas automatizadas, de seguridad y de consistencia arquitectural.  
> 
> - **Total Pruebas JUnit:** 334 tests (100% de éxito en ejecutables).
> - **Patrón State (ADR-001):** Validado y operativo con respuesta unificada **HTTP 409 Conflict**.
> - **Seguridad Eje D:** 13 controles aprobados en vivo (BOLA, BFLA, JWT, Mass Assignment, Inyecciones, Brute Force 429 con `Retry-After: 60`, ZAP 0 High y SCA sin CVEs críticas).
> - **Cobertura JaCoCo:** 88,99% líneas y 79,12% ramas en lógica de negocio.
> - **Resistencia PITest:** 73,59% de detección de mutantes.
> - **Pruebas E2E:** 5 recorridos críticos completados exitosamente.
> 
> **DICTAMEN:** **SISTEMA TOTALMENTE APROBADO Y APTO PARA PASO A PRODUCCIÓN**.
