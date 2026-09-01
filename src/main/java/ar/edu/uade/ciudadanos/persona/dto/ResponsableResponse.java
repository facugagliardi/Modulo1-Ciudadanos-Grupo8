package ar.edu.uade.ciudadanos.persona.dto;

import java.time.OffsetDateTime;

/** 200 de PATCH /relaciones/{id}/responsable. */
public record ResponsableResponse(Long relacionId, boolean esResponsable, OffsetDateTime actualizadoEn) {
}
