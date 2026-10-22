package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CitizenUpdatedData(
        Long citizenId,
        String updateType,
        Map<String, Object> details,
        UpdatedBy updatedBy
) {
}
