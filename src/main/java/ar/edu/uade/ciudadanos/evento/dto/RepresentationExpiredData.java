package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RepresentationExpiredData(
        Long representationId,
        Long personId,
        Long organizationId,
        Long cuit,
        String until,
        String status
) {
    public RepresentationExpiredData(Long representationId, Long personId, Long cuit,
                                     String until, String status) {
        this(representationId, personId, null, cuit, until, status);
    }
}
