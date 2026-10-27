package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RepresentationGrantedData(
        Long representationId,
        Long personId,
        Long organizationId,
        Long cuit,
        String scope,
        String from,
        String status
) {
    public RepresentationGrantedData(Long representationId, Long personId, Long cuit,
                                     String scope, String from, String status) {
        this(representationId, personId, null, cuit, scope, from, status);
    }
}
