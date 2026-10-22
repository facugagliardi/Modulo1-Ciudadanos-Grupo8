package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OrganizationRegisteredData(
        Long organizationId,
        Long cuit,
        String taxId,
        String legalName,
        String tradeName,
        String type,
        String status,
        Map<String, Object> holder
) {
    public OrganizationRegisteredData(Long cuit, String taxId, String legalName, String tradeName,
                                      String type, String status, Map<String, Object> holder) {
        this(null, cuit, taxId, legalName, tradeName, type, status, holder);
    }
}
