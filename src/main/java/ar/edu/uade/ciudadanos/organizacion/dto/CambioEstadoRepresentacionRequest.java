package ar.edu.uade.ciudadanos.organizacion.dto;

import ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion;
import jakarta.validation.constraints.NotNull;

/** PATCH /representaciones/{id}/estado (RF-21). */
public record CambioEstadoRepresentacionRequest(
        @NotNull(message = "estado es obligatorio (VIGENTE, VENCIDA o REVOCADA)")
        EstadoRepresentacion estado) {
}
