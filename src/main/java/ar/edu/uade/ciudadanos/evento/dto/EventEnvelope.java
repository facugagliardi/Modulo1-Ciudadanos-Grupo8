package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Formato comun de evento asincronico obligatorio segun la seccion 8 del TP.
 *
 * @param <T> Tipo de datos especificos de la propiedad data.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record EventEnvelope<T>(
        String eventId,
        String occurredAt,
        String eventType,
        ProducerInfo producer,
        String subject,
        String correlationId,
        T data
) {
    public static <T> EventEnvelope<T> de(String eventId, String occurredAt, String eventType,
                                          ProducerInfo producer, String subject, T data) {
        return new EventEnvelope<>(eventId, occurredAt, eventType, producer, subject, null, data);
    }

    public static <T> EventEnvelope<T> de(String eventId, String occurredAt, String eventType,
                                          ProducerInfo producer, String subject, String correlationId, T data) {
        return new EventEnvelope<>(eventId, occurredAt, eventType, producer, subject, correlationId, data);
    }
}
