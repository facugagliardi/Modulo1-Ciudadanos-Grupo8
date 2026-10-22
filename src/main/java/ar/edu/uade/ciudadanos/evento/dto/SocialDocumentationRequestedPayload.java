package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SocialDocumentationRequestedPayload(
        String citizenId,
        String applicationId,
        String programId,
        List<Map<String, Object>> requiredDocuments,
        String deadline,
        String notes
) {
}
