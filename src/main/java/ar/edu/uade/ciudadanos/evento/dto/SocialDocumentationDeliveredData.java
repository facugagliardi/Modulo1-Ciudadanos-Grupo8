package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SocialDocumentationDeliveredData(
        String citizenId,
        String applicationId,
        String programId,
        List<Map<String, Object>> files
) {
    public SocialDocumentationDeliveredData(UUID citizenUuid, String applicationId, String programId, List<Map<String, Object>> files) {
        this(citizenUuid != null ? citizenUuid.toString() : null, applicationId, programId, files);
    }

    public SocialDocumentationDeliveredData(Long citizenId, String applicationId, String programId, List<Map<String, Object>> files) {
        this(citizenId != null ? String.valueOf(citizenId) : null, applicationId, programId, files);
    }
}
