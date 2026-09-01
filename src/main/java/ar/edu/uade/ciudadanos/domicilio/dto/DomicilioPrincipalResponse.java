package ar.edu.uade.ciudadanos.domicilio.dto;

import java.time.OffsetDateTime;

/** 200 de PATCH /domicilios/{id}/principal (RF-10, RF-12). */
public record DomicilioPrincipalResponse(
        Long propiedadId, Long personaId, boolean esPrincipal, OffsetDateTime actualizadoEn) {
}
