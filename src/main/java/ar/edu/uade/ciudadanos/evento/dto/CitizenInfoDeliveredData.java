package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CitizenInfoDeliveredData(
        Long citizenId,
        String fullName,
        String documentId,
        String phone,
        String email,
        Map<String, Object> address
) {
}
