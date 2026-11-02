# Comunicaciones para la demo de v1.0-testing

Estado preparado el 02/11/2026. Publicar código en main y crear el tag no aplica
migraciones a la base compartida ni garantiza que Render u otros módulos hayan
desplegado esa revisión. Este documento distingue capacidad local de una prueba
conjunta por Core. No se declara una E2E remota sin recibo y efecto en destino.

## Lista general

| Módulo | Qué soporta M1 | Qué puede demostrarse | Qué falta para comunicación real compartida |
| --- | --- | --- | --- |
| **M2 - Atención Ciudadana** | Recepción de `ticketCreated`, `ticketUpdated` y `updateTicketStatus`; seguimiento del vecino y datos de identidad/JWT según contrato. | Prueba local con eventos sintéticos y seguimiento en portal. En Render se documentó login/consulta; no una E2E completa con M2. | Consumidor compartido conectado, evento real de M2, ruteo Core y comprobación del mismo eventId en M1. Validación de cuentas/JWT desde M2. |
| **M3 - Obras Públicas** | Recepción de `publicWorksProjectApproved` y `publicWorksProjectCompleted`; expediente por proyecto, incluso institucional; duplicados, orden temporal y separación del estado de obra/administrativo. | Disponible en el código de esta release para ensayo local con contrato M3. La respuesta `caseFileResolved` tiene schema/publicador, pero no disparador automático. | Migración 05 y despliegue del backend compartido; evento real Obras/Core y comprobación de expediente. Cerrar acuerdo bilateral de dictamen y momento de respuesta para el circuito de vuelta. |
| **M4 - Habilitaciones** | Existen datos de identidad, organizaciones y eventos generales de M1. | Funciones propias de M1 y publicación local de eventos generales; no un circuito M4 específico validado. | Contrato/consumo específico y prueba conjunta no acreditados por este cierre. No prometer ida y vuelta con M4. |
| **M5 - Rentas** | Recepción de `exemptionRequested`, `updateExemptionStatus`, `paymentPlanRequested`, `updatePaymentPlanStatus`; seguimiento por ciudadano, deduplicación, orden y correlación. | Localmente, proyección y regresiones. Core informó cuatro relaciones activas y schemas asociados; eso prepara el intercambio. | Único consumidor operativo; publicación real con UUID autorizado; cotejar outbox M5, ruteo Core, recibo M1 y seguimiento. No hay resultado E2E compartido registrado aquí. |
| **M6 - Ambiente** | Directorio `/integraciones/v1`: ciudadano UUID, organización UUID/CUIT y equivalencia actorType+sub a actorId. Autorización local `CONSULTA_INTERMODULO`. | Consultas locales con un usuario autorizado de pruebas. | Migración 06 y despliegue; acuerdo de autenticación máquina a máquina. M1 no valida todavía module-token RS256 entrante. No disponible como integración de máquina confirmada. |
| **M7 - Tránsito** | Eventos/identidad generales, sin flujo específico de Tránsito probado en este cierre. | Funciones locales de M1; no afirmar comunicación funcional con M7. | Contrato específico, suscripción y E2E conjunta por confirmar. |
| **M8 - Desarrollo Social** | `socialDocumentationRequested` genera solicitudes vinculadas a ciudadano y contexto social; `socialDocumentationDelivered` conserva correlación/contexto. Outbox y pruebas PostgreSQL. | Flujo contractual local de documentación. La entrega interna de documentos también se prueba con E2E, pero esa solicitud INTERNA no equivale a un pedido real de M8. | Confirmar suscripción M8/Core, consumidor compartido, revisión desplegada y prueba real pedido-entrega-recibo de M8. |
| **Core** | Publicador, listener, outbox, IDs/correlación y contratos. Se documentó token/mapa HTTP 200 y AMQP TLS con validación de certificado/hostname y acceso pasivo a q.ciudadanos desde la PC autorizada. | Broker local con envío real y cola receptora de prueba. Acceso compartido documentado no equivale a recepción de negocio. | Confirmar IP de salida, credenciales privadas vigentes y único consumidor conectado; validar cada intercambio. No volver a registrar relaciones ya confirmadas. |

**Conclusión práctica:** para una demo autónoma, están preparados los circuitos
locales M2/M5, recepción M3 y documentación M8; el directorio M6 se puede probar
localmente con autorización de usuario. **No hay en este cierre un módulo remoto
declarado listo de punta a punta con evidencia conjunta.** M2/M5 tienen mayor
preparación de contratos y relaciones compartidas, pero necesitan ese ensayo.

## Qué mostrar detrás del frontend

Usar frontend y una vista de apoyo de eventos/outbox/RabbitMQ. Seguir el mismo
`eventId` y `correlationId` desde la operación hasta el recibo del destino.
Un HTTP 200/201 o publisher confirm sólo no prueba procesamiento del receptor.

- Compose local: `muni.inbox` y `q.core.testing` permiten mostrar la salida real
  de M1 a un receptor local de prueba. Explicitar ese alcance.
- M2/M5 entrante: publicar en el entorno de testing autorizado un evento de
  contrato y mostrar el trámite actualizado en el portal.
- M3 entrante: aprobación crea/vincula expediente; finalización modifica el
  estado de obra. No resuelve automáticamente el trámite administrativo.
- M8: distinguir el pedido de origen EVENTO del pedido interno de la UI.
- Entorno compartido: sólo decir “lo recibió/procesó el otro módulo” al mostrar
  su evidencia, no por ver que M1 guardó el evento emitido.

No abrir un segundo consumidor de la cola compartida sin coordinación: puede
competir con el backend. No purgar colas ni emitir ejemplos al ambiente
compartido como sustituto de una prueba acordada.

## Preparación de bases y despliegue

El Compose con base nueva incluye el esquema actualizado. Para bases existentes,
revisar/aplicar las migraciones reejecutables en orden antes del nuevo backend:
`03_integracion_m2_m5.sql`, `04_integracion_social_segura.sql` si corresponde,
`05_integracion_obras.sql` y `06_consultas_m6.sql`. Confirmar los nombres y el
estado real contra los scripts de `db/`; nunca usar reconstrucción destructiva
para actualizar una base compartida. En este cierre de Git no se ejecutan SQL
remotos ni se cambian credenciales/suscripciones del Core.

Fuentes: [M2/M5](INTEGRACION_M2_M5.md), [M3](INTEGRACION_M3.md),
[M6](INTEGRACION_M6.md), README, dispatcher, publicador/outbox y pruebas de
contrato. Las confirmaciones históricas se conservan con su origen; comprobar
disponibilidad en el ensayo antes de prometerla para el aula.
