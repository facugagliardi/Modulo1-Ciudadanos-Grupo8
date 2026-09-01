package ar.edu.uade.ciudadanos.persona.dto;

import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import jakarta.validation.constraints.NotNull;

/** PATCH /ciudadanos/{id}/estado (RF-05). */
public record CambioEstadoCiudadanoRequest(
        @NotNull(message = "estado es obligatorio (ACTIVO, INACTIVO, FALLECIDO o BLOQUEADO)")
        EstadoCiudadano estado) {
}
