package ar.edu.uade.ciudadanos.evento.document;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/**
 * Patron outbox: todo evento que M1 publica se escribe primero aca, dentro de la
 * misma operacion de negocio, y recien despues lo toma el publisher.
 *
 * <p>El sobre sigue el diagrama; el contrato de eventos de ARCHITECTURE.md
 * (eventType, subject, correlationId, data) se serializa dentro de
 * {@code payload}: {@code aggregateType}/{@code aggregateId} son el subject
 * partido en dos.
 */
@Document(collection = "evento_outbox")
public class EventoOutbox {

    /** eventId del contrato: UUID de 36 caracteres. */
    @Id
    private String eventId;

    /** Entidad afectada: "citizens", "organizations", "representations", ... */
    @Indexed
    @Field("aggregate_type")
    private String aggregateType;

    /** Id de esa entidad. Junto con aggregateType forma el subject. */
    @Field("aggregate_id")
    private String aggregateId;

    /** citizenUpdated, organizationRegistered, representationGranted, ... */
    @Indexed
    @Field("event_type")
    private String eventType;

    /** Cuerpo completo del evento serializado como JSON. */
    @Field("payload")
    private String payload;

    @Indexed
    @Field("created_at")
    private Instant createdAt = Instant.now();

    /** Resumen corto, para poder leer la cola sin parsear el payload. */
    @Field("info")
    private String info;

    @Field("details")
    private String details;

    /**
     * Agregado sobre el diagrama: sin esto la coleccion no funciona como cola
     * (no habria forma de saber que quedo pendiente de publicar). Ver README.
     */
    @Indexed
    @Field("publicado")
    private boolean publicado;

    @Field("publicado_en")
    private Instant publicadoEn;

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getAggregateType() {
        return aggregateType;
    }

    public void setAggregateType(String aggregateType) {
        this.aggregateType = aggregateType;
    }

    public String getAggregateId() {
        return aggregateId;
    }

    public void setAggregateId(String aggregateId) {
        this.aggregateId = aggregateId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getInfo() {
        return info;
    }

    public void setInfo(String info) {
        this.info = info;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public boolean isPublicado() {
        return publicado;
    }

    public void setPublicado(boolean publicado) {
        this.publicado = publicado;
    }

    public Instant getPublicadoEn() {
        return publicadoEn;
    }

    public void setPublicadoEn(Instant publicadoEn) {
        this.publicadoEn = publicadoEn;
    }
}
