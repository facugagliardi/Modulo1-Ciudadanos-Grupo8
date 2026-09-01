package ar.edu.uade.ciudadanos.evento.document;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/**
 * Registro de idempotencia del consumo. El eventId es la PK, asi que reinsertar
 * un evento ya procesado falla con duplicate key: eso ES el chequeo.
 */
@Document(collection = "evento_procesado")
public class EventoProcesado {

    /** eventId del evento consumido: UUID de 36 caracteres. */
    @Id
    private String eventId;

    @Field("consumer_id")
    private String consumerId;

    @Field("processed_at")
    private Instant processedAt = Instant.now();

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getConsumerId() {
        return consumerId;
    }

    public void setConsumerId(String consumerId) {
        this.consumerId = consumerId;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(Instant processedAt) {
        this.processedAt = processedAt;
    }
}
