package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SocialDocumentationRequestedEvent(
        String eventId,
        String eventType,
        String timestamp,
        String sourceModule,
        SocialDocumentationRequestedPayload payload
) {
}
