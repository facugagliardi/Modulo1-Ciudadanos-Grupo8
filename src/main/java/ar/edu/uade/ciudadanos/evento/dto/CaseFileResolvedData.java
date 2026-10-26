package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CaseFileResolvedData(
        Long caseFileId,
        String caseFileNumber,
        String state,
        String resolution,
        String initiatingArea,
        String title,
        String citizenId,
        Map<String, Object> externalReference,
        String resolutionSummary,
        UpdatedBy updatedBy,
        String statusChangedAt
) {
    public CaseFileResolvedData(Long caseFileId, String caseFileNumber, String state, String resolution,
                                String initiatingArea, String title, Long citizenId,
                                Map<String, Object> externalReference, String resolutionSummary,
                                UpdatedBy updatedBy, String statusChangedAt) {
        this(caseFileId, caseFileNumber, state, resolution, initiatingArea, title,
                citizenId != null ? String.valueOf(citizenId) : null,
                externalReference, resolutionSummary, updatedBy, statusChangedAt);
    }

    public CaseFileResolvedData(Long caseFileId, String caseFileNumber, String state, String resolution,
                                String initiatingArea, String title, UUID citizenUuid,
                                Map<String, Object> externalReference, String resolutionSummary,
                                UpdatedBy updatedBy, String statusChangedAt) {
        this(caseFileId, caseFileNumber, state, resolution, initiatingArea, title,
                citizenUuid != null ? citizenUuid.toString() : null,
                externalReference, resolutionSummary, updatedBy, statusChangedAt);
    }
}
