package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CaseFileResolvedData(
        Long caseFileId,
        String caseFileNumber,
        String state,
        String resolution,
        String initiatingArea,
        String title,
        Long citizenId,
        Map<String, Object> externalReference,
        String resolutionSummary,
        UpdatedBy updatedBy,
        String statusChangedAt
) {
}
