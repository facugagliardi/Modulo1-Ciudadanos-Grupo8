package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CitizenInfoDeliveredData(
        String citizenId,
        String fullName,
        String documentId,
        String phone,
        String email,
        Map<String, Object> address
) {
    public CitizenInfoDeliveredData(UUID citizenUuid, String fullName, String documentId, String phone, String email, Map<String, Object> address) {
        this(citizenUuid != null ? citizenUuid.toString() : null, fullName, documentId, phone, email, address);
    }

    public CitizenInfoDeliveredData(Long citizenId, String fullName, String documentId, String phone, String email, Map<String, Object> address) {
        this(citizenId != null ? String.valueOf(citizenId) : null, fullName, documentId, phone, email, address);
    }
}
