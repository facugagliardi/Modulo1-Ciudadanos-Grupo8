# Funcionamiento de M1: mapa funcional y técnico

**Referencia histórica:** este análisis describe `main` antes de los cambios de integración de la rama `aedelstein`. Para el comportamiento nuevo de identidad, eventos y Core, consultar `INTEGRACION_M2_M5.md` y el código actual.

Revisión del código local del 27 de octubre de 2026, rama `main`. Este documento describe la implementación observada y diferencia las reglas pretendidas de los desvíos encontrados. No modifica comportamiento ni datos. Los hallazgos son de lectura de código; no se explotaron contra los servicios levantados.

## 1. Qué sistema es

M1 mantiene ciudadanos, organizaciones, domicilios, contactos, relaciones familiares, representaciones, documentos, pedidos de documentación y expedientes digitales. Expone consultas de identidad para otros módulos y publica/recibe eventos.

Hay dos experiencias en una misma aplicación React: portal del vecino y gestión interna. El backend es un monolito Spring Boot organizado por dominio. El frontend consume su API REST; no consulta directamente la base en sus pantallas.

### Componentes actuales

| Pieza | Implementación | Responsabilidad |
|---|---|---|
| Frontend | React 18, Vite, React Router, Tailwind, Radix, Motion | Formularios, navegación, permisos visibles, carga y presentación |
| Backend | Java 21, Spring Boot 3.5.16, Spring MVC, Spring Security | Reglas de negocio, autorización, API y transacciones |
| Persistencia | PostgreSQL y Spring Data JPA | Datos de negocio, credenciales y tabla `events` |
| Mensajería | Spring AMQP y RabbitMQ | Integración asincrónica |
| Archivos | `AlmacenamientoLocal` | Binarios en disco; la base guarda su referencia |
| Pruebas | JUnit/Mockito y Vitest/Testing Library | Pruebas de servicios, contratos, componentes y pantallas |

MongoDB figura en documentación histórica, pero no es dependencia del `pom.xml` actual. Los eventos actuales se persisten en PostgreSQL.

## 2. Cómo interpretar la documentación existente

| Archivo | Utilidad | Precaución |
|---|---|---|
| `README.md` | Dominio, matriz de permisos, contratos, límites conocidos | Conserva referencias a Mongo, personas jurídicas y cantidades antiguas |
| `ARCHITECTURE.md` | RF-01 a RF-37, diseño y acuerdos entre módulos | No es el contrato exacto actual de rutas ni del sobre de eventos |
| `INSTALACION.md` | Instalación y arranque | Contrastar servicios requeridos con configuración y dependencias actuales |
| `Contexto-app.md` | — | Está vacío |
| `frontend/contexto.md` | Referencia extensa de API y reglas del frontend | Indica verificación en septiembre; hubo cambios posteriores |
| `frontend/sitemap.md` | Pantallas, recorridos y estados esperados | Registro jurídico, rutas `/personas` y pendientes no reflejan todo el código actual |
| `frontend/DISENO.md` | Densidad, tipografía, interacción, accesibilidad y movimiento | Algunos comentarios de pendientes quedaron antiguos |
| `frontend/issues.md` | Problemas y decisiones de septiembre | Varios puntos ya tienen implementación: binarios, organizaciones por dueño, documentos pendientes |

Orden para resolver discrepancias: controller/DTO → service/autorización → entidades/repositorios/esquema → adaptadores y pantallas → documentos históricos. Incluso los comentarios dentro del código pueden estar desactualizados.

## 3. Recorrido de una petición

1. La pantalla obtiene identidad y permisos con `useSesion`.
2. Un adaptador de `frontend/src/lib/api/endpoints` construye la ruta y el cuerpo.
3. `campos.js` deja pasar únicamente las propiedades declaradas para esa operación.
4. `cliente.js` agrega Bearer, serializa JSON o conserva `FormData`, y ejecuta `fetch`.
5. Spring Security valida el access token mediante `JwtAuthenticationFilter`.
6. El controller recibe el DTO y activa Bean Validation donde corresponde.
7. El service comprueba permisos/titularidad, existencia, conflictos y reglas del dominio.
8. JPA consulta o modifica PostgreSQL. Las entidades administradas se actualizan al cerrar la transacción, aunque no aparezca un `save` explícito después de cada setter.
9. Algunas operaciones también registran/publican un evento.
10. El frontend procesa el resultado y recarga el recurso afectado. Las excepciones se convierten en el contrato común de errores.

Los listados se envuelven habitualmente en `{items: [...]}`. Búsqueda, filtros, orden y paginación se hacen en memoria del navegador. El backend normalmente no pagina.

## 4. Autenticación y sesión

### Registro del vecino

`Registro.jsx` tiene tres pasos: datos personales → DNI adjunto → email. El primer paso ejecuta `registrarYEntrar`: registra y luego inicia sesión. Son dos peticiones independientes; la cuenta y la sesión existen antes de completar el documento y el contacto.

El backend crea un ciudadano `ACTIVO`, asigna UUID mediante la entidad y guarda el hash BCrypt en `credencial_ciudadano`. Comprueba CUIL y DNI duplicados. El registro actual recibe seis campos; no recibe `tipo` ni crea una cuenta jurídica.

Detalle: la pantalla exige nacionalidad, pero `campos.js` la descarta y `RegisterRequest` no la contiene. El evento de registro usa nacionalidad fija `argentina`. No hay persistencia de la nacionalidad elegida en este recorrido.

### Ingreso

- Vecino: `/auth/login`, CUIL y contraseña; exige ciudadano activo y emite rol `PERSONA`.
- Empleado: `/auth/empleados/login`, mail y contraseña; exige cuenta activa y toma el rol del empleado.
- Integración adicional: `/auth/usuario/login`, email bajo el campo `gmail`; busca primero empleado y luego contactos del ciudadano. No es el ingreso habitual del frontend. Para ciudadano emite rol `CIUDADANO`, distinto de `PERSONA` y ausente del enum `Rol`; es una inconsistencia del contrato.

Los tokens se entregan en headers `Authorization`, `X-Refresh-Token` y `X-Token-Expires-In`. El cuerpo contiene los datos del sujeto. Access dura 900 segundos; refresh, 604800. Los claims relevantes son `sub`, `sub_type`, `rol`, `typ`, `iss` y `exp`.

El frontend guarda la sesión en memoria y `localStorage` (`m1.sesion`). `useSyncExternalStore` mantiene React sincronizado con ese almacén externo. Ante un 401, el cliente comparte un único refresh entre solicitudes concurrentes y reintenta cada solicitud una vez. Si falla el refresh, limpia la sesión.

Renovar emite otro par de JWT, pero no invalida el refresh anterior ni vuelve a consultar el estado del ciudadano/empleado. Logout no revoca tokens: el frontend los descarta. Bloquear una cuenta impide un nuevo login, pero no elimina por sí mismo tokens ya emitidos.

### Alta asistida

`AltaDeVecino.jsx` comprueba DNI con 400 ms de espera y cancela consultas anteriores. Genera una contraseña para entregar al vecino. Registra sin iniciar sesión como ese vecino, para conservar la sesión del empleado.

## 5. Autorización

`Rol.java` centraliza los permisos. `AutorizacionService` combina permisos con titularidad.

| Rol | Regla prevista |
|---|---|
| `PERSONA` | Gestiona lo propio; no tiene permisos generales sobre terceros |
| `MESA_ENTRADAS` | Consulta padrón, edita terceros, inicia expedientes y pide documentación |
| `ADMINISTRATIVO` | Además valida documentos, cambia estados de expedientes y gestiona representaciones |
| `RESPONSABLE_AREA` | Además cambia estados de ciudadanos/organizaciones |
| `AUDITOR` | Consulta sin permisos generales de escritura |
| `SERVICIO` | Consultas intermodulares acotadas |

Sobre una organización se autoriza al dueño, representante vigente o empleado con permiso. La vigencia se consulta por fechas y estado. El alcance se almacena, pero estas comprobaciones generales no lo convierten en restricciones diferentes por operación.

Las guardas del frontend separan sesión, zona, permisos y páginas exclusivas de ciudadano. Ocultar botones mejora el recorrido; la seguridad depende del backend.

**Desvío transversal:** varias comprobaciones de titularidad comparan sólo el número de ID, sin exigir `TipoSujeto.CIUDADANO`. Ciudadanos y empleados tienen secuencias distintas. Un empleado con ID coincidente puede entrar en la excepción de «propio» de un ciudadano. Esto afecta la garantía de sólo lectura del auditor; también debe revisarse en contactos, relaciones, domicilios y vínculos organizacionales.

## 6. Ciudadanos y padrón

`CiudadanoService` lista resúmenes y compone el detalle con domicilio principal y contactos. La edición es parcial: campos `null` no se modifican. DNI y CUIL nuevos se verifican contra duplicados. Estado se cambia mediante operación separada.

Transiciones: `ACTIVO`, `INACTIVO` y `BLOQUEADO` pueden pasar entre sí o a `FALLECIDO`; `FALLECIDO` es terminal. Repetir el estado actual da 400.

La consulta por DNI devuelve `{existe:false}` cuando no encuentra, en lugar de 404. El padrón requiere `LISTAR_PADRON`. Su resumen no contiene toda la información de contactos y domicilios: una tabla no puede buscar por datos que nunca descargó.

Editar publica `citizenUpdated/UPDATED`; registrar publica `REGISTERED`; bloquear y marcar fallecido publican `BLOCKED` y `DECEASED`. No todos los otros cambios de estado tienen emisión equivalente.

## 7. Domicilios

Se separan `Propiedad` y vínculo `CiudadanoPropiedad`: la dirección física es una entidad; principal y vigencias pertenecen al vínculo.

- Crear valida ciudadano y escritura, crea propiedad y vínculo. El primer domicilio queda principal aunque no se pida explícitamente.
- Marcar otro principal baja el flag anterior y ejecuta `flush` antes de subir el nuevo, para respetar el índice único parcial.
- Listar incluye vigentes e históricos.
- Baja cierra `vigenteHasta`; no borra la fila. Si era principal, elige el vigente más reciente como reemplazo. Rechaza dar de baja el único principal vigente.
- Editar reemplaza los campos de la propiedad; exige tipo, calle y número. No crea automáticamente una versión histórica de la dirección.
- Las operaciones por propiedad deducen el vínculo: propio para ciudadano o único para interno; si hay varios vínculos para un interno, rechazan la ambigüedad.

Crear un principal o marcarlo publica `ADDRESS_UPDATED`; editar la dirección y darla de baja no tienen el mismo disparador en este servicio. La promesa de historial no significa inmutabilidad de todas las columnas: el PUT modifica la propiedad existente.

Existe además `GET /domicilios/{id}`. Su service `obtener` devuelve la propiedad sin comprobar titularidad, a diferencia del listado personal.

## 8. Contactos

Un contacto se asocia al ciudadano mediante tabla puente. Crear normaliza email a minúsculas y teléfono sin espacios/guiones, valida formato y comprueba duplicación dentro de ese ciudadano. Editar reinicia la verificación y su fecha. Eliminar borra vínculo y contacto.

La verificación es simulada: `verificar` marca verificado sin contrastar el código con uno emitido. La validación de forma del DTO no equivale a prueba de control del correo/teléfono. Tampoco hay envío real de códigos en este flujo.

El servicio de actualización no repite el chequeo de duplicados que sí hace el alta. La eliminación del último contacto no tiene una regla que obligue a conservar uno.

## 9. Familia

Una relación guarda dos ciudadanos y el tipo de cada extremo. Se rechaza autorrelación y se busca duplicación en ambos sentidos. Puede gestionarla un participante o un empleado con `EDITAR_TERCEROS`.

Al consultar desde un ciudadano se devuelve el otro extremo con su nombre y el tipo que ese otro representa para el consultado. `esResponsable` es un único booleano del vínculo. Cambiarlo al valor actual da 400. El backend valida que los tipos estén admitidos, pero no impone que el par sea semánticamente recíproco; el frontend ayuda con su catálogo de recíprocos.

## 10. Organizaciones, titularidad y representación

### Alta y aprobación

Crear comprueba CUIT y `taxId` únicos, normaliza tipo y deja estado `PENDIENTE`. Admite dueños explícitos o creador más `otrosDuenos`; puede calcular el porcentaje restante del creador. La suma no puede superar 100, pero eso no obliga a que toda composición sume exactamente 100.

Dueño y representante son vínculos diferentes. `MisOrganizaciones.jsx` consulta ambos y los une por organización para no duplicar entradas. La consulta de organizaciones por dueño efectiva es `/personas/{id}/organizaciones`; el adaptador intenta antes `/ciudadanos/{id}/organizaciones` y retrocede ante 404.

Aprobar cambia `PENDIENTE → ACTIVA`; rechazar cambia `PENDIENTE → RECHAZADA`. Son métodos separados del grafo general de cambios de estado. El grafo general sólo define `ACTIVA`, `INACTIVA` y `BLOQUEADA`.

**Permisos desalineados:** el frontend ofrece aprobar/rechazar a `ADMINISTRATIVO` mediante `APROBAR_ORGANIZACION`. El backend no declara ese permiso y exige `CAMBIAR_ESTADO_TITULAR`, que sólo tiene `RESPONSABLE_AREA`.

### Dueños

Se agrega un dueño existente con porcentaje y, opcionalmente, ajustes a otros dueños. Se puede cambiar el porcentaje de uno existente. No puede quitarse el único dueño. Al quitar otro se transfiere su parte a un beneficiario explícito o se reparte proporcionalmente entre los restantes; hay redondeo que conviene considerar al exigir totales exactos.

### Propiedades de organización

Tienen vínculo y vigencias propios (`OrganizacionPropiedad`). Se puede crear una propiedad o asociar una existente, elegir principal y dar de baja. Su baja permite quedarse sin domicilio vigente y escoge otra de las restantes si existe; no aplica exactamente la regla del domicilio ciudadano. Reasociar puede reutilizar el vínculo y reiniciar sus fechas.

### Representaciones

Crear exige existencia de persona/organización, autoridad para otorgar, alcance admitido y fechas coherentes. Guarda `VIGENTE`. No permite otro registro con estado persistido `VIGENTE` para el mismo par.

`VIGENTE → VENCIDA/REVOCADA`; ambas finales. Los GET pueden informar `VENCIDA` por fecha sin actualizar la fila. La autorización consulta vigencia efectiva. Por eso un registro vencido por fecha que sigue almacenado como `VIGENTE` puede bloquear un nuevo otorgamiento hasta cerrarlo explícitamente.

Otorgar y terminar emiten `representationGranted` y `representationExpired`. La gestión backend también admite `EDITAR_TERCEROS`; el frontend del detalle usa un permiso más estrecho para mostrar controles.

## 11. Documentos y solicitudes

### Documento

Cargar crea metadatos con versión 1 y referencia al binario. Una nueva versión crea otra fila con versión anterior + 1. Si quien sube tiene `VALIDAR_DOCUMENTACION`, nace validado; de otro modo queda pendiente. La auditoría guarda tipo de sujeto, ID y rol.

Validar requiere permiso, sólo acepta pendientes y guarda resultado, actor, fecha y eventual vencimiento. Hay listado global de pendientes. El binario se entrega mediante `/documentos/{id}/archivo` con autorización y `Content-Disposition: inline`. El frontend lo descarga con Bearer como Blob y crea URL local para iframe o imagen.

La consulta «última versión válida» busca primero la mayor versión del tipo y luego exige que esté aprobada y vigente; no retrocede a una versión anterior aprobada si la más nueva está pendiente.

**Problema de almacenamiento:** `DocumentoService` pasa el ID del ciudadano como segundo argumento de `guardar`. `AlmacenamientoLocal` forma `documento-{id}-v{version}.{ext}` y usa `REPLACE_EXISTING`. Dos cargas iniciales del mismo ciudadano con igual extensión producen la misma ruta y pisan el binario, aunque las filas de documentos sean diferentes. El comentario que promete nombres UUID no coincide con esta implementación.

**Validación desconectada:** existe `ArchivosPermitidos.exigirValido`, pero no se invoca desde las cargas del controller/service/almacenamiento actual. Los límites multipart siguen configurados; la existencia del validador no garantiza validación backend de extensión, MIME o archivo vacío. El frontend valida parte de esto en varios recorridos, pero no sustituye ese control.

### Solicitud

Crear exige permiso para solicitar, titular existente, tipo admitido y plazo no pasado. Origen es `INTERNA` o `EVENTO`. Internos con `LISTAR_PADRON` ven todas; el vecino ve propias.

`PENDIENTE → CUMPLIDA/VENCIDA`; una `VENCIDA` todavía puede cumplirse. Cumplir exige `documentoId` del titular. No comprueba aquí que sea del tipo pedido, aprobado o vigente. Marcar vencida exige además permiso para solicitar.

El frontend combina subida + cumplimiento en una sola interacción, pero son dos requests. Si la segunda falla, conserva la opción de asociar el documento ya cargado. Revisar, rechazar y volver a pedir también puede requerir operaciones separadas, con éxito parcial.

Cumplir publica `socialDocumentationDelivered`, pero construye referencias de solicitud/programa y expediente genéricas, en lugar de conservar necesariamente la correlación original de M8.

## 12. Expedientes y actuaciones

Crear requiere `GESTIONAR_EXPEDIENTES`, titular existente, carátula y área. Acepta número o genera `EXP-{año}-{count+1}`. La unicidad está en la base; el contador no es una secuencia segura frente a concurrencia.

Recorrido: `INICIADO → EN_TRAMITE → RESUELTO → ARCHIVADO`; también se puede archivar desde iniciado o en trámite. El titular consulta; un empleado con `LEER_TERCEROS` ve todos. Cambiar estado exige permiso específico.

Actuaciones llevan clave compuesta `(expedienteId, actuacionId)`, numerada desde 1 por expediente. Se agregan con permiso de gestión y no se admiten sobre archivados. Los adjuntos son referencias serializadas en JSON, no una carga multipart. JSON corrupto al leer se informa en log y se sustituye por lista vacía.

Al resolver se publica `casefileResolved`. El payload actual fija resolución aprobada, texto favorable y referencia de obra pública; no deduce esos datos de un dictamen real. No todo expediente resuelto representa necesariamente esa resolución de negocio.

## 13. Eventos e integración

### Publicación

`EventPublisherService` serializa el sobre, persiste evento y llama a RabbitMQ. Tipos: `citizenUpdated`, `casefileResolved`, `citizenInfoDelivered`, `organizationInfoDelivered`, `organizationRegistered`, `representationGranted`, `representationExpired`, `socialDocumentationDelivered`.

El sobre real tiene `eventId`, `eventType`, `eventVersion`, `occuredAt` (esa ortografía), `sourceModule`, opcionales `correlationId`/`causationId` y `data`. No serializa el antiguo `producer`/`subject` descrito en la arquitectura. `subject()` es un helper que devuelve el módulo fuente.

UUID ciudadano se intenta resolver desde UUID, ID interno, CUIT o DNI. Eso no garantiza que todos los identificadores de todos los payloads sean UUID: hay referencias numéricas y sintéticas.

Exchange configurable con default `muni.inbox`, tipo fanout durable. En fanout la routing key no filtra destinatarios. Se vincula directamente `q.ciudadanos` a ese exchange y existe otra cola para solicitudes M8. El listener usa nombres constantes aunque la declaración principal admite configurar el nombre de cola.

El arranque automático del listener tiene default `false`; el proceso puede estar saludable sin consumir. La configuración efectiva puede cambiar mediante variables del proceso, no inspeccionadas aquí.

### Recepción M8

La solicitud social registra entrada, resuelve ciudadano, crea expediente y solicitudes pendientes y responde con `socialDocumentationDelivered` usando correlación y causalidad. Si no hay plazo interpretable, usa hoy + 15 días; si no hay documentos, pide certificado de domicilio. Traduce tipos externos a su catálogo.

El receptor HTTP genérico distingue familias por fragmentos del nombre (`casefile`, `expediente`, `documentation`, `documentacion`, `solicitud`) y puede crear entidades. La deduplicación consulta `eventId` ya registrado.

### Límites observados

- `/eventos/**` es público: permite listar payloads, publicar ejemplos y recibir mensajes con efectos sobre negocio.
- Si el ciudadano externo no se resuelve, se toma el primer ciudadano disponible o ID 1. Un mensaje incorrecto puede generar trámites para otra persona.
- El listener tipado de M8 escucha una cola enlazada a fanout sin despachar primero por `eventType`. Debe verificarse con el broker real qué otros mensajes llegan y cómo se deserializan.
- No se encontró worker/scheduler que reintente publicaciones fallidas. Guardar un registro no prueba entrega posterior.
- La llamada de publicación usa la sobrecarga de cuatro argumentos de `registrarEmitido`: el primer argumento, `eventId`, termina como `aggregateType`; el ID de fila se genera nuevo. El ID de fila puede diferir del `eventId` del JSON publicado.
- En varios servicios se ignoran excepciones de publicación. Además, enviar al broker ocurre antes del commit de la transacción externa; no es una entrega atómica entre base y broker.
- El listener llama al método transaccional del mismo bean: esa llamada interna no atraviesa el proxy de Spring. No debe suponerse que todo el procesamiento del listener tiene la misma transacción que la invocación HTTP al service.
- El procesamiento genérico captura errores al crear entidades; registrar como recibido no implica que todas las entidades se hayan creado correctamente.

### Consultas intermodulares

`ConsultaInterModuloController` usa `@SoloInterno` para exigir `CONSULTA_INTERMODULO`. Consultar identidad de ciudadano/organización también intenta publicar un evento de entrega: esos GET tienen efecto lateral de mensajería. En la entrega de identidad ciudadana los campos de teléfono y correo se completan vacíos en este código.

## 14. Pantallas y componentes compartidos

| Grupo | Recorridos |
|---|---|
| Público | Ingreso vecino/empleado, registro en pasos, sin permiso, no encontrado |
| Portal | Resumen, perfil, domicilios e historial, contactos, familia, organizaciones, documentos, pedidos y expedientes |
| Gestión | Tablero, padrón, alta asistida, legajo, organizaciones, documentación y expedientes |
| Detalles compartidos | Organización y expediente reciben la zona como parámetro y habilitan acciones por permisos/vínculos |

`App.jsx` conecta las rutas. Conserva guardas y referencias a sujeto jurídico aunque el registro actual ya no lo crea. No existe ruta implementada de consultas intermodulares en el menú de rutas actual.

`useRecurso` administra carga, error, datos y recarga. Cancela solicitudes previas y descarta respuestas tardías. Distingue primera carga de recarga del mismo recurso: conserva el contenido durante una actualización para evitar parpadeo.

`Tabla` normaliza texto para buscar, filtra, ordena y recorta página en cliente. Usa búsqueda diferida, orden ascendente/descendente/original y tamaños 25/50/100. Distingue vacío real de búsqueda sin coincidencias y mantiene semántica accesible.

`CambiarEstado` obtiene opciones del grafo y confirma acciones terminales. `BadgeEstado` combina texto, color y señal de terminalidad. Los catálogos de frontend duplican reglas backend: deben mantenerse coordinados.

El tablero baja cuatro listados y calcula totales y agrupaciones, expedientes sin actuaciones, solicitudes vencidas y próximas a vencer. Un fallo no impide presentar el resto. No representa necesariamente el universo completo si una de las fuentes falló; la pantalla lo informa.

`BuscadorDePersona` resuelve referencias humanas por DNI en lugar de pedir IDs internos. `Identificador` aplica formato de DNI/CUIL/expediente. Los campos y diálogos encapsulan etiquetas, errores, foco y controles.

### Diseño y movimiento

- Portal holgado y backoffice compacto mediante tokens; en pantallas pequeñas vuelve la densidad apta para tacto.
- IBM Plex Sans para interfaz, Plex Mono para identificadores y Garamond para carátula de expediente.
- `BarraDeGoma` mueve una única marca de pestaña; `goma.js` calcula su animación.
- `useEmpujon` detecta navegación entre secciones, respeta enlaces externos y modificadores de teclado.
- `deslizarSeccion` usa View Transitions y maquetas intermedias (`fantasmasPortal/Admin`); sin soporte o con movimiento reducido navega directamente.
- `planSalto` determina tiempos y selección de hasta tres maquetas intermedias.
- `MenuMovil` administra fases de apertura/cierre, cortina, teclado, bloqueo de scroll y retorno del foco.
- `Esqueleto` mide un molde real, clasifica texto/superficies/controles y dibuja celdas en canvas. Espera al menos 650 ms en condiciones normales y barre hacia el contenido ajustando altura.
- `useUltimosDatos` recuerda la forma de contenido por clave; la memoria se limpia al cambiar identidad de sesión, sin borrarse por una simple renovación de token.

## 15. Configuración, persistencia y herramientas auxiliares

`application.yml` configura datasource, Hibernate `validate`, UTC JDBC, JSON estricto, tamaños multipart, RabbitMQ, almacenamiento y JWT. La aplicación no migra automáticamente las tablas al iniciar.

Hay valores predeterminados de conexión remota y secretos en configuración; se omiten sus valores en este documento. Deben distinguirse de las variables efectivas del proceso. Los SQL no se ejecutaron en esta revisión.

`db/01_schema.sql` expresa el esquema principal. `retool_schema.sql` combina creación y datos, incluye borrados de tablas y modificaciones posteriores; no es una migración inocua sobre una base existente. Los dos deben compararse contra entidades antes de asumir que cualquier script reproduce el estado actual.

Las restricciones SQL refuerzan unicidad, referencias, estados, porcentajes y principal vigente. No reemplazan las comprobaciones de negocio; algunas reglas entre varias filas dependen sólo del servicio y pueden tener carreras.

Colección Bruno, Insomnia y `openapi.json` son herramientas de contrato/prueba, pero no certifican por sí solas estar sincronizadas con todos los controllers. `generate_bruno.py` genera una colección; los scripts `frontend/migrate_retool.cjs` y `replace.cjs` son utilitarios auxiliares, no parte del renderizado normal de React.

## 16. Verificación y alcance

- Ejecutado Maven con Java 21: **118 tests, 0 fallos, 0 errores, 0 omitidos** según reportes Surefire.
- Intentado `npm test -- --reporter=dot`: no arrancó porque `vitest` no está disponible en las dependencias de esta copia.
- El frontend configura umbral de cobertura 85%, con exclusiones explícitas; no se midió la cobertura en esta revisión. El `pom.xml` no configura un umbral equivalente con JaCoCo.
- Se inspeccionaron documentación, rutas, servicios de dominio, seguridad, sesión/cliente HTTP, adaptadores, pantallas clave, componentes compartidos, configuración, esquema y pruebas. No se afirma haber ejercitado cada rama de cada componente.
- No se hicieron altas, bajas, envíos de prueba ni cambios contra la base/broker activos. No se verificó despliegue ni integración real de otros módulos. Los riesgos de ejecución/concurrencia señalados se deducen del código y requieren pruebas específicas para medir su impacto.

## 17. Prioridad para una futura corrección

1. Rutas públicas de eventos y resolución del destinatario por defecto.
2. Colisión de archivos y conexión de validación de archivos en backend.
3. Titularidad validada con ID y tipo de sujeto, no sólo ID.
4. Publicación/consumo transaccionales, IDs de eventos, despacho por tipo y reintentos verificables.
5. Permisos de aprobación, rol del login por email y revocación/estado al renovar.
6. Integridad de documentación cumplida y correlación con el trámite original.
7. Concurrencia de numeración, porcentajes y principales; sincronización de documentación y contratos.

No se aplicaron correcciones funcionales. Se agregó este mapa para apoyar el trabajo posterior.
