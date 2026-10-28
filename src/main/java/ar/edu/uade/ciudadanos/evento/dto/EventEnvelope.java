package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Plantilla común obligatoria definida por el módulo Core:
 *
 * eventId: UUID nuevo por evento, clave de idempotencia.
 * eventType: String(&lt;=120), camelCase.
 * eventVersion: String(&lt;=20), default "1.0".
 * occurredAt: ISO-8601 con offset obligatorio; admite occuredAt al recibir por compatibilidad.
 * sourceModule: String(&lt;=60), identificador del módulo (ej: "ciudadanos").
 * correlationId: UUID opcional (hilo del trámite).
 * causationId: UUID opcional (eventId que disparó este evento).
 * data: Object payload libre del módulo.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record EventEnvelope<T>(
        String eventId,

        String eventType,

        String eventVersion,

        @JsonProperty("occurredAt")
        @JsonAlias("occuredAt")
        String occuredAt,

        String sourceModule,

        String correlationId,

        String causationId,

        T data
) {
    public static final String DEFAULT_VERSION = "1.0";
    public static final String SOURCE_MODULE_CIUDADANOS = "ciudadanos";

    public EventEnvelope {
        if (eventVersion == null || eventVersion.isBlank()) {
            eventVersion = DEFAULT_VERSION;
        }
        if (sourceModule == null || sourceModule.isBlank()) {
            sourceModule = SOURCE_MODULE_CIUDADANOS;
        }
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = java.util.UUID.randomUUID().toString();
        }
    }

    /** Constructor estándar de Core sin correlationId ni causationId */
    public static <T> EventEnvelope<T> de(String eventId, String occuredAt, String eventType, String sourceModule, T data) {
        return new EventEnvelope<>(eventId, eventType, DEFAULT_VERSION, occuredAt, sourceModule, null, null, data);
    }

    /** Constructor estándar de Core con correlationId */
    public static <T> EventEnvelope<T> de(String eventId, String occuredAt, String eventType, String sourceModule, String correlationId, T data) {
        return new EventEnvelope<>(eventId, eventType, DEFAULT_VERSION, occuredAt, sourceModule, correlationId, null, data);
    }

    /** Constructor estándar de Core con correlationId y causationId */
    public static <T> EventEnvelope<T> de(String eventId, String occuredAt, String eventType, String sourceModule,
                                          String correlationId, String causationId, T data) {
        return new EventEnvelope<>(eventId, eventType, DEFAULT_VERSION, occuredAt, sourceModule, correlationId, causationId, data);
    }

    /** Sobrecarga para compatibilidad con firmas previas */
    public static <T> EventEnvelope<T> de(String eventId, String occuredAt, String eventType,
                                          ProducerInfo producer, String subject, T data) {
        String module = (producer != null && producer.moduleId() != null) ? producer.moduleId().toLowerCase() : SOURCE_MODULE_CIUDADANOS;
        if ("m1".equals(module)) {
            module = SOURCE_MODULE_CIUDADANOS;
        }
        return new EventEnvelope<>(eventId, eventType, DEFAULT_VERSION, occuredAt, module, null, null, data);
    }

    public static <T> EventEnvelope<T> de(String eventId, String occuredAt, String eventType,
                                          ProducerInfo producer, String subject, String correlationId, T data) {
        String module = (producer != null && producer.moduleId() != null) ? producer.moduleId().toLowerCase() : SOURCE_MODULE_CIUDADANOS;
        if ("m1".equals(module)) {
            module = SOURCE_MODULE_CIUDADANOS;
        }
        return new EventEnvelope<>(eventId, eventType, DEFAULT_VERSION, occuredAt, module, correlationId, null, data);
    }

    /** Método de conveniencia para compatibilidad con código que invoque occurredAt() */
    public String occurredAt() {
        return occuredAt;
    }

    /** Método de conveniencia para compatibilidad que devuelva el subject deducido */
    public String subject() {
        return sourceModule != null ? sourceModule : SOURCE_MODULE_CIUDADANOS;
    }
}
