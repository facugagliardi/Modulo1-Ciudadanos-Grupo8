package ar.edu.uade.ciudadanos.evento.dto;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record ContextoDocumentacionSocial(String citizenId, String applicationId, String programId,
        String programEditionId, String correlationId, String fileId, String fileNumber,
        Map<String, Object> requirement, String applicationNumber, String notes) {
    public Map<String, Object> solicitud(String requestId, String status, String documentId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requestId", requestId);
        result.put("requirementId", requirement.get("requirementId"));
        result.put("documentType", requirement.get("type"));
        result.put("status", status);
        if (documentId != null) result.put("documentId", documentId);
        return result;
    }
    public SocialDocumentationDeliveredData entrega(String requestId, String documentId) {
        return new SocialDocumentationDeliveredData(citizenId, applicationId, programId,
                List.of(Map.of("fileId", fileId, "number", fileNumber, "initiatingArea", "SOCIAL_DEVELOPMENT",
                        "status", "IN_PROGRESS", "documentationRequests", List.of(solicitud(requestId, "COMPLETED", documentId)))),
                programEditionId);
    }
}
