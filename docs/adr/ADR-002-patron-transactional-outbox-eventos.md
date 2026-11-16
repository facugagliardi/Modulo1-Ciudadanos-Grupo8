# ADR-002: Implementación del Patrón Transactional Outbox para Publicación Confiable de Eventos

## Estado
Aceptado

## Fecha
2026-11-16

## Contexto y Problemática
El Módulo 1 (Ciudadanos) actúa como el maestro de identidades del ecosistema municipal y debe notificar eventos de dominio (tales como `citizenUpdated`, `caseFileResolved` u `organizationRegistered`) a otros módulos del sistema (M2 Atención Ciudadana, M3 Obras, M5 Rentas, M6 Ambiente, M8 Desarrollo Social) a través del broker de mensajería RabbitMQ gestionado por Core.

En una arquitectura dirigida por eventos, actualizar la base de datos relacional (PostgreSQL) y publicar un mensaje en el broker mediante llamadas directas secuenciales introduce el problema del **Dual-Write**:
- Si la transacción en PostgreSQL se confirma pero la llamada a RabbitMQ falla por latencia o caída del broker, el evento se pierde definitivamente.
- Si el mensaje se publica en el broker pero la transacción de base de datos falla al realizar el `commit`, se emite un evento fantasma inexistente.
- El uso de transacciones distribuidas (Two-Phase Commit / XA) degrada severamente la disponibilidad, latencia y escalabilidad, acoplando el rendimiento de la aplicación a la infraestructura de mensajería externa.

## Decisión
Se adopta el patrón de integración arquitectural **Transactional Outbox**:

1. **Tabla Outbox en PostgreSQL:** Se implementa la entidad `EventOutbox` (`ar.edu.uade.ciudadanos.evento.EventOutbox`) mapeada a la tabla `event_outbox`. Dicha tabla almacena los metadatos y carga útil del evento (`eventId`, `tipo`, `moduloOrigen`, `fecha`, `adjuntos`/payload).

2. **Atomicidad Local:** Cuando un servicio de negocio ejecuta una mutación de datos (por ejemplo, el alta de un ciudadano o la resolución de un expediente), persiste el evento correspondiente en `event_outbox` dentro de la **misma transacción ACID** local gestionada por Spring (`@Transactional`). Si la operación de negocio falla, el evento se descarta automáticamente; si tiene éxito, el evento queda garantizado en disco.

3. **Publicación y Desacoplamiento:** El servicio `EventPublisherService` (`ar.edu.uade.ciudadanos.evento.EventPublisherService`) gestiona la emisión hacia el broker. En caso de fallas transitorias de red con Core o indisponibilidad temporal del broker RabbitMQ, la transacción de usuario no se ve afectada y los eventos permanecen custodiados en PostgreSQL para su reintento o auditoría.

4. **Trazabilidad e Idempotencia:** Cada evento se genera con un identificador único canónico RFC 4122 (`eventId` de tipo UUID). Esto permite a los módulos consumidores deduplicar mensajes recibidos, soportando de forma natural una garantía de entrega *at-least-once*.

## Consecuencias

### Positivas
- **Consistencia Garantizada:** Elimina inconsistencias entre el estado persistido en el backend de M1 y los eventos notificados al ecosistema.
- **Resiliencia Operativa:** La disponibilidad de las operaciones de negocio locales no depende de la conectividad en tiempo real con el broker externo de Core.
- **Trazabilidad y Auditoría:** `event_outbox` actúa como un registro histórico inmutable de todos los eventos generados por el módulo.

### Negativas / Compensaciones
- Sobrecarga de almacenamiento adicional en PostgreSQL por la persistencia de los sobres de eventos.
- Los módulos consumidores deben implementar procesamiento idempotente basándose en el `eventId` para mitigar posibles duplicados ante reintentos.
