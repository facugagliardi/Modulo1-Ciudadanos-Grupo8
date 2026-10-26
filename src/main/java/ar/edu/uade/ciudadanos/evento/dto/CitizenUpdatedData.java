package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CitizenUpdatedData(
        String citizenId,
        String updateType,
        Map<String, Object> details,
        UpdatedBy updatedBy
) {
    public CitizenUpdatedData(UUID citizenUuid, String updateType, Map<String, Object> details, UpdatedBy updatedBy) {
        this(citizenUuid != null ? citizenUuid.toString() : null, updateType, details, updatedBy);
    }

    public CitizenUpdatedData(Long citizenId, String updateType, Map<String, Object> details, UpdatedBy updatedBy) {
        this(citizenId != null ? String.valueOf(citizenId) : null, updateType, details, updatedBy);
    }
}
