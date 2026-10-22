package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OrganizationInfoDeliveredData(
        Long organizationId,
        Long cuit,
        String legalName,
        String tradeName,
        String taxId,
        String status
) {
    public OrganizationInfoDeliveredData(Long cuit, String legalName, String tradeName, String taxId, String status) {
        this(null, cuit, legalName, tradeName, taxId, status);
    }
}
