package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SocialDocumentationRequestedEvent(
        String eventId,
        String eventType,
        String eventVersion,
        @JsonProperty("occurredAt")
        @JsonAlias({"occuredAt", "timestamp"})
        String occuredAt,
        String sourceModule,
        String correlationId,
        String causationId,
        @JsonProperty("data")
        @JsonAlias({"payload", "data"})
        SocialDocumentationRequestedPayload payload
) {
    public SocialDocumentationRequestedEvent(String eventId, String eventType, String timestamp,
                                             String sourceModule, SocialDocumentationRequestedPayload payload) {
        this(eventId, eventType, "1.0", timestamp, sourceModule, null, null, payload);
    }

    public String timestamp() {
        return occuredAt;
    }
}
